import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { orchestrate } from "../services/ai-orchestrator.ts";

const app = new Hono();

app.post("/api/ai/chat", async (c) => {
  const body = await c.req.json<{
    message: string;
    projectId?: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  }>();

  if (!body.message) {
    return c.json({ error: "message is required" }, 400);
  }

  return streamSSE(c, async (stream) => {
    try {
      const events = orchestrate(body.message, body.history ?? []);
      for await (const event of events) {
        await stream.writeSSE({
          data: JSON.stringify({ type: event.type, data: event.data }),
        });
      }
    } catch (err: unknown) {
      await stream.writeSSE({
        data: JSON.stringify({ type: "error", data: (err as Error).message ?? "Unknown error" }),
      });
    }
  });
});

export default app;
