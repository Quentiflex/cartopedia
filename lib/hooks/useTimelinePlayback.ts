import { useEffect, useState } from "react";

const PLAY_INTERVAL_MS = 600;

type UseTimelinePlaybackOptions = {
  currentStart: number;
  maxStart: number;
  onNext: () => void;
};

/**
 * Custom hook for timeline playback functionality
 * Handles play/pause state and automatic progression
 */
export function useTimelinePlayback({
  currentStart,
  maxStart,
  onNext,
}: UseTimelinePlaybackOptions) {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;
    
    // Auto-stop at the end
    if (currentStart >= maxStart) {
      setIsPlaying(false);
      return;
    }

    const id = setInterval(() => {
      if (currentStart >= maxStart) {
        setIsPlaying(false);
      } else {
        onNext();
      }
    }, PLAY_INTERVAL_MS);

    return () => clearInterval(id);
  }, [isPlaying, currentStart, maxStart, onNext]);

  return {
    isPlaying,
    setIsPlaying,
    canPlay: currentStart < maxStart,
  };
}
