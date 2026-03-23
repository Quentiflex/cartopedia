"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EntitySearch } from "./EntitySearch";
import type { AcademicDisciplineCard } from "@/app/api/wikidata/academic-disciplines/route";

type DisciplineEvolutionRow = {
  iri: string;
  label: string;
  startYear: number | null;
  endYear: number | null;
  description?: string;
  wikiSummary?: {
    extract: string;
    articleUrl: string;
    thumbnail?: string;
  } | null;
};

type EpubExportEntity = {
  iri: string;
  label: string;
  articleUrl?: string;
};

type DisciplineEvolutionResponse = {
  discipline: { iri: string; label: string };
  disciplineValid: boolean;
  warning?: string;
  schoolType: { iri: string; label: string };
  economicsMode?: "school" | "concept" | "branch" | "authors";
  linkProperty: { code: string; label: string };
  items: DisciplineEvolutionRow[];
  yearRange: { min: number; max: number; step: number };
};

type CategoryAuthorCard = {
  iri: string;
  label: string;
  description?: string;
};

type CategoryAuthorsResponse = {
  results: CategoryAuthorCard[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

type AcademicDisciplinesApiResponse = {
  results: AcademicDisciplineCard[];
  pagination?: {
    limit: number;
    offset: number;
    total?: number;
  };
};

function qidFromIri(iri: string): string {
  return iri.split(/[/#]/).pop() ?? iri;
}

function parseQorIri(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^Q\d+$/i.test(trimmed)) return trimmed.toUpperCase();
  const normalized = trimmed.replace(/[<>]/g, "");
  const m = normalized.match(/Q\d+$/i);
  return m ? m[0].toUpperCase() : null;
}

const LINK_PROPERTIES: Array<{ code: "P361" | "P279"; label: string }> = [
  { code: "P361", label: "part of (P361)" },
  { code: "P279", label: "subclass of (P279)" },
];
const ECONOMICS_QID = "Q8134";
const SOCIOLOGY_QID = "Q21201";

export function DisciplineEvolution() {
  const DISCIPLINE_PAGE_SIZE = 18;
  const EVOLUTION_PAGE_SIZE = 18;
  const AUTHOR_PAGE_SIZE = 18;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [disciplineIri, setDisciplineIri] = useState<string | null>(null);
  const [directDiscipline, setDirectDiscipline] = useState("");

  const [disciplineCards, setDisciplineCards] = useState<AcademicDisciplineCard[]>([]);
  const [disciplineCardsLoading, setDisciplineCardsLoading] = useState(false);
  const [disciplineCardsError, setDisciplineCardsError] = useState<string | null>(null);
  const [disciplineCardsOffset, setDisciplineCardsOffset] = useState(0);
  const [disciplineCardsTotal, setDisciplineCardsTotal] = useState<number | null>(null);

  const [linkProperty, setLinkProperty] = useState<"P361" | "P279">("P361");
  const [economicsMode, setEconomicsMode] = useState<"school" | "concept" | "branch" | "authors">("school");

  const [data, setData] = useState<DisciplineEvolutionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evolutionLimit, setEvolutionLimit] = useState(EVOLUTION_PAGE_SIZE);
  const [selectedCategoryIri, setSelectedCategoryIri] = useState<string | null>(null);
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState<string | null>(null);
  const [authors, setAuthors] = useState<CategoryAuthorCard[]>([]);
  const [authorsLoading, setAuthorsLoading] = useState(false);
  const [authorsError, setAuthorsError] = useState<string | null>(null);
  const [authorsOffset, setAuthorsOffset] = useState(0);
  const [authorsHasMore, setAuthorsHasMore] = useState(false);
  const [selectedForEpub, setSelectedForEpub] = useState<Record<string, EpubExportEntity>>({});
  const [exportingEpub, setExportingEpub] = useState(false);

  useEffect(() => {
    const fromUrl = searchParams.get("discipline");
    if (!fromUrl) return;
    const parsed = parseQorIri(fromUrl);
    if (!parsed) return;
    const iri = `http://www.wikidata.org/entity/${parsed}`;
    setDisciplineIri((prev) => (prev === iri ? prev : iri));
    setDirectDiscipline((prev) => (prev === parsed ? prev : parsed));
    const modeFromUrl = searchParams.get("viewMode") ?? searchParams.get("economicsMode");
    if (
      modeFromUrl === "concept" ||
      modeFromUrl === "school" ||
      modeFromUrl === "branch" ||
      modeFromUrl === "authors"
    ) {
      setEconomicsMode(modeFromUrl);
    }
  }, [searchParams]);

  async function fetchDisciplineCards(params: { offset: number; append: boolean }) {
    setDisciplineCardsLoading(true);
    setDisciplineCardsError(null);
    try {
      const res = await fetch(
        `/api/wikidata/academic-disciplines?limit=${DISCIPLINE_PAGE_SIZE}&offset=${params.offset}`
      );
      const json = (await res.json()) as { error?: string } & Partial<AcademicDisciplinesApiResponse>;
      if (!res.ok) throw new Error(json.error ?? "Failed to load disciplines");
      const incoming = json.results ?? [];
      setDisciplineCards((prev) => (params.append ? [...prev, ...incoming] : incoming));
      const total = json.pagination?.total;
      setDisciplineCardsTotal(typeof total === "number" ? total : null);
      setDisciplineCardsOffset(params.offset);
    } catch (err) {
      setDisciplineCardsError(err instanceof Error ? err.message : "Failed to load disciplines");
    } finally {
      setDisciplineCardsLoading(false);
    }
  }

  useEffect(() => {
    fetchDisciplineCards({ offset: 0, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!disciplineIri) return;

    let alive = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const selectedQid = qidFromIri(disciplineIri ?? "");
        let endpoint = "/api/wikidata/discipline-evolution";
        let params = new URLSearchParams({
          discipline: disciplineIri ?? "",
          linkProperty,
          limit: String(evolutionLimit),
        });
        if (selectedQid === ECONOMICS_QID || selectedQid === SOCIOLOGY_QID) {
          if (selectedQid === ECONOMICS_QID) {
            endpoint =
              economicsMode === "school"
                ? "/api/wikidata/discipline-evolution/economics-schools"
                : economicsMode === "concept"
                  ? "/api/wikidata/discipline-evolution/economics-concepts"
                  : economicsMode === "branch"
                    ? "/api/wikidata/discipline-evolution/economics-branches"
                    : "/api/wikidata/discipline-evolution/economics-authors";
          } else {
            endpoint =
              economicsMode === "school"
                ? "/api/wikidata/discipline-evolution/sociology-schools"
                : economicsMode === "concept"
                  ? "/api/wikidata/discipline-evolution/sociology-concepts"
                  : economicsMode === "branch"
                    ? "/api/wikidata/discipline-evolution/sociology-branches"
                    : "/api/wikidata/discipline-evolution/sociology-authors";
          }
          params = new URLSearchParams({ limit: String(evolutionLimit) });
        }
        const res = await fetch(`${endpoint}?${params}`, { signal: controller.signal });
        const json = (await res.json()) as { error?: string; data?: DisciplineEvolutionResponse } & Partial<DisciplineEvolutionResponse>;
        if (!res.ok) throw new Error((json as any).error ?? "Failed to load discipline evolution");
        if (!alive) return;
        setData(json as DisciplineEvolutionResponse);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load discipline evolution");
        setData(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [disciplineIri, linkProperty, evolutionLimit, economicsMode]);

  useEffect(() => {
    if (!disciplineIri) return;
    const qid = qidFromIri(disciplineIri);
    if (qid !== ECONOMICS_QID && qid !== SOCIOLOGY_QID) return;
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("viewMode") === economicsMode) return;
    params.set("viewMode", economicsMode);
    params.delete("economicsMode");
    const query = params.toString();
    router.replace(query ? `/discipline-evolution?${query}` : "/discipline-evolution");
  }, [disciplineIri, economicsMode, router, searchParams]);

  const canLoadMoreDisciplines =
    disciplineCardsTotal != null
      ? disciplineCards.length < disciplineCardsTotal
      : disciplineCards.length > 0;
  const canLoadMoreEvolution = !!data && data.items.length >= evolutionLimit;

  function updateDisciplineInUrl(iri: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!iri) {
      params.delete("discipline");
      params.delete("viewMode");
      params.delete("economicsMode");
    } else {
      const qid = qidFromIri(iri);
      params.set("discipline", qid);
      if (qid === ECONOMICS_QID || qid === SOCIOLOGY_QID) {
        params.set("viewMode", economicsMode);
        params.delete("economicsMode");
      } else {
        params.delete("viewMode");
        params.delete("economicsMode");
      }
    }
    const query = params.toString();
    router.replace(query ? `/discipline-evolution?${query}` : "/discipline-evolution");
  }

  function selectDiscipline(iri: string) {
    const qid = qidFromIri(iri);
    if (qid !== ECONOMICS_QID && qid !== SOCIOLOGY_QID) {
      setEconomicsMode("school");
    }
    setDisciplineIri(iri);
    setDirectDiscipline(qid);
    setEvolutionLimit(EVOLUTION_PAGE_SIZE);
    setSelectedCategoryIri(null);
    setSelectedCategoryLabel(null);
    setAuthors([]);
    setAuthorsError(null);
    setAuthorsOffset(0);
    setAuthorsHasMore(false);
    setSelectedForEpub({});
    updateDisciplineInUrl(iri);
  }

  function clearSelectedDiscipline() {
    setDisciplineIri(null);
    setData(null);
    setDirectDiscipline("");
    setError(null);
    setEvolutionLimit(EVOLUTION_PAGE_SIZE);
    setSelectedCategoryIri(null);
    setSelectedCategoryLabel(null);
    setAuthors([]);
    setAuthorsError(null);
    setAuthorsOffset(0);
    setAuthorsHasMore(false);
    setSelectedForEpub({});
    updateDisciplineInUrl(null);
  }

  function toggleEpubSelection(item: DisciplineEvolutionRow) {
    setSelectedForEpub((prev) => {
      if (prev[item.iri]) {
        const copy = { ...prev };
        delete copy[item.iri];
        return copy;
      }
      return {
        ...prev,
        [item.iri]: {
          iri: item.iri,
          label: item.label,
          articleUrl: item.wikiSummary?.articleUrl,
        },
      };
    });
  }

  async function exportSelectedToEpub() {
    const entities = Object.values(selectedForEpub);
    if (entities.length === 0) return;
    setExportingEpub(true);
    try {
      const titleBase = data?.discipline?.label
        ? `${data.discipline.label} selection`
        : "Cartopedia selection";
      const res = await fetch("/api/wikidata/export-epub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleBase, entities }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Failed to generate EPUB");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const contentDisposition = res.headers.get("content-disposition") ?? "";
      const match = contentDisposition.match(/filename="([^"]+)"/i);
      const fileName = match?.[1] ?? "cartopedia-export.epub";
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export EPUB");
    } finally {
      setExportingEpub(false);
    }
  }

  async function fetchAuthors(params: { categoryIri: string; offset: number; append: boolean }) {
    setAuthorsLoading(true);
    setAuthorsError(null);
    try {
      const q = new URLSearchParams({
        category: params.categoryIri,
        limit: String(AUTHOR_PAGE_SIZE),
        offset: String(params.offset),
      });
      const res = await fetch(`/api/wikidata/category-authors?${q}`);
      const json = (await res.json()) as { error?: string } & Partial<CategoryAuthorsResponse>;
      if (!res.ok) throw new Error(json.error ?? "Failed to load authors");
      const incoming = json.results ?? [];
      setAuthors((prev) => (params.append ? [...prev, ...incoming] : incoming));
      setAuthorsHasMore(Boolean(json.pagination?.hasMore));
      setAuthorsOffset(params.offset);
    } catch (err) {
      setAuthorsError(err instanceof Error ? err.message : "Failed to load authors");
    } finally {
      setAuthorsLoading(false);
    }
  }

  function handleCategoryClick(item: DisciplineEvolutionRow) {
    if (
      disciplineIri &&
      (qidFromIri(disciplineIri) === ECONOMICS_QID || qidFromIri(disciplineIri) === SOCIOLOGY_QID) &&
      economicsMode === "authors"
    ) {
      window.open(`https://www.wikidata.org/wiki/${qidFromIri(item.iri)}`, "_blank", "noopener,noreferrer");
      return;
    }
    setSelectedCategoryIri(item.iri);
    setSelectedCategoryLabel(item.label);
    setAuthors([]);
    setAuthorsOffset(0);
    setAuthorsHasMore(false);
    fetchAuthors({ categoryIri: item.iri, offset: 0, append: false });
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-900 text-zinc-100">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-700 px-5 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-white">Discipline Evolution</h1>
          <div className="mt-0.5 text-xs text-zinc-500">
            MVP: schools of thought over time inside an academic discipline.
          </div>
          <div className="mt-1 text-[11px] text-zinc-600">
            Start year uses `P571`/`P580`/`P585` (MVP). End year defaults to start year for now. Links use `P361`/`P279`.
          </div>
        </div>

        <Link
          href="/"
          className="rounded-lg border border-zinc-600 bg-zinc-800/90 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          ← Back
        </Link>
      </header>

      <div className="shrink-0 border-b border-zinc-700 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Discipline</span>
            <div className="w-72">
              <EntitySearch onSelect={(iri) => selectDiscipline(iri)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Direct</span>
            <input
              value={directDiscipline}
              onChange={(e) => setDirectDiscipline(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const qid = parseQorIri(directDiscipline);
                if (!qid) return;
                selectDiscipline(`http://www.wikidata.org/entity/${qid}`);
              }}
              placeholder="Q…"
              className="w-28 rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="button"
              disabled={!directDiscipline.trim()}
              onClick={() => {
                const qid = parseQorIri(directDiscipline);
                if (!qid) return;
                selectDiscipline(`http://www.wikidata.org/entity/${qid}`);
              }}
              className="rounded-md bg-zinc-800/90 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Set
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Link</span>
            <select
              value={linkProperty}
              onChange={(e) => setLinkProperty(e.target.value as "P361" | "P279")}
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {LINK_PROPERTIES.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {disciplineIri &&
            (qidFromIri(disciplineIri) === ECONOMICS_QID || qidFromIri(disciplineIri) === SOCIOLOGY_QID) && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">View</span>
              <div className="inline-flex rounded-lg border border-zinc-600 bg-zinc-800/70 p-1">
                <button
                  type="button"
                  onClick={() => setEconomicsMode("school")}
                  className={`rounded-md px-2.5 py-1 text-xs ${
                    economicsMode === "school"
                      ? "bg-amber-500/20 text-amber-200"
                      : "text-zinc-300 hover:bg-zinc-700/60"
                  }`}
                >
                  School of thought
                </button>
                <button
                  type="button"
                  onClick={() => setEconomicsMode("concept")}
                  className={`rounded-md px-2.5 py-1 text-xs ${
                    economicsMode === "concept"
                      ? "bg-amber-500/20 text-amber-200"
                      : "text-zinc-300 hover:bg-zinc-700/60"
                  }`}
                >
                  Concept
                </button>
                <button
                  type="button"
                  onClick={() => setEconomicsMode("branch")}
                  className={`rounded-md px-2.5 py-1 text-xs ${
                    economicsMode === "branch"
                      ? "bg-amber-500/20 text-amber-200"
                      : "text-zinc-300 hover:bg-zinc-700/60"
                  }`}
                >
                  Branch
                </button>
                <button
                  type="button"
                  onClick={() => setEconomicsMode("authors")}
                  className={`rounded-md px-2.5 py-1 text-xs ${
                    economicsMode === "authors"
                      ? "bg-amber-500/20 text-amber-200"
                      : "text-zinc-300 hover:bg-zinc-700/60"
                  }`}
                >
                  Authors
                </button>
              </div>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={!disciplineIri}
              onClick={clearSelectedDiscipline}
              className="rounded-lg border border-zinc-700 bg-zinc-800/30 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>

        {data && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            {data.warning && (
              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                {data.warning}
              </span>
            )}
            <span>
              Discipline: <span className="text-zinc-300">{data.discipline.label}</span> ({qidFromIri(data.discipline.iri)})
            </span>
            <span>
              Link: <span className="text-zinc-300">{data.linkProperty.label}</span>
            </span>
            <span>
              Selected: <span className="text-zinc-300">{Object.keys(selectedForEpub).length}</span>
            </span>
            <button
              type="button"
              onClick={exportSelectedToEpub}
              disabled={exportingEpub || Object.keys(selectedForEpub).length === 0}
              className="rounded border border-zinc-600 bg-zinc-800/80 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {exportingEpub ? "Building EPUB…" : "Download selected EPUB"}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-5">
        {!disciplineIri ? (
          <div className="flex h-full flex-col">
            <div className="mb-4">
              <div className="text-2xl font-semibold">Pick an academic discipline</div>
              <div className="mt-2 text-sm text-zinc-500">
                Click a card to visualize idea “currents” as schools of thought over time.
              </div>
            </div>

            {disciplineCardsError ? (
              <div className="rounded-lg border border-red-600/50 bg-red-900/20 px-4 py-3 text-sm text-red-200">
                {disciplineCardsError}
              </div>
            ) : disciplineCardsLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="h-7 w-7 animate-spin rounded-full border-4 border-zinc-600 border-t-amber-500" />
              </div>
            ) : disciplineCards.length === 0 ? (
              <div className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/40 px-4 py-6 text-center text-sm text-zinc-500">
                No disciplines found.
              </div>
            ) : (
              <div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {disciplineCards.map((d) => (
                    <button
                      key={d.iri}
                      type="button"
                    onClick={() => selectDiscipline(d.iri)}
                      className="rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-left transition hover:border-amber-500/50 hover:bg-zinc-900/70 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      aria-label={`Select ${d.label}`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{d.label}</div>
                          {d.description ? (
                            <div className="mt-1 line-clamp-3 text-xs text-zinc-500">{d.description}</div>
                          ) : (
                            <div className="mt-1 text-xs text-zinc-600">No short description.</div>
                          )}
                        </div>
                        <div className="shrink-0 font-mono text-[11px] text-zinc-500">
                          {qidFromIri(d.iri)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      fetchDisciplineCards({
                        offset: disciplineCardsOffset + DISCIPLINE_PAGE_SIZE,
                        append: true,
                      })
                    }
                    disabled={disciplineCardsLoading || !canLoadMoreDisciplines}
                    className="rounded-lg border border-zinc-600 bg-zinc-800/90 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {disciplineCardsLoading
                      ? "Loading…"
                      : canLoadMoreDisciplines
                        ? "Load more disciplines"
                        : "All disciplines loaded"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-zinc-600 border-t-amber-500" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-600/50 bg-red-900/20 px-4 py-3 text-sm text-red-200">
            <div className="font-medium">Could not load evolution</div>
            <div className="mt-1 text-xs text-red-300">{error}</div>
          </div>
        ) : data && data.items.length > 0 ? (
          <div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((item) => (
                <button
                  key={item.iri}
                  type="button"
                  onClick={() => handleCategoryClick(item)}
                  className={`rounded-xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    selectedCategoryIri === item.iri
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-zinc-700 bg-zinc-900/40 hover:border-amber-500/50 hover:bg-zinc-900/70"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{item.label}</div>
                      <div className="mt-1 text-xs text-zinc-500 line-clamp-4">
                        {item.wikiSummary?.extract ?? item.description ?? "No paragraph available."}
                      </div>
                    </div>
                    <div className="shrink-0 space-y-2 text-right">
                      <div className="font-mono text-[11px] text-zinc-500">{qidFromIri(item.iri)}</div>
                      <label className="inline-flex items-center gap-1 text-[11px] text-zinc-300">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedForEpub[item.iri])}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleEpubSelection(item);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3.5 w-3.5 rounded border-zinc-500 bg-zinc-800 text-amber-500"
                        />
                        EPUB
                      </label>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setEvolutionLimit((n) => n + EVOLUTION_PAGE_SIZE)}
                disabled={loading || !canLoadMoreEvolution}
                className="rounded-lg border border-zinc-600 bg-zinc-800/90 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading
                  ? "Loading…"
                  : canLoadMoreEvolution
                    ? "Load more results"
                    : "All fetched results loaded"}
              </button>
            </div>

            {selectedCategoryIri &&
              !(
                disciplineIri &&
                (qidFromIri(disciplineIri) === ECONOMICS_QID || qidFromIri(disciplineIri) === SOCIOLOGY_QID) &&
                economicsMode === "authors"
              ) && (
              <div className="mt-8">
                <h3 className="mb-3 text-lg font-semibold text-white">
                  Authors in {selectedCategoryLabel ?? qidFromIri(selectedCategoryIri)}
                </h3>
                {authorsError ? (
                  <div className="rounded-lg border border-red-600/50 bg-red-900/20 px-4 py-3 text-sm text-red-200">
                    {authorsError}
                  </div>
                ) : authorsLoading && authors.length === 0 ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-7 w-7 animate-spin rounded-full border-4 border-zinc-600 border-t-amber-500" />
                  </div>
                ) : authors.length === 0 ? (
                  <div className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-4 py-6 text-sm text-zinc-500">
                    No authors found for this category.
                  </div>
                ) : (
                  <div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {authors.map((author) => (
                        <a
                          key={author.iri}
                          href={`https://www.wikidata.org/wiki/${qidFromIri(author.iri)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-left transition hover:border-amber-500/50 hover:bg-zinc-900/70"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-white">{author.label}</div>
                              <div className="mt-1 text-xs text-zinc-500 line-clamp-4">
                                {author.description ?? "No Wikidata paragraph available."}
                              </div>
                            </div>
                            <div className="shrink-0 font-mono text-[11px] text-zinc-500">{qidFromIri(author.iri)}</div>
                          </div>
                        </a>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={() =>
                          fetchAuthors({
                            categoryIri: selectedCategoryIri,
                            offset: authorsOffset + AUTHOR_PAGE_SIZE,
                            append: true,
                          })
                        }
                        disabled={authorsLoading || !authorsHasMore}
                        className="rounded-lg border border-zinc-600 bg-zinc-800/90 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {authorsLoading ? "Loading…" : authorsHasMore ? "Load more authors" : "All authors loaded"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-4 py-6 text-center text-sm text-zinc-500">
            No schools of thought found for this configuration.
          </div>
        )}
      </div>
    </div>
  );
}

