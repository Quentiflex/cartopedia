import { NextRequest, NextResponse } from "next/server";
import { runLiveSparql, liveVal } from "@/lib/wikidata-live";
import { fetchWikiSummary } from "@/lib/wikipedia";

type EvolutionRow = {
  iri: string;
  label: string;
  startYear: null;
  endYear: null;
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
  economicsMode: "branch";
  items: EvolutionRow[];
  yearRange: { min: number; max: number; step: number };
};

type MappedRow = {
  iri: string;
  label: string;
  description: string | undefined;
  articleUrl: string | undefined;
};

const ECONOMICS_IRI = "http://www.wikidata.org/entity/Q8134";
const BRANCH_OF_ECONOMICS_IRI = "http://www.wikidata.org/entity/Q127601778";

async function attachWikiSummaries(rows: MappedRow[]): Promise<EvolutionRow[]> {
  return Promise.all(
    rows.map(async (row, index) => {
      const wikiSummary =
        index < 12 && row.articleUrl
          ? await Promise.race([
              fetchWikiSummary(row.articleUrl),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_500)),
            ])
          : null;
      return {
        iri: row.iri,
        label: row.label,
        startYear: null,
        endYear: null,
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
SELECT ?branch ?label ?description ?articleUrl WHERE {
  ?branch wdt:P31 <${BRANCH_OF_ECONOMICS_IRI}> .
  ?branch rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  OPTIONAL { ?branch schema:description ?description . FILTER(LANG(?description) = "en") }
  OPTIONAL {
    ?articleUrl schema:about ?branch ;
                schema:inLanguage "en" ;
                schema:isPartOf <https://en.wikipedia.org/> .
  }
}
ORDER BY ?label
LIMIT ${limit}`.trim();

    const rows = await runLiveSparql(query, 25_000);
    const mapped = rows
      .map((b) => {
        const iri = liveVal(b, "branch");
        const label = liveVal(b, "label");
        if (!iri || !label) return null;
        return { iri, label, description: liveVal(b, "description"), articleUrl: liveVal(b, "articleUrl") };
      })
      .filter((x): x is MappedRow => x !== null);

    const response: EvolutionResponse = {
      discipline: { iri: ECONOMICS_IRI, label: "economics" },
      disciplineValid: true,
      schoolType: { iri: BRANCH_OF_ECONOMICS_IRI, label: "branch of economics" },
      linkProperty: { code: "P31", label: "instance of" },
      economicsMode: "branch",
      items: await attachWikiSummaries(mapped),
      yearRange: { min: 0, max: 0, step: 1 },
    };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
    });
  } catch (err) {
    const msg = toWikidataBusyMessage(err);
    return NextResponse.json({ error: msg ?? "Failed to fetch economics branches" }, { status: msg ? 503 : 502 });
  }
}

