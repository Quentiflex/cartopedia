import { NextRequest, NextResponse } from "next/server";
import { getWarParticipations } from "@/lib/data";

/**
 * GET /api/war-participants?start=1826&end=1830
 * Returns participants (with coordinates) that took part in at least one war
 * overlapping the given year window.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const startYear = startParam != null ? parseInt(startParam, 10) : 1820;
  const endYear = endParam != null ? parseInt(endParam, 10) : 1830;

  if (Number.isNaN(startYear) || Number.isNaN(endYear) || startYear > endYear) {
    return NextResponse.json(
      { error: "Invalid start/end years" },
      { status: 400 }
    );
  }

  try {
    const result = await getWarParticipations(startYear, endYear);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "SPARQL error";
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
