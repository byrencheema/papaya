import { GoogleGenAI, Type } from "@google/genai";
import type { FunctionDeclaration } from "@google/genai";
import { v4 as uuid } from "uuid";
import { join } from "path";
import type { TimelineDiff, Asset } from "../../shared/types.ts";
import * as store from "./project-store.ts";
import { extractFrames, extractSingleFrame, thumbnail } from "./ffmpeg.ts";
import { generateImage } from "./imagen.ts";
import { generateMusic } from "./lyria.ts";
import { generateVideo, generateTransitionVideo, extendVideo, generateVideoFromFrame } from "./veo.ts";
import { probe } from "./ffmpeg.ts";

const ASSETS_DIR = join(import.meta.dir, "../../assets");

const T = "\x1b[33m[tool]\x1b[0m";

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "get_project_state",
    description:
      "Returns the current project state including tracks, clips, assets, captions, and timeline duration.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "analyze_segment",
    description:
      "Analyze a segment of a video/audio clip using Gemini vision. Extracts frames and returns scene description, transcript, mood, and loudness data.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        clipId: { type: Type.STRING, description: "ID of the clip to analyze" },
        startMs: { type: Type.NUMBER, description: "Start of segment in ms" },
        endMs: { type: Type.NUMBER, description: "End of segment in ms" },
      },
      required: ["clipId", "startMs", "endMs"],
    },
  },
  {
    name: "apply_timeline_diff",
    description:
      "Apply a TimelineDiff to the current project state. Commits the changes and returns the resulting state summary.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        diff: {
          type: Type.OBJECT,
          description: "A TimelineDiff object with id, description, and ops array",
          properties: {
            id: { type: Type.STRING, description: "Unique identifier for the diff" },
            description: { type: Type.STRING, description: "Human-readable description of the changes" },
            ops: {
              type: Type.ARRAY,
              description:
                "Array of diff operations. Each must have a 'type' field (split, trim, ripple_delete, move, insert_asset, add_captions, set_music, duck_music, add_track, remove_clip) and the corresponding parameters.",
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    description:
                      "Operation type: split, trim, ripple_delete, move, insert_asset, add_captions, set_music, duck_music, add_track, remove_clip",
                  },
                  clipId: { type: Type.STRING, description: "Clip ID (for split, trim, ripple_delete, move, remove_clip)" },
                  atMs: { type: Type.NUMBER, description: "Split point in timeline ms (for split). This is an absolute position on the timeline, not relative to the clip." },
                  newClipId1: { type: Type.STRING, description: "Optional pre-assigned ID for the first (left) clip after split" },
                  newClipId2: { type: Type.STRING, description: "Optional pre-assigned ID for the second (right) clip after split" },
                  newInPointMs: { type: Type.NUMBER, description: "New in point (for trim)" },
                  newOutPointMs: { type: Type.NUMBER, description: "New out point (for trim)" },
                  newStartMs: { type: Type.NUMBER, description: "New start position (for trim)" },
                  newDurationMs: { type: Type.NUMBER, description: "New duration (for trim)" },
                  toTrackId: { type: Type.STRING, description: "Destination track ID (for move)" },
                  toStartMs: { type: Type.NUMBER, description: "Destination start time (for move)" },
                  assetId: { type: Type.STRING, description: "Asset ID (for insert_asset, set_music)" },
                  trackId: { type: Type.STRING, description: "Track ID (for insert_asset, add_captions, set_music, duck_music)" },
                  startMs: { type: Type.NUMBER, description: "Start time in ms (for insert_asset, set_music)" },
                  inPointMs: { type: Type.NUMBER, description: "In point in ms (for insert_asset)" },
                  outPointMs: { type: Type.NUMBER, description: "Out point in ms (for insert_asset)" },
                  captions: {
                    type: Type.ARRAY,
                    description: "Array of caption objects (for add_captions)",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        text: { type: Type.STRING, description: "Caption text (3-6 words, uppercase)" },
                        startMs: { type: Type.NUMBER, description: "Caption start time in ms" },
                        durationMs: { type: Type.NUMBER, description: "Caption duration in ms" },
                        words: {
                          type: Type.ARRAY,
                          description: "Per-word timing for karaoke-style highlight",
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              text: { type: Type.STRING, description: "Single word" },
                              fromMs: { type: Type.NUMBER, description: "Word start time in ms" },
                              toMs: { type: Type.NUMBER, description: "Word end time in ms" },
                            },
                            required: ["text", "fromMs", "toMs"],
                          },
                        },
                      },
                      required: ["text", "startMs", "durationMs"],
                    },
                  },
                  segments: {
                    type: Type.ARRAY,
                    description: "Array of duck segments (for duck_music)",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        startMs: { type: Type.NUMBER, description: "Segment start" },
                        endMs: { type: Type.NUMBER, description: "Segment end" },
                        volume: { type: Type.NUMBER, description: "Volume level 0-1" },
                      },
                      required: ["startMs", "endMs", "volume"],
                    },
                  },
                  trackType: { type: Type.STRING, description: "Track type: video, audio, or caption (for add_track)" },
                  label: { type: Type.STRING, description: "Track label (for add_track)" },
                },
                required: ["type"],
              },
            },
          },
          required: ["id", "description", "ops"],
        },
      },
      required: ["diff"],
    },
  },
  {
    name: "generate_and_insert_video",
    description:
      "Generate an AI video clip from a text prompt using Veo 3 and automatically insert it on the timeline. This tool handles EVERYTHING: generation and insertion. Do NOT call apply_timeline_diff afterward — changes are already applied. Use this when the user wants a video clip (motion, action, scenes). Do NOT use generate_and_insert_image for video requests.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: "Detailed description of the video to generate (scene, action, camera movement, style)" },
        insertAtMs: { type: Type.NUMBER, description: "Timeline position to insert at (default: end of timeline)" },
        trackId: { type: Type.STRING, description: "Track to insert on (default: V1)" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "generate_and_insert_image",
    description:
      "Generate a STILL AI image from a text prompt (title cards, b-roll stills, thumbnails). Only use for static images, NOT for video clips or scenes with motion.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: "Detailed description of the image to generate" },
        insertOnTimeline: { type: Type.BOOLEAN, description: "If true, insert the image on the video track at insertAtMs" },
        insertAtMs: { type: Type.NUMBER, description: "Timeline position to insert at (default: 0)" },
        trackId: { type: Type.STRING, description: "Track to insert on (default: V1)" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "generate_and_place_audio",
    description:
      "Generate AI background music/soundtrack matching the video mood, then auto-place it on the audio track using set_music.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: "Music style description (genre, mood, tempo, instruments)" },
        durationSeconds: { type: Type.NUMBER, description: "Duration in seconds (default: 30)" },
        trackId: { type: Type.STRING, description: "Audio track to place on (default: A1)" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "generate_and_insert_transition",
    description:
      "Generate an AI video transition using Veo 3.1 and automatically insert it on the timeline. This tool handles EVERYTHING: frame extraction, video generation, shifting clips, and insertion. Do NOT call apply_timeline_diff afterward — changes are already applied. Two modes: (1) leftClipId + rightClipId: inserts between two existing clips. (2) atMs: splits clip first, then inserts between halves.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: "Description of the transition (e.g. 'a flying robot zooms across the screen', 'smooth cinematic dissolve through clouds')" },
        leftClipId: { type: Type.STRING, description: "ID of the clip on the left side of the transition (use with rightClipId for between-clips mode)" },
        rightClipId: { type: Type.STRING, description: "ID of the clip on the right side of the transition (use with leftClipId for between-clips mode)" },
        atMs: { type: Type.NUMBER, description: "Timeline position to split and insert the transition at (split mode — used when leftClipId/rightClipId are not provided)" },
        clipId: { type: Type.STRING, description: "ID of the clip to split (for split mode). If not provided, finds the clip at atMs on V1." },
        trackId: { type: Type.STRING, description: "Track ID (default: V1)" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "extend_clip",
    description:
      "Extend a clip by generating additional video at its end using Veo 3.1 and automatically insert it on the timeline. This tool handles EVERYTHING: frame extraction, video generation, shifting clips, and insertion. Do NOT call apply_timeline_diff afterward — changes are already applied. Uses native Veo extend for Veo-generated clips, or last-frame-to-video for regular clips.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        clipId: { type: Type.STRING, description: "ID of the clip to extend" },
        prompt: { type: Type.STRING, description: "Description of what should happen in the extended footage" },
        trackId: { type: Type.STRING, description: "Track ID (default: V1)" },
      },
      required: ["clipId", "prompt"],
    },
  },
  {
    name: "auto_edit",
    description:
      "One-click automatic edit: analyzes the video, makes smart cuts, generates a soundtrack, and creates a title card. Returns step-by-step instructions for you to follow using existing tools.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];

export async function executeToolCall(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  switch (name) {
    case "get_project_state": {
      const state = store.getState();

      const MAX_THUMB_BYTES = 50_000;
      const thumbnails: Array<{ assetId: string; base64: string }> = [];
      for (const asset of state.assets) {
        if (asset.type !== "video" && asset.type !== "image" && asset.type !== "generated_video") continue;
        const smallThumbPath = join(ASSETS_DIR, `${asset.id}_thumb.jpg`);
        try {
          const smallFile = Bun.file(smallThumbPath);
          if (!(await smallFile.exists())) {
            const srcPath = asset.path.startsWith("/assets/")
              ? join(ASSETS_DIR, asset.path.slice(8))
              : asset.path;
            const srcFile = Bun.file(srcPath);
            if (await srcFile.exists()) {
              await thumbnail(srcPath, smallThumbPath, 0);
            }
          }
          const thumbFile = Bun.file(smallThumbPath);
          if (await thumbFile.exists()) {
            const buf = Buffer.from(await thumbFile.arrayBuffer());
            if (buf.length <= MAX_THUMB_BYTES) {
              thumbnails.push({ assetId: asset.id, base64: buf.toString("base64") });
            } else {
              console.log(T, `  skipping oversized thumbnail for ${asset.id} (${(buf.length / 1024).toFixed(0)}KB)`);
            }
          }
        } catch {}
      }

      const overlaps: Array<{ trackId: string; clipA: string; clipB: string; overlapMs: number }> = [];
      const gaps: Array<{ trackId: string; fromMs: number; toMs: number }> = [];
      for (const track of state.tracks) {
        const sorted = [...track.clips].sort((a, b) => a.startMs - b.startMs);
        for (let i = 0; i < sorted.length - 1; i++) {
          const a = sorted[i]!;
          const b = sorted[i + 1]!;
          const aEnd = a.startMs + a.durationMs;
          if (aEnd > b.startMs) {
            overlaps.push({ trackId: track.id, clipA: a.id, clipB: b.id, overlapMs: aEnd - b.startMs });
          } else if (aEnd < b.startMs) {
            gaps.push({ trackId: track.id, fromMs: aEnd, toMs: b.startMs });
          }
        }
      }

      return {
        id: state.id,
        name: state.name,
        dimensions: state.dimensions,
        durationMs: state.durationMs,
        trackCount: state.tracks.length,
        tracks: state.tracks.map((t) => ({
          id: t.id,
          type: t.type,
          label: t.label,
          muted: t.muted,
          locked: t.locked,
          clipCount: t.clips.length,
          clips: t.clips
            .slice()
            .sort((a, b) => a.startMs - b.startMs)
            .map((c, idx) => {
              const asset = state.assets.find((a) => a.id === c.assetId);
              return {
                clipNumber: idx + 1,
                id: c.id,
                assetId: c.assetId,
                assetName: asset?.name,
                assetType: asset?.type,
                isVeoGenerated: asset?.type === "generated_video",
                startMs: c.startMs,
                durationMs: c.durationMs,
                inPointMs: c.inPointMs,
                outPointMs: c.outPointMs,
                volume: (c as any).volume,
              };
            }),
        })),
        assets: state.assets.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          durationMs: a.durationMs,
          width: a.width,
          height: a.height,
          generationPrompt: a.generationPrompt,
          hasThumbnail: thumbnails.some((t) => t.assetId === a.id),
        })),
        captions: state.captions.map((c) => ({
          id: c.id,
          trackId: c.trackId,
          startMs: c.startMs,
          durationMs: c.durationMs,
          text: c.text,
          wordCount: c.words?.length,
        })),
        captionStyle: state.captionStyle,
        overlaps: overlaps.length > 0 ? overlaps : undefined,
        gaps: gaps.length > 0 ? gaps : undefined,
        _thumbnails: thumbnails,
      };
    }

    case "analyze_segment": {
      const { clipId, startMs, endMs } = args as { clipId: string; startMs: number; endMs: number };
      console.log(T, `analyze_segment: clip=${clipId} range=${startMs}-${endMs}ms`);
      const state = store.getState();
      let clip = null;
      for (const track of state.tracks) {
        clip = track.clips.find((c) => c.id === clipId);
        if (clip) break;
      }
      if (!clip) return { error: `Clip ${clipId} not found` };

      const asset = state.assets.find((a) => a.id === clip!.assetId);
      if (!asset) return { error: `Asset for clip ${clipId} not found` };

      const assetPath = asset.path.startsWith("/assets/")
        ? join(ASSETS_DIR, asset.path.slice(8))
        : asset.path;

      try {
        console.log(T, `  extracting frames from ${assetPath}`);
        const frames = await extractFrames(assetPath, startMs, endMs, 4);
        console.log(T, `  extracted ${frames.length} frames, sending to gemini vision`);

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not set");
        const client = new GoogleGenAI({ apiKey });

        const imageParts = frames.map((frame) => ({
          inlineData: {
            mimeType: "image/png" as const,
            data: frame.toString("base64"),
          },
        }));

        const response = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                ...imageParts,
                {
                  text: `Analyze these ${frames.length} frames extracted from a video segment (${startMs}ms to ${endMs}ms). Provide:
1. Scene description (what's happening visually)
2. Estimated transcript/dialogue (if any speech is visible)
3. Mood/tone of the segment
4. Key visual elements and composition
5. Suggested editing actions (cuts, transitions, effects)

Respond as JSON: { "sceneDescription": "...", "transcript": "...", "mood": "...", "visualElements": [...], "editingSuggestions": [...] }`,
                },
              ],
            },
          ],
        });

        let analysis: Record<string, unknown> = {};
        const text = response.text ?? "";
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
        } catch {
          analysis = { rawAnalysis: text };
        }

        return {
          clipId,
          startMs,
          endMs,
          framesAnalyzed: frames.length,
          ...analysis,
        };
      } catch (e) {
        return {
          clipId,
          startMs,
          endMs,
          error: `Vision analysis failed: ${(e as Error).message}`,
          transcript: `[Analysis unavailable for clip ${clipId}]`,
        };
      }
    }

    case "apply_timeline_diff": {
      const diff = (args as { diff: TimelineDiff }).diff;
      try {
        store.addCommit(diff, "ai");
        const result = store.getState();
        return {
          valid: true,
          diff,
          resultingSummary: {
            durationMs: result.durationMs,
            trackCount: result.tracks.length,
            totalClips: result.tracks.reduce((sum, t) => sum + t.clips.length, 0),
            captionCount: result.captions.length,
          },
          resultingClips: result.tracks.map((t) => ({
            trackId: t.id,
            clips: t.clips.map((c) => ({
              id: c.id,
              assetId: c.assetId,
              startMs: c.startMs,
              durationMs: c.durationMs,
              inPointMs: c.inPointMs,
              outPointMs: c.outPointMs,
            })),
          })),
        };
      } catch (e) {
        return { valid: false, error: (e as Error).message };
      }
    }

    case "generate_and_insert_video": {
      const { prompt, insertAtMs, trackId } = args as {
        prompt: string;
        insertAtMs?: number;
        trackId?: string;
      };
      const trkId = trackId ?? "V1";
      console.log(T, `generate_and_insert_video: "${prompt.slice(0, 60)}"`);

      const id = uuid();
      const filename = `${id}.mp4`;
      const state = store.getState();
      const aspectRatio = state.dimensions.width > state.dimensions.height ? "16:9" : "9:16";

      await generateVideo(prompt, filename, { aspectRatio });

      let durationMs = 8000;
      let width = state.dimensions.width;
      let height = state.dimensions.height;
      try {
        const probed = await probe(join(ASSETS_DIR, filename));
        durationMs = probed.durationMs;
        width = probed.width || width;
        height = probed.height || height;
      } catch {}

      const asset: Asset = {
        id,
        name: `Video: ${prompt.slice(0, 50)}`,
        type: "generated_video",
        path: `/assets/${filename}`,
        thumbnailPath: `/assets/${id}_thumb.jpg`,
        durationMs,
        width,
        height,
        generationPrompt: prompt,
        createdAt: Date.now(),
      };
      store.addAsset(asset);

      const track = state.tracks.find((t) => t.id === trkId);
      const endOfTimeline = track
        ? Math.max(0, ...track.clips.map((c) => c.startMs + c.durationMs))
        : 0;
      const startMs = insertAtMs ?? endOfTimeline;

      const diff: TimelineDiff = {
        id: uuid(),
        description: `Insert generated video: ${prompt.slice(0, 40)}`,
        ops: [{
          type: "insert_asset",
          assetId: id,
          trackId: trkId,
          startMs,
        }],
      };

      try {
        store.addCommit(diff, "ai");
        return {
          assetId: id,
          assetName: asset.name,
          durationMs,
          startMs,
          inserted: true,
          diff,
        };
      } catch (e) {
        return {
          assetId: id,
          assetName: asset.name,
          durationMs,
          inserted: false,
          insertError: (e as Error).message,
        };
      }
    }

    case "generate_and_insert_image": {
      console.log(T, `generate_and_insert_image: "${(args as any).prompt?.slice(0, 60)}"`);
      const { prompt, insertOnTimeline, insertAtMs, trackId } = args as {
        prompt: string;
        insertOnTimeline?: boolean;
        insertAtMs?: number;
        trackId?: string;
      };

      const id = uuid();
      const filename = `${id}.png`;

      const state = store.getState();
      const videoClips = state.tracks
        .filter((t) => t.type === "video")
        .flatMap((t) => t.clips);

      let referenceFrames: Buffer[] | undefined;
      if (videoClips.length > 0) {
        const clip = videoClips[0]!;
        const asset = state.assets.find((a) => a.id === clip.assetId);
        if (asset && (asset.type === "video" || asset.type === "image")) {
          const assetPath = asset.path.startsWith("/assets/")
            ? join(ASSETS_DIR, asset.path.slice(8))
            : asset.path;
          try {
            referenceFrames = await extractFrames(assetPath, clip.startMs, clip.startMs + clip.durationMs, 3);
            console.log(T, `  extracted ${referenceFrames.length} reference frames from ${asset.name}`);
          } catch (e) {
            console.log(T, `  failed to extract reference frames: ${(e as Error).message}`);
          }
        }
      }

      await generateImage(prompt, filename, referenceFrames);

      const asset: Asset = {
        id,
        name: `Image: ${prompt.slice(0, 50)}`,
        type: "image",
        path: `/assets/${filename}`,
        thumbnailPath: `/assets/${filename}`,
        durationMs: 5000,
        width: 1080,
        height: 1920,
        generationPrompt: prompt,
        createdAt: Date.now(),
      };
      store.addAsset(asset);

      const result: Record<string, unknown> = {
        assetId: id,
        assetName: asset.name,
        path: asset.path,
      };

      if (insertOnTimeline) {
        const diff: TimelineDiff = {
          id: uuid(),
          description: `Insert generated image: ${prompt.slice(0, 40)}`,
          ops: [
            {
              type: "insert_asset",
              assetId: id,
              trackId: trackId ?? "V1",
              startMs: insertAtMs ?? 0,
            },
          ],
        };

        try {
          store.addCommit(diff, "ai");
          result.inserted = true;
          result.diff = diff;
        } catch (e) {
          result.inserted = false;
          result.insertError = (e as Error).message;
        }
      }

      return result;
    }

    case "generate_and_place_audio": {
      console.log(T, `generate_and_place_audio: "${(args as any).prompt?.slice(0, 60)}" dur=${(args as any).durationSeconds ?? 30}s`);
      const { prompt, durationSeconds, trackId } = args as {
        prompt: string;
        durationSeconds?: number;
        trackId?: string;
      };

      const id = uuid();
      const filename = `${id}.wav`;

      await generateMusic(prompt, filename, { durationSeconds: durationSeconds ?? 30 });

      let durationMs = (durationSeconds ?? 30) * 1000;
      try {
        const probed = await probe(join(ASSETS_DIR, filename));
        durationMs = probed.durationMs;
      } catch {}

      const asset: Asset = {
        id,
        name: `Music: ${prompt.slice(0, 50)}`,
        type: "generated_music",
        path: `/assets/${filename}`,
        durationMs,
        generationPrompt: prompt,
        createdAt: Date.now(),
      };
      store.addAsset(asset);

      const diff: TimelineDiff = {
        id: uuid(),
        description: `Set background music: ${prompt.slice(0, 40)}`,
        ops: [
          {
            type: "set_music",
            assetId: id,
            trackId: trackId ?? "A1",
            startMs: 0,
          },
        ],
      };

      try {
        store.addCommit(diff, "ai");
        return {
          assetId: id,
          assetName: asset.name,
          durationMs,
          placed: true,
          diff,
        };
      } catch (e) {
        return {
          assetId: id,
          assetName: asset.name,
          durationMs,
          placed: false,
          placeError: (e as Error).message,
        };
      }
    }

    case "generate_and_insert_transition": {
      const { prompt, leftClipId, rightClipId, atMs, clipId: targetClipId, trackId: targetTrackId } = args as {
        prompt: string;
        leftClipId?: string;
        rightClipId?: string;
        atMs?: number;
        clipId?: string;
        trackId?: string;
      };
      const trkId = targetTrackId ?? "V1";
      console.log(T, `generate_and_insert_transition: "${prompt.slice(0, 60)}"`);

      let state = store.getState();
      const track = state.tracks.find((t) => t.id === trkId);
      if (!track) return { error: `Track ${trkId} not found` };

      let leftId: string;
      let rightId: string;
      let splitDiff: TimelineDiff | undefined;

      if (leftClipId && rightClipId) {
        leftId = leftClipId;
        rightId = rightClipId;
        console.log(T, `  between-clips mode: left=${leftId} right=${rightId}`);
      } else if (atMs !== undefined) {
        const clipToSplit = targetClipId
          ? track.clips.find((c) => c.id === targetClipId)
          : track.clips.find((c) => atMs > c.startMs && atMs < c.startMs + c.durationMs);
        if (!clipToSplit) return { error: `No clip found at ${atMs}ms on track ${trkId}` };

        leftId = uuid();
        rightId = uuid();
        splitDiff = {
          id: uuid(),
          description: `Split for transition at ${atMs}ms`,
          ops: [{
            type: "split",
            clipId: clipToSplit.id,
            atMs,
            newClipId1: leftId,
            newClipId2: rightId,
          }],
        };
        store.addCommit(splitDiff, "ai");
        state = store.getState();
        console.log(T, `  split mode at ${atMs}ms: left=${leftId} right=${rightId}`);
      } else {
        return { error: "Must provide either leftClipId+rightClipId or atMs" };
      }

      const currentTrack = state.tracks.find((t) => t.id === trkId)!;
      const leftClip = currentTrack.clips.find((c) => c.id === leftId);
      const rightClip = currentTrack.clips.find((c) => c.id === rightId);
      if (!leftClip || !rightClip) return { error: `Clips not found: left=${leftId} right=${rightId}` };

      const leftAsset = state.assets.find((a) => a.id === leftClip.assetId);
      const rightAsset = state.assets.find((a) => a.id === rightClip.assetId);
      if (!leftAsset || !rightAsset) return { error: "Assets not found for clips" };

      const resolvePath = (p: string) => p.startsWith("/assets/") ? join(ASSETS_DIR, p.slice(8)) : p;
      const leftPath = resolvePath(leftAsset.path);
      const rightPath = resolvePath(rightAsset.path);

      const lastFrameMs = leftClip.inPointMs + leftClip.durationMs - 33;
      const firstFrameMs = rightClip.inPointMs;
      console.log(T, `  extracting last frame at ${lastFrameMs}ms, first frame at ${firstFrameMs}ms`);

      const [startFrame, endFrame] = await Promise.all([
        extractSingleFrame(leftPath, lastFrameMs),
        extractSingleFrame(rightPath, firstFrameMs),
      ]);

      console.log(T, `  generating transition video with Veo 3.1`);
      const videoId = uuid();
      const videoFilename = `${videoId}.mp4`;
      await generateTransitionVideo(prompt, videoFilename, startFrame, endFrame, {
        aspectRatio: `${state.dimensions.width}:${state.dimensions.height}`,
      });

      let durationMs = 5000;
      try {
        const probed = await probe(join(ASSETS_DIR, videoFilename));
        durationMs = probed.durationMs;
      } catch {}

      const videoAsset: Asset = {
        id: videoId,
        name: `Transition: ${prompt.slice(0, 40)}`,
        type: "generated_video",
        path: `/assets/${videoFilename}`,
        durationMs,
        width: state.dimensions.width,
        height: state.dimensions.height,
        generationPrompt: prompt,
        createdAt: Date.now(),
      };
      store.addAsset(videoAsset);

      const clipsToShift = currentTrack.clips
        .filter((c) => c.startMs >= rightClip.startMs)
        .sort((a, b) => b.startMs - a.startMs);

      const insertDiff: TimelineDiff = {
        id: uuid(),
        description: `Insert transition: ${prompt.slice(0, 40)}`,
        ops: [
          ...clipsToShift.map((c) => ({
            type: "move" as const,
            clipId: c.id,
            toTrackId: trkId,
            toStartMs: c.startMs + durationMs,
          })),
          {
            type: "insert_asset" as const,
            assetId: videoId,
            trackId: trkId,
            startMs: leftClip.startMs + leftClip.durationMs,
          },
        ],
      };
      store.addCommit(insertDiff, "ai");

      const finalState = store.getState();
      return {
        alreadyApplied: true,
        transitionAssetId: videoId,
        transitionDurationMs: durationMs,
        leftClipId: leftId,
        rightClipId: rightId,
        diff: insertDiff,
        resultingClips: finalState.tracks.find((t) => t.id === trkId)?.clips
          .slice().sort((a, b) => a.startMs - b.startMs)
          .map((c, i) => ({ clipNumber: i + 1, id: c.id, startMs: c.startMs, durationMs: c.durationMs })),
      };
    }

    case "extend_clip": {
      const { clipId: extClipId, prompt, trackId: extTrackId } = args as {
        clipId: string;
        prompt: string;
        trackId?: string;
      };
      const trkId = extTrackId ?? "V1";
      console.log(T, `extend_clip: clip=${extClipId} "${prompt.slice(0, 60)}"`);

      const state = store.getState();
      const track = state.tracks.find((t) => t.id === trkId);
      if (!track) return { error: `Track ${trkId} not found` };

      const clip = track.clips.find((c) => c.id === extClipId);
      if (!clip) return { error: `Clip ${extClipId} not found` };

      const asset = state.assets.find((a) => a.id === clip.assetId);
      if (!asset) return { error: `Asset not found for clip ${extClipId}` };

      const resolvePath = (p: string) => p.startsWith("/assets/") ? join(ASSETS_DIR, p.slice(8)) : p;
      const assetPath = resolvePath(asset.path);
      const videoId = uuid();
      const videoFilename = `${videoId}.mp4`;
      const isVeoGenerated = asset.type === "generated_video";

      if (isVeoGenerated) {
        console.log(T, `  extending Veo-generated video natively`);
        await extendVideo(prompt, assetPath, videoFilename);
      } else if (asset.type === "image") {
        console.log(T, `  using image asset directly for image-to-video`);
        const frame = Buffer.from(await Bun.file(assetPath).arrayBuffer());
        await generateVideoFromFrame(prompt, videoFilename, frame, {
          aspectRatio: `${state.dimensions.width}:${state.dimensions.height}`,
        });
      } else {
        const lastFrameMs = clip.inPointMs + clip.durationMs - 33;
        console.log(T, `  extracting last frame at ${lastFrameMs}ms for image-to-video`);
        const frame = await extractSingleFrame(assetPath, lastFrameMs);
        await generateVideoFromFrame(prompt, videoFilename, frame, {
          aspectRatio: `${state.dimensions.width}:${state.dimensions.height}`,
        });
      }

      let durationMs = 7000;
      try {
        const probed = await probe(join(ASSETS_DIR, videoFilename));
        durationMs = probed.durationMs;
      } catch {}

      const videoAsset: Asset = {
        id: videoId,
        name: `Extension: ${prompt.slice(0, 40)}`,
        type: "generated_video",
        path: `/assets/${videoFilename}`,
        durationMs,
        width: state.dimensions.width,
        height: state.dimensions.height,
        generationPrompt: prompt,
        createdAt: Date.now(),
      };
      store.addAsset(videoAsset);

      const clipEnd = clip.startMs + clip.durationMs;
      const clipsAfter = track.clips
        .filter((c) => c.startMs >= clipEnd)
        .sort((a, b) => b.startMs - a.startMs);

      const insertDiff: TimelineDiff = {
        id: uuid(),
        description: `Extend clip: ${prompt.slice(0, 40)}`,
        ops: [
          ...clipsAfter.map((c) => ({
            type: "move" as const,
            clipId: c.id,
            toTrackId: trkId,
            toStartMs: c.startMs + durationMs,
          })),
          {
            type: "insert_asset" as const,
            assetId: videoId,
            trackId: trkId,
            startMs: clipEnd,
          },
        ],
      };
      store.addCommit(insertDiff, "ai");

      const finalState = store.getState();
      return {
        alreadyApplied: true,
        extensionAssetId: videoId,
        extensionDurationMs: durationMs,
        isVeoExtend: isVeoGenerated,
        clipId: extClipId,
        diff: insertDiff,
        resultingClips: finalState.tracks.find((t) => t.id === trkId)?.clips
          .slice().sort((a, b) => a.startMs - b.startMs)
          .map((c, i) => ({ clipNumber: i + 1, id: c.id, startMs: c.startMs, durationMs: c.durationMs })),
      };
    }

    case "auto_edit": {
      const state = store.getState();
      const videoClips = state.tracks
        .filter((t) => t.type === "video")
        .flatMap((t) => t.clips);

      const steps: string[] = [];

      if (videoClips.length === 0) {
        return {
          instructions: "No video clips found on the timeline. Please import a video first and place it on the timeline before running auto edit.",
        };
      }

      steps.push(
        "Step 1: ANALYZE — Call analyze_segment on each video clip to understand the content. Use the full duration of each clip.",
      );
      steps.push(
        "Step 2: EDIT — Based on the analysis, create smart cuts. Remove silent or uninteresting sections using ripple_delete after splitting. Keep the most visually interesting segments.",
      );
      steps.push(
        "Step 3: SOUNDTRACK — Call generate_and_place_audio with a music prompt that matches the mood discovered during analysis.",
      );
      steps.push(
        "Step 4: TITLE CARD — Call generate_and_insert_image to create a title card. Insert it at the beginning (startMs: 0) with insertOnTimeline: true.",
      );
      steps.push(
        "Step 5: CAPTIONS — Add captions based on the transcript discovered during analysis using apply_timeline_diff with add_captions ops.",
      );

      return {
        instructions: steps.join("\n\n"),
        videoClipCount: videoClips.length,
        clips: videoClips.map((c) => ({
          id: c.id,
          startMs: c.startMs,
          durationMs: c.durationMs,
        })),
        projectDurationMs: state.durationMs,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
