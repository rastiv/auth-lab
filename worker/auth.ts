import { env, waitUntil } from "cloudflare:workers";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
// The minimal build omits Kysely; Drizzle is our only database layer.
import { betterAuth } from "better-auth/minimal";
import { captcha } from "better-auth/plugins/captcha";
import { magicLink } from "better-auth/plugins/magic-link";
import { twoFactor } from "better-auth/plugins/two-factor";
import { authEvents, recordAuthEvent } from "./auth-events";
import { db } from "./db";
import {
  magicLinkEmail,
  passwordChangedEmail,
  resetPasswordEmail,
  sendEmail,
  twoFactorCodeEmail,
  verificationEmail,
} from "./email";
import { hashPassword, verifyPassword } from "./password";
import { hasAuthenticatorApp } from "./two-factor";

// If someone else changed the password, this is how the owner finds out.
function notifyPasswordChanged(email: string) {
  // After the response, and a failed notification must not fail the change.
  waitUntil(
    sendEmail({ to: email, ...passwordChangedEmail(env.BETTER_AUTH_URL) }).catch(console.error),
  );
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    password: { hash: hashPassword, verify: verifyPassword },
    // Better-Auth runs this in the background (see backgroundTasks), so known
    // and unknown addresses get the same response in the same time.
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({ to: user.email, ...resetPasswordEmail(url) });
    },
    // A reset usually means the password may be compromised: sign out everywhere.
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user }, request) => {
      notifyPasswordChanged(user.email);
      recordAuthEvent(user.id, "password_reset", null, request);
    },
  },
  hooks: {
    // Better-Auth has no callback for /change-password, so check every response.
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/change-password") return;
      // A failed change returns an error instead, which has no user.
      const returned = ctx.context.returned as { user?: { email: string } } | undefined;
      if (returned?.user) notifyPasswordChanged(returned.user.email);
    }),
  },
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      // Otherwise GitHub silently uses whichever account is signed in on
      // github.com, which may not be the one you meant.
      prompt: "select_account",
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // Let people pick an account instead of silently reusing the last one.
      prompt: "select_account",
    },
  },
  account: {
    // We only need the provider tokens once, to read the profile at sign-in;
    // encrypt the copies kept in the account table anyway.
    encryptOAuthTokens: true,
    // Implicit linking (same email, different method) stays on, with
    // Better-Auth's defaults: only when the provider vouches for the email and
    // the local account's email is verified, so an attacker can't pre-register
    // someone's address and inherit their Google or GitHub sign-in.
  },
  databaseHooks: {
    account: {
      // Google's ID token is only needed to identify you during sign-in, but
      // Better-Auth stores it unencrypted. Drop it: data we don't keep can't leak.
      // On update this also clears tokens stored before this hook existed.
      create: { before: async (account) => ({ data: { ...account, idToken: null } }) },
      update: { before: async (account) => ({ data: { ...account, idToken: null } }) },
    },
  },
  verification: {
    // Reset tokens are stored as-is by default; hash them like magic link
    // tokens, so a leaked database can't be used to take over accounts.
    storeIdentifier: { default: "plain", overrides: { "reset-password:": "hashed" } },
  },
  emailVerification: {
    sendOnSignUp: true,
    // An unverified sign-in attempt sends a fresh link instead of a dead end.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({ to: user.email, ...verificationEmail(url) });
    },
  },
  plugins: [
    // Two methods, one per account: an authenticator app (TOTP) or a code by
    // email (weaker: whoever controls the inbox has both factors).
    // TOTP secrets and backup codes are stored encrypted with BETTER_AUTH_SECRET.
    // Only password sign-in asks for a code: Google/GitHub have their own 2FA,
    // and magic links bypass it (a known trade-off, explained in the UI).
    twoFactor({
      // The account name shown in authenticator apps.
      issuer: "auth-lab",
      otpOptions: {
        // Minutes. Inboxes can be slow; same lifetime as a magic link.
        period: 5,
        // Only a hash is stored, like the other email tokens.
        storeOTP: "hashed",
        // Runs in the background, so the response is the same either way.
        sendOTP: async ({ user, otp }) => {
          // Better-Auth offers email codes to every 2FA account. With the
          // password and the inbox, an attacker could then skip the
          // authenticator app, so accounts that have one never get a code.
          if (await hasAuthenticatorApp(user.id)) return;
          await sendEmail({ to: user.email, ...twoFactorCodeEmail(otp) });
        },
      },
    }),
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: env.TURNSTILE_SECRET_KEY,
      // Every endpoint that sends an email (spam, Resend quota, domain
      // reputation) or runs PBKDF2 (CPU limit, password guessing).
      endpoints: [
        "/sign-up/email",
        "/sign-in/email",
        "/sign-in/magic-link",
        "/request-password-reset",
      ],
    }),
    magicLink({
      // Only a hash is stored, so a leaked database can't be used to sign in.
      storeToken: "hashed",
      // Awaited (unlike verification emails): the response is the same for
      // known and unknown addresses, so its timing reveals nothing.
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({ to: email, ...magicLinkEmail(url) });
      },
    }),
    // Must stay after twoFactor: see worker/auth-events.ts.
    authEvents(),
  ],
  advanced: {
    // Workers don't set X-Forwarded-For; rate limiting needs the real client IP.
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    // Emails are sent after the response: faster, and response time no longer
    // reveals whether an address exists. waitUntil keeps the Worker alive for it.
    backgroundTasks: { handler: waitUntil },
  },
});
