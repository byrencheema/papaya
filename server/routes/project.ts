import { Hono } from "hono";
import * as store from "../services/project-store.ts";
import type { ProjectState } from "../../shared/types.ts";

const app = new Hono();

app.get("/api/project", (c) => {
  return c.json(store.getState());
});

app.put("/api/project", async (c) => {
  const body = await c.req.json<ProjectState>();
  store.setState(body);
  return c.json({ ok: true });
});

export default app;
