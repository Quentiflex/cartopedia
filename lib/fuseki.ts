/**
 * Fuseki SPARQL client for the history dataset.
 * Queries wars and participants in a time window; aggregates by participant
 * for map display (one point per country, labels = war names).
 */

const FUSEKI_SPARQL_URL =
  process.env.FUSEKI_SPARQL_URL ?? "http://127.0.0.1:3030/history/sparql";

/** Optional Basic auth (e.g. FUSEKI_USER=admin FUSEKI_PASSWORD=admin). */
function getAuthHeader(): string | undefined {
  const user = process.env.FUSEKI_USER;
  const password = process.env.FUSEKI_PASSWORD;
  if (user != null && password != null) {
    return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
  }
  const auth = process.env.FUSEKI_AUTH;
  if (auth != null && auth.length > 0) {
    return `Basic ${auth}`;
  }
  return undefined;
}

const SPARQL_TEMPLATE = `
PREFIX ex: <http://example.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?participant ?participantLabel ?lat ?lon ?warLabel ?warStart ?warEnd
WHERE {
  ?war a ex:War ;
       rdfs:label ?warLabel ;
       ex:startDate ?warStart ;
       ex:hasParticipant ?participant .
  OPTIONAL { ?war ex:endDate ?warEnd } .
  ?participant rdfs:label ?participantLabel ;
               ex:latitude ?lat ;
               ex:longitude ?lon .
  FILTER (YEAR(?warStart) <= __END_YEAR__)
  FILTER (!BOUND(?warEnd) || YEAR(?warEnd) >= __START_YEAR__)
}
ORDER BY ?participantLabel ?warLabel
`.trim();

const WARS_SPARQL_TEMPLATE = `
PREFIX ex: <http://example.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?war ?warLabel ?warStart ?warEnd
WHERE {
  ?war a ex:War ;
       rdfs:label ?warLabel ;
       ex:startDate ?warStart .
  OPTIONAL { ?war ex:endDate ?warEnd } .
  FILTER (YEAR(?warStart) <= __END_YEAR__)
  FILTER (!BOUND(?warEnd) || YEAR(?warEnd) >= __START_YEAR__)
}
ORDER BY ?warStart ?warLabel
`.trim();

/** SPARQL: list ontology classes (ex:) with label, comment, subClassOf. */
export const ONTOLOGY_CLASSES_QUERY = `
PREFIX ex: <http://example.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?class ?label ?comment ?subClassOf
WHERE {
  ?class a rdfs:Class .
  FILTER(STRSTARTS(STR(?class), "http://example.org/ontology/"))
  OPTIONAL { ?class rdfs:label ?label . FILTER(LANG(?label) = "en") }
  OPTIONAL { ?class rdfs:comment ?comment . FILTER(LANG(?comment) = "en") }
  OPTIONAL { ?class rdfs:subClassOf ?subClassOf }
}
ORDER BY ?class
`.trim();

/** SPARQL: list ontology properties (ex:) with label, comment, domain, range. */
export const ONTOLOGY_PROPERTIES_QUERY = `
PREFIX ex: <http://example.org/ontology/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?prop ?label ?comment ?domain ?range
WHERE {
  ?prop a rdf:Property .
  FILTER(STRSTARTS(STR(?prop), "http://example.org/ontology/"))
  OPTIONAL { ?prop rdfs:label ?label . FILTER(LANG(?label) = "en") }
  OPTIONAL { ?prop rdfs:comment ?comment . FILTER(LANG(?comment) = "en") }
  OPTIONAL { ?prop rdfs:domain ?domain }
  OPTIONAL { ?prop rdfs:range ?range }
}
ORDER BY ?prop
`.trim();

export type SparqlBinding = {
  participant?: { value: string };
  participantLabel?: { value: string };
  war?: { value: string };
  warLabel?: { value: string };
  warStart?: { value: string };
  warEnd?: { value: string };
  lat?: { value: string };
  lon?: { value: string };
};

export type SparqlResult = {
  results: { bindings: SparqlBinding[] };
};

function clampYear(n: number): number {
  return Math.max(1, Math.min(9999, Math.floor(Number(n))));
}

/**
 * Build SPARQL query for the given year range (inclusive). Replaces placeholders
 * with safe numeric values.
 */
export function buildWarParticipantsQuery(startYear: number, endYear: number): string {
  const start = clampYear(startYear);
  const end = clampYear(endYear);
  return SPARQL_TEMPLATE.replace("__START_YEAR__", String(start)).replace(
    "__END_YEAR__",
    String(end)
  );
}

/**
 * Build SPARQL query for wars overlapping the given year range (for Gantt).
 */
export function buildWarsQuery(startYear: number, endYear: number): string {
  const start = clampYear(startYear);
  const end = clampYear(endYear);
  return WARS_SPARQL_TEMPLATE.replace("__START_YEAR__", String(start)).replace(
    "__END_YEAR__",
    String(end)
  );
}

/**
 * Execute a SPARQL SELECT and return parsed bindings.
 */
export async function runSparqlSelect(query: string): Promise<SparqlBinding[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/sparql-query",
    Accept: "application/sparql-results+json",
  };
  const auth = getAuthHeader();
  if (auth) headers.Authorization = auth;

  const res = await fetch(FUSEKI_SPARQL_URL, {
    method: "POST",
    headers,
    body: query,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(
      `SPARQL request failed: ${res.status} ${res.statusText}. ${text.slice(0, 200)}`
    );
  }

  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) {
    throw new Error(
      `Fuseki returned non-JSON (got ${trimmed.slice(0, 80)}…). ` +
        `Is Fuseki running at ${FUSEKI_SPARQL_URL}? Start it (e.g. Docker) and ensure the "history" dataset exists.`
    );
  }

  let data: SparqlResult;
  try {
    data = JSON.parse(text) as SparqlResult;
  } catch {
    throw new Error(
      `Invalid JSON from Fuseki: ${text.slice(0, 100)}…. ` +
        `Check ${FUSEKI_SPARQL_URL} is the SPARQL endpoint.`
    );
  }

  return data.results?.bindings ?? [];
}
