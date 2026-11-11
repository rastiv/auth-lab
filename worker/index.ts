import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>()
  .basePath("/api")
  .get("/health", (c) => c.json({ status: "ok" }));

// Exported for the typed Hono RPC client (`hc<AppType>`) on the frontend.
export type AppType = typeof app;

export default app;
