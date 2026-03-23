import { NextRequest, NextResponse } from "next/server";
import { runLiveSparql, liveVal } from "@/lib/wikidata-live";

export type CategoryAuthorCard = {
  iri: string;
  label: string;
  description?: string;
};

export type CategoryAuthorsResponse = {
  results: CategoryAuthorCard[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

function qidOrIriToWikidataEntityIri(input: string): string | null {
  const trimmed = input.trim();
  if (/^Q\d+$/i.test(trimmed)) return `http://www.wikidata.org/entity/${trimmed.toUpperCase()}`;
  const normalized = trimmed.replace(/[<>]/g, "");
  if (/^https?:\/\/www\.wikidata\.org\/entity\/Q\d+$/i.test(normalized)) return normalized;
  return null;
}

export async function GET(request: NextRequest) {
  const categoryRaw = request.nextUrl.searchParams.get("category") ?? "";
  const limitRaw = request.nextUrl.searchParams.get("limit") ?? "18";
  const offsetRaw = request.nextUrl.searchParams.get("offset") ?? "0";

  const categoryIri = qidOrIriToWikidataEntityIri(categoryRaw);
  if (!categoryIri) {
    return NextResponse.json({ error: "Missing/invalid `category`" }, { status: 400 });
  }

  const limit = Math.max(1, Math.min(parseInt(limitRaw, 10) || 18, 50));
  const offset = Math.max(0, parseInt(offsetRaw, 10) || 0);
  const fetchLimit = limit + 1;

  const query = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
PREFIX wikibase: <http://wikiba.se/ontology#>
SELECT DISTINCT ?author ?label ?description ?sitelinks WHERE {
  ?author wdt:P31 <http://www.wikidata.org/entity/Q5> .
  {
    ?author wdt:P101 <${categoryIri}> .
  }
  UNION
  {
    ?author wdt:P101 ?field .
    ?field wdt:P279* <${categoryIri}> .
  }
  UNION
  {
    ?author wdt:P106 <${categoryIri}> .
  }
  UNION
  {
    ?author wdt:P106 ?occupation .
    ?occupation wdt:P279* <${categoryIri}> .
  }
  ?author rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  OPTIONAL { ?author schema:description ?description . FILTER(LANG(?description) = "en") }
  OPTIONAL { ?author wikibase:sitelinks ?sitelinks }
}
ORDER BY DESC(?sitelinks) ?label
LIMIT ${fetchLimit}
OFFSET ${offset}`.trim();

  try {
    const rows = await runLiveSparql(query, 25_000);
    const mapped = rows
      .map((b): CategoryAuthorCard | null => {
        const iri = liveVal(b, "author");
        const label = liveVal(b, "label");
        const description = liveVal(b, "description");
        if (!iri || !label) return null;
        return description ? { iri, label, description } : { iri, label };
      })
      .filter((x): x is CategoryAuthorCard => x !== null);

    const hasMore = mapped.length > limit;
    const results = hasMore ? mapped.slice(0, limit) : mapped;

    return NextResponse.json(
      {
        results,
        pagination: { limit, offset, hasMore },
      } satisfies CategoryAuthorsResponse,
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch category authors";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

