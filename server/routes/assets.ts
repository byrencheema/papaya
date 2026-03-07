import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { basename, join } from "path";
import * as store from "../services/project-store.ts";
import { probe, thumbnail } from "../services/ffmpeg.ts";
import type { Asset, AssetType } from "../../shared/types.ts";

const ASSETS_DIR = join(import.meta.dir, "../../assets");

const app = new Hono();

function inferAssetType(mimeType: string): AssetType {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  return "video";
}

function resolveAssetPath(assetPath: string): string {
  return join(ASSETS_DIR, basename(assetPath));
}

app.post("/api/assets/import", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return c.json({ error: "No file provided" }, 400);

  const id = uuid();
  const ext = file.name.split(".").pop() ?? "bin";
  const filename = `${id}.${ext}`;
  const filePath = join(ASSETS_DIR, filename);

  const buffer = await file.arrayBuffer();
  await Bun.write(filePath, buffer);

  const assetType = inferAssetType(file.type);
  let durationMs = 0;
  let width = 0;
  let height = 0;
  let thumbnailPath: string | undefined;

  try {
    const probeResult = await probe(filePath);
    durationMs = probeResult.durationMs;
    width = probeResult.width;
    height = probeResult.height;
  } catch {
    if (assetType === "image") {
      durationMs = 5000;
    }
  }

  if (assetType === "video" || assetType === "image") {
    try {
      const thumbFilename = `${id}_thumb.jpg`;
      const thumbPath = join(ASSETS_DIR, thumbFilename);
      await thumbnail(filePath, thumbPath, 0);
      thumbnailPath = `/assets/${thumbFilename}`;
    } catch {}
  }

  const asset: Asset = {
    id,
    name: file.name,
    type: assetType,
    path: `/assets/${filename}`,
    durationMs,
    width: width || undefined,
    height: height || undefined,
    thumbnailPath,
    createdAt: Date.now(),
  };

  store.addAsset(asset);
  return c.json(asset, 201);
});

app.get("/api/assets/:id/thumbnail", async (c) => {
  const id = c.req.param("id");
  const state = store.getState();
  const asset = state.assets.find((a) => a.id === id);
  if (!asset) return c.json({ error: "Asset not found" }, 404);

  if (asset.thumbnailPath) {
    const fullPath = resolveAssetPath(asset.thumbnailPath);
    const file = Bun.file(fullPath);
    if (await file.exists()) {
      return new Response(file.stream(), {
        headers: { "Content-Type": "image/jpeg" },
      });
    }
  }

  const assetFullPath = resolveAssetPath(asset.path);
  const thumbFilename = `${id}_thumb.jpg`;
  const thumbPath = join(ASSETS_DIR, thumbFilename);

  try {
    await thumbnail(assetFullPath, thumbPath, 0);
    const file = Bun.file(thumbPath);
    return new Response(file.stream(), {
      headers: { "Content-Type": "image/jpeg" },
    });
  } catch {
    return c.json({ error: "Could not generate thumbnail" }, 500);
  }
});

export default app;
