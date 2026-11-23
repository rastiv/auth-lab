import { env, waitUntil } from "cloudflare:workers";
import type { createAuthMiddleware } from "better-auth/api";
import { and, eq, lt } from "drizzle-orm";
import { METHOD_LABELS } from "../shared/auth-events";
import { db } from "./db";
import { knownDevice } from "./db/schema";
import { newDeviceEmail, sendEmail } from "./email";
import { describeRequest } from "./request-info";

type AuthMiddlewareContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

// Chrome caps cookie lifetimes at 400 days; a token can't outlive its cookie.
const KNOWN_DEVICE_DAYS = 400;

const PROVIDERS: Record<string, string> = { google: "Google", github: "GitHub" };

/**
 * Called on every successful sign-in. Gives the browser a random token and
 * emails the user when it's new to their account. An account's first browser
 * is remembered silently: that's the sign-up, not news. So is everyone's next
 * sign-in after this feature shipped.
 */
export function rememberDevice(
  ctx: AuthMiddlewareContext,
  user: { id: string; email: string; newDeviceAlerts?: boolean | null },
  method: string,
) {
  const cookie = ctx.context.createAuthCookie("known_device", {
    maxAge: KNOWN_DEVICE_DAYS * 24 * 60 * 60,
  });
  const token = ctx.getCookie(cookie.name) || randomToken();
  // Set on every sign-in, so a browser that keeps being used never expires.
  ctx.setCookie(cookie.name, token, cookie.attributes);

  const request = ctx.request;
  const check = async () => {
    const tokenHash = await sha256(token);
    const known = await db
      .select({ tokenHash: knownDevice.tokenHash })
      .from(knownDevice)
      .where(eq(knownDevice.userId, user.id));
    if (known.some((device) => device.tokenHash === tokenHash)) {
      await db
        .update(knownDevice)
        .set({ lastSeenAt: new Date() })
        .where(and(eq(knownDevice.userId, user.id), eq(knownDevice.tokenHash, tokenHash)));
      return;
    }
    // Remembered even with alerts off, so turning them back on doesn't flag
    // every browser already in use.
    await db.insert(knownDevice).values({ userId: user.id, tokenHash });
    if (known.length === 0 || user.newDeviceAlerts === false) return;

    const { device, city, country, network } = describeRequest(request);
    const place = [city, country].filter(Boolean).join(", ");
    await sendEmail({
      to: user.email,
      ...newDeviceEmail(env.BETTER_AUTH_URL, {
        method: METHOD_LABELS[method] ?? method,
        device,
        location: [place, network].filter(Boolean).join(" · "),
        when: new Date(),
        provider: PROVIDERS[method],
      }),
    });
  };
  // After the response: sign-in isn't slower, and a failure can't fail it.
  waitUntil(check().catch(console.error));
}

/** Run by the daily cron trigger: the cookie has expired by then anyway. */
export async function deleteStaleKnownDevices() {
  const cutoff = new Date(Date.now() - KNOWN_DEVICE_DAYS * 24 * 60 * 60 * 1000);
  await db.delete(knownDevice).where(lt(knownDevice.lastSeenAt, cutoff));
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
