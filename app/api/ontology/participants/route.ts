import { NextResponse } from "next/server";

/**
 * GET /api/ontology/participants
 *
 * Previously served participant data from a local Fuseki dataset.
 * That dataset is no longer used; returns an empty list.
 */
export async function GET() {
  return NextResponse.json([]);
}
