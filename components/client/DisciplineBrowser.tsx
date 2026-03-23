"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { EntitySearch } from "./EntitySearch";
import { resolvePredicateLabel } from "@/lib/wikidata-predicates";
import type {
  NeighborhoodNode,
  RelationNeighborhoodResponse,
} from "@/app/api/wikidata/relation-neighborhood/route";

function wikidataIdFromIri(iri: string): string {
  return iri.split(/[/#]/).pop() ?? iri;
}

function parseFocusInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^Q\d+$/i.test(trimmed)) return `http://www.wikidata.org/entity/${trimmed.toUpperCase()}`;
  const normalized = trimmed.replace(/[<>]/g, "");
  if (/^https?:\/\/www\.wikidata\.org\/entity\/Q\d+$/i.test(normalized)) return normalized;
  return null;
}

const RELATION_CODES = ["P279", "P31", "P361"] as const;

export function DisciplineBrowser() {
  const relationOptions = useMemo(
    () =>
      RELATION_CODES.map((code) => ({
        code,
        label: resolvePredicateLabel(`http://www.wikidata.org/prop/direct/${code}`),
      })),
    []
  );

  const [focusIri, setFocusIri] = useState<string | null>(null);
  const [directInput, setDirectInput] = useState("");
  const [relationCode, setRelationCode] = useState<(typeof RELATION_CODES)[number]>("P279");

  const [data, setData] = useState<RelationNeighborhoodResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!focusIri) return;

    let alive = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/wikidata/relation-neighborhood?iri=${encodeURIComponent(
          focusIri
        )}&relation=${encodeURIComponent(relationCode)}`;
        const res = await fetch(url, { signal: controller.signal });
        const json = (await res.json()) as { error?: string; data?: RelationNeighborhoodResponse } & Partial<RelationNeighborhoodResponse>;
        if (!res.ok) throw new Error((json as any).error ?? "Failed to load neighborhood");
        if (!alive) return;
        setData(json as RelationNeighborhoodResponse);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Neighborhood load error");
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
  }, [focusIri, relationCode]);

  const relationLabel = data?.relation.label ?? relationOptions.find((o) => o.code === relationCode)?.label ?? relationCode;

  function Column({
    title,
    nodes,
  }: {
    title: string;
    nodes: NeighborhoodNode[];
  }) {
    return (
      <section className="flex w-64 shrink-0 flex-col rounded-xl border border-zinc-700 bg-zinc-900/40">
        <header className="flex items-center justify-between gap-2 border-b border-zinc-700 px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {title}
            </div>
            <div className="truncate text-[10px] text-zinc-600">via {relationLabel}</div>
          </div>
          <span className="shrink-0 rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
            {nodes.length}
          </span>
        </header>
        <div className="flex-1 overflow-y-auto p-2">
          {nodes.length === 0 ? (
            <p className="px-1 py-3 text-center text-xs text-zinc-600">
              No results
            </p>
          ) : (
            <div className="space-y-2">
              {nodes.map((n) => (
                <NodeButton key={n.iri} node={n} selected={n.iri === focusIri} onClick={() => setFocusIri(n.iri)} />
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  function NodeButton({
    node,
    selected,
    onClick,
  }: {
    node: NeighborhoodNode;
    selected: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full rounded-lg border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-amber-500 ${
          selected
            ? "border-amber-500 bg-amber-500/10"
            : "border-zinc-700 bg-zinc-800/30 hover:border-zinc-600 hover:bg-zinc-800/50"
        }`}
        aria-label={`Navigate to ${node.label}`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-white">{node.label}</span>
          <span className="shrink-0 font-mono text-[10px] text-zinc-500">{wikidataIdFromIri(node.iri)}</span>
        </div>
      </button>
    );
  }

  const up2 = data?.up.depth2 ?? [];
  const up1 = data?.up.depth1 ?? [];
  const down1 = data?.down.depth1 ?? [];
  const down2 = data?.down.depth2 ?? [];

  return (
    <div className="flex h-screen flex-col bg-zinc-900 text-zinc-100">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-700 px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-base font-semibold text-white">Concept Graph Browser</h1>
            <span className="rounded-full border border-sky-700/50 bg-sky-900/30 px-2.5 py-0.5 text-xs text-sky-400">
              Wikidata · live
            </span>
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">
            2-hop neighborhood (Up/Down) for a selected relation.
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
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Focus</span>
            <div className="w-72">
              <EntitySearch onSelect={(iri) => setFocusIri(iri)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Direct</span>
            <input
              value={directInput}
              onChange={(e) => setDirectInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const parsed = parseFocusInput(directInput);
                if (parsed) setFocusIri(parsed);
              }}
              placeholder="Q11764"
              className="w-28 rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="button"
              onClick={() => {
                const parsed = parseFocusInput(directInput);
                if (parsed) setFocusIri(parsed);
              }}
              className="rounded-md bg-zinc-800/90 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!directInput.trim()}
            >
              Set
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Relation</span>
            <select
              value={relationCode}
              onChange={(e) => setRelationCode(e.target.value as any)}
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {relationOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.code} · {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={!focusIri}
              onClick={() => {
                setFocusIri(null);
                setData(null);
                setDirectInput("");
                setError(null);
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-800/30 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>

        {data?.focus.description && (
          <div className="mt-2 text-xs text-zinc-500">
            {data.focus.description}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex w-full flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="flex w-full flex-1 gap-3 overflow-auto p-4">
              {/* Up(2) */}
              <Column title="Up (2)" nodes={up2} />
              {/* Up(1) */}
              <Column title="Up (1)" nodes={up1} />

              {/* Focus */}
              <section className="flex w-64 shrink-0 flex-col rounded-xl border border-zinc-700 bg-zinc-900/40">
                <header className="border-b border-zinc-700 px-3 py-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Focus
                  </div>
                  <div className="text-[10px] text-zinc-600">{data?.relation.label ?? relationLabel}</div>
                </header>
                <div className="flex-1 overflow-y-auto p-3">
                  {!focusIri ? (
                    <div className="mt-6 text-center">
                      <p className="text-sm font-medium text-zinc-300">Select a concept</p>
                      <p className="mt-1 text-xs text-zinc-600">
                        Use search to pick “Sociology” and explore its 2-hop links.
                      </p>
                    </div>
                  ) : loading ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="h-7 w-7 animate-spin rounded-full border-4 border-zinc-600 border-t-amber-500" />
                    </div>
                  ) : error ? (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-red-300">Could not load neighborhood</p>
                      <p className="mt-1 text-[11px] text-red-400">{error}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 px-3 py-2">
                        <div className="truncate text-sm font-semibold text-white">
                          {data?.focus.label ?? wikidataIdFromIri(focusIri)}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-zinc-500">
                          {wikidataIdFromIri(focusIri)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Down(1) */}
              <Column title="Down (1)" nodes={down1} />
              {/* Down(2) */}
              <Column title="Down (2)" nodes={down2} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

