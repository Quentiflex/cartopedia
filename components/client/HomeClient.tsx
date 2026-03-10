"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useCallback, useTransition } from "react";
import { CountryDetailPanel } from "./CountryDetailPanel";
import { EntityDetailPanel } from "./EntityDetailPanel";
import { EntitySearch } from "./EntitySearch";
import { GanttChart } from "./GanttChart";
import { Map } from "./Map";
import { Timeline, type TimeWindow } from "./Timeline";
import type { MapFillMode } from "@/lib/hooks/useMapLibre";
import type { CShapesCountry, War, WarParticipation } from "@/types/wars";
import { CATEGORY_COLORS, CURATED_TYPES, type WikidataMapEntity } from "@/lib/wikidata-curated-types";
import {
  WikidataEntityPanel,
  type WikidataEntityDetail,
} from "./WikidataEntityPanel";

type OwidDatasetEntry = { id: string; label: string };

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
  /** Wikidata entity ID (e.g. "Q31") to open automatically on load. */
  initialEntityId?: string;
  /** Initial Wikidata overlay types from the URL (?overlay=...) */
  initialOverlayTypes?: string[];
};

const WD_BASE = "http://www.wikidata.org/entity/";

function qidFromIri(iri: string): string {
  return iri.split(/[/#]/).pop() ?? iri;
}

function buildSearchParams(params: {
  start: number;
  end: number;
  view: ViewMode;
  entity?: string | null;
  overlay?: string | null;
}): string {
  const sp = new URLSearchParams();
  sp.set("start", String(params.start));
  sp.set("end", String(params.end));
  sp.set("view", params.view);
  if (params.entity) sp.set("entity", params.entity);
  if (params.overlay) sp.set("overlay", params.overlay);
  return "?" + sp.toString();
}

export function HomeClient({
  participations,
  wars,
  timeWindow,
  viewMode,
  initialEntityId,
  initialOverlayTypes,
}: HomeClientProps) {
  const router = useRouter();
  const [timeWindowPending, startTimeWindowTransition] = useTransition();
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] =
    useState<CShapesCountry | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<EntityInstance | null>(null);
  const [entityHistory, setEntityHistory] = useState<EntityInstance[]>([]);
  const [loadingEntity, setLoadingEntity] = useState(false);
  const [mapFillMode, setMapFillMode] = useState<MapFillMode>("default");
  const [owidDatasets, setOwidDatasets] = useState<OwidDatasetEntry[]>([]);
  const [owidDataset, setOwidDataset] = useState<string>("population-with-un-projections");

  // ── Wikidata overlay ──────────────────────────────────────────────────────
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [selectedTypeIris, setSelectedTypeIris] = useState<Set<string>>(
    () => new Set(initialOverlayTypes ?? [])
  );
  const [overlayEntities, setOverlayEntities] = useState<WikidataMapEntity[]>([]);
  const [overlayStatus, setOverlayStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [fetchedWindow, setFetchedWindow] = useState<TimeWindow | null>(null);
  const overlayPanelRef = useRef<HTMLDivElement>(null);

  const [wikidataEntity, setWikidataEntity] = useState<WikidataEntityDetail | null>(null);
  const [wikidataEntityIri, setWikidataEntityIri] = useState<string | null>(null);
  const [wikidataEntityLoading, setWikidataEntityLoading] = useState(false);
  const [wikidataEntityError, setWikidataEntityError] = useState<string | null>(null);
  const [wikidataEntityHistory, setWikidataEntityHistory] = useState<WikidataEntityDetail[]>([]);

  const isStale =
    fetchedWindow !== null &&
    (fetchedWindow.start !== timeWindow.start || fetchedWindow.end !== timeWindow.end);

  const overlayParamFromSet = useCallback(
    (set: Set<string>): string | null => (set.size ? [...set].join(",") : null),
    []
  );

  const getOverlayParam = useCallback(
    () => overlayParamFromSet(selectedTypeIris),
    [overlayParamFromSet, selectedTypeIris]
  );

  function toggleType(iri: string) {
    setSelectedTypeIris((prev) => {
      const next = new Set(prev);
      if (next.has(iri)) {
        next.delete(iri);
      } else {
        next.add(iri);
      }
      const overlay = overlayParamFromSet(next);
      router.push(
        buildSearchParams({
          start: timeWindow.start,
          end: timeWindow.end,
          view: viewMode,
          entity: wikidataEntityIri ? qidFromIri(wikidataEntityIri) : null,
          overlay,
        })
      );
      return next;
    });
  }

  async function fetchOverlay() {
    if (selectedTypeIris.size === 0) return;
    setOverlayStatus("loading");
    setOverlayError(null);
    try {
      const params = new URLSearchParams({
        types: [...selectedTypeIris].join(","),
        startYear: String(timeWindow.start),
        endYear: String(timeWindow.end),
      });
      const r = await fetch(`/api/wikidata/map-entities?${params}`);
      const data = await r.json() as { entities?: WikidataMapEntity[]; error?: string };
      if (!r.ok) throw new Error(data.error ?? "Fetch failed");
      setOverlayEntities(data.entities ?? []);
      setFetchedWindow({ ...timeWindow });
      setOverlayStatus("done");
    } catch (err) {
      setOverlayError(err instanceof Error ? err.message : "Error");
      setOverlayStatus("error");
    }
  }

  // Group types by category for the panel
  const typesByCategory = CURATED_TYPES.reduce<Record<string, typeof CURATED_TYPES>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  // ── Wikidata entity detail (map marker click) ─────────────────────────────
  /** Related events fetched for the currently open entity — shown as map markers. */
  const [relatedEventEntities, setRelatedEventEntities] = useState<WikidataMapEntity[]>([]);

  // Derive active categories from all visible map entities for the legend
  const legendCategories = useMemo(() => {
    const seen = new Set<string>();
    const result: { category: string; color: string }[] = [];
    for (const e of [...overlayEntities, ...relatedEventEntities]) {
      const meta = CURATED_TYPES.find((t) => t.iri === e.typeIri);
      if (meta && !seen.has(meta.category)) {
        seen.add(meta.category);
        result.push({ category: meta.category, color: CATEGORY_COLORS[meta.category] ?? "#a855f7" });
      }
    }
    return result;
  }, [overlayEntities, relatedEventEntities]);

  /**
   * When related events are loaded we focus the map: show only the current
   * entity (if present in the overlay) + the related event markers.
   * This clears the "noise" from the full overlay while keeping context.
   */
  const focusedMapEntities = useMemo(() => {
    if (relatedEventEntities.length === 0) return overlayEntities;
    const hostMarker = wikidataEntityIri
      ? overlayEntities.filter((e) => e.iri === wikidataEntityIri)
      : [];
    return [...hostMarker, ...relatedEventEntities];
  }, [overlayEntities, relatedEventEntities, wikidataEntityIri]);

  /**
   * Navigate to a Wikidata entity.
   * Pushes ?entity=QID to the URL (unless skipUrlPush is true, e.g. on initial load).
   */
  const navigateToWikidataEntity = async (iri: string, opts?: { skipUrlPush?: boolean }) => {
    if (wikidataEntity) {
      setWikidataEntityHistory((h) => [...h, wikidataEntity]);
    }
    setWikidataEntityIri(iri);
    setWikidataEntity(null);
    setWikidataEntityError(null);
    setWikidataEntityLoading(true);
    if (!opts?.skipUrlPush) {
      router.push(
        buildSearchParams({
          start: timeWindow.start,
          end: timeWindow.end,
          view: viewMode,
          entity: qidFromIri(iri),
          overlay: getOverlayParam(),
        })
      );
    }
    try {
      const r = await fetch(`/api/wikidata/entity?iri=${encodeURIComponent(iri)}&source=live`);
      const data = await r.json() as WikidataEntityDetail & { error?: string };
      if (!r.ok) throw new Error(data.error ?? "Failed to load entity");
      setWikidataEntity(data);
    } catch (err) {
      setWikidataEntityError(err instanceof Error ? err.message : "Error");
    } finally {
      setWikidataEntityLoading(false);
    }
  };

  const closeWikidataPanel = () => {
    setWikidataEntity(null);
    setWikidataEntityIri(null);
    setWikidataEntityError(null);
    setWikidataEntityHistory([]);
    setRelatedEventEntities([]);
    router.push(
      buildSearchParams({
        start: timeWindow.start,
        end: timeWindow.end,
        view: viewMode,
        overlay: getOverlayParam(),
      })
    );
  };

  const goBackWikidata = () => {
    const prev = wikidataEntityHistory[wikidataEntityHistory.length - 1];
    if (!prev) return;
    setWikidataEntityHistory((h) => h.slice(0, -1));
    setWikidataEntity(prev);
    setWikidataEntityIri(prev.iri);
    setWikidataEntityError(null);
    // Replace (not push) so the browser back button is not confused
    router.replace(
      buildSearchParams({
        start: timeWindow.start,
        end: timeWindow.end,
        view: viewMode,
        entity: qidFromIri(prev.iri),
        overlay: getOverlayParam(),
      })
    );
  };

  // Open entity panel from URL on initial page load (e.g. shared link or bookmark)
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!initialLoadDone.current && initialEntityId) {
      initialLoadDone.current = true;
      navigateToWikidataEntity(`${WD_BASE}${initialEntityId}`, { skipUrlPush: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/api/owid/datasets")
      .then((r) => (r.ok ? r.json() : { datasets: [] }))
      .then((body: { datasets: OwidDatasetEntry[] }) => {
        const list = body.datasets ?? [];
        setOwidDatasets(list);
        if (list.length > 0) {
          setOwidDataset((current) =>
            list.some((d) => d.id === current) ? current : list[0].id
          );
        }
      })
      .catch(() => setOwidDatasets([]));
  }, []);

  const handleTimeWindowChange = (window: TimeWindow) => {
    startTimeWindowTransition(() => {
      router.push(
        buildSearchParams({
          start: window.start,
          end: window.end,
          view: viewMode,
          entity: wikidataEntityIri ? qidFromIri(wikidataEntityIri) : null,
          overlay: getOverlayParam(),
        })
      );
    });
  };

  const handleViewModeChange = (view: ViewMode) => {
    router.push(
      buildSearchParams({
        start: timeWindow.start,
        end: timeWindow.end,
        view,
        entity: wikidataEntityIri ? qidFromIri(wikidataEntityIri) : null,
        overlay: getOverlayParam(),
      })
    );
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
          fillMode={mapFillMode}
          owidDataset={owidDataset}
          wikidataEntities={focusedMapEntities}
          showCShapes={false}
          showHistoricalCountries={true}
          onHistoricalCountriesLoading={setCountriesLoading}
          onParticipationClick={(p) => {
            handleParticipationClick(p);
            setSelectedCountry(null);
          }}
          onCountryClick={(c) => {
            setSelectedCountry(c);
            closeEntityPanel();
          }}
          onWikidataEntityClick={(iri) => {
            setSelectedCountry(null);
            closeEntityPanel();
            navigateToWikidataEntity(iri);
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
      {(wikidataEntityIri !== null) && (
        <WikidataEntityPanel
          iri={wikidataEntityIri}
          entity={wikidataEntity}
          loading={wikidataEntityLoading}
          error={wikidataEntityError}
          canGoBack={wikidataEntityHistory.length > 0}
          timeWindow={timeWindow}
          onClose={closeWikidataPanel}
          onNavigate={navigateToWikidataEntity}
          onBack={goBackWikidata}
          onRelatedEntitiesChange={setRelatedEventEntities}
        />
      )}
      {/* Wikidata overlay panel */}
      {overlayOpen && (
        <div
          ref={overlayPanelRef}
          className="absolute left-6 top-24 z-30 flex w-64 flex-col rounded-xl border border-zinc-600 bg-zinc-900/95 shadow-2xl backdrop-blur"
          style={{ maxHeight: "calc(100vh - 160px)" }}
        >
          <div className="flex items-center justify-between border-b border-zinc-700 px-3 py-2">
            <span className="text-xs font-semibold text-zinc-200">Wikidata Overlay</span>
            <button
              type="button"
              onClick={() => setOverlayOpen(false)}
              className="rounded p-0.5 text-zinc-500 hover:text-zinc-200"
              aria-label="Close overlay panel"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Type checkboxes */}
          <div className="flex-1 overflow-y-auto px-3 py-2 text-xs">
            {Object.entries(typesByCategory).map(([cat, types]) => (
              <div key={cat} className="mb-3">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[cat] ?? "#a855f7" }}
                  />
                  {cat}
                </div>
                {types.map((t) => (
                  <label key={t.iri} className="flex cursor-pointer items-center gap-2 rounded py-0.5 text-zinc-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={selectedTypeIris.has(t.iri)}
                      onChange={() => toggleType(t.iri)}
                      className="rounded border-zinc-500 bg-zinc-700 text-violet-500 focus:ring-violet-500"
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            ))}
          </div>

          {/* Footer: status + fetch button */}
          <div className="border-t border-zinc-700 px-3 py-2">
            {overlayStatus === "done" && (
              <div className={`mb-1.5 text-[10px] ${isStale ? "text-amber-400" : "text-zinc-400"}`}>
                {isStale
                  ? `⚠ Stale (fetched ${fetchedWindow!.start}–${fetchedWindow!.end}) · re-fetch to update`
                  : `✓ ${overlayEntities.length} entities · ${timeWindow.start}–${timeWindow.end}`}
              </div>
            )}
            {overlayStatus === "error" && (
              <div className="mb-1.5 text-[10px] text-red-400">{overlayError}</div>
            )}
            <button
              type="button"
              onClick={fetchOverlay}
              disabled={selectedTypeIris.size === 0 || overlayStatus === "loading"}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {overlayStatus === "loading" ? (
                <>
                  <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Fetching…
                </>
              ) : (
                <>Fetch {timeWindow.start}–{timeWindow.end}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Map legend – shown when any entities are visible */}
      {(overlayEntities.length > 0 || relatedEventEntities.length > 0) && (
        <div className="absolute bottom-24 left-6 z-20 rounded-xl border border-zinc-700 bg-zinc-900/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Legend</div>
          {legendCategories.map(({ category, color }) => (
            <div key={category} className="flex items-center gap-2 py-0.5 text-zinc-300">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              {category}
            </div>
          ))}
        </div>
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
          href="/wikidata"
          className="rounded-lg border border-zinc-600 bg-zinc-800/90 px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          title="Browse Wikidata"
          aria-label="Browse Wikidata"
        >
          Wikidata
        </Link>
        {viewMode === "map" && (
          <button
            type="button"
            onClick={() => setOverlayOpen((v) => !v)}
            title="Wikidata map overlay"
            className={`relative flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-violet-500 ${
              overlayOpen
                ? "border-violet-500 bg-violet-900/80 text-violet-200"
                : "border-zinc-600 bg-zinc-800/90 text-zinc-400 hover:bg-zinc-700 hover:text-white"
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Overlay
            {(overlayEntities.length + relatedEventEntities.length) > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white">
                {overlayEntities.length + relatedEventEntities.length}
              </span>
            )}
          </button>
        )}
        <EntitySearch onSelect={navigateToWikidataEntity} />
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
        {/* Country fill hidden while CShapes layer is disabled */}
      </header>
      <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center px-4 pb-6">
        <Timeline window={timeWindow} onWindowChange={handleTimeWindowChange} loading={timeWindowPending || countriesLoading} />
      </div>
    </div>
  );
}
