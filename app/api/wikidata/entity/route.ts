import { NextRequest, NextResponse } from "next/server";
import { fetchLiveEntity } from "@/lib/wikidata-live";

/**
 * GET /api/wikidata/entity?iri=<IRI>
 *
 * Returns entity details from the live Wikidata Query Service.
 * The `source` parameter is accepted but ignored — live is always used.
 */
export async function GET(request: NextRequest) {
  const iri = request.nextUrl.searchParams.get("iri");
  if (!iri) {
    return NextResponse.json({ error: "Missing iri parameter" }, { status: 400 });
  }

  const safeIri = iri.replace(/[<>]/g, "");

  try {
    const live = await fetchLiveEntity(safeIri);
    if (!live) {
      return NextResponse.json({ error: "Entity not found in Wikidata." }, { status: 404 });
    }
    return NextResponse.json(
      { iri: safeIri, source: "live", ...live },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Live Wikidata error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
