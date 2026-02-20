import { NextResponse } from "next/server";
import { CURATED_TYPES } from "@/lib/wikidata-curated-types";

export type { CuratedType } from "@/lib/wikidata-curated-types";

/** GET /api/wikidata/types — returns the curated type list (static, instant). */
export async function GET() {
  return NextResponse.json({ types: CURATED_TYPES });
}
