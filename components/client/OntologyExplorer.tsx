"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { OntologyData } from "@/lib/ontology";

type OntologyClass = OntologyData["classes"][number];
type OntologyProperty = OntologyData["properties"][number];

type ClassTreeNode = {
  cls: OntologyClass;
  children: ClassTreeNode[];
};

type OntologyExplorerProps = {
  open: boolean;
  onClose: () => void;
  /** Ontology data from the server (fetched in a Server Component). */
  data: OntologyData | null;
  /** When set (e.g. on /ontology page), show a link instead of a close button. */
  closeHref?: string;
};

function localName(iri: string): string {
  if (iri.startsWith("http://example.org/ontology/"))
    return iri.slice("http://example.org/ontology/".length);
  if (iri.startsWith("http://www.w3.org/2001/XMLSchema#"))
    return "xsd:" + iri.slice("http://www.w3.org/2001/XMLSchema#".length);
  return iri;
}

function buildClassTree(classes: OntologyClass[]): ClassTreeNode[] {
  const byIri = new Map(classes.map((c) => [c.fullIri, c]));
  const roots: ClassTreeNode[] = [];
  const nodeByIri = new Map<string, ClassTreeNode>();

  classes.forEach((cls) => {
    nodeByIri.set(cls.fullIri, { cls, children: [] });
  });

  classes.forEach((cls) => {
    const node = nodeByIri.get(cls.fullIri)!;
    if (cls.subClassOf == null || !byIri.has(cls.subClassOf)) {
      roots.push(node);
    } else {
      const parent = nodeByIri.get(cls.subClassOf);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  });

  return roots;
}

function treeToColumns(roots: ClassTreeNode[]): ClassTreeNode[][] {
  const columns: ClassTreeNode[][] = [];
  let current = roots;
  while (current.length > 0) {
    columns.push(current);
    current = current.flatMap((n) => n.children);
  }
  return columns;
}

function propertiesForClass(
  clsIri: string,
  classes: OntologyClass[],
  properties: OntologyProperty[]
): OntologyProperty[] {
  const ancestors = new Set<string>();
  let current: string | null = clsIri;
  const byIri = new Map(classes.map((c) => [c.fullIri, c]));
  while (current) {
    ancestors.add(current);
    const c = byIri.get(current);
    current = c?.subClassOf ?? null;
  }
  return properties.filter(
    (p) => p.domain != null && ancestors.has(p.domain)
  );
}

export function OntologyExplorer({ open, onClose, data, closeHref }: OntologyExplorerProps) {
  const [selectedClass, setSelectedClass] = useState<OntologyClass | null>(null);

  useEffect(() => {
    if (!open) setSelectedClass(null);
  }, [open]);

  const columns = data
    ? treeToColumns(buildClassTree(data.classes))
    : [];
  const selectedProperties = data && selectedClass
    ? propertiesForClass(selectedClass.fullIri, data.classes, data.properties)
    : [];

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col bg-zinc-900"
      role="dialog"
      aria-labelledby="ontology-explorer-title"
      aria-modal="true"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-700 px-5 py-4">
        <h1
          id="ontology-explorer-title"
          className="text-lg font-semibold text-white"
        >
          Ontology
        </h1>
        {closeHref ? (
          <Link
            href={closeHref}
            className="rounded-lg border border-zinc-600 bg-zinc-800/90 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            ← Back to Cartopedia
          </Link>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            aria-label="Close"
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
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        {!data ? (
          <div className="flex flex-1 items-center justify-center text-zinc-400">
            No ontology data available.
          </div>
        ) : (
          <>
            <div className="flex shrink-0 gap-px overflow-x-auto border-r border-zinc-700 bg-zinc-800/50 p-3">
              {columns.map((level, colIndex) => (
                <div
                  key={colIndex}
                  className="flex w-44 flex-col gap-1"
                  style={{ minWidth: "11rem" }}
                >
                  <div className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {colIndex === 0 ? "Root" : `Level ${colIndex + 1}`}
                  </div>
                  {level.map((node) => (
                    <button
                      key={node.cls.fullIri}
                      type="button"
                      onClick={() => setSelectedClass(node.cls)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                        selectedClass?.fullIri === node.cls.fullIri
                          ? "border-amber-500 bg-amber-500/20 text-amber-200"
                          : "border-zinc-600 bg-zinc-800 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-700"
                      }`}
                    >
                      <span className="font-medium">{node.cls.label}</span>
                      {node.cls.comment && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">
                          {node.cls.comment}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {selectedClass ? (
                <div className="space-y-6">
                  <section>
                    <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
                      Class
                    </h2>
                    <div className="mt-2 rounded-lg border border-zinc-600 bg-zinc-800/50 px-4 py-3">
                      <div className="font-semibold text-white">
                        {selectedClass.label}
                      </div>
                      <div className="mt-1 font-mono text-xs text-zinc-400">
                        {selectedClass.id}
                      </div>
                      {selectedClass.comment && (
                        <p className="mt-2 text-sm text-zinc-300">
                          {selectedClass.comment}
                        </p>
                      )}
                      {selectedClass.subClassOf && (
                        <p className="mt-2 text-xs text-zinc-500">
                          Subclass of: {localName(selectedClass.subClassOf)}
                        </p>
                      )}
                    </div>
                  </section>
                  <section>
                    <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
                      Properties ({selectedProperties.length})
                    </h2>
                    <div className="mt-2 space-y-3">
                      {selectedProperties.length === 0 ? (
                        <p className="text-sm text-zinc-500">
                          No properties defined for this class (or inherited).
                        </p>
                      ) : (
                        selectedProperties.map((prop) => (
                          <div
                            key={prop.fullIri}
                            className="rounded-lg border border-zinc-600 bg-zinc-800/50 px-4 py-3"
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-medium text-amber-200">
                                {prop.label}
                              </span>
                              <span className="font-mono text-xs text-zinc-500">
                                {prop.id}
                              </span>
                            </div>
                            <dl className="mt-2 grid gap-1 text-sm">
                              {prop.domain != null && (
                                <>
                                  <dt className="text-zinc-500">Domain</dt>
                                  <dd className="text-zinc-300">
                                    {localName(prop.domain)}
                                  </dd>
                                </>
                              )}
                              {prop.range != null && (
                                <>
                                  <dt className="text-zinc-500">Range</dt>
                                  <dd className="text-zinc-300 font-mono">
                                    {localName(prop.range)}
                                  </dd>
                                </>
                              )}
                            </dl>
                            {prop.comment && (
                              <p className="mt-2 text-sm text-zinc-400">
                                {prop.comment}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-500">
                  Click a class to see its properties
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
