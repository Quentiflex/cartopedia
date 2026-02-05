"use client";

type EntityProperty = {
  property: string;
  value: string;
  valueIri?: string;
  isLiteral: boolean;
};

type IncomingRelation = {
  property: string;
  subject: string;
  subjectIri: string;
};

type EntityInstance = {
  iri: string;
  label: string;
  properties: EntityProperty[];
  incomingRelations?: IncomingRelation[];
};

type EntityDetailPanelProps = {
  entity: EntityInstance;
  onClose: () => void;
  onNavigate?: (iri: string) => void;
  onBack?: () => void;
  canGoBack?: boolean;
};

function formatValue(value: string, isLiteral: boolean): string {
  if (!isLiteral) return value;
  
  // Try to format dates
  if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      const d = new Date(value);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return value;
    }
  }
  
  return value;
}

function groupPropertiesByName(properties: EntityProperty[]): Map<string, EntityProperty[]> {
  const grouped = new Map<string, EntityProperty[]>();
  
  for (const prop of properties) {
    const existing = grouped.get(prop.property) || [];
    existing.push(prop);
    grouped.set(prop.property, existing);
  }
  
  return grouped;
}

function groupIncomingRelations(relations: IncomingRelation[]): Map<string, IncomingRelation[]> {
  const grouped = new Map<string, IncomingRelation[]>();
  
  for (const rel of relations) {
    const existing = grouped.get(rel.property) || [];
    existing.push(rel);
    grouped.set(rel.property, existing);
  }
  
  return grouped;
}

export function EntityDetailPanel({
  entity,
  onClose,
  onNavigate,
  onBack,
  canGoBack = false,
}: EntityDetailPanelProps) {
  const groupedProperties = groupPropertiesByName(entity.properties);
  const groupedIncoming = entity.incomingRelations 
    ? groupIncomingRelations(entity.incomingRelations)
    : new Map();

  return (
    <div
      className="absolute right-0 top-0 z-30 flex h-full w-80 min-w-[280px] max-w-[90vw] flex-col border-l border-zinc-700 bg-zinc-900/95 shadow-xl backdrop-blur sm:w-96"
      role="dialog"
      aria-labelledby="entity-panel-title"
      aria-modal="true"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-700 px-5 py-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {canGoBack && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="shrink-0 rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              aria-label="Go back"
              title="Go back"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}
          <h2
            id="entity-panel-title"
            className="text-lg font-semibold text-white truncate"
          >
            {entity.label}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          aria-label="Close panel"
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
      </div>
      
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {entity.properties.length === 0 ? (
          <p className="text-sm text-zinc-500">No properties available.</p>
        ) : (
          <dl className="space-y-4">
            {Array.from(groupedProperties.entries()).map(([propName, props]) => (
              <div key={propName}>
                <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {propName}
                </dt>
                <dd className="mt-2 space-y-2">
                  {props.length === 1 ? (
                    props[0].isLiteral ? (
                      <div className="text-sm text-zinc-300">
                        {formatValue(props[0].value, props[0].isLiteral)}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => props[0].valueIri && onNavigate?.(props[0].valueIri)}
                        className="text-sm text-amber-200 hover:text-amber-100 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-500 rounded"
                        disabled={!props[0].valueIri || !onNavigate}
                      >
                        {formatValue(props[0].value, props[0].isLiteral)}
                      </button>
                    )
                  ) : (
                    props.map((prop, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-zinc-600 bg-zinc-800/50 px-3 py-2"
                      >
                        {prop.isLiteral ? (
                          <div className="text-sm text-zinc-300">
                            {formatValue(prop.value, prop.isLiteral)}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => prop.valueIri && onNavigate?.(prop.valueIri)}
                            className="text-sm text-amber-200 hover:text-amber-100 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-500 rounded text-left w-full"
                            disabled={!prop.valueIri || !onNavigate}
                          >
                            {formatValue(prop.value, prop.isLiteral)}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
        
        {/* Incoming relationships (reverse properties) */}
        {groupedIncoming.size > 0 && (
          <>
            <div className="mt-6 border-t border-zinc-700 pt-4">
              <h3 className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-3">
                Referenced By
              </h3>
              <dl className="space-y-4">
                {Array.from(groupedIncoming.entries()).map(([propName, relations]) => (
                  <div key={propName}>
                    <dt className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                      {propName}
                    </dt>
                    <dd className="mt-2 space-y-2">
                      {relations.map((rel, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => onNavigate?.(rel.subjectIri)}
                          className="block w-full rounded-lg border border-zinc-600 bg-zinc-800/50 px-3 py-2 text-left text-sm text-amber-200 transition hover:border-amber-500/50 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          {rel.subject}
                        </button>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </>
        )}
        
        <div className="mt-6 border-t border-zinc-700 pt-4">
          <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            IRI
          </dt>
          <dd className="mt-1 break-all font-mono text-xs text-zinc-500">
            {entity.iri}
          </dd>
        </div>
      </div>
    </div>
  );
}
