"use client";

import { useCallback, useEffect, useState } from "react";

const YEAR_MIN = -1000;
const YEAR_MAX = new Date().getFullYear();
const DEFAULT_MEMORY = 50;

export type TimeWindow = { start: number; end: number };

type TimelineProps = {
  window: TimeWindow;
  onWindowChange: (window: TimeWindow) => void;
  loading?: boolean;
};

function clampYear(year: number): number {
  return Math.max(YEAR_MIN, Math.min(YEAR_MAX, year));
}


export function Timeline({ window, onWindowChange, loading = false }: TimelineProps) {
  // Current year = window.end; memory window = how many years before it
  const currentYear = window.end;
  const memoryYears = Math.max(0, window.end - window.start);

  const [inputYear, setInputYear] = useState(String(currentYear));
  const [inputMemory, setInputMemory] = useState(String(memoryYears));

  // Sync inputs when window changes externally (e.g. URL navigation)
  useEffect(() => {
    setInputYear(String(window.end));
    setInputMemory(String(Math.max(0, window.end - window.start)));
  }, [window.end, window.start]);

  const handleSet = useCallback(() => {
    const year = parseInt(inputYear, 10);
    const memory = parseInt(inputMemory, 10);
    if (Number.isNaN(year)) return;
    const safeMemory = Number.isNaN(memory) || memory < 0 ? DEFAULT_MEMORY : memory;
    onWindowChange({
      start: clampYear(year - safeMemory),
      end: clampYear(year),
    });
  }, [inputYear, inputMemory, onWindowChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSet();
    },
    [handleSet]
  );

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/95 px-5 py-3 shadow-xl backdrop-blur">
      <label className="text-xs text-zinc-400">Year</label>
      <input
        type="number"
        value={inputYear}
        onChange={(e) => setInputYear(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-24 rounded-lg border border-white/20 bg-zinc-800 px-2 py-1.5 font-mono text-sm text-white focus:border-amber-500/60 focus:outline-none"
        aria-label="Current year"
      />
      <span className="text-zinc-600">·</span>
      <label className="text-xs text-zinc-400">Memory</label>
      <input
        type="number"
        value={inputMemory}
        onChange={(e) => setInputMemory(e.target.value)}
        onKeyDown={handleKeyDown}
        min={0}
        className="w-20 rounded-lg border border-white/20 bg-zinc-800 px-2 py-1.5 font-mono text-sm text-white focus:border-amber-500/60 focus:outline-none"
        aria-label="Memory window in years"
      />
      <span className="text-xs text-zinc-500">yrs</span>
      <button
        type="button"
        onClick={handleSet}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg border border-amber-500/60 bg-amber-500/20 px-3 py-1.5 text-sm font-medium text-amber-400 transition hover:bg-amber-500/30 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading && (
          <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}
        {loading ? "Loading…" : "Set"}
      </button>
    </div>
  );
}
