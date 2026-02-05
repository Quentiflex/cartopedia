"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { OntologyData } from "@/lib/ontology";
import { useOntologyTree } from "@/lib/hooks/useOntologyTree";
import { localName } from "@/lib/utils/ontology-utils";
import { EntityDetailPanel } from "./EntityDetailPanel";

type EntityInstance = {
  iri: string;
  label: string;
  properties: Array<{ property: string; value: string; valueIri?: string; isLiteral: boolean }>;
  incomingRelations?: Array<{ property: string; subject: string; subjectIri: string }>;
};

type InstancesResponse = {
  instances: EntityInstance[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type Participant = {
  iri: string;
  label: string;
};

type OntologyExplorerProps = {
  open: boolean;
  onClose: () => void;
  /** Ontology data from the server (fetched in a Server Component). */
  data: OntologyData | null;
  /** When set (e.g. on /ontology page), show a link instead of a close button. */
  closeHref?: string;
};

export function OntologyExplorer({ open, onClose, data, closeHref }: OntologyExplorerProps) {
  const { columns, selectedClass, selectedProperties, setSelectedClass, resetSelection } = 
    useOntologyTree(data);
  
  const [instances, setInstances] = useState<EntityInstance[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<InstancesResponse["pagination"] | null>(null);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [instancesError, setInstancesError] = useState<string | null>(null);
  
  // Filter state
  const [startYear, setStartYear] = useState<string>("");
  const [endYear, setEndYear] = useState<string>("");
  const [selectedParticipant, setSelectedParticipant] = useState<string>("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  
  // Selected entity for detail panel with navigation history
  const [selectedEntity, setSelectedEntity] = useState<EntityInstance | null>(null);
  const [entityHistory, setEntityHistory] = useState<EntityInstance[]>([]);
  const [loadingEntity, setLoadingEntity] = useState(false);

  // Reset selection when dialog closes
  useEffect(() => {
    if (!open) resetSelection();
  }, [open, resetSelection]);

  // Fetch participants list on mount
  useEffect(() => {
    const fetchParticipants = async () => {
      setLoadingParticipants(true);
      try {
        const response = await fetch("/api/ontology/participants");
        if (response.ok) {
          const data: Participant[] = await response.json();
          setParticipants(data);
        }
      } catch (err) {
        console.error("Failed to load participants:", err);
      } finally {
        setLoadingParticipants(false);
      }
    };

    if (open) {
      fetchParticipants();
    }
  }, [open]);

  // Fetch instances when a class is selected or filters change
  useEffect(() => {
    if (!selectedClass) {
      setInstances([]);
      setPagination(null);
      return;
    }

    const fetchInstances = async () => {
      setLoadingInstances(true);
      setInstancesError(null);
      try {
        const params = new URLSearchParams({
          classIri: selectedClass.fullIri,
          page: String(currentPage),
          limit: "12",
        });

        if (startYear) params.append("startYear", startYear);
        if (endYear) params.append("endYear", endYear);
        if (selectedParticipant) params.append("participant", selectedParticipant);

        const response = await fetch(`/api/ontology/instances?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch instances: ${response.statusText}`);
        }

        const data: InstancesResponse = await response.json();
        setInstances(data.instances);
        setPagination(data.pagination);
      } catch (err) {
        setInstancesError(err instanceof Error ? err.message : "Failed to load instances");
        setInstances([]);
        setPagination(null);
      } finally {
        setLoadingInstances(false);
      }
    };

    fetchInstances();
  }, [selectedClass, currentPage, startYear, endYear, selectedParticipant]);

  // Reset page and filters when class changes
  useEffect(() => {
    setCurrentPage(1);
    setStartYear("");
    setEndYear("");
    setSelectedParticipant("");
  }, [selectedClass]);

  const resetFilters = () => {
    setStartYear("");
    setEndYear("");
    setSelectedParticipant("");
    setCurrentPage(1);
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
                  
                  <section>
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
                        Instances {pagination && `(${pagination.total})`}
                      </h2>
                    </div>
                    
                    {/* Filters */}
                    <div className="mt-3 rounded-lg border border-zinc-600 bg-zinc-800/30 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-medium text-zinc-400">Filters</h3>
                        {(startYear || endYear || selectedParticipant) && (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="text-xs text-amber-400 hover:text-amber-300 transition"
                          >
                            Reset filters
                          </button>
                        )}
                      </div>
                      
                      <div className="grid gap-3 sm:grid-cols-3">
                        {/* Start Year */}
                        <div>
                          <label htmlFor="startYear" className="block text-xs text-zinc-500 mb-1">
                            Start Year
                          </label>
                          <input
                            id="startYear"
                            type="number"
                            placeholder="e.g. 1800"
                            value={startYear}
                            onChange={(e) => {
                              setStartYear(e.target.value);
                              setCurrentPage(1);
                            }}
                            className="w-full rounded border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        
                        {/* End Year */}
                        <div>
                          <label htmlFor="endYear" className="block text-xs text-zinc-500 mb-1">
                            End Year
                          </label>
                          <input
                            id="endYear"
                            type="number"
                            placeholder="e.g. 1900"
                            value={endYear}
                            onChange={(e) => {
                              setEndYear(e.target.value);
                              setCurrentPage(1);
                            }}
                            className="w-full rounded border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        
                        {/* Participant */}
                        <div>
                          <label htmlFor="participant" className="block text-xs text-zinc-500 mb-1">
                            Participant
                          </label>
                          <select
                            id="participant"
                            value={selectedParticipant}
                            onChange={(e) => {
                              setSelectedParticipant(e.target.value);
                              setCurrentPage(1);
                            }}
                            disabled={loadingParticipants}
                            className="w-full rounded border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                          >
                            <option value="">All participants</option>
                            {participants.map((p) => (
                              <option key={p.iri} value={p.iri}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    
                    {loadingInstances ? (
                      <div className="mt-4 flex items-center justify-center py-8">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-600 border-t-amber-500" />
                      </div>
                    ) : instancesError ? (
                      <div className="mt-2 rounded-lg border border-red-600 bg-red-900/20 px-4 py-3 text-sm text-red-300">
                        {instancesError}
                      </div>
                    ) : instances.length === 0 ? (
                      <p className="mt-2 text-sm text-zinc-500">
                        No instances found for this class.
                      </p>
                    ) : (
                      <>
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {instances.map((instance) => (
                            <button
                              key={instance.iri}
                              type="button"
                              onClick={() => setSelectedEntity(instance)}
                              className="rounded-lg border border-zinc-600 bg-zinc-800/50 px-4 py-3 text-left transition hover:border-amber-500/50 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                              <div className="mb-2 font-semibold text-white">
                                {instance.label}
                              </div>
                              <div className="space-y-1">
                                {instance.properties.slice(0, 5).map((prop, idx) => (
                                  <div key={idx} className="text-xs">
                                    <span className="text-zinc-500">{prop.property}:</span>{" "}
                                    <span className={prop.isLiteral ? "text-zinc-300" : "text-amber-200"}>
                                      {prop.value.length > 40
                                        ? `${prop.value.substring(0, 40)}...`
                                        : prop.value}
                                    </span>
                                  </div>
                                ))}
                                {instance.properties.length > 5 && (
                                  <div className="pt-1 text-xs text-zinc-500">
                                    +{instance.properties.length - 5} more properties
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                        
                        {pagination && pagination.totalPages > 1 && (
                          <div className="mt-4 flex items-center justify-between border-t border-zinc-700 pt-4">
                            <div className="text-sm text-zinc-400">
                              Page {pagination.page} of {pagination.totalPages}
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-zinc-800"
                              >
                                Previous
                              </button>
                              <button
                                type="button"
                                onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                                disabled={currentPage === pagination.totalPages}
                                className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-zinc-800"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-500">
                  Click a class to see its properties and instances
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
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
    </div>
  );
}
