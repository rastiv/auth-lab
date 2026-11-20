import { env, waitUntil } from "cloudflare:workers";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
// The minimal build omits Kysely; Drizzle is our only database layer.
import { betterAuth } from "better-auth/minimal";
import { captcha } from "better-auth/plugins/captcha";
import { magicLink } from "better-auth/plugins/magic-link";
import { db } from "./db";
import { magicLinkEmail, resetPasswordEmail, sendEmail, verificationEmail } from "./email";
import { hashPassword, verifyPassword } from "./password";

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
  },
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
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
  ],
  advanced: {
    // Workers don't set X-Forwarded-For; rate limiting needs the real client IP.
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    // Emails are sent after the response: faster, and response time no longer
    // reveals whether an address exists. waitUntil keeps the Worker alive for it.
    backgroundTasks: { handler: waitUntil },
  },
});
