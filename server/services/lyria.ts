import { GoogleGenAI } from "@google/genai";
import type { LiveMusicServerMessage } from "@google/genai";
import { join } from "path";

const ASSETS_DIR = join(import.meta.dir, "../../assets");
const TAG = "\x1b[35m[lyria]\x1b[0m";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenAI({ apiKey, apiVersion: "v1alpha" });
}

function writeWavHeader(buffer: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const dataSize = buffer.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  header.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, buffer]);
}

export async function generateMusic(
  prompt: string,
  outputFilename: string,
  options?: { durationSeconds?: number },
): Promise<string> {
  const client = getClient();
  const durationMs = (options?.durationSeconds ?? 30) * 1000;
  const audioChunks: Buffer[] = [];
  let chunkCount = 0;
  let filteredReason: string | null = null;

  console.log(TAG, `generating "${prompt.slice(0, 60)}" for ${durationMs / 1000}s`);

  const session = await client.live.music.connect({
    model: "models/lyria-realtime-exp",
    callbacks: {
      onmessage: (message: LiveMusicServerMessage) => {
        if (message.serverContent?.audioChunks) {
          for (const chunk of message.serverContent.audioChunks) {
            audioChunks.push(Buffer.from(chunk.data!, "base64"));
            chunkCount++;
          }
          if (chunkCount % 50 === 0) {
            const totalBytes = audioChunks.reduce((s, c) => s + c.length, 0);
            console.log(TAG, `  received ${chunkCount} chunks (${(totalBytes / 1024).toFixed(0)}KB)`);
          }
        }
        if ((message as any).filteredPrompt) {
          filteredReason = JSON.stringify((message as any).filteredPrompt);
          console.log(TAG, `  prompt filtered: ${filteredReason}`);
        }
        if ((message as any).warning) {
          console.log(TAG, `  warning: ${JSON.stringify((message as any).warning)}`);
        }
      },
      onerror: (e: ErrorEvent) => {
        console.error(TAG, `error: ${e.message}`);
      },
      onclose: () => {
        console.log(TAG, `  session closed`);
      },
    },
  });

  console.log(TAG, `  session connected, setting prompt`);

  session.setWeightedPrompts({
    weightedPrompts: [{ text: prompt, weight: 1.0 }],
  });

  session.setMusicGenerationConfig({
    musicGenerationConfig: {
      guidance: 4.0,
    },
  });

  console.log(TAG, `  playing...`);
  session.play();

  await new Promise((resolve) => setTimeout(resolve, durationMs));

  console.log(TAG, `  stopping after ${durationMs / 1000}s, received ${chunkCount} chunks`);
  session.stop();

  await new Promise((resolve) => setTimeout(resolve, 500));
  session.close();

  if (filteredReason) {
    throw new Error(`Prompt was filtered by Lyria: ${filteredReason}`);
  }

  if (audioChunks.length === 0) {
    throw new Error("No audio received from Lyria");
  }

  const rawPcm = Buffer.concat(audioChunks);
  const wavBuffer = writeWavHeader(rawPcm, 48000, 2, 16);

  const outputPath = join(ASSETS_DIR, outputFilename);
  await Bun.write(outputPath, wavBuffer);

  console.log(TAG, `  wrote ${(wavBuffer.length / 1024).toFixed(0)}KB to ${outputFilename}`);
  return outputPath;
}
