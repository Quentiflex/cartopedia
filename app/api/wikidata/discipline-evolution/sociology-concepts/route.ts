import { NextRequest, NextResponse } from "next/server";
import { runLiveSparql, liveVal } from "@/lib/wikidata-live";
import { fetchWikiSummary } from "@/lib/wikipedia";

const SOCIOLOGY_IRI = "http://www.wikidata.org/entity/Q21201";
const CONCEPT_IRI = "http://www.wikidata.org/entity/Q151885";

async function enrich(rows: Array<{ iri: string; label: string; description?: string; articleUrl?: string }>) {
  return Promise.all(
    rows.map(async (r, i) => {
      const wikiSummary =
        i < 12 && r.articleUrl
          ? await Promise.race([fetchWikiSummary(r.articleUrl), new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_500))])
          : null;
      return { iri: r.iri, label: r.label, startYear: null, endYear: null, description: r.description, wikiSummary };
    })
  );
}

export async function GET(request: NextRequest) {
  try {
    const limit = Math.max(5, Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "40", 10) || 40, 80));
    const query = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
SELECT ?item ?label ?description ?articleUrl WHERE {
  ?item wdt:P31 <${CONCEPT_IRI}> .
  ?item wdt:P361 <${SOCIOLOGY_IRI}> .
  ?item rdfs:label ?label . FILTER(LANG(?label) = "en")
  OPTIONAL { ?item schema:description ?description . FILTER(LANG(?description) = "en") }
  OPTIONAL { ?articleUrl schema:about ?item ; schema:inLanguage "en" ; schema:isPartOf <https://en.wikipedia.org/> . }
}
ORDER BY ?label
LIMIT ${limit}`.trim();
    const rows = await runLiveSparql(query, 30_000);
    const mapped = rows
      .map((b) => {
        const iri = liveVal(b, "item");
        const label = liveVal(b, "label");
        if (!iri || !label) return null;
        return { iri, label, description: liveVal(b, "description") ?? undefined, articleUrl: liveVal(b, "articleUrl") ?? undefined };
      })
      .filter((x): x is { iri: string; label: string; description?: string; articleUrl?: string } => x !== null);

    return NextResponse.json({
      discipline: { iri: SOCIOLOGY_IRI, label: "sociology" },
      disciplineValid: true,
      schoolType: { iri: CONCEPT_IRI, label: "concept" },
      linkProperty: { code: "P361", label: "part of" },
      economicsMode: "concept",
      items: await enrich(mapped),
      yearRange: { min: 0, max: 0, step: 1 },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch sociology concepts";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

