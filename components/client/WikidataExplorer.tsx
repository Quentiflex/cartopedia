"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SearchResult = {
  iri: string;
  label: string;
  description?: string;
};

type WikidataType = {
  iri: string;
  label: string;
  description?: string;
  category: string;
  count?: number;
};

type TypeMember = {
  iri: string;
  label: string;
  description?: string;
};

type EntityProperty = {
  property: string;
  propertyIri: string;
  value: string;
  valueIri?: string;
  isLiteral: boolean;
};

type IncomingRelation = {
  property: string;
  subject: string;
  subjectIri: string;
};

type WikiSummary = {
  extract: string;
  thumbnail?: string;
  articleUrl: string;
};

type EntityDetail = {
  iri: string;
  label: string;
  description?: string;
  wikiSummary?: WikiSummary | null;
  source?: "local" | "live";
  properties: EntityProperty[];
  incomingRelations: IncomingRelation[];
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function wikidataId(iri: string): string {
  return iri.split(/[/#]/).pop() ?? iri;
}

function formatLiteralValue(value: string): string {
  // ISO date strings
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
    } catch {
      // fall through
    }
  }
  return value;
}

// Group an array of objects by a string key
function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = map.get(k) ?? [];
    group.push(item);
    map.set(k, group);
  }
  return map;
}

// ── Pagination ────────────────────────────────────────────────────────────────

