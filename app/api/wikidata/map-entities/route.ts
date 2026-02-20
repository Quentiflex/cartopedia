import { NextRequest, NextResponse } from "next/server";
import { CURATED_TYPES, type WikidataMapEntity } from "@/lib/wikidata-curated-types";

const LIVE_ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "Cartopedia/1.0 (personal history explorer; https://github.com/cartopedia)";
const TIMEOUT_MS = 25_000;

/** Parse "Point(lon lat)" WKT literal (optionally prefixed with a globe IRI). */
function parseWkt(wkt: string): { lat: number; lon: number } | null {
  const m = wkt.match(/Point\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (!m) return null;
  const lon = parseFloat(m[1]);
  const lat = parseFloat(m[2]);
  if (isNaN(lon) || isNaN(lat)) return null;
  return { lon, lat };
}

/**
 * GET /api/wikidata/map-entities
 *
 * Query params:
 *   types      – comma-separated Wikidata entity IRIs (e.g. Q198,Q178561)
 *   startYear  – integer (inclusive)
 *   endYear    – integer (inclusive)
 *
 * Returns entities that:
 *   • are instances of one of the requested types
 *   • were active during [startYear, endYear] (P571/P580/P582/P585)
 *   • have a resolvable location (P625 directly, or via P276 or P17)
 *
 * Max 300 entities per request.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const typesRaw = sp.get("types") ?? "";
  const startYear = parseInt(sp.get("startYear") ?? "0", 10);
  const endYear   = parseInt(sp.get("endYear")   ?? "9999", 10);

  const typeIris = typesRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("http"));

  if (typeIris.length === 0) {
    return NextResponse.json({ entities: [] });
  }

  // Build a label lookup: IRI → { label, category }
  const typeMeta = new Map(CURATED_TYPES.map((t) => [t.iri, t]));

  const valuesBlock = typeIris.map((iri) => `<${iri}>`).join(" ");

  const query = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
SELECT ?entity ?type
  (COALESCE(SAMPLE(?enLbl), SAMPLE(?anyLbl)) AS ?label)
  (SAMPLE(?rawCoord) AS ?coord)
  (SAMPLE(?desc) AS ?description)
  (SAMPLE(?effectiveEnd) AS ?endDate)
WHERE {
  VALUES ?type { ${valuesBlock} }
  ?entity wdt:P31 ?type .

  # ── Time filter ────────────────────────────────────────────────────────────
  # P571 = inception, P580 = start time, P582 = end time, P585 = point in time
  # P361 = part of  (one level up, used when the entity itself has no dates)
  OPTIONAL { ?entity wdt:P571 ?inception }
  OPTIONAL { ?entity wdt:P580 ?startT }
  OPTIONAL { ?entity wdt:P582 ?endT }
  OPTIONAL { ?entity wdt:P585 ?pointT }
  # Inherit dates from a parent event when the entity itself has none
  OPTIONAL {
    ?entity wdt:P361 ?parent .
    OPTIONAL { ?parent wdt:P580 ?parentStartT }
    OPTIONAL { ?parent wdt:P571 ?parentInception }
    OPTIONAL { ?parent wdt:P582 ?parentEndT }
    OPTIONAL { ?parent wdt:P585 ?parentPointT }
  }
  BIND(COALESCE(?startT, ?inception, ?pointT,
                ?parentStartT, ?parentInception, ?parentPointT) AS ?effectiveStart)
  BIND(COALESCE(?endT, ?pointT,
                ?parentEndT, ?parentPointT)                     AS ?effectiveEnd)
  # Require at least one temporal bound — entities with no dates at all are excluded.
  FILTER(BOUND(?effectiveStart) || BOUND(?effectiveEnd))
  # Overlap check: entity must overlap [startYear, endYear].
  # A missing end date means the entity is still active (ongoing), so no upper bound is applied.
  # A missing start date means we have no lower bound constraint.
  FILTER(
    (!BOUND(?effectiveStart) || YEAR(?effectiveStart) <= ${endYear}) &&
    (!BOUND(?effectiveEnd)   || YEAR(?effectiveEnd)   >= ${startYear})
  )

  # ── Location (P625 → P276→P625 → P17→P625) ────────────────────────────────
  OPTIONAL { ?entity wdt:P625 ?directCoord }
  OPTIONAL { ?entity wdt:P276 ?loc  . ?loc  wdt:P625 ?locCoord  }
  OPTIONAL { ?entity wdt:P17  ?ctry . ?ctry wdt:P625 ?ctryCoord }
  BIND(COALESCE(?directCoord, ?locCoord, ?ctryCoord) AS ?rawCoord)
  FILTER(BOUND(?rawCoord))

  # ── Labels ─────────────────────────────────────────────────────────────────
  OPTIONAL { ?entity rdfs:label ?enLbl  . FILTER(LANG(?enLbl)  = "en") }
  OPTIONAL { ?entity rdfs:label ?anyLbl . FILTER(LANG(?anyLbl) != "")  }
  OPTIONAL { ?entity schema:description ?desc . FILTER(LANG(?desc) = "en") }
}
GROUP BY ?entity ?type
LIMIT 300`.trim();

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
    const bindings: Binding[] = json.results?.bindings ?? [];

    const entities: WikidataMapEntity[] = [];

    for (const b of bindings) {
      const iri   = b.entity?.value;
      const label = b.label?.value;
      const coord = b.coord?.value;
      const typeIri = b.type?.value;
      if (!iri || !label || !coord) continue;

      const pt = parseWkt(coord);
      if (!pt) continue;

      const meta = typeIri ? typeMeta.get(typeIri) : undefined;

      // Parse endYear from an xsd:dateTime string like "1830-01-01T00:00:00Z"
      // Undefined means still active (no end date recorded).
      const endDateStr = b.endDate?.value;
      const endYearRaw = endDateStr ? parseInt(endDateStr.slice(0, 4), 10) : undefined;

      entities.push({
        iri,
        label,
        description: b.description?.value,
        lat: pt.lat,
        lon: pt.lon,
        typeIri: typeIri ?? "",
        typeLabel: meta?.label ?? typeIri?.split(/[/#]/).pop() ?? "Entity",
        endYear: endYearRaw != null && !isNaN(endYearRaw) ? endYearRaw : undefined,
      });
    }

    return NextResponse.json(
      { entities },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
