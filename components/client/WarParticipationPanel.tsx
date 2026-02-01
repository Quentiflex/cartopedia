"use client";

import type { WarParticipation } from "@/types/wars";

type WarParticipationPanelProps = {
  participation: WarParticipation;
  onClose: () => void;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.getFullYear().toString();
  } catch {
    return iso;
  }
}

export function WarParticipationPanel({
  participation,
  onClose,
}: WarParticipationPanelProps) {
  const { participantLabel, latitude, longitude, wars } = participation;

  return (
    <div
      className="absolute right-0 top-0 z-30 flex h-full w-80 min-w-[280px] max-w-[90vw] flex-col border-l border-zinc-700 bg-zinc-900/95 shadow-xl backdrop-blur sm:w-96"
      role="dialog"
      aria-labelledby="war-panel-title"
      aria-modal="true"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-700 px-5 py-4">
        <h2
          id="war-panel-title"
          className="text-lg font-semibold text-white"
        >
          {participantLabel}
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
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Wars in time window
            </dt>
            <dd className="mt-2 space-y-3">
              {wars.map((war, i) => (
                <div
                  key={`${war.label}-${i}`}
                  className="rounded-lg border border-zinc-600 bg-zinc-800/50 px-3 py-2"
                >
                  <div className="font-medium text-amber-200">{war.label}</div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {formatDate(war.startDate)}
                    {war.endDate ? ` – ${formatDate(war.endDate)}` : ""}
                  </div>
                </div>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Location (center)
            </dt>
            <dd className="mt-0.5 font-mono text-sm text-zinc-400">
              {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
