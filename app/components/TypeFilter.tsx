"use client";

import { useRef, useState } from "react";
import { DEFAULT_EVENT_TYPE_COLOR, EVENT_TYPE_COLORS } from "../data/data";

export type TypeFilterProps = {
  types: string[];
  selectedTypes: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
};

const LABELS: Record<string, string> = {
  invention: "Invention",
  geopolitic: "Geopolitics",
};

function labelFor(type: string): string {
  return LABELS[type] ?? type;
}

export function TypeFilter({
  types,
  selectedTypes,
  onSelectionChange,
}: TypeFilterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = (type: string) => {
    const next = new Set(selectedTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onSelectionChange(next);
  };

  const selectAll = () => onSelectionChange(new Set(types));
  const clearAll = () => onSelectionChange(new Set());

  const displayText =
    selectedTypes.size === 0
      ? "All types"
      : selectedTypes.size === types.length
        ? "All types"
        : `${selectedTypes.size} type${selectedTypes.size === 1 ? "" : "s"} selected`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-[160px] items-center justify-between gap-2 rounded-xl border border-white/10 bg-zinc-800/80 px-4 py-3 text-left text-sm text-white/90 shadow-inner transition-colors hover:bg-zinc-700/80 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Filter by event type"
      >
        <span className="truncate">{displayText}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-white/50 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            className="absolute left-0 top-full z-40 mt-2 min-w-[200px] rounded-xl border border-white/10 bg-zinc-900/98 py-2 shadow-xl backdrop-blur"
          >
            <div className="border-b border-white/10 px-3 pb-2 mb-2 flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-amber-400/90 hover:text-amber-300"
              >
                All
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-white/50 hover:text-white/70"
              >
                Clear
              </button>
            </div>
            {types.map((type) => (
              <label
                key={type}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.has(type)}
                  onChange={() => toggle(type)}
                  className="h-4 w-4 rounded border-white/20 bg-zinc-800 text-amber-500 focus:ring-amber-400/50"
                />
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor: EVENT_TYPE_COLORS[type] ?? DEFAULT_EVENT_TYPE_COLOR,
                  }}
                  aria-hidden
                />
                <span>{labelFor(type)}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
