"use client";

import { useCallback, useEffect, useState } from "react";
import { GanttChart } from "./components/GanttChart";
import { Map } from "./components/Map";
import { Timeline, type TimeWindow } from "./components/Timeline";
import { WarParticipationPanel } from "./components/WarParticipationPanel";
import type { War } from "./types/wars";
import type { WarParticipation } from "./types/wars";

const INITIAL_WINDOW: TimeWindow = { start: 1826, end: 1830 };

type ViewMode = "map" | "gantt";

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(INITIAL_WINDOW);
  const [participations, setParticipations] = useState<WarParticipation[]>([]);
  const [wars, setWars] = useState<War[]>([]);
  const [warsLoading, setWarsLoading] = useState(false);
  const [selectedParticipation, setSelectedParticipation] =
    useState<WarParticipation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParticipations = useCallback(async (start: number, end: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/war-participants?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data: WarParticipation[] = await res.json();
      setParticipations(data);
    } catch (e) {
      setParticipations([]);
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWars = useCallback(async (start: number, end: number) => {
    setWarsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/wars?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data: War[] = await res.json();
      setWars(data);
    } catch (e) {
      setWars([]);
      setError(e instanceof Error ? e.message : "Failed to load wars");
    } finally {
      setWarsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParticipations(timeWindow.start, timeWindow.end);
  }, [timeWindow.start, timeWindow.end, fetchParticipations]);

  useEffect(() => {
    if (viewMode === "gantt") {
      fetchWars(timeWindow.start, timeWindow.end);
    }
  }, [viewMode, timeWindow.start, timeWindow.end, fetchWars]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-zinc-900">
      {viewMode === "map" ? (
        <Map
          participations={participations}
          onParticipationClick={setSelectedParticipation}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col pt-20 pb-6">
          {warsLoading && wars.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-zinc-400">
              Loading wars…
            </div>
          ) : (
            <GanttChart wars={wars} />
          )}
        </div>
      )}
      {selectedParticipation && (
        <WarParticipationPanel
          participation={selectedParticipation}
          onClose={() => setSelectedParticipation(null)}
        />
      )}
      <header className="absolute left-0 top-0 z-20 flex flex-wrap items-start gap-4 p-6">
        <div className="pointer-events-none">
          <h1 className="text-xl font-semibold tracking-tight text-white/95 drop-shadow-sm">
            Cartopedia
          </h1>
          <p className="mt-0.5 text-sm text-white/70">
            Wars and participants by time window (RDF)
          </p>
        </div>
        <div className="flex rounded-lg border border-zinc-600 bg-zinc-800/90 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              viewMode === "map"
                ? "bg-amber-500/90 text-zinc-900"
                : "text-zinc-300 hover:bg-zinc-700 hover:text-white"
            }`}
          >
            Map
          </button>
          <button
            type="button"
            onClick={() => setViewMode("gantt")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              viewMode === "gantt"
                ? "bg-amber-500/90 text-zinc-900"
                : "text-zinc-300 hover:bg-zinc-700 hover:text-white"
            }`}
          >
            Gantt
          </button>
        </div>
        {error && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {error}
          </div>
        )}
        {loading && viewMode === "map" && participations.length === 0 && (
          <div className="rounded-lg border border-zinc-600 bg-zinc-800/90 px-3 py-2 text-sm text-zinc-400">
            Loading…
          </div>
        )}
      </header>
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-6">
        <Timeline window={timeWindow} onWindowChange={setTimeWindow} />
      </div>
    </div>
  );
}
