import { env } from "cloudflare:workers";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
// The minimal build omits Kysely; Drizzle is our only database layer.
import { betterAuth } from "better-auth/minimal";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: {
    enabled: true,
    password: { hash: hashPassword, verify: verifyPassword },
  },
  advanced: {
    // Workers don't set X-Forwarded-For; rate limiting needs the real client IP.
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
  },
});
