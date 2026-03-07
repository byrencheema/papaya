import { GoogleGenAI } from "@google/genai";
import { join } from "path";

const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 60;
const ASSETS_DIR = join(import.meta.dir, "../../assets");

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenAI({ apiKey });
}

function normalizeAspectRatio(ratio?: string): string {
  if (!ratio) return "9:16";
  const valid = ["9:16", "16:9"];
  if (valid.includes(ratio)) return ratio;
  const parts = ratio.split(":");
  if (parts.length === 2) {
    const w = parseInt(parts[0]!, 10);
    const h = parseInt(parts[1]!, 10);
    if (w && h) return w > h ? "16:9" : "9:16";
  }
  return "9:16";
}

async function pollUntilDone(client: GoogleGenAI, operation: any) {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    if (operation.done) break;
    console.log(`\x1b[33m[veo]\x1b[0m   polling... (${i + 1}/${MAX_POLL_ATTEMPTS})`);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    operation = await client.operations.get({ operation });
  }
  if (!operation.done) throw new Error("Video generation timed out");
  const videos = operation.response?.generatedVideos;
  if (!videos || videos.length === 0) throw new Error("No video returned from Veo");
  return videos;
}

export async function generateVideo(
  prompt: string,
  outputFilename: string,
  options?: { aspectRatio?: string },
): Promise<string> {
  const client = getClient();

  let operation = await client.models.generateVideos({
    model: "veo-3.1-generate-preview",
    prompt,
    config: {
      aspectRatio: normalizeAspectRatio(options?.aspectRatio),
      numberOfVideos: 1,
    },
  });

  const videos = await pollUntilDone(client, operation);
  const downloadPath = join(ASSETS_DIR, outputFilename);
  await client.files.download({ file: videos[0]!, downloadPath });
  return downloadPath;
}

export async function extendVideo(
  prompt: string,
  sourceVideoPath: string,
  outputFilename: string,
): Promise<string> {
  const client = getClient();
  const videoFile = Bun.file(sourceVideoPath);
  const videoBytes = Buffer.from(await videoFile.arrayBuffer()).toString("base64");

  let operation = await client.models.generateVideos({
    model: "veo-3.1-generate-preview",
    prompt,
    video: {
      videoBytes,
      mimeType: "video/mp4",
    },
    config: {
      numberOfVideos: 1,
      resolution: "720p",
    },
  });

  const videos = await pollUntilDone(client, operation);
  const downloadPath = join(ASSETS_DIR, outputFilename);
  await client.files.download({ file: videos[0]!, downloadPath });
  return downloadPath;
}

export async function generateVideoFromFrame(
  prompt: string,
  outputFilename: string,
  firstFrame: Buffer,
  options?: { aspectRatio?: string },
): Promise<string> {
  const client = getClient();

  let operation = await client.models.generateVideos({
    model: "veo-3.1-generate-preview",
    prompt,
    image: {
      imageBytes: firstFrame.toString("base64"),
      mimeType: "image/png",
    },
    config: {
      aspectRatio: normalizeAspectRatio(options?.aspectRatio),
      numberOfVideos: 1,
    },
  });

  const videos = await pollUntilDone(client, operation);
  const downloadPath = join(ASSETS_DIR, outputFilename);
  await client.files.download({ file: videos[0]!, downloadPath });
  return downloadPath;
}

export async function generateTransitionVideo(
  prompt: string,
  outputFilename: string,
  firstFrame: Buffer,
  lastFrame: Buffer,
  options?: { aspectRatio?: string },
): Promise<string> {
  const client = getClient();

  let operation = await client.models.generateVideos({
    model: "veo-3.1-generate-preview",
    prompt,
    image: {
      imageBytes: firstFrame.toString("base64"),
      mimeType: "image/png",
    },
    config: {
      aspectRatio: normalizeAspectRatio(options?.aspectRatio),
      numberOfVideos: 1,
      lastFrame: {
        imageBytes: lastFrame.toString("base64"),
        mimeType: "image/png",
      },
    },
  });

  const videos = await pollUntilDone(client, operation);
  const downloadPath = join(ASSETS_DIR, outputFilename);
  await client.files.download({ file: videos[0]!, downloadPath });
  return downloadPath;
}
