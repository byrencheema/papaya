export type AssetType = "video" | "audio" | "image" | "generated_video" | "generated_music";

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  path: string;
  durationMs: number;
  width?: number;
  height?: number;
  thumbnailPath?: string;
  generationPrompt?: string;
  createdAt: number;
}

export type TrackType = "video" | "audio" | "caption";

export interface Track {
  id: string;
  type: TrackType;
  label: string;
  clips: Clip[];
  muted: boolean;
  locked: boolean;
}

export interface Clip {
  id: string;
  assetId: string;
  trackId: string;
  startMs: number;
  durationMs: number;
  inPointMs: number;
  outPointMs: number;
}

export interface CaptionWord {
  text: string;
  fromMs: number;
  toMs: number;
}

export interface Caption {
  id: string;
  trackId: string;
  startMs: number;
  durationMs: number;
  text: string;
  words?: CaptionWord[];
}

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  highlightColor: string;
  strokeColor: string;
  strokeWidth: number;
  position: "top" | "center" | "bottom";
}

export interface ProjectState {
  id: string;
  name: string;
  dimensions: { width: number; height: number };
  tracks: Track[];
  assets: Asset[];
  captions: Caption[];
  captionStyle: CaptionStyle;
  durationMs: number;
  createdAt: number;
  updatedAt: number;
}

export type DiffOpType =
  | "split"
  | "trim"
  | "ripple_delete"
  | "move"
  | "insert_asset"
  | "add_captions"
  | "set_music"
  | "duck_music"
  | "add_track"
  | "remove_clip";

export interface SplitOp {
  type: "split";
  clipId: string;
  atMs: number;
  newClipId1?: string;
  newClipId2?: string;
}

export interface TrimOp {
  type: "trim";
  clipId: string;
  newInPointMs?: number;
  newOutPointMs?: number;
  newStartMs?: number;
  newDurationMs?: number;
}

export interface RippleDeleteOp {
  type: "ripple_delete";
  clipId: string;
}

export interface MoveOp {
  type: "move";
  clipId: string;
  toTrackId: string;
  toStartMs: number;
}

export interface InsertAssetOp {
  type: "insert_asset";
  assetId: string;
  trackId: string;
  startMs: number;
  inPointMs?: number;
  outPointMs?: number;
}

export interface AddCaptionsOp {
  type: "add_captions";
  captions: Array<{
    text: string;
    startMs: number;
    durationMs: number;
    words?: CaptionWord[];
  }>;
  trackId?: string;
}

export interface SetMusicOp {
  type: "set_music";
  assetId: string;
  trackId?: string;
  startMs?: number;
}

export interface DuckMusicOp {
  type: "duck_music";
  trackId: string;
  segments: Array<{
    startMs: number;
    endMs: number;
    volume: number;
  }>;
}

export interface AddTrackOp {
  type: "add_track";
  trackType: TrackType;
  label: string;
}

export interface RemoveClipOp {
  type: "remove_clip";
  clipId: string;
}

export type DiffOp =
  | SplitOp
  | TrimOp
  | RippleDeleteOp
  | MoveOp
  | InsertAssetOp
  | AddCaptionsOp
  | SetMusicOp
  | DuckMusicOp
  | AddTrackOp
  | RemoveClipOp;

export interface TimelineDiff {
  id: string;
  description: string;
  ops: DiffOp[];
}

export type CommitSource = "user" | "ai";

export interface Commit {
  id: string;
  diff: TimelineDiff;
  snapshotBefore: string;
  source: CommitSource;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  plan?: string;
  diff?: TimelineDiff;
  status?: "pending" | "streaming" | "done" | "error";
  statusText?: string;
  createdAt: number;
}

export interface SSEEvent {
  type: "plan" | "diff" | "applied_diff" | "done" | "error" | "status";
  data: string;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: "'Inter', system-ui, sans-serif",
  fontSize: 48,
  color: "#FFFFFF",
  highlightColor: "#FFFFFF",
  strokeColor: "#000000",
  strokeWidth: 5,
  position: "bottom",
};

export const DEFAULT_DIMENSIONS = { width: 1080, height: 1920 };

export function createEmptyProject(id: string, name: string): ProjectState {
  return {
    id,
    name,
    dimensions: { ...DEFAULT_DIMENSIONS },
    tracks: [
      { id: "V1", type: "video", label: "Video 1", clips: [], muted: false, locked: false },
      { id: "A1", type: "audio", label: "Audio 1", clips: [], muted: false, locked: false },
      { id: "C1", type: "caption", label: "Captions", clips: [], muted: false, locked: false },
    ],
    assets: [],
    captions: [],
    captionStyle: { ...DEFAULT_CAPTION_STYLE },
    durationMs: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
