import { NextRequest, NextResponse } from "next/server";
import { runLiveSparql, liveVal } from "@/lib/wikidata-live";

const SOCIOLOGY_IRI = "http://www.wikidata.org/entity/Q21201";

export async function GET(request: NextRequest) {
  try {
    const limit = Math.max(5, Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "40", 10) || 40, 80));
    const query = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
PREFIX wikibase: <http://wikiba.se/ontology#>
SELECT DISTINCT ?author ?label ?description ?sitelinks WHERE {
  ?author wdt:P31 <http://www.wikidata.org/entity/Q5> .
  {
    ?author wdt:P101 <${SOCIOLOGY_IRI}> .
  } UNION {
    ?author wdt:P101 ?field .
    ?field wdt:P279* <${SOCIOLOGY_IRI}> .
  } UNION {
    ?author wdt:P106 <${SOCIOLOGY_IRI}> .
  } UNION {
    ?author wdt:P106 ?occupation .
    ?occupation wdt:P279* <${SOCIOLOGY_IRI}> .
  }
  ?author rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  OPTIONAL { ?author schema:description ?description . FILTER(LANG(?description) = "en") }
  OPTIONAL { ?author wikibase:sitelinks ?sitelinks }
}
ORDER BY DESC(?sitelinks) ?label
LIMIT ${limit}`.trim();

    const rows = await runLiveSparql(query, 25_000);
    const items = rows
      .map((b) => {
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
      .filter((x): x is { iri: string; label: string; startYear: null; endYear: null; description?: string; wikiSummary: null } => x !== null);

    return NextResponse.json({
      discipline: { iri: SOCIOLOGY_IRI, label: "sociology" },
      disciplineValid: true,
      schoolType: { iri: SOCIOLOGY_IRI, label: "sociology authors" },
      linkProperty: { code: "P101/P106", label: "field of work / occupation" },
      economicsMode: "authors",
      items,
      yearRange: { min: 0, max: 0, step: 1 },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch sociology authors";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

