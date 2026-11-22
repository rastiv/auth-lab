import { waitUntil } from "cloudflare:workers";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { lt } from "drizzle-orm";
import {
  AUTH_EVENT_RETENTION_DAYS,
  type AuthEventMethod,
  type AuthEventType,
} from "../shared/auth-events";
import { describeDevice } from "../shared/device";
import { db } from "./db";
import { authEvent } from "./db/schema";

type AuthMiddlewareContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/**
 * Logs an event after the response: sign-in isn't slower, and a failed write
 * can't fail it. Location comes from Cloudflare (request.cf), no GeoIP lookup.
 */
export function recordAuthEvent(
  userId: string | Promise<string | undefined>,
  type: AuthEventType,
  method: AuthEventMethod | null,
  request: Request | undefined,
) {
  const cf = (request as { cf?: IncomingRequestCfProperties } | undefined)?.cf;
  const write = async () => {
    const id = await userId;
    if (!id) return;
    await db.insert(authEvent).values({
      userId: id,
      type,
      method,
      device: describeDevice(request?.headers.get("user-agent")),
      city: cf?.city ?? null,
      country: cf?.country ?? null,
      network: cf?.asOrganization ?? null,
    });
  };
  waitUntil(write().catch(console.error));
}

/** Run by the daily cron trigger. */
export async function deleteOldAuthEvents() {
  const cutoff = new Date(Date.now() - AUTH_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await db.delete(authEvent).where(lt(authEvent.createdAt, cutoff));
}

const TWO_FACTOR_METHODS: Record<string, string> = {
  "/two-factor/verify-totp": "app",
  "/two-factor/verify-otp": "email-code",
  "/two-factor/verify-backup-code": "backup-code",
};

const REVOKE_PATHS: Record<string, string> = {
  "/revoke-session": "one",
  "/revoke-other-sessions": "others",
};

// The pending sign-in's signed cookie. Only a sign-in challenge has it;
// setting up 2FA while signed in doesn't.
async function twoFactorChallenge(ctx: AuthMiddlewareContext) {
  const cookie = ctx.context.createAuthCookie("two_factor");
  const identifier = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
  return identifier || undefined;
}

// After a wrong code the challenge's verification row still holds the user ID
// (a right code consumes it, but then there's a new session to read it from).
async function challengeUserId(ctx: AuthMiddlewareContext, identifier: string) {
  const pending = await ctx.context.internalAdapter.findVerificationValue(identifier);
  return pending?.value;
}

function signInMethod(ctx: AuthMiddlewareContext): string | undefined {
  const path = ctx.path;
  if (path === "/sign-in/email") {
    // With 2FA on, a session here means a trusted device skipped the code.
    return ctx.context.newSession?.user.twoFactorEnabled ? "password+trusted-device" : "password";
  }
  if (path.startsWith("/callback/")) return ctx.params?.id;
  if (path.startsWith("/magic-link/verify")) return "magic-link";
  if (path === "/verify-email") return "email-link";
  return undefined;
}

/**
 * The security log behind "Recent activity". A plugin rather than
 * `hooks.after`: plugin hooks run after the app's and in plugin order, so
 * listed after twoFactor it sees a password sign-in that still needs a code as
 * what it is (no session yet), not as a sign-in.
 */
export const authEvents = () =>
  ({
    id: "auth-events",
    init: (authContext) => ({
      options: {
        databaseHooks: {
          account: {
            create: {
              // Every sign-in method is a row in the account table; the first
              // one is the sign-up.
              after: async (account, ctx) => {
                const accounts = await authContext.internalAdapter.findAccounts(account.userId);
                const method = account.providerId === "credential" ? "password" : account.providerId;
                const type = accounts.length === 1 ? "account_created" : "method_added";
                recordAuthEvent(account.userId, type, method, ctx?.request);
              },
            },
          },
        },
      },
    }),
    hooks: {
      before: [
        {
          // After sign-out the session is gone, so look it up first.
          matcher: (ctx) => ctx.path === "/sign-out",
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx);
            if (session) recordAuthEvent(session.user.id, "sign_out", null, ctx.request);
          }),
        },
      ],
      after: [
        {
          matcher: () => true,
          handler: createAuthMiddleware(async (ctx) => {
            const { path, request } = ctx;
            const returned = ctx.context.returned;
            const failed = returned instanceof APIError;
            const errorCode = failed ? returned.body?.code : undefined;
            const sessionUserId = ctx.context.session?.user.id;

            const newSession = ctx.context.newSession;
            const method = signInMethod(ctx);
            if (method && newSession) {
              return recordAuthEvent(newSession.user.id, "sign_in", method, request);
            }

            if (path === "/sign-in/email" && errorCode === "INVALID_EMAIL_OR_PASSWORD") {
              // Only existing accounts: never store an address someone just typed.
              const email = String((ctx.body as { email?: unknown })?.email ?? "");
              const found = ctx.context.internalAdapter.findUserByEmail(email);
              return recordAuthEvent(
                found.then((result) => result?.user.id),
                "sign_in_failed",
                "password",
                request,
              );
            }

            const twoFactorMethod = TWO_FACTOR_METHODS[path];
            if (twoFactorMethod) {
              const challenge = await twoFactorChallenge(ctx);
              if (challenge && failed) {
                // A wrong code means the password was right: worth knowing.
                const userId = challengeUserId(ctx, challenge);
                return recordAuthEvent(userId, "two_factor_failed", twoFactorMethod, request);
              }
              if (challenge && newSession) {
                const via = `password+${twoFactorMethod}`;
                return recordAuthEvent(newSession.user.id, "sign_in", via, request);
              }
              // No challenge: a signed-in user confirming a new authenticator app.
              const userId = newSession?.user.id ?? sessionUserId;
              if (!challenge && !failed && path === "/two-factor/verify-totp" && userId) {
                return recordAuthEvent(userId, "two_factor_enabled", "app", request);
              }
              return;
            }

            if (failed || !sessionUserId) return;
            if (path === "/two-factor/enable" && (returned as { method?: string }).method === "otp") {
              recordAuthEvent(sessionUserId, "two_factor_enabled", "email-code", request);
            } else if (path === "/two-factor/disable") {
              recordAuthEvent(sessionUserId, "two_factor_disabled", null, request);
            } else if (path === "/change-password") {
              recordAuthEvent(sessionUserId, "password_changed", null, request);
            } else if (path === "/unlink-account") {
              const providerId = String((ctx.body as { providerId?: unknown })?.providerId ?? "");
              const removed = providerId === "credential" ? "password" : providerId;
              recordAuthEvent(sessionUserId, "method_removed", removed, request);
            } else if (REVOKE_PATHS[path]) {
              recordAuthEvent(sessionUserId, "sessions_revoked", REVOKE_PATHS[path], request);
            }
          }),
        },
      ],
    },
  }) satisfies BetterAuthPlugin;
