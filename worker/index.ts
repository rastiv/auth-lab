import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AuthEvent } from "../shared/auth-events";
import { auth } from "./auth";
import { deleteOldAuthEvents } from "./auth-events";
import { db } from "./db";
import { authEvent } from "./db/schema";
import { hasAuthenticatorApp } from "./two-factor";

const app = new Hono<{ Bindings: Env }>()
  .basePath("/api")
  .get("/health", (c) => c.json({ status: "ok" }))
  // The session only says whether 2FA is on; the settings UI also shows which method.
  .get("/two-factor-method", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "Not signed in" }, 401);
    if (!session.user.twoFactorEnabled) return c.json({ method: null });
    const method = (await hasAuthenticatorApp(session.user.id)) ? "app" : "email";
    return c.json({ method });
  })
  // "Recent activity": the signed-in user's own security log, newest first.
  .get("/activity", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "Not signed in" }, 401);
    const rows = await db
      .select({
        id: authEvent.id,
        type: authEvent.type,
        method: authEvent.method,
        device: authEvent.device,
        city: authEvent.city,
        country: authEvent.country,
        network: authEvent.network,
        createdAt: authEvent.createdAt,
      })
      .from(authEvent)
      .where(eq(authEvent.userId, session.user.id))
      .orderBy(desc(authEvent.createdAt))
      .limit(30);
    const events: AuthEvent[] = rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
    return c.json(events);
  })
  .all("/auth/*", (c) => auth.handler(c.req.raw));

// Exported for the typed Hono RPC client (`hc<AppType>`) on the frontend.
export type AppType = typeof app;

export default {
  fetch: app.fetch,
  // Daily cron trigger (wrangler.jsonc): enforce the retention period.
  scheduled: async () => {
    await deleteOldAuthEvents();
  },
} satisfies ExportedHandler<Env>;
