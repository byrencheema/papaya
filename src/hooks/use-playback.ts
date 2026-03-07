import { useState, useRef, useCallback, useEffect } from "react";
import type { ProjectState } from "@shared/types";

export function usePlayback(durationMs: number, project: ProjectState | null) {
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const syncMedia = useCallback(
    (ms: number) => {
      if (!project) return;

      const videoTrack = project.tracks.find((t) => t.type === "video");
      const activeClip = videoTrack?.clips.find(
        (c) => ms >= c.startMs && ms < c.startMs + c.durationMs
      );

      if (videoRef.current && activeClip) {
        const asset = project.assets.find((a) => a.id === activeClip.assetId);
        if (asset && asset.type !== "image") {
          const clipLocalTime = (ms - activeClip.startMs + activeClip.inPointMs) / 1000;
          const drift = Math.abs(videoRef.current.currentTime - clipLocalTime);
          if (drift > 0.15) {
            videoRef.current.currentTime = clipLocalTime;
          }
        }
      }

      const audioTrack = project.tracks.find((t) => t.type === "audio");
      const audioClip = audioTrack?.clips.find(
        (c) => ms >= c.startMs && ms < c.startMs + c.durationMs
      );

      if (audioRef.current && audioClip) {
        const audioAsset = project.assets.find((a) => a.id === audioClip.assetId);
        if (audioAsset) {
          if (audioRef.current.src !== audioAsset.path && !audioRef.current.src.endsWith(audioAsset.path)) {
            audioRef.current.src = audioAsset.path;
            audioRef.current.load();
          }
          const audioLocalTime = (ms - audioClip.startMs + audioClip.inPointMs) / 1000;
          const audioDrift = Math.abs(audioRef.current.currentTime - audioLocalTime);
          if (audioDrift > 0.15) {
            audioRef.current.currentTime = audioLocalTime;
          }
        }
      }
    },
    [project]
  );

  const play = useCallback(() => {
    setIsPlaying(true);
    lastFrameRef.current = performance.now();
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
    if (audioRef.current && audioRef.current.src) {
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback(
    (ms: number) => {
      const clamped = Math.max(0, Math.min(ms, durationMs));
      setCurrentTimeMs(clamped);
      syncMedia(clamped);
    },
    [durationMs, syncMedia]
  );

  useEffect(() => {
    if (!isPlaying) return;

    const tick = (now: number) => {
      const delta = now - lastFrameRef.current;
      lastFrameRef.current = now;

      setCurrentTimeMs((prev) => {
        const next = prev + delta;
        if (next >= durationMs) {
          setIsPlaying(false);
          if (videoRef.current) videoRef.current.pause();
          if (audioRef.current) audioRef.current.pause();
          return 0;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    lastFrameRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isPlaying, durationMs]);

  useEffect(() => {
    if (isPlaying) {
      syncMedia(currentTimeMs);
    }
  }, [currentTimeMs, isPlaying, syncMedia]);

  return {
    currentTimeMs,
    isPlaying,
    play,
    pause,
    togglePlayback,
    seek,
    videoRef,
    audioRef,
  };
}
