import { NextRequest, NextResponse } from "next/server";

const LIVE_ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "Cartopedia/1.0 (personal history explorer; https://github.com/cartopedia)";
const TIMEOUT_MS = 30_000;

export type RelatedEvent = {
  iri: string;
  label: string;
  description?: string;
  typeLabel: string;
  typeIri: string;
  /** Only present when the event has a resolvable location — used for map pin. */
  lat?: number;
  lon?: number;
  startYear?: number;
  /**
   * End year used for map opacity.
   * When no end date is recorded we fall back to the start year (point-in-time),
   * so the event does NOT bleed into future time windows.
   */
  endYear?: number;
};

/** Parse "Point(lon lat)" WKT, optionally prefixed with a globe IRI. */
function parseWkt(wkt: string): { lat: number; lon: number } | null {
  const m = wkt.match(/Point\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (!m) return null;
  const lon = parseFloat(m[1]);
  const lat = parseFloat(m[2]);
  if (isNaN(lon) || isNaN(lat)) return null;
  return { lon, lat };
}

/** Parse the year from an xsd:dateTime string (handles BCE negative years). */
function parseYear(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const m = s.match(/^(-?\d+)-/);
  const y = m ? parseInt(m[1], 10) : NaN;
  return isNaN(y) ? undefined : y;
}

/**
 * GET /api/wikidata/related-events?iri=<IRI>[&startYear=X&endYear=Y]
 *
 * Returns significant events (wars, battles, treaties, revolutions…) related to
 * the given entity.  Time-window filtering is OPTIONAL:
 *   • If startYear/endYear are present, only events overlapping [start,end] are returned.
 *   • If omitted, all related events are returned (useful when calling from an event's
 *     "Related Entities" button where time context is irrelevant).
 *
 * Two link directions are searched:
 *   1. event → entity  (P710 participant, P17 country, P276 location) — type-filtered
 *   2. entity → event  (P1344 participant-in, P793 significant event, P607 conflict)
 *      NO type filter here: if the entity explicitly declares a relation it is trusted.
 *
 * Coordinates are OPTIONAL — all matching events are returned.  Map pins are only
 * created for events that have a resolvable location.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const iri = sp.get("iri");
  const startYearParam = sp.get("startYear");
  const endYearParam = sp.get("endYear");
  const filterByTime = startYearParam !== null && endYearParam !== null;
  const startYear = filterByTime ? parseInt(startYearParam!, 10) : -100_000;
  const endYear   = filterByTime ? parseInt(endYearParam!,   10) :  100_000;

  if (!iri || !iri.startsWith("http")) {
    return NextResponse.json({ error: "Missing or invalid iri" }, { status: 400 });
  }

  const safeIri = iri.replace(/[<>]/g, "");

  // Used ONLY for direction 1 (incoming typed events).
  const dir1TypeValues = [
    "http://www.wikidata.org/entity/Q198",     // War
    "http://www.wikidata.org/entity/Q178561",  // Battle
    "http://www.wikidata.org/entity/Q831663",  // Military campaign
    "http://www.wikidata.org/entity/Q188055",  // Military operation
    "http://www.wikidata.org/entity/Q180684",  // Conflict
    "http://www.wikidata.org/entity/Q1656682", // Siege
    "http://www.wikidata.org/entity/Q179076",  // Revolution
    "http://www.wikidata.org/entity/Q131569",  // Treaty
    "http://www.wikidata.org/entity/Q625298",  // Peace treaty
    "http://www.wikidata.org/entity/Q8465",    // Military occupation
    "http://www.wikidata.org/entity/Q189760",  // Assassination
    "http://www.wikidata.org/entity/Q217071",  // International treaty
    "http://www.wikidata.org/entity/Q1344",    // Annexation
    "http://www.wikidata.org/entity/Q179010",  // Armed conflict
  ].map((t) => `<${t}>`).join(" ");

  // Time filter clause — only injected when start/end params are present
  // When called from an event panel, no time filtering is applied at all —
  // participants (countries, armies) have no temporal data and must not be dropped.
  const timeFilterClause = filterByTime
    ? `FILTER(BOUND(?effectiveEnd))
  FILTER(
    (!BOUND(?effectiveStart) || YEAR(?effectiveStart) <= ${endYear}) &&
    YEAR(?effectiveEnd) >= ${startYear}
  )`
    : ``;

  const query = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>

SELECT DISTINCT ?event
  (COALESCE(SAMPLE(?enLabel), SAMPLE(?anyLabel)) AS ?label)
  (SAMPLE(?desc)     AS ?description)
  (COALESCE(SAMPLE(?typeLbl), SAMPLE(?fallbackTypeLbl), "Event") AS ?typeLabel)
  (SAMPLE(?typeIri)  AS ?typeIriVal)
  (SAMPLE(?rawCoord) AS ?coord)
  (SAMPLE(?effectiveStart) AS ?start)
  (SAMPLE(?effectiveEnd)   AS ?end)
WHERE {
  # Each direction is wrapped in a SELECT…LIMIT subquery so the Wikidata engine
  # caps the initial triple scan before the expensive outer joins run.
  # P17/P276 are intentionally excluded from direction 1: for large countries
  # (USA, UK, …) they match millions of events and time out.  P710 (direct
  # participant) is semantically stronger and bounded.
  {
    # ── Direction 1 ─────────────────────────────────────────────────────────
    # Typed event that explicitly lists the entity as a participant (P710).
    SELECT DISTINCT ?event ?typeIri ?typeLbl WHERE {
      VALUES ?typeIri { ${dir1TypeValues} }
      ?event wdt:P31 ?typeIri .
      ?event wdt:P710 <${safeIri}> .
      OPTIONAL { ?typeIri rdfs:label ?typeLbl . FILTER(LANG(?typeLbl) = "en") }
    }
    LIMIT 80
  }
  UNION
  {
    # ── Direction 2 ─────────────────────────────────────────────────────────
    # Entities that the subject explicitly links to.
    # P1344/P793/P607  — events a country participated in / its significant events
    # P710             — participants OF this entity (e.g. countries in a war)
    # P17              — country where an event took place
    # P276             — specific location of an event
    # No type restriction — the entity declared the relation, so we trust it.
    SELECT DISTINCT ?event WHERE {
      VALUES ?invRel { wdt:P1344 wdt:P793 wdt:P607 wdt:P710 wdt:P17 wdt:P276 }
      <${safeIri}> ?invRel ?event .
    }
    LIMIT 80
  }

  # ── Type label for direction-2 events (opportunistic, not required) ──────
  OPTIONAL {
    ?event wdt:P31 ?typeIri .
    OPTIONAL { ?typeIri rdfs:label ?fallbackTypeLbl . FILTER(LANG(?fallbackTypeLbl) = "en") }
  }

  # ── Temporal bounds ──────────────────────────────────────────────────────
  # effectiveEnd falls back to effectiveStart (point-in-time) to prevent
  # dateless events from bleeding into future time windows.
  OPTIONAL { ?event wdt:P580 ?startT }
  OPTIONAL { ?event wdt:P571 ?inception }
  OPTIONAL { ?event wdt:P582 ?endT }
  OPTIONAL { ?event wdt:P585 ?pointT }
  BIND(COALESCE(?startT, ?inception, ?pointT) AS ?effectiveStart)
  BIND(COALESCE(?endT, ?pointT, ?effectiveStart) AS ?effectiveEnd)
  ${timeFilterClause}

  # ── Coordinates (optional) ───────────────────────────────────────────────
  # Events without a resolvable location are still returned for the panel list.
  OPTIONAL { ?event wdt:P625 ?directCoord }
  OPTIONAL { ?event wdt:P276 ?loc  . ?loc  wdt:P625 ?locCoord  }
  OPTIONAL { ?event wdt:P17  ?ctry . ?ctry wdt:P625 ?ctryCoord }
  BIND(COALESCE(?directCoord, ?locCoord, ?ctryCoord) AS ?rawCoord)

  OPTIONAL { ?event rdfs:label ?enLabel  . FILTER(LANG(?enLabel)  = "en") }
  OPTIONAL { ?event rdfs:label ?anyLabel . FILTER(LANG(?anyLabel) != "")  }
  OPTIONAL { ?event schema:description ?desc . FILTER(LANG(?desc) = "en") }
}
GROUP BY ?event
ORDER BY ?start
LIMIT 100`.trim();

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

    const events: RelatedEvent[] = [];
    for (const b of json.results?.bindings ?? []) {
      const eventIri = b.event?.value;
      const label = b.label?.value;
      if (!eventIri || !label) continue;

      const pt = b.coord?.value ? parseWkt(b.coord.value) : null;

      const startYr = parseYear(b.start?.value);
      // endYear: explicit end OR fall back to start (point-in-time)
      const endYr = parseYear(b.end?.value) ?? startYr;

      events.push({
        iri: eventIri,
        label,
        description: b.description?.value,
        typeLabel: b.typeLabel?.value ?? "Event",
        typeIri: b.typeIriVal?.value ?? "",
        ...(pt ? { lat: pt.lat, lon: pt.lon } : {}),
        startYear: startYr,
        endYear: endYr,
      });
    }

    return NextResponse.json(
      { events },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
