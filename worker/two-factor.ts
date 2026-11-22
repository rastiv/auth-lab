import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { twoFactor } from "./db/schema";

// Better-Auth keeps no "method" column: an account uses an authenticator app
// when it has a confirmed TOTP secret, and email codes when 2FA is on without one.
export async function hasAuthenticatorApp(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: twoFactor.id })
    .from(twoFactor)
    .where(and(eq(twoFactor.userId, userId), eq(twoFactor.verified, true)))
    .limit(1);
  return row !== undefined;
}
