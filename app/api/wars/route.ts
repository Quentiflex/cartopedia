import { NextRequest, NextResponse } from "next/server";
import { getWars } from "@/lib/data";

/**
 * GET /api/wars?start=1820&end=1850
 * Returns wars overlapping the given year range (for Gantt).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const startYear = startParam != null ? parseInt(startParam, 10) : 1820;
  const endYear = endParam != null ? parseInt(endParam, 10) : 1850;

  if (Number.isNaN(startYear) || Number.isNaN(endYear) || startYear > endYear) {
    return NextResponse.json(
      { error: "Invalid start/end years" },
      { status: 400 }
    );
  }

  try {
    const wars = await getWars(startYear, endYear);
    return NextResponse.json(wars);
  } catch (err) {
    const message = err instanceof Error ? err.message : "SPARQL error";
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
