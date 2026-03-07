import {
  Composition,
  VideoClip,
  ImageClip,
  AudioClip,
  TextClip,
  Encoder,
  Source,
} from "@diffusionstudio/core";
import type { ProjectState, Caption, CaptionStyle } from "@shared/types";

type Hex = `#${string}`;

const log = (...args: unknown[]) => console.log("%c[comp]", "color:#e879f9", ...args);
const warn = (...args: unknown[]) => console.warn("%c[comp]", "color:#e879f9", ...args);
const err = (...args: unknown[]) => console.error("%c[comp]", "color:#e879f9", ...args);

class CompositionManager {
  composition: Composition;
  private _syncedProjectHash = "";
  private _syncInProgress = false;
  private _pendingProject: ProjectState | null = null;

  constructor() {
    this.composition = new Composition({
      width: 1080,
      height: 1920,
      background: "#000000",
    });
    log("composition created", { width: 1080, height: 1920 });
  }

  mount(container: HTMLDivElement) {
    this.composition.mount(container);
    log("mounted to DOM");
  }

  unmount() {
    this.composition.unmount();
    log("unmounted");
  }

  async play() {
    log("play");
    await this.composition.play();
  }

  async pause() {
    log("pause");
    await this.composition.pause();
  }

  async seek(ms: number) {
    log("seek →", ms, "ms");
    await this.composition.seek(`${ms}ms`);
  }

  getCurrentTimeMs(): number {
    return this.composition.currentTime * 1000;
  }

  get playing(): boolean {
    return this.composition.playing;
  }

  async syncFromProject(project: ProjectState) {
    if (this._syncInProgress) {
      log("sync queued (already in progress)");
      this._pendingProject = project;
      return;
    }

    const hash = JSON.stringify({
      tracks: project.tracks,
      assets: project.assets,
      captions: project.captions,
      captionStyle: project.captionStyle,
    });
    if (hash === this._syncedProjectHash) {
      log("sync skipped (no changes)");
      return;
    }

    this._syncInProgress = true;
    this._syncedProjectHash = hash;

    const totalClips = project.tracks.reduce((s, t) => s + t.clips.length, 0);
    log("sync START", {
      durationMs: project.durationMs,
      tracks: project.tracks.length,
      clips: totalClips,
      captions: project.captions.length,
      assets: project.assets.length,
      clipDetails: project.tracks.flatMap((t) =>
        t.clips.map((c) => ({ id: c.id.slice(0, 8), asset: c.assetId.slice(0, 8), start: c.startMs, dur: c.durationMs, track: t.id }))
      ),
    });
    log("sync triggered from:", new Error().stack?.split("\n").slice(1, 4).join(" <- "));

    try {
      const wasPlaying = this.composition.playing;
      const currentTime = this.composition.currentTime;
      if (wasPlaying) {
        log("pausing before rebuild");
        await this.composition.pause();
      }

      this.composition.clear();
      log("cleared composition");

      for (const track of project.tracks) {
        if (track.type === "video") {
          for (const clip of track.clips) {
            const asset = project.assets.find((a) => a.id === clip.assetId);
            if (!asset) {
              warn("skip clip — asset not found", { clipId: clip.id, assetId: clip.assetId });
              continue;
            }

            const layer = this.composition.createLayer();

            if (asset.type === "image") {
              log("loading image", { clipId: clip.id, path: asset.path, startMs: clip.startMs, durationMs: clip.durationMs });
              try {
                const source = await Source.from(asset.path);
                const imgClip = new ImageClip(source as any, {
                  position: "center",
                  height: "100%",
                });
                await layer.add(imgClip);
                imgClip.delay = `${clip.startMs}ms`;
                imgClip.duration = `${clip.durationMs}ms`;
                log("  ✓ image added", { delay: imgClip.delay, duration: imgClip.duration, end: imgClip.end });
              } catch (e) {
                err("  ✗ image failed", asset.path, e);
              }
            } else {
              log("loading video", { clipId: clip.id, path: asset.path, startMs: clip.startMs, inMs: clip.inPointMs, outMs: clip.outPointMs });
              try {
                const source = await Source.from(asset.path);
                const vidClip = new VideoClip(source as any, {
                  position: "center",
                  height: "100%",
                });
                await layer.add(vidClip);
                vidClip.delay = `${clip.startMs}ms`;
                vidClip.trim(`${clip.inPointMs}ms`, `${clip.outPointMs}ms`);
                log("  ✓ video added", { delay: vidClip.delay, duration: vidClip.duration, end: vidClip.end });
              } catch (e) {
                err("  ✗ video failed", asset.path, e);
              }
            }
          }
        }

        if (track.type === "audio") {
          for (const clip of track.clips) {
            const asset = project.assets.find((a) => a.id === clip.assetId);
            if (!asset) {
              warn("skip audio — asset not found", { clipId: clip.id, assetId: clip.assetId });
              continue;
            }

            log("loading audio", { clipId: clip.id, path: asset.path, startMs: clip.startMs });
            try {
              const layer = this.composition.createLayer();
              const source = await Source.from(asset.path);
              const audioClip = new AudioClip(source as any);
              await layer.add(audioClip);
              audioClip.delay = `${clip.startMs}ms`;
              audioClip.trim(`${clip.inPointMs}ms`, `${clip.outPointMs}ms`);
              log("  ✓ audio added", { delay: audioClip.delay, duration: audioClip.duration, end: audioClip.end });
            } catch (e) {
              err("  ✗ audio failed", asset.path, e);
            }
          }
        }
      }

      if (project.captions.length > 0) {
        log("adding captions", { count: project.captions.length });
        await this.addCaptions(project.captions, project.captionStyle);
      }

      log("composition duration after rebuild:", this.composition.duration, "s");
      log("layers:", this.composition.layers.length);
      for (const [i, layer] of this.composition.layers.entries()) {
        const clips = (layer as any).clips ?? [];
        for (const c of clips) {
          log(`  layer[${i}] clip:`, {
            type: c.constructor?.name,
            delay: c.delay,
            duration: c.duration,
            start: c.start,
            end: c.end,
            range: c.range,
          });
        }
      }

      await this.composition.seek(`${currentTime}s`);
      log("seeked to", currentTime, "s");

      if (wasPlaying) {
        await this.composition.play();
        log("resumed playback");
      }

      log("sync DONE ✓");
    } catch (e) {
      err("sync FAILED", e);
    } finally {
      this._syncInProgress = false;
      if (this._pendingProject) {
        log("processing queued sync");
        const next = this._pendingProject;
        this._pendingProject = null;
        await this.syncFromProject(next);
      }
    }
  }

