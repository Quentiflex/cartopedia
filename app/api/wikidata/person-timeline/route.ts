import { NextRequest, NextResponse } from "next/server";

const LIVE_ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "Cartopedia/1.0 (personal history explorer; https://github.com/cartopedia)";
const TIMEOUT_MS = 20_000;

export type PersonFact = {
  label: string;
  kind: "position" | "award";
  year?: number;
  endYear?: number;
};

function parseYear(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const m = s.match(/^(-?\d+)-/);
  const y = m ? parseInt(m[1], 10) : NaN;
  return isNaN(y) ? undefined : y;
}

/**
 * GET /api/wikidata/person-timeline?iri=<IRI>
 *
 * Returns key dated facts for a person:
 *   • Positions held  (P39) with start (P580) and end (P582) qualifiers
 *   • Awards received (P166) with point-in-time (P585) qualifier
 *
 * Uses the full Wikidata statement model (p:/ps:/pq:) to access qualifiers.
 */
export async function GET(request: NextRequest) {
  const iri = request.nextUrl.searchParams.get("iri");
  if (!iri || !iri.startsWith("http")) {
    return NextResponse.json({ error: "Missing or invalid iri" }, { status: 400 });
  }
  const safeIri = iri.replace(/[<>]/g, "");

  const query = `
PREFIX p:   <http://www.wikidata.org/prop/>
PREFIX ps:  <http://www.wikidata.org/prop/statement/>
PREFIX pq:  <http://www.wikidata.org/prop/qualifier/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?kind ?label ?start ?end WHERE {
  {
    # ── Positions held (P39) ─────────────────────────────────────────────────
    <${safeIri}> p:P39 ?stmt .
    ?stmt ps:P39 ?pos .
    OPTIONAL { ?stmt pq:P580 ?start }
    OPTIONAL { ?stmt pq:P582 ?end }
    ?pos rdfs:label ?label . FILTER(LANG(?label) = "en")
    BIND("position" AS ?kind)
  }
  UNION
  {
    # ── Awards received (P166) ───────────────────────────────────────────────
    <${safeIri}> p:P166 ?stmt .
    ?stmt ps:P166 ?award .
    OPTIONAL { ?stmt pq:P585 ?start }
    ?award rdfs:label ?label . FILTER(LANG(?label) = "en")
    BIND("award" AS ?kind)
  }
}
ORDER BY ?start
LIMIT 60`.trim();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(LIVE_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
        "User-Agent": USER_AGENT,
      },
      body: new URLSearchParams({ query }),
    });
    clearTimeout(timer);

    if (!res.ok) {
      return NextResponse.json({ error: `SPARQL ${res.status}` }, { status: 502 });
    }

    type Binding = Record<string, { type: string; value: string } | undefined>;
    const json = await res.json() as { results: { bindings: Binding[] } };

    const facts: PersonFact[] = [];
    for (const b of json.results?.bindings ?? []) {
      const label = b.label?.value;
      const kind = b.kind?.value as "position" | "award" | undefined;
      if (!label || !kind) continue;
      facts.push({
        label,
        kind,
        year: parseYear(b.start?.value),
        endYear: parseYear(b.end?.value),
      });
    }

    return NextResponse.json(
      { facts },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
