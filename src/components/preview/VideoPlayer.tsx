import { useMemo, useEffect, useRef, type RefObject } from "react";
import type { ProjectState, Caption } from "@shared/types";

interface VideoPlayerProps {
  project: ProjectState | null;
  currentTimeMs: number;
  videoRef: RefObject<HTMLVideoElement | null>;
  audioRef: RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}

export function VideoPlayer({ project, currentTimeMs, videoRef, audioRef, isPlaying }: VideoPlayerProps) {
  const prevAssetIdRef = useRef<string | null>(null);

  const activeClip = useMemo(() => {
    if (!project) return null;
    const videoTrack = project.tracks.find((t) => t.type === "video");
    if (!videoTrack) return null;
    return videoTrack.clips.find(
      (c) => currentTimeMs >= c.startMs && currentTimeMs < c.startMs + c.durationMs
    ) ?? null;
  }, [project, currentTimeMs]);

  const activeAsset = useMemo(() => {
    if (!activeClip || !project) return null;
    return project.assets.find((a) => a.id === activeClip.assetId) ?? null;
  }, [activeClip, project]);

  const audioClip = useMemo(() => {
    if (!project) return null;
    const audioTrack = project.tracks.find((t) => t.type === "audio");
    if (!audioTrack) return null;
    return audioTrack.clips.find(
      (c) => currentTimeMs >= c.startMs && currentTimeMs < c.startMs + c.durationMs
    ) ?? null;
  }, [project, currentTimeMs]);

  const audioAsset = useMemo(() => {
    if (!audioClip || !project) return null;
    return project.assets.find((a) => a.id === audioClip.assetId) ?? null;
  }, [audioClip, project]);

  const activeCaption = useMemo(() => {
    if (!project) return null;
    return project.captions.find(
      (c: Caption) => currentTimeMs >= c.startMs && currentTimeMs < c.startMs + c.durationMs
    ) ?? null;
  }, [project, currentTimeMs]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !activeAsset || activeAsset.type === "image") return;

    const assetChanged = prevAssetIdRef.current !== activeAsset.id;
    prevAssetIdRef.current = activeAsset.id;

    if (assetChanged) {
      el.src = activeAsset.path;
      el.load();
      if (activeClip) {
        el.currentTime = (currentTimeMs - activeClip.startMs + activeClip.inPointMs) / 1000;
      }
      if (isPlaying) el.play().catch(() => {});
    } else if (isPlaying && el.paused) {
      el.play().catch(() => {});
    } else if (!isPlaying && !el.paused) {
      el.pause();
    }
  }, [activeAsset, activeClip, isPlaying, videoRef, currentTimeMs]);

  useEffect(() => {
    if (!activeAsset) {
      prevAssetIdRef.current = null;
      if (videoRef.current) videoRef.current.pause();
    }
  }, [activeAsset, videoRef]);

  useEffect(() => {
    if (!audioRef.current || !audioAsset) return;
    const el = audioRef.current;
    if (!el.src.endsWith(audioAsset.path)) {
      el.src = audioAsset.path;
      el.load();
      if (isPlaying) el.play().catch(() => {});
    } else if (isPlaying && el.paused) {
      el.play().catch(() => {});
    } else if (!isPlaying && !el.paused) {
      el.pause();
    }
  }, [audioAsset, audioRef, isPlaying]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (!audioClip) {
      audioRef.current.pause();
    }
  }, [audioClip, audioRef]);

  const isImage = activeAsset?.type === "image";
  const captionStyle = project?.captionStyle;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {activeAsset ? (
        isImage ? (
          <img
            src={activeAsset.path}
            className="h-full w-full object-contain"
            alt=""
          />
        ) : (
          <video
            ref={videoRef}
            className="h-full w-full object-contain"
            playsInline
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-sm text-muted-foreground">No video at playhead</span>
        </div>
      )}
      <audio ref={audioRef} className="hidden" />
      {activeCaption && captionStyle && (
        <div
          className="absolute inset-x-0 flex justify-center px-4 pointer-events-none"
          style={{
            [captionStyle.position === "top" ? "top" : captionStyle.position === "center" ? "top" : "bottom"]:
              captionStyle.position === "center" ? "50%" : "8%",
            transform: captionStyle.position === "center" ? "translateY(-50%)" : undefined,
          }}
        >
          <div
            className="flex flex-wrap justify-center gap-x-[0.2em] gap-y-1 text-center"
            style={{
              fontFamily: captionStyle.fontFamily,
              fontSize: `${captionStyle.fontSize / 3}px`,
              fontWeight: 800,
              textTransform: "uppercase" as const,
            }}
          >
            {activeCaption.words && activeCaption.words.length > 0 ? (
              activeCaption.words.map((word, i) => {
                const isActive = currentTimeMs >= word.fromMs && currentTimeMs < word.toMs;
                const isPast = currentTimeMs >= word.toMs;
                return (
                  <span
                    key={i}
                    className="inline-block transition-transform duration-100"
                    style={{
                      color: isActive ? captionStyle.highlightColor : captionStyle.color,
                      WebkitTextStroke: `${captionStyle.strokeWidth}px ${captionStyle.strokeColor}`,
                      paintOrder: "stroke fill",
                      transform: isActive ? "scale(1.15)" : "scale(1)",
                      opacity: isPast || isActive ? 1 : 0.7,
                      textShadow: `0 2px 8px rgba(0,0,0,0.5)`,
                    }}
                  >
                    {word.text}
                  </span>
                );
              })
            ) : (
              activeCaption.text.split(" ").map((word, i) => (
                <span
                  key={i}
                  className="inline-block"
                  style={{
                    color: captionStyle.color,
                    WebkitTextStroke: `${captionStyle.strokeWidth}px ${captionStyle.strokeColor}`,
                    paintOrder: "stroke fill",
                    textShadow: `0 2px 8px rgba(0,0,0,0.5)`,
                  }}
                >
                  {word}
                </span>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
