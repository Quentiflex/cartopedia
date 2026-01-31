import { NextRequest, NextResponse } from "next/server";
import { buildWarsQuery, runSparqlSelect } from "@/app/lib/fuseki";
import type { War } from "@/app/types/wars";

/**
 * GET /api/wars?start=1820&end=1850
 * Returns wars overlapping the given year range (for Gantt: label + start/end dates).
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
    const query = buildWarsQuery(startYear, endYear);
    const bindings = await runSparqlSelect(query);

    const wars: War[] = bindings
      .filter(
        (b) =>
          b.war?.value &&
          b.warLabel?.value &&
          b.warStart?.value
      )
      .map((b) => ({
        id: b.war!.value!,
        label: b.warLabel!.value!,
        startDate: b.warStart!.value!,
        endDate: b.warEnd?.value ?? null,
      }));

    return NextResponse.json(wars);
  } catch (err) {
    const message = err instanceof Error ? err.message : "SPARQL error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
