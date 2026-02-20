import { NextResponse } from "next/server";

/**
 * GET /api/ontology/instances
 *
 * Previously served instances from a local Fuseki dataset.
 * That dataset is no longer used; returns an empty result set.
 */
export async function GET() {
  return NextResponse.json({
    instances: [],
    pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
  });
}
