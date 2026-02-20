import { NextRequest, NextResponse } from "next/server";
import { searchLive } from "@/lib/wikidata-live";

/**
 * GET /api/wikidata/search?q=<text>&limit=20
 *
 * Searches the live Wikidata Query Service for entities matching a text string.
 * The `source` parameter is accepted but ignored — live is always used.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10) || 20, 50);

  try {
    const results = await searchLive(q, limit);
    return NextResponse.json({ results, source: "live" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Live search error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
