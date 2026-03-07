import { v4 as uuid } from "uuid";
import type {
  ProjectState,
  DiffOp,
  TimelineDiff,
  Clip,
  Track,
  Caption,
  CaptionWord,
} from "./types.ts";

function findClip(state: ProjectState, clipId: string): { track: Track; clip: Clip; index: number } | null {
  for (const track of state.tracks) {
    const index = track.clips.findIndex((c) => c.id === clipId);
    if (index !== -1) return { track, clip: track.clips[index]!, index };
  }
  return null;
}

function findTrack(state: ProjectState, trackId: string): Track | null {
  return state.tracks.find((t) => t.id === trackId) ?? null;
}

function recalcDuration(state: ProjectState): void {
  let max = 0;
  for (const track of state.tracks) {
    for (const clip of track.clips) {
      max = Math.max(max, clip.startMs + clip.durationMs);
    }
  }
  for (const cap of state.captions) {
    max = Math.max(max, cap.startMs + cap.durationMs);
  }
  state.durationMs = max;
}

export function applyOp(state: ProjectState, op: DiffOp): ProjectState {
  const s = structuredClone(state);

  switch (op.type) {
    case "split": {
      const found = findClip(s, op.clipId);
      if (!found) break;
      const { track, clip, index } = found;
      const relativeAt = op.atMs - clip.startMs;
      if (relativeAt <= 0 || relativeAt >= clip.durationMs) break;

      const clip1: Clip = {
        ...clip,
        id: op.newClipId1 ?? uuid(),
        durationMs: relativeAt,
        outPointMs: clip.inPointMs + relativeAt,
      };
      const clip2: Clip = {
        ...clip,
        id: op.newClipId2 ?? uuid(),
        startMs: clip.startMs + relativeAt,
        durationMs: clip.durationMs - relativeAt,
        inPointMs: clip.inPointMs + relativeAt,
      };
      track.clips.splice(index, 1, clip1, clip2);
      break;
    }

    case "trim": {
      const found = findClip(s, op.clipId);
      if (!found) break;
      const { clip } = found;
      if (op.newInPointMs !== undefined) clip.inPointMs = op.newInPointMs;
      if (op.newOutPointMs !== undefined) clip.outPointMs = op.newOutPointMs;
      if (op.newStartMs !== undefined) clip.startMs = op.newStartMs;
      if (op.newDurationMs !== undefined) clip.durationMs = op.newDurationMs;
      break;
    }

    case "ripple_delete": {
      const found = findClip(s, op.clipId);
      if (!found) break;
      const { track, clip, index } = found;
      const gap = clip.durationMs;
      track.clips.splice(index, 1);
      for (let i = index; i < track.clips.length; i++) {
        track.clips[i]!.startMs -= gap;
      }
      break;
    }

    case "move": {
      const found = findClip(s, op.clipId);
      if (!found) break;
      const { track: srcTrack, clip, index } = found;
      const oldStart = clip.startMs;
      const oldEnd = clip.startMs + clip.durationMs;
      const delta = op.toStartMs - oldStart;
      srcTrack.clips.splice(index, 1);
      const destTrack = findTrack(s, op.toTrackId);
      if (!destTrack) break;
      clip.trackId = op.toTrackId;
      clip.startMs = op.toStartMs;
      destTrack.clips.push(clip);
      destTrack.clips.sort((a, b) => a.startMs - b.startMs);
      if (delta !== 0) {
        for (const cap of s.captions) {
          const capEnd = cap.startMs + cap.durationMs;
          if (cap.startMs >= oldStart && capEnd <= oldEnd) {
            cap.startMs += delta;
            if (cap.words) {
              for (const w of cap.words) {
                w.fromMs += delta;
                w.toMs += delta;
              }
            }
          }
        }
      }
      break;
    }

    case "insert_asset": {
      const asset = s.assets.find((a) => a.id === op.assetId);
      if (!asset) break;
      const track = findTrack(s, op.trackId);
      if (!track) break;
      const inPt = op.inPointMs ?? 0;
      const outPt = op.outPointMs ?? asset.durationMs;
      const clip: Clip = {
        id: uuid(),
        assetId: op.assetId,
        trackId: op.trackId,
        startMs: op.startMs,
        durationMs: outPt - inPt,
        inPointMs: inPt,
        outPointMs: outPt,
      };
      track.clips.push(clip);
      track.clips.sort((a, b) => a.startMs - b.startMs);
      break;
    }

    case "add_captions": {
      let trackId = op.trackId;
      if (!trackId) {
        const capTrack = s.tracks.find((t) => t.type === "caption");
        trackId = capTrack?.id ?? "C1";
      }
      for (const cap of op.captions) {
        const words: CaptionWord[] | undefined = (cap as any).words;
        const caption: Caption = {
          id: uuid(),
          trackId,
          startMs: cap.startMs,
          durationMs: cap.durationMs,
          text: cap.text,
          words,
        };
        s.captions.push(caption);
      }
      break;
    }

    case "set_music": {
      let trackId = op.trackId;
      if (!trackId) {
        const audioTrack = s.tracks.find((t) => t.type === "audio");
        trackId = audioTrack?.id ?? "A1";
      }
      const asset = s.assets.find((a) => a.id === op.assetId);
      if (!asset) break;
      const track = findTrack(s, trackId);
      if (!track) break;
      track.clips = track.clips.filter((c) => {
        const a = s.assets.find((a) => a.id === c.assetId);
        return a?.type !== "audio" && a?.type !== "generated_music";
      });
      const clip: Clip = {
        id: uuid(),
        assetId: op.assetId,
        trackId,
        startMs: op.startMs ?? 0,
        durationMs: asset.durationMs,
        inPointMs: 0,
        outPointMs: asset.durationMs,
      };
      track.clips.push(clip);
      break;
    }

    case "duck_music": {
      const track = findTrack(s, op.trackId);
      if (!track) break;
      for (const clip of track.clips) {
        const asset = s.assets.find((a) => a.id === clip.assetId);
        if (!asset || (asset.type !== "audio" && asset.type !== "generated_music")) continue;
        for (const seg of op.segments) {
          if (seg.startMs < clip.startMs + clip.durationMs && seg.endMs > clip.startMs) {
            (clip as any).volume = seg.volume;
          }
        }
      }
      break;
    }

    case "add_track": {
      const id = `${op.trackType.charAt(0).toUpperCase()}${s.tracks.filter((t) => t.type === op.trackType).length + 1}`;
      s.tracks.push({
        id,
        type: op.trackType,
        label: op.label,
        clips: [],
        muted: false,
        locked: false,
      });
      break;
    }

    case "remove_clip": {
      const found = findClip(s, op.clipId);
      if (!found) break;
      found.track.clips.splice(found.index, 1);
      break;
    }
  }

  recalcDuration(s);
  s.updatedAt = Date.now();
  return s;
}

export function applyDiff(state: ProjectState, diff: TimelineDiff): ProjectState {
  let current = state;
  for (const op of diff.ops) {
    current = applyOp(current, op);
  }
  return current;
}
