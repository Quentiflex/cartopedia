import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

/** In-memory cache: year -> { populationsByIso, populationsByEntity } */
type Cached = { byIso: Record<string, number>; byEntity: Record<string, number> };
const cache = new Map<number, Cached>();

/** Parse CSV line handling quoted fields (header has "Population, total") */
function parseLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === "," && !inQuotes) || (c === "\r" || c === "\n")) {
      out.push(current.trim());
      if (c !== ",") break;
      current = "";
    } else {
      current += c;
    }
  }
  if (current.length > 0) out.push(current.trim());
  return out;
}

async function loadPopulationByYear(year: number): Promise<Cached> {
  if (cache.has(year)) return cache.get(year)!;
  const filePath = path.join(
    process.cwd(),
    "population-with-un-projections.csv"
  );
  const raw = await readFile(filePath, "utf-8");
  const lines = raw.split(/\n/).filter((l) => l.trim());
  const byIso: Record<string, number> = {};
  const byEntity: Record<string, number> = {};
  for (let i = 1; i < lines.length; i++) {
    const parts = parseLine(lines[i]);
    if (parts.length < 4) continue;
    const entity = parts[0].trim();
    const code = parts[1].trim();
    const rowYear = parseInt(parts[2], 10);
    if (Number.isNaN(rowYear) || rowYear !== year) continue;
    const popTotal = parts[3].replace(/\s/g, "");
    const popProj = parts[4]?.replace(/\s/g, "") ?? "";
    const pop =
      popTotal !== "" ? parseInt(popTotal, 10) : parseInt(popProj, 10);
    if (Number.isNaN(pop)) continue;
    byIso[code] = pop;
    byEntity[entity] = pop;
  }
  const result = { byIso, byEntity };
  cache.set(year, result);
  return result;
}

/**
 * GET /api/population?year=1950
 * Returns { year, byIso: { [iso3]: number }, byEntity: { [entityName]: number } }.
 * Uses "Population, total" when available, else "Population, medium projection".
 */
export async function GET(request: NextRequest) {
  const yearParam = request.nextUrl.searchParams.get("year");
  const year =
    yearParam != null ? parseInt(yearParam, 10) : new Date().getFullYear();
  if (Number.isNaN(year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  try {
    const { byIso, byEntity } = await loadPopulationByYear(year);
    return NextResponse.json(
      { year, byIso, byEntity },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate",
        },
      }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load population data";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
