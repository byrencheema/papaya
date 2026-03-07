import { Hono } from "hono";
import * as store from "../services/project-store.ts";
import type { TimelineDiff } from "../../shared/types.ts";

const app = new Hono();

app.get("/api/timeline/commits", (c) => {
  return c.json(store.getCommits());
});

app.post("/api/timeline/apply-diff", async (c) => {
  const diff = await c.req.json<TimelineDiff>();
  if (!diff.ops || !Array.isArray(diff.ops)) {
    return c.json({ error: "Invalid diff: ops must be an array" }, 400);
  }
  const commit = store.addCommit(diff, "user");
  return c.json({ commit, state: store.getState() });
});

app.post("/api/timeline/revert/:commitId", (c) => {
  const commitId = c.req.param("commitId");
  const state = store.revertCommit(commitId);
  if (!state) return c.json({ error: "Commit not found" }, 404);
  return c.json({ state });
});

export default app;
