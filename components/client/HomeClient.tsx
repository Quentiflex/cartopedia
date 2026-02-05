"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CountryDetailPanel } from "./CountryDetailPanel";
import { EntityDetailPanel } from "./EntityDetailPanel";
import { GanttChart } from "./GanttChart";
import { Map } from "./Map";
import { Timeline, type TimeWindow } from "./Timeline";
import type { CShapesCountry, War, WarParticipation } from "@/types/wars";

type EntityInstance = {
  iri: string;
  label: string;
  properties: Array<{ property: string; value: string; valueIri?: string; isLiteral: boolean }>;
  incomingRelations?: Array<{ property: string; subject: string; subjectIri: string }>;
};

type ViewMode = "map" | "gantt";

type HomeClientProps = {
  participations: WarParticipation[];
  wars: War[];
  timeWindow: TimeWindow;
  viewMode: ViewMode;
};

function buildSearchParams(params: {
  start: number;
  end: number;
  view: ViewMode;
}): string {
  const sp = new URLSearchParams();
  sp.set("start", String(params.start));
  sp.set("end", String(params.end));
  sp.set("view", params.view);
  return "?" + sp.toString();
}

export function HomeClient({
  participations,
  wars,
  timeWindow,
  viewMode,
}: HomeClientProps) {
  const router = useRouter();
  const [selectedCountry, setSelectedCountry] =
    useState<CShapesCountry | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<EntityInstance | null>(null);
  const [entityHistory, setEntityHistory] = useState<EntityInstance[]>([]);
  const [loadingEntity, setLoadingEntity] = useState(false);

  const handleTimeWindowChange = (window: TimeWindow) => {
    router.push(buildSearchParams({
      start: window.start,
      end: window.end,
      view: viewMode,
    }));
  };

  const handleViewModeChange = (view: ViewMode) => {
    router.push(buildSearchParams({
      start: timeWindow.start,
      end: timeWindow.end,
      view,
    }));
  };

  // Fetch entity details by IRI and navigate to it
  const navigateToEntity = async (iri: string) => {
    setLoadingEntity(true);
    try {
      const response = await fetch(`/api/ontology/entity?iri=${encodeURIComponent(iri)}`);
      
      if (!response.ok) {
        console.error("Failed to fetch entity:", response.statusText);
        return;
      }

      const entityData: EntityInstance = await response.json();
      
      // Push current entity to history if it exists
      if (selectedEntity) {
        setEntityHistory(prev => [...prev, selectedEntity]);
      }
      
      setSelectedEntity(entityData);
    } catch (err) {
      console.error("Error fetching entity:", err);
    } finally {
      setLoadingEntity(false);
    }
  };

  // Go back to previous entity in history
  const goBackInHistory = () => {
    if (entityHistory.length === 0) return;
    
    const previousEntity = entityHistory[entityHistory.length - 1];
    setEntityHistory(prev => prev.slice(0, -1));
    setSelectedEntity(previousEntity);
  };

  // Close panel and clear history
  const closeEntityPanel = () => {
    setSelectedEntity(null);
    setEntityHistory([]);
  };

  // Handle clicking on a participation marker - show the first war
  const handleParticipationClick = async (participation: WarParticipation) => {
    // For now, we'll show the first war from the participation
    // In the future, we could show a menu if there are multiple wars
    if (participation.wars.length > 0) {
      const warId = participation.wars[0].id;
      await navigateToEntity(warId);
    }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-zinc-900">
      {viewMode === "map" ? (
        <Map
          participations={participations}
          timeWindow={timeWindow}
          onParticipationClick={(p) => {
            handleParticipationClick(p);
            setSelectedCountry(null);
          }}
          onCountryClick={(c) => {
            setSelectedCountry(c);
            closeEntityPanel();
          }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col pt-20 pb-6">
          <GanttChart 
            wars={wars}
            onWarClick={(war) => {
              navigateToEntity(war.id);
              setSelectedCountry(null);
            }}
          />
        </div>
      )}
      {selectedEntity && (
        <EntityDetailPanel
          entity={selectedEntity}
          onClose={closeEntityPanel}
          onNavigate={navigateToEntity}
          onBack={goBackInHistory}
          canGoBack={entityHistory.length > 0}
        />
      )}
      {loadingEntity && (
        <div className="absolute right-0 top-0 z-40 flex h-full w-80 min-w-[280px] max-w-[90vw] items-center justify-center border-l border-zinc-700 bg-zinc-900/95 backdrop-blur sm:w-96">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-600 border-t-amber-500" />
        </div>
      )}
      {selectedCountry && (
        <CountryDetailPanel
          country={selectedCountry}
          onClose={() => setSelectedCountry(null)}
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
        <Link
          href="/ontology"
          className="rounded-lg border border-zinc-600 bg-zinc-800/90 p-2 text-zinc-400 hover:bg-zinc-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          title="View ontology (classes and properties)"
          aria-label="View ontology"
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
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </Link>
        <div className="flex rounded-lg border border-zinc-600 bg-zinc-800/90 p-0.5">
          <button
            type="button"
            onClick={() => handleViewModeChange("map")}
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
            onClick={() => handleViewModeChange("gantt")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              viewMode === "gantt"
                ? "bg-amber-500/90 text-zinc-900"
                : "text-zinc-300 hover:bg-zinc-700 hover:text-white"
            }`}
          >
            Gantt
          </button>
        </div>
      </header>
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-6">
        <Timeline window={timeWindow} onWindowChange={handleTimeWindowChange} />
      </div>
    </div>
  );
}
