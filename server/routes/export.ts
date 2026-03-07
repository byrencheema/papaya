import { Hono } from "hono";
import { basename, join } from "path";
import { v4 as uuid } from "uuid";
import * as store from "../services/project-store.ts";

const ASSETS_DIR = join(import.meta.dir, "../../assets");

function resolveAssetPath(assetPath: string): string {
  return join(ASSETS_DIR, basename(assetPath));
}

const app = new Hono();

app.post("/api/export", async (c) => {
  const state = store.getState();

  const videoTrack = state.tracks.find((t) => t.type === "video");
  if (!videoTrack || videoTrack.clips.length === 0) {
    return c.json({ error: "No video clips on the timeline" }, 400);
  }

  const audioTrack = state.tracks.find((t) => t.type === "audio");
  const sortedClips = [...videoTrack.clips].sort((a, b) => a.startMs - b.startMs);

  const filterParts: string[] = [];
  const inputArgs: string[] = [];
  let inputIdx = 0;

  for (const clip of sortedClips) {
    const asset = state.assets.find((a) => a.id === clip.assetId);
    if (!asset) continue;
    const assetPath = resolveAssetPath(asset.path);
    inputArgs.push("-i", assetPath);

    const inSec = (clip.inPointMs / 1000).toFixed(3);
    const outSec = (clip.outPointMs / 1000).toFixed(3);

    if (asset.type === "image") {
      filterParts.push(
        `[${inputIdx}:v]loop=loop=-1:size=1:start=0,setpts=PTS-STARTPTS,trim=0:${(clip.durationMs / 1000).toFixed(3)},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1[v${inputIdx}]`
      );
    } else {
      filterParts.push(
        `[${inputIdx}:v]trim=${inSec}:${outSec},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1[v${inputIdx}]`
      );
    }
    inputIdx++;
  }

  let audioInputIdx = -1;
  if (audioTrack && audioTrack.clips.length > 0) {
    const audioClip = audioTrack.clips[0]!;
    const audioAsset = state.assets.find((a) => a.id === audioClip.assetId);
    if (audioAsset) {
      audioInputIdx = inputIdx;
      inputArgs.push("-i", resolveAssetPath(audioAsset.path));
      inputIdx++;
    }
  }

  if (filterParts.length === 0) {
    return c.json({ error: "No valid clips to export" }, 400);
  }

  const concatInputs = filterParts.map((_, i) => `[v${i}]`).join("");
  filterParts.push(`${concatInputs}concat=n=${filterParts.length}:v=1:a=0[outv]`);
  const filterComplex = filterParts.join(";");

  const outFilename = `export_${uuid()}.mp4`;
  const outPath = join(ASSETS_DIR, outFilename);

  const args: string[] = [
    "ffmpeg", "-y",
    ...inputArgs,
    "-filter_complex", filterComplex,
    "-map", "[outv]",
  ];

  if (audioInputIdx >= 0) {
    args.push("-map", `${audioInputIdx}:a`);
    args.push("-shortest");
  }

  args.push("-c:v", "libx264", "-preset", "fast", "-crf", "23");
  if (audioInputIdx >= 0) {
    args.push("-c:a", "aac", "-b:a", "192k");
  }
  args.push(outPath);

  try {
    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    const errText = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      throw new Error(`ffmpeg export failed: ${errText}`);
    }

    const file = Bun.file(outPath);
    if (!(await file.exists())) {
      return c.json({ error: "Export file was not created" }, 500);
    }
    return new Response(file.stream(), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${state.name}.mp4"`,
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message ?? "Export failed" }, 500);
  }
});

export default app;
