"use client";

import { useCallback, useMemo } from "react";
import { useTimelineScroll } from "@/lib/hooks/useTimelineScroll";
import { useTimelinePlayback } from "@/lib/hooks/useTimelinePlayback";

const YEAR_MIN = 1820;
const YEAR_MAX = 2000;
const YEAR_RANGE = YEAR_MAX - YEAR_MIN;
const WINDOW_SIZE = 5;
const YEAR_WIDTH_PX = 52;
const WINDOW_WIDTH_PX = WINDOW_SIZE * YEAR_WIDTH_PX;
const STRIP_WIDTH_PX = (YEAR_RANGE + 1) * YEAR_WIDTH_PX;
const MAX_WINDOW_START = YEAR_MAX - WINDOW_SIZE + 1;

export type TimeWindow = { start: number; end: number };

type TimelineProps = {
  window: TimeWindow;
  onWindowChange: (window: TimeWindow) => void;
};

function clampWindowStart(start: number): number {
  return Math.max(YEAR_MIN, Math.min(MAX_WINDOW_START, start));
}

export function Timeline({ window, onWindowChange }: TimelineProps) {
  const windowStartClamped = clampWindowStart(window.start);
  const windowEndClamped = Math.min(YEAR_MAX, windowStartClamped + WINDOW_SIZE - 1);

  // Handle window start change
  const handleWindowStartChange = useCallback(
    (start: number) => {
      onWindowChange({ start, end: Math.min(YEAR_MAX, start + WINDOW_SIZE - 1) });
    },
    [onWindowChange]
  );

  // Playback controls
  const handleNext = useCallback(() => {
    const nextStart = clampWindowStart(windowStartClamped + 1);
    handleWindowStartChange(nextStart);
  }, [windowStartClamped, handleWindowStartChange]);

  const { isPlaying, setIsPlaying, canPlay } = useTimelinePlayback({
    currentStart: windowStartClamped,
    maxStart: MAX_WINDOW_START,
    onNext: handleNext,
  });

  // Scroll and drag controls
  const {
    scrollRef,
    handleScroll,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useTimelineScroll({
    windowStart: windowStartClamped,
    yearMin: YEAR_MIN,
    yearMax: YEAR_MAX,
    isPlaying,
    onWindowStartChange: handleWindowStartChange,
    clampWindowStart,
  });

  // Memoize years array
  const years = useMemo(
    () => Array.from({ length: YEAR_RANGE + 1 }, (_, i) => YEAR_MIN + i),
    []
  );

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-6">
      <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-zinc-900/95 px-4 py-4 shadow-xl backdrop-blur">
        <div className="mb-3 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            disabled={!canPlay && !isPlaying}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-amber-500/60 bg-amber-500/20 text-amber-400 shadow-lg transition hover:bg-amber-500/30 disabled:opacity-40 disabled:hover:bg-amber-500/20"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <span className="text-xs text-white/50">Showing</span>
          <span className="rounded-lg border-2 border-amber-500/60 bg-amber-500/15 px-4 py-2 font-mono text-lg font-semibold tabular-nums text-amber-400">
            {windowStartClamped} – {windowEndClamped}
          </span>
          <span className="text-xs text-white/50">
            ({WINDOW_SIZE}-year window)
          </span>
        </div>

        <div className="relative">
          <div
            ref={scrollRef}
            role="slider"
            aria-label="Select time window"
            aria-valuemin={YEAR_MIN}
            aria-valuemax={YEAR_MAX - WINDOW_SIZE + 1}
            aria-valuenow={windowStartClamped}
            tabIndex={0}
            onScroll={handleScroll}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="relative flex h-14 select-none cursor-grab overflow-x-auto overflow-y-hidden rounded-xl bg-zinc-800/80 active:cursor-grabbing"
            style={{
              scrollBehavior: "smooth",
              scrollbarWidth: "thin",
            }}
          >
            <div
              className="flex h-full shrink-0 select-none items-stretch"
              style={{ width: STRIP_WIDTH_PX }}
            >
              {years.map((y) => {
                const inWindow =
                  y >= windowStartClamped && y <= windowEndClamped;
                return (
                  <div
                    key={y}
                    className="flex shrink-0 flex-col items-center justify-center border-r border-white/10 transition-colors"
                    style={{ width: YEAR_WIDTH_PX }}
                  >
                    <span
                      className={`text-xs font-medium ${
                        inWindow ? "text-amber-400" : "text-white/40"
                      }`}
                    >
                      {y}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="pointer-events-none absolute inset-y-0 flex items-stretch rounded-lg border-2 border-amber-400/80 bg-amber-500/10"
            style={{
              left: "50%",
              width: WINDOW_WIDTH_PX,
              transform: "translateX(-50%)",
            }}
            aria-hidden
          />
        </div>

        <p className="mt-3 text-center text-[10px] text-white/50">
          Grip and drag the timeline · Map shows wars and participants from{" "}
          {windowStartClamped} to {windowEndClamped}
        </p>
      </div>
    </div>
  );
}
