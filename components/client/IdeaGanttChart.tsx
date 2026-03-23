"use client";

import { useMemo, useState } from "react";

export type GanttItem = {
  iri: string;
  label: string;
  startYear: number;
  endYear: number;
};

function alignToStep(min: number, max: number, step: number): { alignedMin: number; alignedMax: number } {
  if (step <= 0) return { alignedMin: min, alignedMax: max };
  const alignedMin = Math.floor(min / step) * step;
  const alignedMax = Math.ceil(max / step) * step;
  return { alignedMin, alignedMax };
}

type IdeaGanttChartProps = {
  items: GanttItem[];
  yearMin: number;
  yearMax: number;
  yearStep: number;
  onItemClick?: (iri: string) => void;
};

const LABEL_WIDTH = 260;
const ROW_HEIGHT = 42;
const DEFAULT_YEAR_WIDTH = 34;
const MIN_YEAR_WIDTH = 18;
const MAX_YEAR_WIDTH = 72;

export function IdeaGanttChart({
  items,
  yearMin,
  yearMax,
  yearStep,
  onItemClick,
}: IdeaGanttChartProps) {
  const { alignedMin, alignedMax } = useMemo(
    () => alignToStep(yearMin, yearMax, yearStep),
    [yearMin, yearMax, yearStep]
  );

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = alignedMin; y <= alignedMax; y += yearStep) arr.push(y);
    return arr;
  }, [alignedMin, alignedMax, yearStep]);

  const [yearWidth, setYearWidth] = useState(DEFAULT_YEAR_WIDTH);

  const totalWidth = years.length * yearWidth;

  const zoomIn = () => setYearWidth((w) => Math.min(MAX_YEAR_WIDTH, w + 8));
  const zoomOut = () => setYearWidth((w) => Math.max(MIN_YEAR_WIDTH, w - 8));

  const itemsSorted = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.startYear !== b.startYear) return a.startYear - b.startYear;
      return a.label.localeCompare(b.label);
    });
  }, [items]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/40">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-700 bg-zinc-800/40 px-4 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white/90">
            Schools of thought by start/end year
          </div>
          <div className="text-xs text-zinc-500">
            Timeline: {yearMin}–{yearMax} (step {yearStep})
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-zinc-600 bg-zinc-800/90 p-0.5">
          <button
            type="button"
            onClick={zoomOut}
            className="rounded px-2 py-1 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="rounded px-2 py-1 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left labels */}
        <div className="z-10 flex shrink-0 flex-col border-r border-zinc-700 bg-zinc-800" style={{ width: LABEL_WIDTH }}>
          <div style={{ height: ROW_HEIGHT }} className="border-b border-zinc-700" />
          {itemsSorted.map((it) => (
            <div
              key={it.iri}
              className="flex items-center border-b border-zinc-700/70 px-3 text-sm text-zinc-200 last:border-b-0"
              style={{ height: ROW_HEIGHT }}
            >
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onItemClick?.(it.iri)}
                  className="block w-full truncate text-left hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 rounded"
                >
                  {it.label}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Scrollable timeline */}
        <div className="flex-1 min-h-0 overflow-auto">
          <div style={{ width: totalWidth, minWidth: "100%" }}>
            {/* Year header */}
            <div className="flex shrink-0 border-b border-zinc-700 bg-zinc-800/90">
              {years.map((y) => (
                <div
                  key={y}
                  className="flex items-center justify-center border-r border-zinc-700/60 text-[11px] font-medium text-zinc-400 last:border-r-0"
                  style={{ width: yearWidth, height: ROW_HEIGHT }}
                >
                  {y}
                </div>
              ))}
            </div>

            {/* Bars */}
            {itemsSorted.map((it) => {
              const startIdx = Math.floor((it.startYear - alignedMin) / yearStep);
              const endIdx = Math.floor((it.endYear - alignedMin) / yearStep);
              const leftPx = startIdx * yearWidth;
              const widthCells = Math.max(1, endIdx - startIdx + 1);
              const widthPx = widthCells * yearWidth;
              return (
                <div
                  key={it.iri}
                  className="relative flex border-b border-zinc-700/70 last:border-b-0"
                  style={{ minHeight: ROW_HEIGHT, height: ROW_HEIGHT }}
                >
                  {/* Background grid cells */}
                  {years.map((y) => (
                    <div
                      key={y}
                      className="shrink-0 border-r border-zinc-700/50 last:border-r-0"
                      style={{ width: yearWidth }}
                    />
                  ))}

                  <button
                    type="button"
                    onClick={() => onItemClick?.(it.iri)}
                    className="absolute top-1/2 -translate-y-1/2 rounded-md border border-amber-500/40 bg-amber-500/20 px-2 text-left text-xs font-medium text-amber-100 shadow-sm transition hover:bg-amber-500/30 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 focus:ring-offset-zinc-800"
                    style={{ left: leftPx, width: widthPx, marginLeft: 2, marginRight: 2 }}
                    title={`${it.label} (${it.startYear}–${it.endYear})`}
                  >
                    {it.startYear}
                    {it.endYear > it.startYear ? `–${it.endYear}` : ""}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

