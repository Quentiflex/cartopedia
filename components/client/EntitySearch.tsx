"use client";

import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "@/app/api/wikidata/search/route";

type Props = {
  onSelect: (iri: string) => void;
};

export function EntitySearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function search() {
    const trimmed = query.trim();
    if (trimmed.length < 2 || loading) return;
    setLoading(true);
    setOpen(false);
    try {
      const r = await fetch(`/api/wikidata/search?q=${encodeURIComponent(trimmed)}`);
      const data = await r.json() as { results?: SearchResult[]; error?: string };
      setResults(data.results ?? []);
      setOpen(true);
      setActiveIndex(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && results.length > 0) {
        const target = activeIndex >= 0 ? results[activeIndex] : results[0];
        if (target) { select(target); return; }
      }
      search();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  function select(r: SearchResult) {
    setQuery("");
    setResults([]);
    setOpen(false);
    onSelect(r.iri);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1 rounded-lg border border-zinc-600 bg-zinc-800/90 pl-3 pr-1 py-1.5">
        <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search entities…"
          className="w-40 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
        />
        {/* Clear button */}
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            className="shrink-0 rounded p-0.5 text-zinc-500 hover:text-zinc-300"
            aria-label="Clear"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {/* Search button */}
        <button
          type="button"
          onClick={search}
          disabled={query.trim().length < 2 || loading}
          className="shrink-0 rounded-md bg-zinc-700 px-2 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            "Go"
          )}
        </button>
      </div>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <ul className="absolute left-0 top-full z-50 mt-1 max-h-72 w-72 overflow-y-auto rounded-xl border border-zinc-600 bg-zinc-900/98 py-1 shadow-2xl backdrop-blur">
          {results.map((r, i) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => select(r)}
                className={`w-full px-3 py-2 text-left transition ${
                  i === activeIndex
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-200 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{r.label}</span>
                  <span className="text-[10px] text-zinc-500">{r.id}</span>
                </div>
                {r.description && (
                  <div className="mt-0.5 truncate text-xs text-zinc-500">{r.description}</div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* No results message */}
      {open && results.length === 0 && !loading && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-zinc-600 bg-zinc-900/98 px-3 py-3 text-sm text-zinc-400 shadow-2xl backdrop-blur">
          No results for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
