"use client";

import { useCallback, useEffect, useState } from "react";
import type { RelatedEvent } from "@/app/api/wikidata/related-events/route";
import type { PersonFact } from "@/app/api/wikidata/person-timeline/route";
import type { WikidataMapEntity } from "@/lib/wikidata-curated-types";

type ActiveTab = "main" | "timeline";

// ── Shared types ──────────────────────────────────────────────────────────────

export type WikidataEntityProperty = {
  property: string;
  propertyIri: string;
  value: string;
  valueIri?: string;
  isLiteral: boolean;
};

export type WikidataIncomingRelation = {
  property: string;
  subject: string;
  subjectIri: string;
};

export type WikiSummary = {
  extract: string;
  thumbnail?: string;
  articleUrl: string;
};

export type WikidataEntityDetail = {
  iri: string;
  label: string;
  description?: string;
  wikiSummary?: WikiSummary | null;
  properties: WikidataEntityProperty[];
  incomingRelations: WikidataIncomingRelation[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function wikidataId(iri: string): string {
  return iri.split(/[/#]/).pop() ?? iri;
}

function formatLiteralValue(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      }
    } catch {
      // fall through
    }
  }
  return value;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k) ?? [];
    arr.push(item);
    map.set(k, arr);
  }
  return map;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PropertyList({
  grouped,
  onNavigate,
}: {
  grouped: Map<string, WikidataEntityProperty[]>;
  onNavigate?: (iri: string) => void;
}) {
  return (
    <dl className="space-y-4">
      {Array.from(grouped.entries()).map(([propName, props]) => (
        <div key={propName}>
          <dt className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
            {propName}
          </dt>
          <dd className="space-y-1">
            {props.map((p, i) =>
              p.isLiteral ? (
                <div key={i} className="text-sm text-zinc-300">
                  {formatLiteralValue(p.value)}
                </div>
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => p.valueIri && onNavigate?.(p.valueIri)}
                  disabled={!p.valueIri}
                  className="block text-left text-sm text-amber-200 hover:text-amber-100 hover:underline focus:outline-none disabled:cursor-default disabled:text-zinc-400"
                >
                  {p.value}
                </button>
              )
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ── Event-type detection ─────────────────────────────────────────────────────

/**
 * Wikidata P31 (instance-of) IRIs that indicate the entity IS an event.
 * For events we show all related entities WITHOUT time-window filtering.
 * For countries / organisations we show events filtered to the time window.
 */
const EVENT_TYPE_IRIS = new Set([
  "http://www.wikidata.org/entity/Q198",     // War
  "http://www.wikidata.org/entity/Q178561",  // Battle
  "http://www.wikidata.org/entity/Q831663",  // Military campaign
  "http://www.wikidata.org/entity/Q188055",  // Military operation
  "http://www.wikidata.org/entity/Q180684",  // Conflict
  "http://www.wikidata.org/entity/Q1656682", // Siege
  "http://www.wikidata.org/entity/Q179076",  // Revolution
  "http://www.wikidata.org/entity/Q131569",  // Treaty
  "http://www.wikidata.org/entity/Q625298",  // Peace treaty
  "http://www.wikidata.org/entity/Q8465",    // Military occupation
  "http://www.wikidata.org/entity/Q179010",  // Armed conflict
  "http://www.wikidata.org/entity/Q189760",  // Assassination
]);

const P31_IRI = "http://www.wikidata.org/prop/direct/P31";

// ── Related entities section ──────────────────────────────────────────────────

function RelatedEntitiesSection({
  entityIri,
  filterByTimeWindow,
  timeWindow,
  onNavigate,
  onRelatedEntitiesChange,
}: {
  entityIri: string;
  /** When true, only events overlapping the time window are fetched. */
  filterByTimeWindow: boolean;
  timeWindow: { start: number; end: number };
  onNavigate: (iri: string) => void;
  onRelatedEntitiesChange?: (entities: WikidataMapEntity[]) => void;
}) {
  const [events, setEvents] = useState<RelatedEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedWindow, setFetchedWindow] = useState<{ start: number; end: number } | null>(null);

  const isStale =
    filterByTimeWindow &&
    fetchedWindow !== null &&
    (fetchedWindow.start !== timeWindow.start || fetchedWindow.end !== timeWindow.end);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ iri: entityIri });
      if (filterByTimeWindow) {
        params.set("startYear", String(timeWindow.start));
        params.set("endYear", String(timeWindow.end));
      }
      const res = await fetch(`/api/wikidata/related-events?${params}`);
      const data = await res.json() as { events?: RelatedEvent[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Fetch failed");
      const fetched = data.events ?? [];
      setEvents(fetched);
      if (filterByTimeWindow) setFetchedWindow({ ...timeWindow });

      // Push geolocated events to the map
      if (onRelatedEntitiesChange) {
        const mapEntities: WikidataMapEntity[] = fetched
          .filter((e): e is RelatedEvent & { lat: number; lon: number } =>
            typeof e.lat === "number" && typeof e.lon === "number"
          )
          .map((e) => ({
            iri: e.iri,
            label: e.label,
            description: e.description,
            lat: e.lat,
            lon: e.lon,
            typeIri: e.typeIri,
            typeLabel: e.typeLabel,
            endYear: e.endYear,
          }));
        onRelatedEntitiesChange(mapEntities);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [entityIri, filterByTimeWindow, timeWindow, onRelatedEntitiesChange]);

  return (
    <div className="mt-5 border-t border-zinc-700 pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Related Entities
        </h3>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg border border-violet-500/50 bg-violet-500/15 px-2.5 py-1 text-xs text-violet-300 transition hover:bg-violet-500/25 disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Loading…
            </>
          ) : filterByTimeWindow ? (
            <>
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              {timeWindow.start}–{timeWindow.end}
            </>
          ) : (
            <>
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              All time
            </>
          )}
        </button>
      </div>

      {isStale && events !== null && (
        <p className="mb-2 text-[10px] text-amber-400">
          ⚠ Results are for {fetchedWindow!.start}–{fetchedWindow!.end} — click to refresh
        </p>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {events !== null && !loading && (
        events.length === 0 ? (
          <p className="text-xs text-zinc-500">No related entities found.</p>
        ) : (
          <ul className="space-y-1.5">
            {events.map((e) => (
              <li key={e.iri}>
                <button
                  type="button"
                  onClick={() => onNavigate(e.iri)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-left transition hover:border-violet-500/40 hover:bg-zinc-800 focus:outline-none"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-amber-200 leading-snug">
                      {e.label}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {e.lat != null && (
                        <svg className="h-3 w-3 text-violet-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                      )}
                      <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400">
                        {e.typeLabel}
                      </span>
                    </div>
                  </div>
                  {(e.startYear != null || e.endYear != null) && (
                    <div className="mt-0.5 text-[11px] text-zinc-500">
                      {e.startYear != null && e.endYear != null
                        ? `${e.startYear} – ${e.endYear}`
                        : e.startYear != null
                          ? `from ${e.startYear}`
                          : `until ${e.endYear}`}
                    </div>
                  )}
                  {e.description && (
                    <p className="mt-0.5 text-[11px] text-zinc-500 line-clamp-2">{e.description}</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

// ── Date helpers ─────────────────────────────────────────────────────────────

const WD_PROP = "http://www.wikidata.org/prop/direct/";

// Priority-ordered lists: first match wins
const START_PROP_IRIS = [
  `${WD_PROP}P571`,  // inception
  `${WD_PROP}P580`,  // start time
  `${WD_PROP}P569`,  // date of birth
  `${WD_PROP}P585`,  // point in time
];
const END_PROP_IRIS = [
  `${WD_PROP}P576`,  // dissolved / abolished
  `${WD_PROP}P582`,  // end time
  `${WD_PROP}P570`,  // date of death
];

const PROP_LABEL: Record<string, string> = {
  [`${WD_PROP}P571`]: "Founded",
  [`${WD_PROP}P580`]: "Start",
  [`${WD_PROP}P569`]: "Born",
  [`${WD_PROP}P585`]: "Date",
  [`${WD_PROP}P576`]: "Dissolved",
  [`${WD_PROP}P582`]: "End",
  [`${WD_PROP}P570`]: "Died",
};

function extractYear(isoValue: string): string {
  // Handles "1830-10-04T00:00:00Z" and negative years like "-0048-01-01T00:00:00Z"
  const m = isoValue.match(/^(-?\d+)-(\d{2})-(\d{2})/);
  if (!m) return isoValue;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (month === 1 && day === 1) return String(year); // year-only precision
  const date = new Date(Date.UTC(Math.abs(year), month - 1, day));
  const formatted = date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  return year < 0 ? `${formatted} BCE` : formatted;
}

// ── Timeline tab ─────────────────────────────────────────────────────────────

const ISO_DATE_RE = /^(-?\d{4})-(\d{2})-(\d{2})/;

/** Parse year from an ISO date string (handles BCE negative years). */
function parseYearFromIso(value: string): number | null {
  const m = value.match(ISO_DATE_RE);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  return isNaN(y) ? null : y;
}

/** Format an ISO date to a human-readable string (reuses extractYear logic). */
function formatIsoDate(value: string): string {
  const m = value.match(ISO_DATE_RE);
  if (!m) return value;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (month === 1 && day === 1) return String(year < 0 ? `${Math.abs(year)} BCE` : year);
  const date = new Date(Date.UTC(Math.abs(year), month - 1, day));
  const formatted = date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  return year < 0 ? `${formatted} BCE` : formatted;
}

type TimelineEntry =
  | { kind: "date";  year: number;        propName: string; formattedDate: string }
  | { kind: "fact";  year: number | null; endYear?: number; label: string; factKind: "position" | "award" }
  | { kind: "event"; year: number | null; event: RelatedEvent };

const ENTRY_ORDER: Record<TimelineEntry["kind"], number> = { date: 0, fact: 1, event: 2 };

function TimelineTab({
  entityIri,
  entityProperties,
  isPerson,
  filterByTimeWindow,
  timeWindow,
  onNavigate,
  onRelatedEntitiesChange,
}: {
  entityIri: string;
  entityProperties: WikidataEntityProperty[];
  isPerson: boolean;
  filterByTimeWindow: boolean;
  timeWindow: { start: number; end: number };
  onNavigate: (iri: string) => void;
  onRelatedEntitiesChange?: (entities: WikidataMapEntity[]) => void;
}) {
  const [events, setEvents] = useState<RelatedEvent[] | null>(null);
  const [facts, setFacts] = useState<PersonFact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ iri: entityIri });
      if (filterByTimeWindow) {
        params.set("startYear", String(timeWindow.start));
        params.set("endYear", String(timeWindow.end));
      }

      // Fetch related events and person-specific facts in parallel
      const [eventsJson, factsJson] = await Promise.all([
        fetch(`/api/wikidata/related-events?${params}`).then((r) =>
          r.json() as Promise<{ events?: RelatedEvent[]; error?: string }>
        ),
        isPerson
          ? fetch(`/api/wikidata/person-timeline?iri=${encodeURIComponent(entityIri)}`).then((r) =>
              r.json() as Promise<{ facts?: PersonFact[] }>
            )
          : Promise.resolve(null),
      ]);

      if (!eventsJson.events && eventsJson.error) throw new Error(eventsJson.error);
      const fetched = eventsJson.events ?? [];
      setEvents(fetched);
      setFacts(factsJson?.facts ?? []);

      if (onRelatedEntitiesChange) {
        const mapEntities: WikidataMapEntity[] = fetched
          .filter((e): e is RelatedEvent & { lat: number; lon: number } =>
            typeof e.lat === "number" && typeof e.lon === "number"
          )
          .map((e) => ({
            iri: e.iri,
            label: e.label,
            description: e.description,
            lat: e.lat,
            lon: e.lon,
            typeIri: e.typeIri,
            typeLabel: e.typeLabel,
            endYear: e.endYear,
          }));
        onRelatedEntitiesChange(mapEntities);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [entityIri, isPerson, filterByTimeWindow, timeWindow, onRelatedEntitiesChange]);

  // Auto-load on mount
  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityIri]);

  // Extract date entries from the entity's own properties
  const dateEntries = entityProperties
    .filter((p) => p.isLiteral && ISO_DATE_RE.test(p.value))
    .map((p): TimelineEntry | null => {
      const year = parseYearFromIso(p.value);
      if (year === null) return null;
      return { kind: "date", year, propName: p.property, formattedDate: formatIsoDate(p.value) };
    })
    .filter((e): e is TimelineEntry => e !== null);

  // Build merged + sorted timeline entries
  const entries: TimelineEntry[] = [
    ...dateEntries,
    ...facts.map((f): TimelineEntry => ({
      kind: "fact",
      year: f.year ?? null,
      endYear: f.endYear,
      label: f.label,
      factKind: f.kind,
    })),
    ...(events ?? []).map((e): TimelineEntry => ({
      kind: "event",
      year: e.startYear ?? null,
      event: e,
    })),
  ].sort((a, b) => {
    const ya = a.year ?? Infinity;
    const yb = b.year ?? Infinity;
    if (ya !== yb) return ya - yb;
    return ENTRY_ORDER[a.kind] - ENTRY_ORDER[b.kind];
  });

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="h-7 w-7 animate-spin rounded-full border-4 border-zinc-600 border-t-violet-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-sm text-red-400">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
        >
          Retry
        </button>
      </div>
    );
  }

  if (events === null) return null;

  if (entries.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-zinc-500">No timeline entries found.</p>
      </div>
    );
  }

  let lastYear: number | null | undefined = undefined;

  return (
    <div className="px-4 py-4">
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[52px] top-0 bottom-0 w-px bg-zinc-700" />

        <ul className="space-y-0">
          {entries.map((entry, idx) => {
            const year = entry.year;
            const showYear = year !== lastYear;
            lastYear = year;

            if (entry.kind === "date") {
              return (
                <li key={`date-${idx}`} className="relative flex gap-3 pb-3">
                  {/* Year label */}
                  <div className="w-[52px] shrink-0 pt-0.5 text-right">
                    {showYear && (
                      <span className="text-[11px] font-semibold tabular-nums text-amber-400">
                        {year != null ? year : "?"}
                      </span>
                    )}
                  </div>

                  {/* Diamond anchor dot */}
                  <div className="relative z-10 mt-[5px] h-2.5 w-2.5 shrink-0 rotate-45 rounded-sm bg-amber-400 ring-2 ring-zinc-900" />

                  {/* Date row */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      {entry.propName}
                    </span>
                    <p className="text-sm font-medium text-amber-300">{entry.formattedDate}</p>
                  </div>
                </li>
              );
            }

            // kind === "fact" (position held / award)
            if (entry.kind === "fact") {
              return (
                <li key={`fact-${idx}`} className="relative flex gap-3 pb-3">
                  <div className="w-[52px] shrink-0 pt-0.5 text-right">
                    {showYear && year != null && (
                      <span className="text-[11px] font-semibold tabular-nums text-amber-400">{year}</span>
                    )}
                  </div>
                  <div className="relative z-10 mt-[6px] h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-2 ring-zinc-900" />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        {entry.factKind === "position" ? "Position" : "Award"}
                      </span>
                      {entry.endYear != null && entry.endYear !== entry.year && (
                        <span className="text-[10px] text-zinc-500">→ {entry.endYear}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium leading-snug text-emerald-300">{entry.label}</p>
                  </div>
                </li>
              );
            }

            // kind === "event"
            const e = entry.event;
            return (
              <li key={`${e.iri}-${idx}`} className="relative flex gap-3 pb-4">
                {/* Year label */}
                <div className="w-[52px] shrink-0 pt-1 text-right">
                  {showYear && (
                    <span className="text-[11px] font-semibold tabular-nums text-amber-400">
                      {year != null ? year : "?"}
                    </span>
                  )}
                </div>

                {/* Dot on the timeline */}
                <div className="relative z-10 mt-[7px] h-2 w-2 shrink-0 rounded-full bg-violet-500 ring-2 ring-zinc-900" />

                {/* Event card */}
                <button
                  type="button"
                  onClick={() => onNavigate(e.iri)}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-2 text-left transition hover:border-violet-500/40 hover:bg-zinc-800 focus:outline-none"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="text-sm font-medium leading-snug text-amber-200">
                      {e.label}
                    </span>
                    {e.lat != null && (
                      <svg className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                      </svg>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400">
                      {e.typeLabel}
                    </span>
                    {e.endYear != null && e.endYear !== e.startYear && (
                      <span className="text-[10px] text-zinc-500">
                        → {e.endYear}
                      </span>
                    )}
                  </div>
                  {e.description && (
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 line-clamp-2">
                      {e.description}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ── Panel component ───────────────────────────────────────────────────────────

type WikidataEntityPanelProps = {
  iri: string;
  entity: WikidataEntityDetail | null;
  loading: boolean;
  error?: string | null;
  canGoBack: boolean;
  timeWindow: { start: number; end: number };
  onClose: () => void;
  onNavigate: (iri: string) => void;
  onBack: () => void;
  /** Called with geolocated related events whenever the "Related Events" button is clicked. */
  onRelatedEntitiesChange?: (entities: WikidataMapEntity[]) => void;
};

/**
 * Floating right-side panel for a Wikidata entity.
 * Renders absolutely so it overlays the map.
 */
export function WikidataEntityPanel({
  iri,
  entity,
  loading,
  error,
  canGoBack,
  timeWindow,
  onClose,
  onNavigate,
  onBack,
  onRelatedEntitiesChange,
}: WikidataEntityPanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("main");

  // Reset to main tab when the entity changes
  useEffect(() => {
    setActiveTab("main");
  }, [iri]);

  const label = entity?.label ?? (loading ? "Loading…" : "Not available");
  const groupedProps = groupBy(entity?.properties ?? [], (p) => p.property);

  // Determine whether this entity is itself an event/conflict.
  // If yes, "Related Entities" should not be filtered by the time window
  // (showing participants, countries etc. regardless of when they existed).
  const entityP31Iris = entity?.properties
    .filter((p) => p.propertyIri === P31_IRI)
    .map((p) => p.valueIri)
    .filter((v): v is string => Boolean(v)) ?? [];
  const filterByTimeWindow = !entityP31Iris.some((iri) => EVENT_TYPE_IRIS.has(iri));
  const isPerson = entityP31Iris.includes("http://www.wikidata.org/entity/Q5");

  return (
    <aside
      className="absolute right-0 top-0 z-40 flex h-full w-80 min-w-[280px] max-w-[90vw] flex-col border-l border-zinc-700 bg-zinc-900/95 shadow-xl backdrop-blur sm:w-96"
      role="complementary"
      aria-label="Entity details"
    >
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-700">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {canGoBack && (
              <button
                type="button"
                onClick={onBack}
                className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                aria-label="Go back"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="truncate text-base font-semibold text-white">{label}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            aria-label="Close panel"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab bar — only show when entity is loaded */}
        {entity && (
          <div className="flex px-4 gap-1 pb-0">
            {(["main", "timeline"] as ActiveTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative pb-2.5 pt-1 px-3 text-xs font-medium capitalize transition focus:outline-none ${
                  activeTab === tab
                    ? "text-amber-300"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab === "main" ? "Overview" : "Timeline"}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-amber-400" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      {loading && !entity ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-zinc-600 border-t-violet-500" />
        </div>
      ) : error && !entity ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-8 text-center">
          <svg className="h-10 w-10 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm font-medium text-zinc-300">Could not load entity</p>
          <p className="text-xs text-zinc-500">{error}</p>
          {iri && (
            <a
              href={`https://www.wikidata.org/wiki/${wikidataId(iri)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-xs text-amber-400 hover:text-amber-300 hover:underline"
            >
              View on wikidata.org ↗
            </a>
          )}
        </div>
      ) : entity ? (
        <>
          {/* ── Overview tab ── */}
          {activeTab === "main" && (
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {entity.description && (
                <p className="mb-4 text-sm italic text-zinc-400">{entity.description}</p>
              )}

              {/* ── Dates banner ── */}
              {(() => {
                const props = entity.properties;
                const startProp = props.find((p) => START_PROP_IRIS.includes(p.propertyIri));
                const endProp   = props.find((p) => END_PROP_IRIS.includes(p.propertyIri));
                if (!startProp && !endProp) return null;
                return (
                  <div className="mb-4 flex items-stretch gap-px overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800/50 text-sm">
                    {startProp && (
                      <div className="flex flex-1 flex-col px-3 py-2.5">
                        <span className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          {PROP_LABEL[startProp.propertyIri] ?? "Start"}
                        </span>
                        <span className="font-mono font-semibold text-amber-300">
                          {extractYear(startProp.value)}
                        </span>
                      </div>
                    )}
                    {startProp && (
                      <div className="flex items-center bg-zinc-700/40 px-2 text-zinc-600">→</div>
                    )}
                    <div className="flex flex-1 flex-col px-3 py-2.5">
                      <span className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        {endProp ? (PROP_LABEL[endProp.propertyIri] ?? "End") : "End"}
                      </span>
                      <span className={`font-mono font-semibold ${endProp ? "text-amber-300" : "text-emerald-400"}`}>
                        {endProp ? extractYear(endProp.value) : "Present"}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {entity.wikiSummary && (
                <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
                  {entity.wikiSummary.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entity.wikiSummary.thumbnail}
                      alt=""
                      className="mx-auto mb-3 block h-40 w-full rounded object-cover"
                    />
                  )}
                  <p className="text-xs leading-relaxed text-zinc-300 line-clamp-[12]">
                    {entity.wikiSummary.extract}
                  </p>
                  <a
                    href={entity.wikiSummary.articleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 hover:underline"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Read on Wikipedia
                  </a>
                </div>
              )}

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400">
                  {wikidataId(entity.iri)}
                </span>
                <a
                  href={`https://www.wikidata.org/wiki/${wikidataId(entity.iri)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-400 hover:text-amber-300 hover:underline"
                >
                  wikidata.org ↗
                </a>
              </div>

              {groupedProps.size === 0 ? (
                <p className="text-sm text-zinc-500">No properties found.</p>
              ) : (
                <PropertyList grouped={groupedProps} onNavigate={onNavigate} />
              )}

              <RelatedEntitiesSection
                entityIri={entity.iri}
                filterByTimeWindow={filterByTimeWindow}
                timeWindow={timeWindow}
                onNavigate={onNavigate}
                onRelatedEntitiesChange={onRelatedEntitiesChange}
              />

              <div className="mt-6 border-t border-zinc-700 pt-3">
                <p className="break-all font-mono text-xs text-zinc-600">{entity.iri}</p>
              </div>
            </div>
          )}

          {/* ── Timeline tab ── */}
          {activeTab === "timeline" && (
            <div className="flex-1 overflow-y-auto">
              <TimelineTab
                entityIri={entity.iri}
                entityProperties={entity.properties}
                isPerson={isPerson}
                filterByTimeWindow={filterByTimeWindow}
                timeWindow={timeWindow}
                onNavigate={onNavigate}
                onRelatedEntitiesChange={onRelatedEntitiesChange}
              />
            </div>
          )}
        </>
      ) : null}
    </aside>
  );
}
