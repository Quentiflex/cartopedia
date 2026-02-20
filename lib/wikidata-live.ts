/**
 * Client for the public Wikidata Query Service SPARQL endpoint.
 * https://query.wikidata.org/sparql
 *
 * Usage limits (personal / light use):
 *   • No authentication required.
 *   • 60-second query timeout.
 *   • ~5 concurrent requests per IP.
 *   • No hard per-minute cap — include a User-Agent and be reasonable.
 *
 * Queries here intentionally mirror the local-Fuseki ones but without any
 * GRAPH clause, since Wikidata's public endpoint uses the default graph.
 */

import { fetchWikiSummary, type WikiSummary } from "./wikipedia";

const LIVE_ENDPOINT = "https://query.wikidata.org/sparql";

// Identifies this app to Wikidata's infrastructure — good practice.
const USER_AGENT = "Cartopedia/1.0 (personal history explorer; https://github.com/cartopedia)";

export type LiveBinding = Record<
  string,
  { type: string; value: string; "xml:lang"?: string; datatype?: string } | undefined
>;

export async function runLiveSparql(query: string, timeoutMs = 15_000): Promise<LiveBinding[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(LIVE_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/sparql-query",
        Accept: "application/sparql-results+json",
        "User-Agent": USER_AGENT,
      },
      body: query,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Wikidata SPARQL ${res.status} ${res.statusText}: ${text.slice(0, 200)}`
      );
    }

    const data = await res.json() as { results: { bindings: LiveBinding[] } };
    return data.results?.bindings ?? [];
  } finally {
    clearTimeout(timer);
  }
}

export function liveVal(b: LiveBinding, key: string): string | undefined {
  return b[key]?.value;
}

/** Search Wikidata for entities matching a text string (English labels). */
export async function searchLive(
  q: string,
  limit = 20
): Promise<Array<{ iri: string; label: string; description?: string }>> {
  const safeQ = q.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const rows = await runLiveSparql(`
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
SELECT DISTINCT ?entity ?label ?description WHERE {
  ?entity rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${safeQ}")))
  OPTIONAL { ?entity schema:description ?description . FILTER(LANG(?description) = "en") }
}
ORDER BY ASC(STRLEN(STR(?label))) ?label
LIMIT ${Math.min(limit, 50)}`.trim());

  return rows
    .map((b) => ({ iri: liveVal(b, "entity"), label: liveVal(b, "label"), description: liveVal(b, "description") }))
    .filter((r) => r.iri != null && r.label != null) as Array<{ iri: string; label: string; description?: string }>;
}

/** Fetch paginated members of a Wikidata type (P31) from the live endpoint.
 *  • Sorted by sitelink count descending (most notable entities first).
 *  • English label preferred; falls back to any available language label.
 */
export async function fetchLiveTypeMembers(
  typeIri: string,
  page = 1,
  limit = 20
): Promise<{
  members: Array<{ iri: string; label: string; description?: string }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const safeTypeIri = typeIri.replace(/[<>]/g, "");
  const offset = (page - 1) * limit;

  const [countRows, memberRows] = await Promise.all([
    // COUNT via a capped sub-select (avoids full-table scan on huge types)
    runLiveSparql(`
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
SELECT (COUNT(?entity) AS ?total) WHERE {
  SELECT DISTINCT ?entity WHERE { ?entity wdt:P31 <${safeTypeIri}> } LIMIT 10000
}`.trim()),

    // Members: GROUP BY entity so each entity appears once.
    // COALESCE(SAMPLE(?enLabel), SAMPLE(?anyLabel)) gives English when available,
    // any other language otherwise — no blank Q-codes.
    // Ordered by sitelink count DESC so the most notable entities appear first.
    runLiveSparql(`
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
PREFIX wikibase: <http://wikiba.se/ontology#>
SELECT ?entity
  (SAMPLE(?sl) AS ?sitelinks)
  (COALESCE(SAMPLE(?enLabel), SAMPLE(?anyLabel)) AS ?label)
  (SAMPLE(?desc) AS ?description)
WHERE {
  ?entity wdt:P31 <${safeTypeIri}> .
  OPTIONAL { ?entity wikibase:sitelinks ?sl }
  OPTIONAL { ?entity rdfs:label ?enLabel   . FILTER(LANG(?enLabel)   = "en") }
  OPTIONAL { ?entity rdfs:label ?anyLabel  . FILTER(LANG(?anyLabel)  != "")  }
  OPTIONAL { ?entity schema:description ?desc . FILTER(LANG(?desc) = "en") }
}
GROUP BY ?entity
ORDER BY DESC(?sitelinks)
LIMIT ${limit} OFFSET ${offset}`.trim()),
  ]);

  const total = parseInt(liveVal(countRows[0] ?? {}, "total") ?? "0", 10);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const members = memberRows
    .map((b) => ({
      iri: liveVal(b, "entity"),
      label: liveVal(b, "label") ?? liveVal(b, "entity")?.split(/[/#]/).pop(),
      description: liveVal(b, "description"),
    }))
    .filter((m) => m.iri != null && m.label != null) as Array<{
      iri: string;
      label: string;
      description?: string;
    }>;

  return { members, pagination: { page, limit, total, totalPages } };
}

// Namespace for truthy direct Wikidata properties — the only ones we display.
const WDT_PREFIX = "http://www.wikidata.org/prop/direct/";

/**
 * Batch-fetch the best available label (English preferred, any language
 * as fallback) for a list of entity IRIs.
 * Uses SAMPLE so we get exactly one label per entity.
 */
async function fetchFallbackLabels(
  iris: string[],
  sparqlFn: (q: string) => Promise<LiveBinding[]>
): Promise<Map<string, string>> {
  if (iris.length === 0) return new Map();
  const values = iris.map((i) => `<${i}>`).join(" ");
  const rows = await sparqlFn(`
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?entity (SAMPLE(?lbl) AS ?label) WHERE {
  VALUES ?entity { ${values} }
  ?entity rdfs:label ?lbl .
  FILTER(LANG(?lbl) != "")
}
GROUP BY ?entity`.trim());

  const map = new Map<string, string>();
  for (const b of rows) {
    const e = liveVal(b, "entity");
    const l = liveVal(b, "label");
    if (e && l) map.set(e, l);
  }
  return map;
}

/**
 * Best label for an entity: English first, then any language, then the local
 * name (Q-code / P-code), then the full IRI.
 * ORDER BY puts English rows first so LIMIT 1 picks them.
 */
async function fetchBestLabel(
  iri: string,
  sparqlFn: (q: string) => Promise<LiveBinding[]>
): Promise<string> {
  const rows = await sparqlFn(`
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?label WHERE {
  <${iri}> rdfs:label ?label .
  FILTER(LANG(?label) != "")
}
ORDER BY IF(LANG(?label) = "en", 0, 1) ?label
LIMIT 1`.trim());
  return liveVal(rows[0] ?? {}, "label") ?? iri.split(/[/#]/).pop() ?? iri;
}

/**
 * Fetch full entity details from the live Wikidata endpoint.
 * • Only truthy direct properties (wdt:P…) are shown — no rank/statement noise.
 * • English labels preferred everywhere; any-language used as fallback.
 * • Same response shape as the local entity API.
 */
export async function fetchLiveEntity(iri: string): Promise<{
  label: string;
  description?: string;
  wikiSummary?: WikiSummary | null;
  properties: Array<{
    property: string;
    propertyIri: string;
    value: string;
    valueIri?: string;
    isLiteral: boolean;
  }>;
  incomingRelations: Array<{ property: string; subject: string; subjectIri: string }>;
} | null> {
  const safeIri = iri.replace(/[<>]/g, "");

  // ── Entity label (English preferred, any-language fallback) ──────────────
  const metaQuery = `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
SELECT ?label ?description WHERE {
  OPTIONAL {
    <${safeIri}> rdfs:label ?label .
    FILTER(LANG(?label) != "")
  }
  OPTIONAL { <${safeIri}> schema:description ?description . FILTER(LANG(?description) = "en") }
}
ORDER BY IF(LANG(?label) = "en", 0, 1) ?label
LIMIT 1`.trim();

  // ── Curated outgoing properties ───────────────────────────────────────────
  // Instead of scanning all predicates and joining the property schema (very slow
  // for large entities like countries), we whitelist a fixed set of historically
  // and geographically meaningful predicates. The VALUES clause lets the engine
  // do O(1) indexed lookups per predicate — sub-second for any entity.
  const outgoingQuery = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?pred ?predLabel ?value ?valueLabel WHERE {
  VALUES ?pred {
    wdt:P31   wdt:P279  wdt:P571  wdt:P576  wdt:P580  wdt:P582  wdt:P585
    wdt:P569  wdt:P570  wdt:P17   wdt:P131  wdt:P30   wdt:P36   wdt:P47
    wdt:P155  wdt:P156  wdt:P361  wdt:P710  wdt:P1344 wdt:P27   wdt:P19
    wdt:P20   wdt:P106  wdt:P39   wdt:P37   wdt:P1082 wdt:P122  wdt:P6
    wdt:P159  wdt:P495  wdt:P112  wdt:P169  wdt:P749  wdt:P355
  }
  <${safeIri}> ?pred ?value .
  FILTER(!isLiteral(?value) || LANG(?value) = "en" || LANG(?value) = "")
  BIND(IRI(CONCAT("http://www.wikidata.org/entity/", STRAFTER(STR(?pred), "${WDT_PREFIX}"))) AS ?predEntity)
  OPTIONAL { ?predEntity rdfs:label ?predLabel . FILTER(LANG(?predLabel) = "en") }
  OPTIONAL {
    FILTER(isIRI(?value))
    ?value rdfs:label ?valueLabel . FILTER(LANG(?valueLabel) = "en")
  }
}
ORDER BY ?predLabel ?pred`.trim();

  // ── English Wikipedia sitelink ────────────────────────────────────────────
  const sitelinkQuery = `
PREFIX schema: <http://schema.org/>
SELECT ?articleUrl WHERE {
  ?articleUrl schema:about <${safeIri}> ;
              schema:inLanguage "en" ;
              schema:isPartOf <https://en.wikipedia.org/> .
}
LIMIT 1`.trim();

  const [metaRows, outRows, sitelinkRows] = await Promise.all([
    runLiveSparql(metaQuery),
    runLiveSparql(outgoingQuery),
    // Short timeout: sitelink lookup should be fast; don't let it delay the panel.
    runLiveSparql(sitelinkQuery, 5_000).catch(() => []),
  ]);

  if (outRows.length === 0) return null;

  const { resolvePredicateLabel } = await import("./wikidata-predicates");

  const label = liveVal(metaRows[0] ?? {}, "label") ?? safeIri.split(/[/#]/).pop() ?? safeIri;
  const description = liveVal(metaRows[0] ?? {}, "description");

  const properties = outRows
    .map((b) => {
      const predIri = liveVal(b, "pred");
      const valueNode = b["value"];
      if (!predIri || !valueNode) return null;
      const isLiteral = valueNode.type === "literal";
      const valueLabel = liveVal(b, "valueLabel");
      const valueDisplay = isLiteral
        ? valueNode.value
        : (valueLabel ?? valueNode.value.split(/[/#]/).pop() ?? valueNode.value);
      return {
        property: resolvePredicateLabel(predIri, liveVal(b, "predLabel")),
        propertyIri: predIri,
        value: valueDisplay,
        valueIri: isLiteral ? undefined : valueNode.value,
        isLiteral,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  // Incoming relations omitted — unbounded reverse scans (e.g. all entities whose
  // "country" = Belgium) time out on large entities. The Related Events button
  // in the panel covers event-based discovery.
  const incomingRelations: Array<{ property: string; subject: string; subjectIri: string }> = [];

  // ── Wikipedia summary (best-effort, 5 s cap) ────────────────────────────
  const articleUrl = liveVal(sitelinkRows[0] ?? {}, "articleUrl");
  const wikiSummary = articleUrl
    ? await Promise.race([
        fetchWikiSummary(articleUrl),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
      ])
    : null;

  return { label, description, wikiSummary, properties, incomingRelations };
}
