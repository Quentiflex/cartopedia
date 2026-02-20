/**
 * Fuseki SPARQL client for the Wikidata truthy dataset.
 *
 * The Wikidata triples live in the named graph WIKIDATA_GRAPH inside the
 * same Fuseki dataset as the history data (default: "history").
 * Override via WIKIDATA_SPARQL_URL env var if your dataset is named differently.
 *
 * Wikidata RDF conventions:
 *   Items:      http://www.wikidata.org/entity/Q…
 *   Properties: http://www.wikidata.org/prop/direct/P… (truthy shortcut)
 *   Labels:     rdfs:label  (multiple languages, we prefer "en")
 *   Desc:       schema:description
 */

const WIKIDATA_SPARQL_URL =
  process.env.WIKIDATA_SPARQL_URL ??
  process.env.FUSEKI_SPARQL_URL ??
  "http://127.0.0.1:3030/history/sparql";

/**
 * Named graph that holds the Wikidata truthy triples.
 * Override via WIKIDATA_GRAPH env var if needed.
 */
export const WIKIDATA_GRAPH =
  process.env.WIKIDATA_GRAPH ?? "http://cartopedia.org/graph/history/raw";

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

export type WikidataBinding = Record<
  string,
  { type: string; value: string; "xml:lang"?: string; datatype?: string } | undefined
>;

/**
 * Execute a SPARQL ASK query and return the boolean result.
 * Uses the same endpoint and auth as runWikidataSparql.
 */
export async function runWikidataAsk(query: string): Promise<boolean> {
  const headers: Record<string, string> = {
    "Content-Type": "application/sparql-query",
    Accept: "application/sparql-results+json",
  };
  const auth = getAuthHeader();
  if (auth) headers.Authorization = auth;

  const res = await fetch(WIKIDATA_SPARQL_URL, {
    method: "POST",
    headers,
    body: query,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SPARQL ASK failed: ${res.status} ${res.statusText}. ${text.slice(0, 200)}`);
  }

  const data = await res.json() as { boolean?: boolean };
  return data.boolean === true;
}

export async function runWikidataSparql(query: string): Promise<WikidataBinding[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/sparql-query",
    Accept: "application/sparql-results+json",
  };
  const auth = getAuthHeader();
  if (auth) headers.Authorization = auth;

  const res = await fetch(WIKIDATA_SPARQL_URL, {
    method: "POST",
    headers,
    body: query,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(
      `SPARQL ${res.status} ${res.statusText} at ${WIKIDATA_SPARQL_URL} — ${text.slice(0, 300)}`
    );
  }

  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) {
    throw new Error(
      `Fuseki returned non-JSON at ${WIKIDATA_SPARQL_URL} (got: ${trimmed.slice(0, 120)}…). ` +
        `Check that Fuseki is running and the dataset exists. ` +
        `Override endpoint with the WIKIDATA_SPARQL_URL env var if needed.`
    );
  }

  let data: { results: { bindings: WikidataBinding[] } };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new Error(`Invalid JSON from Fuseki: ${text.slice(0, 100)}…`);
  }

  return data.results?.bindings ?? [];
}

/** Extract the string value of a named binding field, or undefined. */
export function val(binding: WikidataBinding, key: string): string | undefined {
  return binding[key]?.value;
}

/**
 * Given a predicate IRI like http://www.wikidata.org/prop/direct/P31,
 * derive the entity IRI http://www.wikidata.org/entity/P31 for label lookup.
 * Falls back to extracting the local name for display if no label is available.
 */
export function predicateLocalName(iri: string): string {
  return iri.split(/[/#]/).pop() ?? iri;
}
