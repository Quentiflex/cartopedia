"use client";

import type { CShapesCountry } from "@/types/wars";

type CountryDetailPanelProps = {
  country: CShapesCountry;
  onClose: () => void;
};

function formatArea(sqKm: number): string {
  if (sqKm >= 1_000_000) return `${(sqKm / 1_000_000).toFixed(1)}M km²`;
  if (sqKm >= 1_000) return `${(sqKm / 1_000).toFixed(1)}k km²`;
  return `${Math.round(sqKm)} km²`;
}

export function CountryDetailPanel({
  country,
  onClose,
}: CountryDetailPanelProps) {
  const { cntry_name, capname, area, gwsyear, gweyear } = country;

  return (
    <div
      className="absolute right-0 top-0 z-30 flex h-full w-80 min-w-[280px] max-w-[90vw] flex-col border-l border-zinc-700 bg-zinc-900/95 shadow-xl backdrop-blur sm:w-96"
      role="dialog"
      aria-labelledby="country-panel-title"
      aria-modal="true"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-700 px-5 py-4">
        <h2
          id="country-panel-title"
          className="text-lg font-semibold text-white"
        >
          {cntry_name}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          aria-label="Close panel"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <dl className="space-y-4">
          {capname != null && capname !== "" && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Capital
              </dt>
              <dd className="mt-0.5 text-sm text-zinc-300">{capname}</dd>
            </div>
          )}
          {area != null && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Area
              </dt>
              <dd className="mt-0.5 text-sm text-zinc-300">
                {formatArea(area)}
              </dd>
            </div>
          )}
          {(gwsyear != null || gweyear != null) && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Existence (CShapes)
              </dt>
              <dd className="mt-0.5 text-sm text-zinc-300">
                {gwsyear != null && gweyear != null
                  ? `${gwsyear} – ${gweyear}`
                  : gwsyear != null
                    ? `from ${gwsyear}`
                    : gweyear != null
                      ? `until ${gweyear}`
                      : ""}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
