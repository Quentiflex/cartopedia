import { NextResponse } from "next/server";

/**
 * GET /api/wars?start=...&end=...
 *
 * Previously served war data from a local Fuseki dataset.
 * That dataset is no longer used; returns an empty list.
 * War data for the main map is now provided by the Wikidata overlay
 * (/api/wikidata/map-entities).
 */
export async function GET() {
  return NextResponse.json([]);
}
