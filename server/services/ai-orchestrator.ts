import { GoogleGenAI } from "@google/genai";
import type { Content } from "@google/genai";
import { v4 as uuid } from "uuid";
import { mkdirSync, appendFileSync } from "fs";
import { join } from "path";
import type { TimelineDiff, SSEEvent } from "../../shared/types.ts";
import * as store from "./project-store.ts";
import { toolDeclarations, executeToolCall } from "./ai-tools.ts";

const MAX_TOOL_ROUNDS = 12;
const LOGS_DIR = join(import.meta.dir, "../../logs");

const TAG = "\x1b[36m[orchestrator]\x1b[0m";
const TOOL_TAG = "\x1b[33m[tool]\x1b[0m";
const ERR_TAG = "\x1b[31m[error]\x1b[0m";

const ANSI_RE = /\x1b\[[0-9;]*m/g;

let sessionLogFile: string | null = null;

function startSessionLog() {
  mkdirSync(LOGS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  sessionLogFile = join(LOGS_DIR, `session-${ts}.log`);
}

function writeLog(line: string) {
  if (!sessionLogFile) return;
  appendFileSync(sessionLogFile, line.replace(ANSI_RE, "") + "\n");
}

function log(...args: unknown[]) {
  console.log(TAG, ...args);
  writeLog([TAG, ...args].map(String).join(" "));
}

function toolLog(...args: unknown[]) {
  console.log(TOOL_TAG, ...args);
  writeLog([TOOL_TAG, ...args].map(String).join(" "));
}

function errLog(...args: unknown[]) {
  console.log(ERR_TAG, ...args);
  writeLog([ERR_TAG, ...args].map(String).join(" "));
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenAI({ apiKey });
}

function buildSystemPrompt(): string {
  const state = store.getState();
  return [
    "You are a professional video editor AI assistant for Papaya, a timeline-based video editor.",
    "You help users edit their video projects by analyzing the current state and applying timeline diffs.",
    "",
    `Current project: "${state.name}"`,
    `Dimensions: ${state.dimensions.width}x${state.dimensions.height}`,
    `Duration: ${state.durationMs}ms`,
    `Tracks: ${state.tracks.map((t) => `${t.id} (${t.type}): ${t.clips.length} clips`).join(", ")}`,
    `Assets: ${state.assets.length} total`,
    "",
    "Be decisive and act immediately. When the user asks you to edit, call get_project_state,",
    "then immediately apply the edits via apply_timeline_diff. Do NOT ask for confirmation or permission.",
    "Just do it. Keep explanations brief — say what you did, not what you're about to do.",
    "",
    "DIFF OPERATION REFERENCE — each op must have 'type' plus the listed fields:",
    '- split: { type: "split", clipId: string, atMs: number, newClipId1?: string, newClipId2?: string }',
    '  NOTE: atMs is an ABSOLUTE timeline position (not relative to clip start). Use newClipId1/newClipId2 to pre-assign IDs so you can reference the resulting clips in later ops within the same diff.',
    '- trim: { type: "trim", clipId: string, newInPointMs?: number, newOutPointMs?: number, newStartMs?: number, newDurationMs?: number }',
    '- ripple_delete: { type: "ripple_delete", clipId: string }',
    '- move: { type: "move", clipId: string, toTrackId: string, toStartMs: number }',
    '- insert_asset: { type: "insert_asset", assetId: string, trackId: string, startMs: number, inPointMs?: number, outPointMs?: number }',
    '- add_captions: { type: "add_captions", captions: [{ text: string, startMs: number, durationMs: number, words?: [{ text: string, fromMs: number, toMs: number }] }, ...], trackId?: string }',
    '- set_music: { type: "set_music", assetId: string, trackId?: string, startMs?: number }',
    '- duck_music: { type: "duck_music", trackId: string, segments: [{ startMs: number, endMs: number, volume: number }, ...] }',
    '- add_track: { type: "add_track", trackType: "video"|"audio"|"caption", label: string }',
    '- remove_clip: { type: "remove_clip", clipId: string }',
    "",
    "SPLIT + TRIM WORKFLOW: To cut out a section of a clip, use split with pre-assigned IDs, then trim or ripple_delete the unwanted piece.",
    "Example — remove 2000ms-4000ms from a clip starting at 0ms:",
    "  1. split clipId='orig' atMs=2000 newClipId1='left' newClipId2='right'",
    "  2. split clipId='right' atMs=4000 newClipId1='middle' newClipId2='keep'",
    "  3. ripple_delete clipId='middle'",
    "All three ops can go in a single diff's ops array since the IDs are pre-assigned.",
    "",
    "The apply_timeline_diff response includes resultingClips showing all clip IDs after the diff is applied.",
    "Use this to reference clips in subsequent tool calls.",
    "",
    "IMPORTANT: For add_captions, the captions must be in a 'captions' array, NOT as top-level fields.",
    "Each caption should have 3-6 words max. Include per-word timing in a 'words' array for karaoke-style highlighting.",
    "Example: { type: 'add_captions', captions: [{ text: 'HELLO WORLD', startMs: 0, durationMs: 2000, words: [{ text: 'HELLO', fromMs: 0, toMs: 1000 }, { text: 'WORLD', fromMs: 1000, toMs: 2000 }] }] }",
    "",
    "CAPTION RULES:",
    "- ONLY add captions by using transcribe_clip on clips that contain real recorded speech.",
    "- NEVER invent or write caption text yourself. Captions must come from actual audio transcription.",
    "- Do NOT add captions to AI-generated videos (Veo), images (Imagen), or any clip without real speech.",
    "- If the user asks for captions on a generated clip, explain that captions require real spoken audio.",
    "",
    "CLIP NUMBERING: When you call get_project_state, each clip includes a 'clipNumber' (1-based, sorted by startMs).",
    "Users may refer to clips by number (e.g. 'clip 1', 'clip 2', 'between clip 2 and 3'). Map these to the actual clip IDs.",
    "",
    "AI GENERATION TOOLS:",
    "- generate_and_insert_video: Generate an AI VIDEO CLIP from a prompt using Veo 3. Use this when the user asks for a clip, scene, or anything with motion. Inserts at end of timeline by default.",
    "- generate_and_insert_image: Generate a STILL image (title cards, thumbnails). Do NOT use this for video/clip requests.",
    "- generate_and_insert_transition: Generate an AI transition between two points using Veo 3.1.",
    "  TWO MODES:",
    "  (a) Between existing clips: pass leftClipId + rightClipId. Grabs last frame of left, first frame of right, generates transition between them.",
    "  (b) Split mode: pass atMs. Splits the clip, then inserts transition between the halves.",
    "  Use mode (a) when clips are already cut. Use mode (b) when the user specifies a time within a single clip.",
    "  Example: 'add a flying robot between clip 1 and clip 2' → use leftClipId=clip1.id, rightClipId=clip2.id",
    "  Example: 'insert a robot at 5s' → use atMs=5000",
    "- extend_clip: Extend a clip by generating more video at its end using Veo 3.1.",
    "  If the clip is a Veo-generated video, uses native Veo extend for seamless continuation.",
    "  If it's a regular video/image, extracts the last frame and generates from it.",
    "  Use when users say things like 'extend clip 2', 'make clip 1 longer', 'add more to the end'.",
    "- generate_and_place_audio: Generate background music/soundtrack matching the video mood. Automatically places on the audio track.",
    "- transcribe_clip: Transcribe speech from a clip using Groq Whisper STT. Returns accurate word-level timestamps. Use this for captions instead of relying on analyze_segment's estimated transcript.",
    "- auto_edit: One-click automatic editing. Chains analysis → smart cuts → soundtrack → title card → captions. Follow the returned instructions step by step.",
    "",
    "AUTO EDIT GUIDANCE: When auto_edit is called, follow each step in the returned instructions carefully.",
    "Use the existing tools to complete each step. Be thorough but efficient.",
  ].join("\n");
}

export async function* orchestrate(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): AsyncGenerator<SSEEvent> {
  const startTime = Date.now();
  startSessionLog();
  log(`▶ new request: "${userMessage.slice(0, 80)}${userMessage.length > 80 ? "…" : ""}"`);
  log(`  history: ${history.length} messages`);

  const client = getClient();

  const contents: Content[] = [
    ...history.map((msg) => ({
      role: (msg.role === "assistant" ? "model" : "user") as "model" | "user",
      parts: [{ text: msg.content }],
    })),
    { role: "user", parts: [{ text: userMessage }] },
  ];

  const appliedDiffs: TimelineDiff[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const roundStart = Date.now();
    const totalParts = contents.reduce((sum, c) => sum + (c.parts?.length ?? 0), 0);
    log(`  round ${round + 1}/${MAX_TOOL_ROUNDS} — calling gemini (${contents.length} msgs, ${totalParts} parts)...`);

    const GEMINI_TIMEOUT_MS = 30_000;
    let response;
    try {
      response = await Promise.race([
        client.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents,
          config: {
            systemInstruction: buildSystemPrompt(),
            tools: [{ functionDeclarations: toolDeclarations }],
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("GEMINI_TIMEOUT")), GEMINI_TIMEOUT_MS),
        ),
      ]);
    } catch (e) {
      const err = e as Error;
      if (err.message === "GEMINI_TIMEOUT") {
        log(`  ⚠ gemini timed out after ${GEMINI_TIMEOUT_MS}ms — aborting`);
        yield { type: "plan", data: "The AI took too long to respond. Please try again." };
        break;
      }
      errLog(`  gemini API error on round ${round + 1}:`, err.message);
      errLog(`  stack:`, err.stack);
      yield { type: "plan", data: `AI error: ${err.message}` };
      break;
    }

    log(`  round ${round + 1} — gemini responded in ${Date.now() - roundStart}ms`);

    const candidate = response.candidates?.[0];
    if (!candidate) {
      errLog(`  no candidates returned — finishReason: ${response.candidates ? "empty array" : "undefined"}`);
      log(`  raw response keys: ${Object.keys(response).join(", ")}`);
      yield { type: "plan", data: "AI returned no response. Please try again." };
      break;
    }
    if (candidate.finishReason && candidate.finishReason !== "STOP" && candidate.finishReason !== "MAX_TOKENS") {
      errLog(`  unexpected finishReason: ${candidate.finishReason}`);
      if (candidate.finishReason === "SAFETY") {
        yield { type: "plan", data: "Response blocked by safety filters. Try rephrasing your request." };
        break;
      }
    }
    const modelParts = candidate?.content?.parts ?? [];
    const textParts = modelParts.filter((p: any) => p.text);
    const functionCalls = modelParts.filter((p: any) => p.functionCall);

    if (textParts.length > 0) {
      const text = textParts.map((p: any) => p.text).join("");
      log(`  plan text: "${text.slice(0, 100)}${text.length > 100 ? "…" : ""}"`);
      yield { type: "plan", data: text };
    }

    if (functionCalls.length === 0) {
      log(`  round ${round + 1} — no tool calls, finishing`);
      break;
    }

    log(`  round ${round + 1} — ${functionCalls.length} tool call(s): ${functionCalls.map((fc: any) => fc.functionCall.name).join(", ")}`);

    contents.push({
      role: "model",
      parts: modelParts,
    });

    const responseParts = [];
    for (const part of functionCalls) {
      const fc = (part as any).functionCall;
      const toolStart = Date.now();
      const argsPreview = JSON.stringify(fc.args ?? {}).slice(0, 120);
      toolLog(`  ▸ ${fc.name}(${argsPreview}${argsPreview.length >= 120 ? "…" : ""})`);
      yield { type: "status", data: `Calling ${fc.name}...` };

      try {
        const result = await executeToolCall(fc.name!, fc.args as Record<string, unknown>);
        const elapsed = Date.now() - toolStart;
        const resultPreview = JSON.stringify(result).slice(0, 150);
        toolLog(`  ✓ ${fc.name} (${elapsed}ms) → ${resultPreview}${resultPreview.length >= 150 ? "…" : ""}`);

        if (result.diff && typeof result.diff === "object") {
          const diff = result.diff as TimelineDiff;
          if (diff.ops) {
            if (!diff.id) diff.id = uuid();
            appliedDiffs.push(diff);
            log(`  captured diff: "${diff.description}" with ${diff.ops.length} ops`);
            yield { type: "applied_diff", data: JSON.stringify(diff) };
          }
        }

        const thumbnails = result._thumbnails as Array<{ assetId: string; base64: string }> | undefined;
        delete result._thumbnails;

        const thumbnailParts = thumbnails?.length
          ? thumbnails.map(t => ({
              inlineData: {
                mimeType: "image/jpeg" as const,
                data: t.base64,
                displayName: `thumb-${t.assetId}`,
              },
            }))
          : undefined;

        responseParts.push({
          functionResponse: {
            name: fc.name!,
            response: { result },
            ...(thumbnailParts?.length && { parts: thumbnailParts }),
          },
        });

        if (thumbnailParts?.length) {
          log(`  thumbnails injected: ${thumbnailParts.length} image(s) inside functionResponse.parts`);
        }
      } catch (e) {
        const elapsed = Date.now() - toolStart;
        const err = e as Error;
        errLog(`  ✗ ${fc.name} failed (${elapsed}ms):`, err.message);
        errLog(`  stack:`, err.stack);
        yield { type: "status", data: `${fc.name} failed: ${err.message}` };
        responseParts.push({
          functionResponse: {
            name: fc.name!,
            response: { error: (e as Error).message },
          },
        });
      }
    }

    contents.push({ role: "user", parts: responseParts });
  }

  const totalMs = Date.now() - startTime;
  log(`■ done in ${totalMs}ms — ${appliedDiffs.length} diff(s) applied`);

  yield { type: "done", data: appliedDiffs.length > 0 ? "Edits applied" : "Response complete" };
}
