import { NextRequest, NextResponse } from "next/server";

const WD_API = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "Cartopedia/1.0 (personal history explorer; https://github.com/cartopedia)";

export type SearchResult = {
  id: string;
  iri: string;
  label: string;
  description?: string;
};

/**
 * GET /api/wikidata/search?q=<query>
 *
 * Proxies to Wikidata's wbsearchentities API and returns up to 10 matching entities.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL(WD_API);
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("search", q);
  url.searchParams.set("language", "en");
  url.searchParams.set("uselang", "en");
  url.searchParams.set("limit", "10");
  url.searchParams.set("format", "json");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return NextResponse.json({ error: `Wikidata API ${res.status}` }, { status: 502 });
    }

    type WdResult = { id: string; label?: string; description?: string };
    const json = await res.json() as { search: WdResult[] };

    const results: SearchResult[] = (json.search ?? []).map((r) => ({
      id: r.id,
      iri: `http://www.wikidata.org/entity/${r.id}`,
      label: r.label ?? r.id,
      description: r.description,
    }));

    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
