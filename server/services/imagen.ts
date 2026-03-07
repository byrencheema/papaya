import { GoogleGenAI } from "@google/genai";
import { join } from "path";

const ASSETS_DIR = join(import.meta.dir, "../../assets");

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenAI({ apiKey });
}

export async function generateImage(
  prompt: string,
  outputFilename: string,
  referenceImages?: Buffer[],
): Promise<string> {
  const client = getClient();

  const aspectHint = "Generate this image in 9:16 portrait aspect ratio (1080x1920).";
  const parts: Array<Record<string, unknown>> = [];
  if (referenceImages?.length) {
    for (const img of referenceImages) {
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: img.toString("base64"),
        },
      });
    }
    parts.push({ text: `Use these frames from the current video as visual reference for style, colors, and content.\n\n${aspectHint}\n\n${prompt}` });
  } else {
    parts.push({ text: `${aspectHint}\n\n${prompt}` });
  }

  const response = await client.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: ["IMAGE", "TEXT"],
    },
  });

  const responseParts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = responseParts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image returned from Gemini");
  }

  const imageBuffer = Buffer.from(imagePart.inlineData.data, "base64");
  const outputPath = join(ASSETS_DIR, outputFilename);
  await Bun.write(outputPath, imageBuffer);

  return outputPath;
}