  private async addCaptions(captions: Caption[], style: CaptionStyle) {
    const positionY = style.position === "top" ? "8%" : style.position === "center" ? "50%" : "92%";
    const maxWidth = Math.round(this.composition.width * 0.75);

    for (const caption of captions) {
      if (caption.words && caption.words.length > 0) {
        for (const word of caption.words) {
          try {
            const layer = this.composition.createLayer();
            const textClip = new TextClip({
              text: word.text.toUpperCase(),
              font: { family: style.fontFamily, size: style.fontSize, weight: "800" },
              color: style.highlightColor as Hex,
              position: "center",
              maxWidth,
            });
            textClip.y = positionY as any;
            textClip.strokes = [{ color: style.strokeColor as Hex, width: style.strokeWidth }];
            await layer.add(textClip);
            textClip.delay = `${word.fromMs}ms`;
            textClip.duration = `${word.toMs - word.fromMs}ms`;
          } catch (e) {
            err("caption word failed", word.text, e);
          }
        }
      } else {
        try {
          const layer = this.composition.createLayer();
          const textClip = new TextClip({
            text: caption.text,
            font: { family: style.fontFamily, size: style.fontSize, weight: "800" },
            color: style.color as Hex,
            position: "center",
            maxWidth,
          });
          textClip.y = positionY as any;
          textClip.strokes = [{ color: style.strokeColor as Hex, width: style.strokeWidth }];
          await layer.add(textClip);
          textClip.delay = `${caption.startMs}ms`;
          textClip.duration = `${caption.durationMs}ms`;
        } catch (e) {
          err("caption failed", caption.text, e);
        }
      }
    }
    log("  ✓ captions added");
  }

  async export(
    onProgress?: (progress: { total: number; progress: number; remaining: Date }) => void
  ) {
    log("export starting");
    const encoder = new Encoder(this.composition, {
      video: { fps: 30, resolution: 1 },
    });
    if (onProgress) encoder.onProgress = onProgress;
    return encoder.render();
  }
}

export const compositionManager = new CompositionManager();
