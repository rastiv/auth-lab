import { env, waitUntil } from "cloudflare:workers";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
// The minimal build omits Kysely; Drizzle is our only database layer.
import { betterAuth } from "better-auth/minimal";
import { magicLink } from "better-auth/plugins/magic-link";
import { db } from "./db";
import { magicLinkEmail, sendEmail, verificationEmail } from "./email";
import { hashPassword, verifyPassword } from "./password";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    password: { hash: hashPassword, verify: verifyPassword },
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
