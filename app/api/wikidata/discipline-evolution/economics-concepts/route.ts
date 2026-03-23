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
  economicsMode: "concept";
  items: EvolutionRow[];
  yearRange: { min: number; max: number; step: number };
};

type MappedRow = {
  iri: string;
  label: string;
  startYear: null;
  endYear: null;
  description: string | undefined;
  articleUrl: string | undefined;
};

const ECONOMICS_IRI = "http://www.wikidata.org/entity/Q8134";
const CONCEPT_IRI = "http://www.wikidata.org/entity/Q151885";

async function attachWikiSummaries(rows: MappedRow[]): Promise<EvolutionRow[]> {
  const MAX_SUMMARY_ITEMS = 12;
  return Promise.all(
    rows.map(async (row, index) => {
      if (index >= MAX_SUMMARY_ITEMS || !row.articleUrl) {
        return {
          iri: row.iri,
          label: row.label,
          startYear: row.startYear,
          endYear: row.endYear,
          description: row.description,
          wikiSummary: null,
        };
      }
      const wikiSummary = row.articleUrl
        ? await Promise.race([
            fetchWikiSummary(row.articleUrl),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_500)),
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
    const candidateLimit = Math.min(limit * 20, 400);

    // "Concepts belonging to economics" in a practical/fast interpretation:
    // direct part-of economics + typed as concept.
    const query = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
SELECT
  ?concept
  ?label
  ?description
  ?articleUrl
WHERE {
  {
    SELECT ?concept WHERE {
      ?concept wdt:P31 <${CONCEPT_IRI}> .
      ?concept wdt:P361 <${ECONOMICS_IRI}> .
      FILTER NOT EXISTS { ?concept wdt:P31 <http://www.wikidata.org/entity/Q5> }
    }
    LIMIT ${candidateLimit}
  }
  ?concept rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  OPTIONAL { ?concept schema:description ?description . FILTER(LANG(?description) = "en") }
  OPTIONAL {
    ?articleUrl schema:about ?concept ;
                schema:inLanguage "en" ;
                schema:isPartOf <https://en.wikipedia.org/> .
  }
}
ORDER BY ?label
LIMIT ${limit}`.trim();

    let rows: Awaited<ReturnType<typeof runLiveSparql>>;
    try {
      rows = await runLiveSparql(query, 45_000);
    } catch (err) {
      // Fallback: keep the endpoint responsive when WDQS is overloaded.
      const fallback = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
SELECT ?concept ?label ?description ?articleUrl WHERE {
  ?concept wdt:P361 <${ECONOMICS_IRI}> .
  ?concept rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  OPTIONAL { ?concept schema:description ?description . FILTER(LANG(?description) = "en") }
  OPTIONAL {
    ?articleUrl schema:about ?concept ;
                schema:inLanguage "en" ;
                schema:isPartOf <https://en.wikipedia.org/> .
  }
}
ORDER BY ?label
LIMIT ${limit}`.trim();
      rows = await runLiveSparql(fallback, 20_000);
    }
    const mapped = rows
      .map((b) => {
        const iri = liveVal(b, "concept");
        const label = liveVal(b, "label");
        if (!iri || !label) return null;
        return {
          iri,
          label,
          startYear: null,
          endYear: null,
          description: liveVal(b, "description"),
          articleUrl: liveVal(b, "articleUrl"),
        };
      })
      .filter((x): x is MappedRow => x !== null);

    const items = await attachWikiSummaries(mapped);

    const response: EvolutionResponse = {
      discipline: { iri: ECONOMICS_IRI, label: "economics" },
      disciplineValid: true,
      schoolType: { iri: CONCEPT_IRI, label: "concept" },
      linkProperty: { code: "P361", label: "part of" },
      economicsMode: "concept",
      items,
      yearRange: { min: 0, max: 0, step: 1 },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
    });
  } catch (err) {
    const msg = toWikidataBusyMessage(err);
    return NextResponse.json({ error: msg ?? "Failed to fetch economics concepts" }, { status: msg ? 503 : 502 });
  }
}

