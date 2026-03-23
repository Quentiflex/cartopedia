import { NextRequest, NextResponse } from "next/server";
import { runLiveSparql, liveVal } from "@/lib/wikidata-live";

type EvolutionRow = {
  iri: string;
  label: string;
  startYear: null;
  endYear: null;
  description?: string;
  wikiSummary?: null;
};

type EvolutionResponse = {
  discipline: { iri: string; label: string };
  disciplineValid: boolean;
  schoolType: { iri: string; label: string };
  linkProperty: { code: string; label: string };
  economicsMode: "authors";
  items: EvolutionRow[];
  yearRange: { min: number; max: number; step: number };
};

const ECONOMICS_IRI = "http://www.wikidata.org/entity/Q8134";

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
PREFIX wikibase: <http://wikiba.se/ontology#>
SELECT DISTINCT ?author ?label ?description ?sitelinks WHERE {
  ?author wdt:P31 <http://www.wikidata.org/entity/Q5> .
  {
    ?author wdt:P101 <${ECONOMICS_IRI}> .
  } UNION {
    ?author wdt:P101 ?field .
    ?field wdt:P279* <${ECONOMICS_IRI}> .
  } UNION {
    ?author wdt:P106 <${ECONOMICS_IRI}> .
  } UNION {
    ?author wdt:P106 ?occupation .
    ?occupation wdt:P279* <${ECONOMICS_IRI}> .
  }
  ?author rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  OPTIONAL { ?author schema:description ?description . FILTER(LANG(?description) = "en") }
  OPTIONAL { ?author wikibase:sitelinks ?sitelinks }
}
ORDER BY DESC(?sitelinks) ?label
LIMIT ${limit}`.trim();

    const rows = await runLiveSparql(query, 25_000);
    const items: EvolutionRow[] = rows
      .map((b): EvolutionRow | null => {
        const iri = liveVal(b, "author");
        const label = liveVal(b, "label");
        if (!iri || !label) return null;
        return {
          iri,
          label,
          startYear: null,
          endYear: null,
          description: liveVal(b, "description") ?? undefined,
          wikiSummary: null,
        };
      })
      .filter((x): x is EvolutionRow => x !== null);

    const response: EvolutionResponse = {
      discipline: { iri: ECONOMICS_IRI, label: "economics" },
      disciplineValid: true,
      schoolType: { iri: ECONOMICS_IRI, label: "economics authors" },
      linkProperty: { code: "P101/P106", label: "field of work / occupation" },
      economicsMode: "authors",
      items,
      yearRange: { min: 0, max: 0, step: 1 },
    };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
    });
  } catch (err) {
    const msg = toWikidataBusyMessage(err);
    return NextResponse.json({ error: msg ?? "Failed to fetch economics authors" }, { status: msg ? 503 : 502 });
  }
}

