"use client";

import { useCallback, useEffect, useState } from "react";
import { useTimelinePlayback } from "@/lib/hooks/useTimelinePlayback";

const YEAR_MIN = -1000;
const YEAR_MAX = new Date().getFullYear();

export type TimeWindow = { start: number; end: number };

type TimelineProps = {
  window: TimeWindow;
  onWindowChange: (window: TimeWindow) => void;
};

function clampYear(year: number): number {
  return Math.max(YEAR_MIN, Math.min(YEAR_MAX, year));
}

export function Timeline({ window, onWindowChange }: TimelineProps) {
  const [inputStart, setInputStart] = useState(String(window.start));
  const [inputEnd, setInputEnd] = useState(String(window.end));

  const windowStart = clampYear(window.start);
  const windowEnd = clampYear(window.end);
  const windowSize = windowEnd - windowStart + 1;

  // Sync inputs when window is changed externally (e.g. by play)
  useEffect(() => {
    setInputStart(String(windowStart));
    setInputEnd(String(windowEnd));
  }, [windowStart, windowEnd]);

  const handleNext = useCallback(() => {
    const nextStart = clampYear(windowStart + 1);
    onWindowChange({ start: nextStart, end: clampYear(nextStart + windowSize - 1) });
  }, [windowStart, windowSize, onWindowChange]);

  const { isPlaying, setIsPlaying, canPlay } = useTimelinePlayback({
    currentStart: windowStart,
    maxStart: YEAR_MAX - 1,
    onNext: handleNext,
  });

  const handleConfirm = useCallback(() => {
    const s = parseInt(inputStart, 10);
    const e = parseInt(inputEnd, 10);
    if (!Number.isNaN(s) && !Number.isNaN(e) && s <= e) {
      onWindowChange({ start: clampYear(s), end: clampYear(e) });
    }
  }, [inputStart, inputEnd, onWindowChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleConfirm();
    },
    [handleConfirm]
  );

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/95 px-5 py-3 shadow-xl backdrop-blur">
      <button
        type="button"
        onClick={() => setIsPlaying((p) => !p)}
        disabled={!canPlay && !isPlaying}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-amber-500/60 bg-amber-500/20 text-amber-400 transition hover:bg-amber-500/30 disabled:opacity-40 disabled:hover:bg-amber-500/20"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <span className="rounded-lg border-2 border-amber-500/60 bg-amber-500/15 px-4 py-1.5 font-mono text-base font-semibold tabular-nums text-amber-400">
        {windowStart} – {windowEnd}
      </span>

      <div className="flex items-center gap-2">
        <input
          type="number"
          value={inputStart}
          onChange={(e) => setInputStart(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-24 rounded-lg border border-white/20 bg-zinc-800 px-2 py-1.5 font-mono text-sm text-white focus:border-amber-500/60 focus:outline-none"
          aria-label="Start year"
        />
        <span className="text-xs text-white/40">to</span>
        <input
          type="number"
          value={inputEnd}
          onChange={(e) => setInputEnd(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-24 rounded-lg border border-white/20 bg-zinc-800 px-2 py-1.5 font-mono text-sm text-white focus:border-amber-500/60 focus:outline-none"
          aria-label="End year"
        />
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-lg border border-amber-500/60 bg-amber-500/20 px-3 py-1.5 text-sm text-amber-400 transition hover:bg-amber-500/30"
        >
          Set
        </button>
      </div>
    </div>
  );
}
