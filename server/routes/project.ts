import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { readdir, unlink } from "fs/promises";
import { join } from "path";
import * as store from "../services/project-store.ts";
import { createEmptyProject } from "../../shared/types.ts";
import type { ProjectState } from "../../shared/types.ts";

const ASSETS_DIR = join(import.meta.dir, "../../assets");

const app = new Hono();

app.get("/api/project", (c) => {
  return c.json(store.getState());
});

app.put("/api/project", async (c) => {
  const body = await c.req.json<ProjectState>();
  store.setState(body);
  return c.json({ ok: true });
});

app.post("/api/project/reset", async (c) => {
  try {
    const files = await readdir(ASSETS_DIR);
    await Promise.all(files.filter((f) => !f.startsWith("demo-")).map((f) => unlink(join(ASSETS_DIR, f))));
  } catch {}
  store.setState(createEmptyProject(uuid(), "Untitled Project"));
  return c.json(store.getState());
});

export default app;
