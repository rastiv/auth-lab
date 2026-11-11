import { Hono } from "hono";
import { auth } from "./auth";

const app = new Hono<{ Bindings: Env }>()
  .basePath("/api")
  .get("/health", (c) => c.json({ status: "ok" }))
  .all("/auth/*", (c) => auth.handler(c.req.raw));

// Exported for the typed Hono RPC client (`hc<AppType>`) on the frontend.
export type AppType = typeof app;

export default app;
