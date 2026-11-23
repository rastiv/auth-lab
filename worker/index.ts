import { and, desc, eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import type { ActiveSession, AuthEvent } from "../shared/auth-events";
import { describeDevice } from "../shared/device";
import { auth } from "./auth";
import { deleteOldAuthEvents, recordAuthEvent } from "./auth-events";
import { db } from "./db";
import { authEvent, session } from "./db/schema";
import { deleteStaleKnownDevices } from "./known-devices";
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
  // "Where you're signed in". Better-Auth's /list-sessions also returns each
  // session's token, which is a key to the account, so it refuses sessions
  // older than a day. This list has no tokens and works for any session.
  .get("/sessions", async (c) => {
    const current = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!current) return c.json({ error: "Not signed in" }, 401);
    const rows = await db
      .select({ id: session.id, userAgent: session.userAgent, createdAt: session.createdAt })
      .from(session)
      .where(and(eq(session.userId, current.user.id), gt(session.expiresAt, new Date())))
      .orderBy(desc(session.createdAt));
    const sessions: ActiveSession[] = rows.map((row) => ({
      id: row.id,
      device: describeDevice(row.userAgent),
      createdAt: row.createdAt.toISOString(),
      current: row.id === current.session.id,
    }));
    return c.json(sessions);
  })
  // Signs out one of your other browsers, by ID instead of token.
  .delete("/sessions/:id", async (c) => {
    const current = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!current) return c.json({ error: "Not signed in" }, 401);
    // Matching the user too: an ID of someone else's session deletes nothing.
    const deleted = await db
      .delete(session)
      .where(and(eq(session.id, c.req.param("id")), eq(session.userId, current.user.id)))
      .returning({ id: session.id });
    if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
    recordAuthEvent(current.user.id, "sessions_revoked", "one", c.req.raw);
    return c.json({ status: true });
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
  // Daily cron trigger (wrangler.jsonc): enforce the retention periods.
  scheduled: async () => {
    await deleteOldAuthEvents();
    await deleteStaleKnownDevices();
  },
} satisfies ExportedHandler<Env>;
