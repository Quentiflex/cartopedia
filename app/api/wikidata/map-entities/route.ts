import { NextRequest, NextResponse } from "next/server";
import { CURATED_TYPES, type WikidataMapEntity } from "@/lib/wikidata-curated-types";

const LIVE_ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "Cartopedia/1.0 (personal history explorer; https://github.com/cartopedia)";
const TIMEOUT_MS = 35_000;

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
 * Parse a year from an xsd:dateTime string.
 * Handles both CE ("1830-01-01T00:00:00Z") and BCE ("-0048-01-01T00:00:00Z").
 * parseInt(".slice(0,4)") breaks for negative years — use a regex instead.
 */
function parseYearStr(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const m = s.match(/^(-?\d+)-/);
  const y = m ? parseInt(m[1], 10) : NaN;
  return isNaN(y) ? undefined : y;
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

  // Split into person types (People category) vs entity types (everything else).
  // In Wikidata, persons are wdt:P31 Q5 (human) with roles in wdt:P106 (occupation)
  // or wdt:P39 (position held).  Querying P31 for person-role concepts returns wrong
  // results (awards, events, etc. that happen to be classified under that concept).
  const personTypeIris  = typeIris.filter(iri => typeMeta.get(iri)?.category === "People");
  const entityTypeIris  = typeIris.filter(iri => typeMeta.get(iri)?.category !== "People");

  // Mandatory date property path used as an index filter inside each subquery.
  // Requiring at least one of these triples lets Wikidata intersect two indexes
  // (type + date) instead of scanning the entire type class — critical for broad
  // types like Q7725634 (literary work) that have millions of instances.
  const DATE_PATH = "wdt:P571|wdt:P580|wdt:P577|wdt:P575|wdt:P585";

  const unionBranches: string[] = [];
  if (entityTypeIris.length > 0) {
    const vals = entityTypeIris.map(iri => `<${iri}>`).join(" ");
    // Pre-filter by year inside the subquery so the 500-entity cap only applies
    // to candidates that could actually fall in (or overlap) the requested window.
    // YEAR(?someDate) <= endYear: started/published before the window closed.
    unionBranches.push(
      `  {\n    SELECT DISTINCT ?entity ?type WHERE {\n      VALUES ?type { ${vals} }\n      ?entity wdt:P31 ?type .\n      ?entity (${DATE_PATH}) ?someDate .\n      FILTER(YEAR(?someDate) <= ${endYear})\n    }\n    LIMIT 500\n  }`
    );
  }
  if (personTypeIris.length > 0) {
    const vals = personTypeIris.map(iri => `<${iri}>`).join(" ");
    unionBranches.push(
      `  {\n    SELECT DISTINCT ?entity ?type WHERE {\n      VALUES ?type { ${vals} }\n      ?entity wdt:P31 <http://www.wikidata.org/entity/Q5> .\n      ?entity (wdt:P106|wdt:P39) ?type .\n      ?entity wdt:P569 ?birthDate .\n      FILTER(YEAR(?birthDate) <= ${endYear})\n    }\n    LIMIT 500\n  }`
    );
  }
  const typePattern = unionBranches.join("\n  UNION\n");

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
  ${typePattern}

  # ── Time filter ────────────────────────────────────────────────────────────
  # P571 = inception           P580 = start time       P582 = end time
  # P585 = point in time       P569 = date of birth    P570 = date of death
  # P577 = publication date    (literary works, books)
  # P575 = time of discovery   (inventions, scientific discoveries)
  # P361 = part of             (inherit dates one level up)
  OPTIONAL { ?entity wdt:P571 ?inception }
  OPTIONAL { ?entity wdt:P580 ?startT }
  OPTIONAL { ?entity wdt:P569 ?birthT }
  OPTIONAL { ?entity wdt:P577 ?pubDate }
  OPTIONAL { ?entity wdt:P575 ?discovT }
  OPTIONAL { ?entity wdt:P582 ?endT }
  OPTIONAL { ?entity wdt:P570 ?deathT }
  OPTIONAL { ?entity wdt:P585 ?pointT }
  # Inherit dates from a parent event when the entity itself has none
  OPTIONAL {
    ?entity wdt:P361 ?parent .
    OPTIONAL { ?parent wdt:P580 ?parentStartT }
    OPTIONAL { ?parent wdt:P571 ?parentInception }
    OPTIONAL { ?parent wdt:P582 ?parentEndT }
    OPTIONAL { ?parent wdt:P585 ?parentPointT }
  }
  BIND(COALESCE(?startT, ?inception, ?birthT, ?pubDate, ?discovT, ?pointT,
                ?parentStartT, ?parentInception, ?parentPointT) AS ?effectiveStart)
  # For point-in-time entities (books, inventions) that have no explicit end date,
  # fall back to their creation/publication date so they don't appear across all of history.
  BIND(COALESCE(?endT, ?deathT, ?pointT, ?pubDate, ?discovT,
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

  # ── Location ─────────────────────────────────────────────────────────────
  # P625 direct · P276 location · P17 country · P19 birth place (persons)
  # P495 country of origin — resolves inventions, literary works, diseases, etc.
  OPTIONAL { ?entity wdt:P625 ?directCoord }
  OPTIONAL { ?entity wdt:P276 ?loc        . ?loc        wdt:P625 ?locCoord    }
  OPTIONAL { ?entity wdt:P17  ?ctry       . ?ctry       wdt:P625 ?ctryCoord   }
  OPTIONAL { ?entity wdt:P19  ?birthPlace . ?birthPlace wdt:P625 ?birthCoord  }
  OPTIONAL { ?entity wdt:P495 ?originCtry . ?originCtry wdt:P625 ?originCoord }
  BIND(COALESCE(?directCoord, ?locCoord, ?ctryCoord, ?birthCoord, ?originCoord) AS ?rawCoord)
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

      // Parse endYear — handles both CE and BCE dates (e.g. "-0048-01-01T00:00:00Z").
      // Undefined means still active (no end date recorded).
      const endYearRaw = parseYearStr(b.endDate?.value);

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
