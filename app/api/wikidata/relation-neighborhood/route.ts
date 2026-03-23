import { NextRequest, NextResponse } from "next/server";
import {
  fetchLiveRelationNeighborhood,
  type RelationNeighborhoodResponse,
} from "@/lib/wikidata-live";

export type { NeighborhoodNode, RelationNeighborhoodResponse } from "@/lib/wikidata-live";

// Keep the API safe + predictable: only accept whitelisted relation codes.
const WHITELISTED_RELATIONS = new Set(["P279", "P31", "P361"]);

function qidOrIriToWikidataEntityIri(input: string): string | null {
  const trimmed = input.trim();
  if (/^Q\d+$/i.test(trimmed)) return `http://www.wikidata.org/entity/${trimmed.toUpperCase()}`;
  const normalized = trimmed.replace(/[<>]/g, "");
  if (/^https?:\/\/www\.wikidata\.org\/entity\/Q\d+$/i.test(normalized)) return normalized;
  return null;
}

export async function GET(request: NextRequest) {
  const rawIri = request.nextUrl.searchParams.get("iri") ?? "";
  const rawRelation = request.nextUrl.searchParams.get("relation") ?? "P279";

  const focusIri = qidOrIriToWikidataEntityIri(rawIri);
  if (!focusIri) {
    return NextResponse.json(
      { error: "Missing/invalid `iri` (expected Q-id or Wikidata entity IRI)" },
      { status: 400 }
    );
  }

  const relationCode = rawRelation.trim().toUpperCase();
  if (!WHITELISTED_RELATIONS.has(relationCode)) {
    return NextResponse.json(
      {
        error: `Unsupported relation '${relationCode}'. Allowed: ${Array.from(WHITELISTED_RELATIONS).join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Caps for performance and to keep UI readable.
  const depthLimit = 25;

  try {
    const data = await fetchLiveRelationNeighborhood({
      focusIri,
      relationCode,
      depthLimit,
    });
    return NextResponse.json(
      data satisfies RelationNeighborhoodResponse,
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neighborhood query error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

