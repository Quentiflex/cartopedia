import { NextResponse } from "next/server";

/**
 * GET /api/ontology/entity?iri=...
 *
 * Previously served entity details from a local Fuseki dataset.
 * That dataset is no longer used; only live Wikidata data is supported.
 * Use /api/wikidata/entity?iri=<wikidata-iri> for Wikidata entities instead.
 */
export async function GET() {
  return NextResponse.json(
    { error: "Local ontology data is not available. Use /api/wikidata/entity for Wikidata entities." },
    { status: 404 }
  );
}
