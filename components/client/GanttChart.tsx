"use client";

import { useCallback, useRef, useState } from "react";
import type { War } from "@/types/wars";

const YEAR_MIN = 1820;
const YEAR_MAX = 2000;
const ROW_HEIGHT = 40;
const MIN_YEAR_WIDTH = 20;
const MAX_YEAR_WIDTH = 64;
const DEFAULT_YEAR_WIDTH = 36;
const LABEL_WIDTH = 200;

type GanttChartProps = {
  wars: War[];
  onWarClick?: (war: War) => void;
};

function getYears(): number[] {
  const years: number[] = [];
  for (let y = YEAR_MIN; y <= YEAR_MAX; y++) years.push(y);
  return years;
}

function yearFromIso(iso: string): number {
  try {
    return new Date(iso).getFullYear();
  } catch {
    return YEAR_MIN;
  }
}

export function GanttChart({ wars, onWarClick }: GanttChartProps) {
  const years = getYears();
  const [yearWidth, setYearWidth] = useState(DEFAULT_YEAR_WIDTH);
  const scrollRef = useRef<HTMLDivElement>(null);

  const zoomIn = useCallback(() => {
    setYearWidth((w) => Math.min(MAX_YEAR_WIDTH, w + 8));
  }, []);

  const zoomOut = useCallback(() => {
    setYearWidth((w) => Math.max(MIN_YEAR_WIDTH, w - 8));
  }, []);

  const totalWidth = years.length * yearWidth;

  const warsSorted = [...wars].sort((a, b) => {
    const startA = yearFromIso(a.startDate);
    const startB = yearFromIso(b.startDate);
    return startA !== startB ? startA - startB : (a.label || "").localeCompare(b.label || "");
  });

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-zinc-900 p-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-white/90">
          Wars by date range (bars span start–end year)
        </span>
        <div className="flex items-center gap-1 rounded-lg border border-zinc-600 bg-zinc-800/90 p-0.5">
          <button
            type="button"
            onClick={zoomOut}
            className="rounded px-2 py-1 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            title="Zoom out"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="rounded px-2 py-1 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            title="Zoom in"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800/80">
        {/* Left column: war labels */}
        <div
          className="z-10 flex shrink-0 flex-col border-r border-zinc-700 bg-zinc-800"
          style={{ width: LABEL_WIDTH }}
        >
          <div
            className="flex shrink-0 border-b border-zinc-700"
            style={{ height: ROW_HEIGHT, width: LABEL_WIDTH }}
          />
          {warsSorted.map((war) => (
            <div
              key={war.id}
              className="flex items-center border-b border-zinc-700/80 px-3 py-2 last:border-b-0"
              style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}
            >
              <span className="truncate text-sm font-medium text-zinc-200">
                {war.label}
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable area: year grid + bars */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-auto"
          style={{ minWidth: 0 }}
        >
          <div style={{ width: totalWidth, minWidth: "100%" }}>
            {/* Year headers */}
            <div className="flex shrink-0 border-b border-zinc-700 bg-zinc-800/90">
              {years.map((year) => (
                <div
                  key={year}
                  className="flex shrink-0 items-center justify-center border-r border-zinc-700/80 text-xs font-medium text-zinc-400 last:border-r-0"
                  style={{ width: yearWidth, height: ROW_HEIGHT }}
                >
                  {year}
                </div>
              ))}
            </div>

            {/* Rows: one per war, bar spans startYear–endYear */}
            {warsSorted.map((war) => {
              const startYear = yearFromIso(war.startDate);
              const endYear = war.endDate
                ? yearFromIso(war.endDate)
                : startYear;
              const leftPx = (startYear - YEAR_MIN) * yearWidth;
              const spanYears = Math.max(1, endYear - startYear + 1);
              const widthPx = spanYears * yearWidth;

              return (
                <div
                  key={war.id}
                  className="relative flex border-b border-zinc-700/80 last:border-b-0"
                  style={{ minHeight: ROW_HEIGHT }}
                >
                  {/* Year grid cells (background) */}
                  {years.map((year) => (
                    <div
                      key={year}
                      className="shrink-0 border-r border-zinc-700/50 last:border-r-0"
                      style={{ width: yearWidth, minHeight: ROW_HEIGHT }}
                    />
                  ))}
                  {/* Bar spanning start–end */}
                  <button
                    type="button"
                    onClick={() => onWarClick?.(war)}
                    className="absolute inset-y-0 rounded-md border border-amber-500/40 bg-amber-500/25 py-1.5 px-2 text-left text-xs font-medium text-amber-100 shadow-sm transition hover:bg-amber-500/40 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 focus:ring-offset-zinc-800"
                    style={{
                      left: leftPx,
                      width: widthPx,
                      marginTop: 4,
                      marginBottom: 4,
                      marginLeft: 2,
                    }}
                    title={`${war.label} (${startYear}–${endYear})`}
                  >
                    <span className="truncate block">
                      {startYear}
                      {endYear > startYear ? `–${endYear}` : ""}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {wars.length === 0 && (
        <p className="mt-3 text-center text-sm text-zinc-500">
          No wars in this time range. Adjust the timeline or load data into Fuseki.
        </p>
      )}
    </div>
  );
}
