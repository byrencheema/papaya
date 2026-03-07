import { useState, useCallback, useEffect } from "react";
import { compositionManager } from "@/lib/composition-manager";

export function usePlayback(durationMs: number) {
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const unsub = compositionManager.composition.on("playback:time", () => {
      const ms = compositionManager.getCurrentTimeMs();
      setCurrentTimeMs(ms);
    });
    const unsubEnd = compositionManager.composition.on("playback:end", () => {
      setIsPlaying(false);
      setCurrentTimeMs(0);
    });
    return () => {
      unsub();
      unsubEnd();
    };
  }, []);

  const play = useCallback(async () => {
    setIsPlaying(true);
    await compositionManager.play();
  }, []);

  const pause = useCallback(async () => {
    setIsPlaying(false);
    await compositionManager.pause();
  }, []);

  const togglePlayback = useCallback(async () => {
    if (compositionManager.playing) {
      await pause();
    } else {
      await play();
    }
  }, [play, pause]);

  const seek = useCallback(
    async (ms: number) => {
      const clamped = Math.max(0, Math.min(ms, durationMs));
      setCurrentTimeMs(clamped);
      await compositionManager.seek(clamped);
    },
    [durationMs]
  );

  return {
    currentTimeMs,
    isPlaying,
    play,
    pause,
    togglePlayback,
    seek,
  };
}