function PaginationBar({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const [inputVal, setInputVal] = useState(String(page));

  // Keep input in sync when page changes externally (e.g. type selection)
  useEffect(() => setInputVal(String(page)), [page]);

  function commit(raw: string) {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1 && n <= totalPages) onPageChange(n);
    else setInputVal(String(page)); // reset on invalid
  }

  // Build the visible page window: first, …, [cur-2..cur+2], …, last
  const windowSize = 2;
  const pages: Array<number | "…"> = [];
  const lo = Math.max(2, page - windowSize);
  const hi = Math.min(totalPages - 1, page + windowSize);
  pages.push(1);
  if (lo > 2) pages.push("…");
  for (let i = lo; i <= hi; i++) pages.push(i);
  if (hi < totalPages - 1) pages.push("…");
  if (totalPages > 1) pages.push(totalPages);

  const btnBase =
    "flex h-7 min-w-[1.75rem] items-center justify-center rounded px-1.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-amber-500";

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-700 pt-4">
      {/* Page window */}
      <div className="flex items-center gap-1">
        {/* Previous */}
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={`${btnBase} border border-zinc-600 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40`}
          aria-label="Previous page"
        >
          ←
        </button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-sm text-zinc-600">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p as number)}
              className={`${btnBase} border ${
                p === page
                  ? "border-amber-500 bg-amber-500/15 font-semibold text-amber-300"
                  : "border-zinc-600 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={`${btnBase} border border-zinc-600 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40`}
          aria-label="Next page"
        >
          →
        </button>
      </div>

      {/* Jump-to input */}
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <span>Go to</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit(inputVal)}
          className="w-14 rounded border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-center text-sm text-zinc-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          aria-label="Jump to page"
        />
        <span className="text-zinc-500">/ {totalPages}</span>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="h-7 w-7 animate-spin rounded-full border-4 border-zinc-600 border-t-amber-500" />
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-600/50 bg-red-900/20 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  );
}

// ── Entity detail panel (right sidebar) ──────────────────────────────────────

type EntityDetailPanelProps = {
  entity: EntityDetail;
  loading: boolean;
  error?: string | null;
  onClose: () => void;
  onNavigate: (iri: string) => void;
  onBack: () => void;
  canGoBack: boolean;
};

function PropertyList({
  grouped,
  onNavigate,
}: {
  grouped: Map<string, EntityProperty[]>;
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
                  className="block text-left text-sm text-amber-200 hover:text-amber-100 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-default disabled:text-zinc-400"
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

function EntityDetailPanel({
  entity,
  loading,
  error,
  onClose,
  onNavigate,
  onBack,
  canGoBack,
}: EntityDetailPanelProps) {
  const groupedCore     = groupBy(entity.properties, (p) => p.property);
  const groupedIncoming = groupBy(entity.incomingRelations, (r) => r.property);

  return (
    <aside
      className="flex w-80 shrink-0 flex-col border-l border-zinc-700 bg-zinc-900 sm:w-96"
      role="complementary"
      aria-label="Entity details"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-700 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {canGoBack && (
            <button
              type="button"
              onClick={onBack}
              className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              aria-label="Go back"
              title="Go back"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h2 className="truncate text-base font-semibold text-white">{entity.label}</h2>
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

      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-8 text-center">
          <svg className="h-10 w-10 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm font-medium text-zinc-300">Not in local dataset</p>
          <p className="text-xs text-zinc-500">{error}</p>
          {entity.iri && (
            <a
              href={`https://www.wikidata.org/wiki/${wikidataId(entity.iri)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-xs text-amber-400 hover:text-amber-300 hover:underline"
            >
              View on wikidata.org ↗
            </a>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Description */}
          {entity.description && (
            <p className="mb-4 text-sm italic text-zinc-400">{entity.description}</p>
          )}

          {/* Wikipedia summary */}
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

          {/* Wikidata ID + source badge + link */}
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

          {/* Properties */}
          {entity.properties.length === 0 ? (
            <p className="text-sm text-zinc-500">No properties found.</p>
          ) : (
            <PropertyList grouped={groupedCore} onNavigate={onNavigate} />
          )}

          {/* Incoming relations */}
          {groupedIncoming.size > 0 && (
            <div className="mt-6 border-t border-zinc-700 pt-4">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Referenced by
              </h3>
              <dl className="space-y-4">
                {Array.from(groupedIncoming.entries()).map(([propName, rels]) => (
                  <div key={propName}>
                    <dt className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
                      {propName}
                    </dt>
                    <dd className="space-y-1">
                      {rels.map((r, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => onNavigate?.(r.subjectIri)}
                          className="block w-full rounded border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-left text-sm text-amber-200 transition hover:border-amber-500/50 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          {r.subject}
                        </button>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Raw IRI */}
          <div className="mt-6 border-t border-zinc-700 pt-3">
            <p className="break-all font-mono text-xs text-zinc-600">{entity.iri}</p>
          </div>
        </div>
      )}
    </aside>
  );
}

// ── Result card ───────────────────────────────────────────────────────────────

function ResultCard({
  iri,
  label,
  description,
  selected,
  onClick,
}: {
  iri: string;
  label: string;
  description?: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-amber-500 ${
        selected
          ? "border-amber-500 bg-amber-500/10"
          : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-white">{label}</span>
        <span className="shrink-0 font-mono text-xs text-zinc-600">{wikidataId(iri)}</span>
      </div>
      {description && (
        <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{description}</p>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function WikidataExplorer() {
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Types state — loaded from static API, grouped by category
  const [types, setTypes] = useState<WikidataType[]>([]);
  const [typesError, setTypesError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<WikidataType | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Type members state
  const [members, setMembers] = useState<TypeMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [membersPagination, setMembersPagination] = useState<Pagination | null>(null);
  const [membersPage, setMembersPage] = useState(1);

  // Entity detail state
  const [selectedEntity, setSelectedEntity] = useState<EntityDetail | null>(null);
  const [entityLoading, setEntityLoading] = useState(false);
  const [entityError, setEntityError] = useState<string | null>(null);
  const [entityHistory, setEntityHistory] = useState<EntityDetail[]>([]);

  // Which IRI is currently "selected" in the list (for highlight)
  const [activeIri, setActiveIri] = useState<string | null>(null);

  // Mode: "types" | "search"
  const [mode, setMode] = useState<"types" | "search">("types");

  // Always query the live Wikidata endpoint.
  const dataSource = "live" as const;

  // ── Load curated types on mount (static API — instant) ────────────────────

  useEffect(() => {
    fetch("/api/wikidata/types")
      .then((r) => (r.ok ? r.json() : r.json().then((e: { error: string }) => Promise.reject(new Error(e.error)))))
      .then((data: { types: WikidataType[] }) => setTypes(data.types ?? []))
      .catch((err: Error) => setTypesError(err.message));
  }, []);

  // ── Search debounce ────────────────────────────────────────────────────────

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (searchQuery.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    setMode("search");
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const params = new URLSearchParams({ q: searchQuery, limit: "20", source: dataSource });
        const r = await fetch(`/api/wikidata/search?${params}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Search failed");
        setSearchResults(data.results ?? []);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : "Search error");
      } finally {
        setSearchLoading(false);
      }
    }, 400);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery, dataSource]);

  // ── Load type members ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedType) return;

    setMembersLoading(true);
    setMembersError(null);
    const params = new URLSearchParams({
      type: selectedType.iri,
      page: String(membersPage),
      limit: "20",
      source: dataSource,
    });
    fetch(`/api/wikidata/type-members?${params}`)
      .then((r) => (r.ok ? r.json() : r.json().then((e: { error: string }) => Promise.reject(new Error(e.error)))))
      .then((data: { members: TypeMember[]; pagination: Pagination }) => {
        setMembers(data.members ?? []);
        setMembersPagination(data.pagination ?? null);
      })
      .catch((err: Error) => setMembersError(err.message))
      .finally(() => setMembersLoading(false));
  }, [selectedType, membersPage, dataSource]);

  // ── Fetch entity detail ────────────────────────────────────────────────────

  const navigateToEntity = useCallback(
    async (iri: string) => {
      setActiveIri(iri);
      setEntityLoading(true);
      setEntityError(null);
      try {
        const r = await fetch(`/api/wikidata/entity?iri=${encodeURIComponent(iri)}&source=${dataSource}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load entity");
        if (selectedEntity) {
          setEntityHistory((prev) => [...prev, selectedEntity]);
        }
        setSelectedEntity(data as EntityDetail);
      } catch (err) {
        setEntityError(err instanceof Error ? err.message : "Failed to load entity");
        // Keep the panel open to show the error (don't clear selectedEntity)
      } finally {
        setEntityLoading(false);
      }
    },
    [selectedEntity]
  );

  const goBackInHistory = useCallback(() => {
    if (entityHistory.length === 0) return;
    const prev = entityHistory[entityHistory.length - 1];
    setEntityHistory((h) => h.slice(0, -1));
    setSelectedEntity(prev);
    setActiveIri(prev.iri);
  }, [entityHistory]);

  const closeEntityPanel = useCallback(() => {
    setSelectedEntity(null);
    setEntityHistory([]);
    setEntityError(null);
    setActiveIri(null);
  }, []);

  const handleTypeClick = (type: WikidataType) => {
    setSelectedType(type);
    setMembersPage(1);
    setMembers([]);
    setMode("types");
    setSearchQuery("");
    setSearchResults([]);
    closeEntityPanel();
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setMode("types");
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const showSearch = mode === "search" && searchQuery.length >= 2;
  const centerItems: Array<{ iri: string; label: string; description?: string }> = showSearch
    ? searchResults
    : members;

  return (
    <div className="flex h-screen flex-col bg-zinc-900 text-zinc-100">
      {/* ── Header ── */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-700 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="text-base font-semibold text-white">Wikidata Explorer</h1>
          <span className="flex items-center gap-1.5 rounded-full border border-sky-700/50 bg-sky-900/30 px-2.5 py-0.5 text-xs text-sky-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
            Live · wikidata.org
          </span>
        </div>

        <Link
          href="/"
          className="shrink-0 rounded-lg border border-zinc-600 bg-zinc-800/90 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          ← Back
        </Link>
      </header>

      {/* ── Body: sidebar + center + detail panel ── */}
      <div className="flex min-h-0 flex-1">

        {/* ── Left sidebar: search + type browser ── */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-700 xl:w-72">
          {/* Search box */}
          <div className="shrink-0 border-b border-zinc-700 p-3">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Wikidata…"
                className="w-full rounded-lg border border-zinc-600 bg-zinc-800 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Type browser — grouped by category */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 px-4 pt-3 pb-1 flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Browse by type
              </h2>
              {showSearch && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="text-xs text-amber-400 hover:text-amber-300"
                >
                  Clear search
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto pb-3">
              {typesError ? (
                <div className="px-3 pt-2">
                  <ErrorBanner message={typesError} />
                </div>
              ) : (
                // Group types by category
                Array.from(
                  types.reduce((map, t) => {
                    const cat = t.category ?? "Other";
                    map.set(cat, [...(map.get(cat) ?? []), t]);
                    return map;
                  }, new Map<string, WikidataType[]>())
                ).map(([category, items]) => {
                  const collapsed = collapsedCategories.has(category);
                  return (
                    <div key={category} className="border-b border-zinc-800 last:border-0">
                      {/* Category header */}
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedCategories((prev) => {
                            const next = new Set(prev);
                            collapsed ? next.delete(category) : next.add(category);
                            return next;
                          })
                        }
                        className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-zinc-800/50 focus:outline-none"
                      >
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                          {category}
                        </span>
                        <svg
                          className={`h-3 w-3 text-zinc-600 transition-transform ${collapsed ? "-rotate-90" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {/* Type items */}
                      {!collapsed && (
                        <ul className="px-2 pb-1">
                          {items.map((t) => (
                            <li key={t.iri}>
                              <button
                                type="button"
                                onClick={() => handleTypeClick(t)}
                                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                                  selectedType?.iri === t.iri && !showSearch
                                    ? "bg-amber-500/15 text-amber-200"
                                    : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                                }`}
                              >
                                <span className="font-medium">{t.label}</span>
                                {t.description && (
                                  <p className="mt-0.5 line-clamp-1 text-xs text-zinc-600">
                                    {t.description}
                                  </p>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* ── Center: entity list ── */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Center header */}
          <div className="shrink-0 border-b border-zinc-700 px-5 py-3">
            {showSearch ? (
              <h2 className="text-sm font-medium text-zinc-300">
                {searchLoading
                  ? "Searching…"
                  : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} for "${searchQuery}"`}
              </h2>
            ) : selectedType ? (
              <div className="flex items-baseline gap-3">
                <h2 className="text-sm font-medium text-zinc-300">
                  {selectedType.label}
                </h2>
                {membersPagination && (
                  <span className="text-xs text-zinc-500">
                    {membersPagination.total.toLocaleString()} entities
                  </span>
                )}
              </div>
            ) : (
              <h2 className="text-sm text-zinc-500">
                Select a type on the left, or search for an entity
              </h2>
            )}
          </div>

          {/* Entity list */}
          <div className="flex-1 overflow-y-auto p-4">
            {showSearch ? (
              searchLoading ? (
                <Spinner />
              ) : searchError ? (
                <ErrorBanner message={searchError} />
              ) : searchResults.length === 0 && searchQuery.length >= 2 ? (
                <p className="text-sm text-zinc-500">No results found for "{searchQuery}".</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {searchResults.map((r) => (
                    <ResultCard
                      key={r.iri}
                      {...r}
                      selected={activeIri === r.iri}
                      onClick={() => navigateToEntity(r.iri)}
                    />
                  ))}
                </div>
              )
            ) : selectedType ? (
              membersLoading ? (
                <Spinner />
              ) : membersError ? (
                <ErrorBanner message={membersError} />
              ) : centerItems.length === 0 ? (
                <p className="text-sm text-zinc-500">No entities found for this type.</p>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {centerItems.map((m) => (
                      <ResultCard
                        key={m.iri}
                        {...m}
                        selected={activeIri === m.iri}
                        onClick={() => navigateToEntity(m.iri)}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  {membersPagination && membersPagination.totalPages > 1 && (
                    <PaginationBar
                      page={membersPage}
                      totalPages={membersPagination.totalPages}
                      onPageChange={setMembersPage}
                    />
                  )}
                </>
              )
            ) : (
              /* Welcome state */
              <div className="flex h-full items-center justify-center">
                <div className="max-w-sm text-center">
                  <div className="mb-4 text-4xl">🌐</div>
                  <h3 className="mb-2 text-lg font-semibold text-zinc-300">
                    Wikidata Knowledge Graph
                  </h3>
                  <p className="text-sm text-zinc-500">
                    Browse entities by type using the left panel, or search for any entity
                    by name. Click on any entity to explore its properties and connections.
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ── Right: entity detail panel ── */}
        {(selectedEntity || entityLoading || entityError) && (
          <EntityDetailPanel
            entity={
              selectedEntity ?? {
                iri: activeIri ?? "",
                label: entityError ? "Not available" : "Loading…",
                properties: [],
                incomingRelations: [],
              }
            }
            loading={entityLoading && !selectedEntity && !entityError}
            error={entityError}
            onClose={closeEntityPanel}
            onNavigate={navigateToEntity}
            onBack={goBackInHistory}
            canGoBack={entityHistory.length > 0}
          />
        )}
      </div>
    </div>
  );
}
