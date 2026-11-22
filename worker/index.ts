import { Hono } from "hono";
import { auth } from "./auth";
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
  .all("/auth/*", (c) => auth.handler(c.req.raw));

// Exported for the typed Hono RPC client (`hc<AppType>`) on the frontend.
export type AppType = typeof app;

export default app;
