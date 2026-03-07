import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import * as store from "../services/project-store.ts";
import { generateVideo } from "../services/veo.ts";
import { generateMusic } from "../services/lyria.ts";
import { generateImage } from "../services/imagen.ts";
import { probe } from "../services/ffmpeg.ts";
import type { Asset } from "../../shared/types.ts";

const app = new Hono();

app.post("/api/generate/video", async (c) => {
  const body = await c.req.json<{
    prompt: string;
    aspectRatio?: string;
  }>();

  if (!body.prompt) return c.json({ error: "prompt is required" }, 400);

  try {
    const id = uuid();
    const filename = `${id}.mp4`;

    await generateVideo(body.prompt, filename, {
      aspectRatio: body.aspectRatio,
    });

    let durationMs = 0;
    let width = 0;
    let height = 0;
    try {
      const probed = await probe(`assets/${filename}`);
      durationMs = probed.durationMs;
      width = probed.width;
      height = probed.height;
    } catch {}

    const asset: Asset = {
      id,
      name: `Generated: ${body.prompt.slice(0, 50)}`,
      type: "generated_video",
      path: `/assets/${filename}`,
      durationMs,
      width: width || undefined,
      height: height || undefined,
      generationPrompt: body.prompt,
      createdAt: Date.now(),
    };

    store.addAsset(asset);
    return c.json(asset, 201);
  } catch (err: unknown) {
    return c.json({ error: (err as Error).message ?? "Video generation failed" }, 500);
  }
});

app.post("/api/generate/music", async (c) => {
  const body = await c.req.json<{
    prompt: string;
    durationSeconds?: number;
  }>();

  if (!body.prompt) return c.json({ error: "prompt is required" }, 400);

  try {
    const id = uuid();
    const filename = `${id}.wav`;

    await generateMusic(body.prompt, filename, {
      durationSeconds: body.durationSeconds,
    });

    let durationMs = 0;
    try {
      const probed = await probe(`assets/${filename}`);
      durationMs = probed.durationMs;
    } catch {}

    const asset: Asset = {
      id,
      name: `Music: ${body.prompt.slice(0, 50)}`,
      type: "generated_music",
      path: `/assets/${filename}`,
      durationMs,
      generationPrompt: body.prompt,
      createdAt: Date.now(),
    };

    store.addAsset(asset);
    return c.json(asset, 201);
  } catch (err: unknown) {
    return c.json({ error: (err as Error).message ?? "Music generation failed" }, 500);
  }
});

app.post("/api/generate/image", async (c) => {
  const body = await c.req.json<{ prompt: string }>();

  if (!body.prompt) return c.json({ error: "prompt is required" }, 400);

  try {
    const id = uuid();
    const filename = `${id}.png`;

    await generateImage(body.prompt, filename);

    const asset: Asset = {
      id,
      name: `Image: ${body.prompt.slice(0, 50)}`,
      type: "image",
      path: `/assets/${filename}`,
      thumbnailPath: `/assets/${filename}`,
      durationMs: 5000,
      width: 1080,
      height: 1920,
      generationPrompt: body.prompt,
      createdAt: Date.now(),
    };

    store.addAsset(asset);
    return c.json(asset, 201);
  } catch (err: unknown) {
    return c.json({ error: (err as Error).message ?? "Image generation failed" }, 500);
  }
});

export default app;
