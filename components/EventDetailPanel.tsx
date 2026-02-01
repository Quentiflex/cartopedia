"use client";

import type { Event } from "@/app/data/data";
import { EVENT_TYPE_COLORS } from "@/app/data/data";

type EventDetailPanelProps = {
  event: Event;
  onClose: () => void;
};

function getEventTypeColor(type: string): string {
  return EVENT_TYPE_COLORS[type] ?? "#94a3b8";
}

export function EventDetailPanel({ event, onClose }: EventDetailPanelProps) {
  return (
    <div
      className="absolute right-0 top-0 z-30 flex h-full w-80 min-w-[280px] max-w-[90vw] flex-col border-l border-zinc-700 bg-zinc-900/95 shadow-xl backdrop-blur sm:w-96"
      role="dialog"
      aria-labelledby="event-panel-title"
      aria-modal="true"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-700 px-5 py-4">
        <h2 id="event-panel-title" className="text-lg font-semibold text-white">
          {event.title}
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <dl className="space-y-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Year
            </dt>
            <dd className="mt-0.5 text-zinc-200">{event.year}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Type
            </dt>
            <dd className="mt-0.5 flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: getEventTypeColor(event.type) }}
                aria-hidden
              />
              <span className="capitalize text-zinc-200">{event.type}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Domain
            </dt>
            <dd className="mt-0.5 capitalize text-zinc-200">{event.domain}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Continent
            </dt>
            <dd className="mt-0.5 text-zinc-200">{event.continent}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Location
            </dt>
            <dd className="mt-0.5 font-mono text-sm text-zinc-400">
              {event.geography.coordinates[1].toFixed(4)}°,{" "}
              {event.geography.coordinates[0].toFixed(4)}°
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
