import { NextRequest, NextResponse } from "next/server";
import { runLiveSparql, liveVal } from "@/lib/wikidata-live";

export type AcademicDisciplineCard = {
  iri: string;
  label: string;
  description?: string;
};

export type AcademicDisciplinesResponse = {
  results: AcademicDisciplineCard[];
  pagination: {
    limit: number;
    offset: number;
    total?: number;
  };
};

export async function GET(request: NextRequest) {
  const limitRaw = request.nextUrl.searchParams.get("limit") ?? "120";
  const offsetRaw = request.nextUrl.searchParams.get("offset") ?? "0";
  const limit = Math.max(1, Math.min(parseInt(limitRaw, 10) || 120, 300));
  const offset = Math.max(0, parseInt(offsetRaw, 10) || 0);
  const academicDisciplineTypeIri = "http://www.wikidata.org/entity/Q11862829";

  const [countQuery, dataQuery] = [
    `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
SELECT (COUNT(DISTINCT ?item) AS ?total) WHERE {
  ?item wdt:P31 <${academicDisciplineTypeIri}> .
}`.trim(),
    `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
PREFIX wikibase: <http://wikiba.se/ontology#>
SELECT DISTINCT ?item ?label ?description ?sitelinks WHERE {
  ?item wdt:P31 <${academicDisciplineTypeIri}> .
  ?item rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  OPTIONAL { ?item schema:description ?description . FILTER(LANG(?description) = "en") }
  OPTIONAL { ?item wikibase:sitelinks ?sitelinks }
}
ORDER BY DESC(?sitelinks) ?label
LIMIT ${limit}
OFFSET ${offset}`.trim(),
  ];

  try {
    const [countRows, rows] = await Promise.all([
      runLiveSparql(countQuery, 25_000).catch(() => []),
      runLiveSparql(dataQuery, 25_000),
    ]);
    const results = rows
      .map((b): AcademicDisciplineCard | null => {
      const iri = liveVal(b, "item");
      const label = liveVal(b, "label");
      const description = liveVal(b, "description");
      if (!iri || !label) return null;
      return description ? { iri, label, description } : { iri, label };
      })
      .filter((r): r is AcademicDisciplineCard => r !== null);
    const totalRaw = liveVal(countRows[0] ?? {}, "total");
    const total = totalRaw != null ? parseInt(totalRaw, 10) : undefined;

    return NextResponse.json(
      {
        results,
        pagination: { limit, offset, total: Number.isFinite(total as number) ? total : undefined },
      } satisfies AcademicDisciplinesResponse,
      {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch disciplines";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

