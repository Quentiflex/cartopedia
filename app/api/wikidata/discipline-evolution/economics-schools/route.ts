import { NextRequest, NextResponse } from "next/server";
import { runLiveSparql, liveVal } from "@/lib/wikidata-live";
import { fetchWikiSummary } from "@/lib/wikipedia";

type EvolutionRow = {
  iri: string;
  label: string;
  startYear: number | null;
  endYear: number | null;
  description?: string;
  wikiSummary?: {
    extract: string;
    articleUrl: string;
    thumbnail?: string;
  } | null;
};

type EvolutionResponse = {
  discipline: { iri: string; label: string };
  disciplineValid: boolean;
  schoolType: { iri: string; label: string };
  linkProperty: { code: string; label: string };
  economicsMode: "school";
  items: EvolutionRow[];
  yearRange: { min: number; max: number; step: number };
};

type MappedRow = {
  iri: string;
  label: string;
  startYear: number | null;
  endYear: number | null;
  description: string | undefined;
  articleUrl: string | undefined;
};

const ECONOMICS_IRI = "http://www.wikidata.org/entity/Q8134";
const ECONOMIC_SCHOOL_IRI = "http://www.wikidata.org/entity/Q3048444";

function yearStepFromRange(min: number, max: number): number {
  const span = Math.abs(max - min);
  if (span > 250) return 10;
  if (span > 160) return 5;
  if (span > 80) return 2;
  return 1;
}

async function attachWikiSummaries(rows: MappedRow[]): Promise<EvolutionRow[]> {
  return Promise.all(
    rows.map(async (row) => {
      const wikiSummary = row.articleUrl
        ? await Promise.race([
            fetchWikiSummary(row.articleUrl),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 4_000)),
          ])
        : null;
      return {
        iri: row.iri,
        label: row.label,
        startYear: row.startYear,
        endYear: row.endYear,
        description: row.description,
        wikiSummary,
      };
    })
  );
}

function toWikidataBusyMessage(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const lower = msg.toLowerCase();
  if (lower.includes("aborted") || lower.includes("timeout") || lower.includes("timed out")) {
    return "Wikidata is temporarily busy or too slow right now. Please try again in a moment.";
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const limitRaw = request.nextUrl.searchParams.get("limit") ?? "40";
    const limit = Math.max(5, Math.min(parseInt(limitRaw, 10) || 40, 80));

    const query = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
SELECT
  ?school
  ?label
  ?startYear
  ?description
  ?articleUrl
WHERE {
  ?school wdt:P31 <${ECONOMIC_SCHOOL_IRI}> .
  ?school rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  OPTIONAL { ?school schema:description ?description . FILTER(LANG(?description) = "en") }
  OPTIONAL {
    ?articleUrl schema:about ?school ;
                schema:inLanguage "en" ;
                schema:isPartOf <https://en.wikipedia.org/> .
  }
  OPTIONAL { ?school wdt:P571 ?inceptionDate . BIND(YEAR(?inceptionDate) AS ?yInception) }
  OPTIONAL { ?school wdt:P580 ?startDate . BIND(YEAR(?startDate) AS ?yStart) }
  OPTIONAL { ?school wdt:P585 ?pointDate . BIND(YEAR(?pointDate) AS ?yPoint) }
  BIND(COALESCE(?yInception, ?yStart, ?yPoint) AS ?startYear)
}
ORDER BY ?startYear ?label
LIMIT ${limit}`.trim();

    const rows = await runLiveSparql(query, 25_000);
    const mapped = rows
      .map((b) => {
        const iri = liveVal(b, "school");
        const label = liveVal(b, "label");
        if (!iri || !label) return null;
        const startYearRaw = liveVal(b, "startYear");
        const startYear = startYearRaw != null ? parseInt(startYearRaw, 10) : null;
        return {
          iri,
          label,
          startYear,
          endYear: startYear,
          description: liveVal(b, "description"),
          articleUrl: liveVal(b, "articleUrl"),
        };
      })
      .filter((x): x is MappedRow => x !== null);

    const items = await attachWikiSummaries(mapped);
    const years = items.flatMap((it) =>
      [it.startYear, it.endYear ?? it.startYear].filter((y): y is number => typeof y === "number")
    );
    const yearMin = years.length ? Math.min(...years) : 0;
    const yearMax = years.length ? Math.max(...years) : 0;

    const response: EvolutionResponse = {
      discipline: { iri: ECONOMICS_IRI, label: "economics" },
      disciplineValid: true,
      schoolType: { iri: ECONOMIC_SCHOOL_IRI, label: "school of economic thought" },
      linkProperty: { code: "P31", label: "instance of" },
      economicsMode: "school",
      items,
      yearRange: { min: yearMin, max: yearMax, step: yearStepFromRange(yearMin, yearMax) },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
    });
  } catch (err) {
    const msg = toWikidataBusyMessage(err);
    return NextResponse.json({ error: msg ?? "Failed to fetch economics schools" }, { status: msg ? 503 : 502 });
  }
}

