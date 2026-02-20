import { NextRequest, NextResponse } from "next/server";
import { fetchLiveTypeMembers } from "@/lib/wikidata-live";

/**
 * GET /api/wikidata/type-members?type=<IRI>&page=1&limit=20
 *
 * Returns paginated members of a Wikidata type from the live Wikidata Query Service.
 * The `source` parameter is accepted but ignored — live is always used.
 */
export async function GET(request: NextRequest) {
  const typeIri = request.nextUrl.searchParams.get("type");
  if (!typeIri) {
    return NextResponse.json({ error: "Missing type parameter" }, { status: 400 });
  }

  const page  = Math.max(1, parseInt(request.nextUrl.searchParams.get("page")  ?? "1",  10) || 1);
  const limit = Math.min(   parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10) || 20, 50);

  try {
    const data = await fetchLiveTypeMembers(typeIri, page, limit);
    return NextResponse.json({ ...data, source: "live" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Live query error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
