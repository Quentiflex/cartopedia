import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const DATA_FILES = "data_files";

/** In-memory cache: key = `${dataset}-${year}` -> { byIso, byEntity, minValue, maxValue } */
type Cached = {
  byIso: Record<string, number>;
  byEntity: Record<string, number>;
  minValue: number;
  maxValue: number;
};
const cache = new Map<string, Cached>();

function parseLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === "," && !inQuotes) || c === "\r" || c === "\n") {
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

/** Load dataset by id and year. CSV: Entity, Code, Year, <value column>, ... */
async function loadData(dataset: string, year: number): Promise<Cached> {
  const key = `${dataset}-${year}`;
  if (cache.has(key)) return cache.get(key)!;

  const filePath = path.join(process.cwd(), DATA_FILES, dataset, `${dataset}.csv`);
  const raw = await readFile(filePath, "utf-8");
  const lines = raw.split(/\n/).filter((l) => l.trim());
  const byIso: Record<string, number> = {};
  const byEntity: Record<string, number> = {};
  let minValue = Infinity;
  let maxValue = -Infinity;

  for (let i = 1; i < lines.length; i++) {
    const parts = parseLine(lines[i]);
    if (parts.length < 4) continue;
    const entity = parts[0].trim();
    const code = parts[1].trim();
    const rowYear = parseInt(parts[2], 10);
    if (Number.isNaN(rowYear) || rowYear !== year) continue;
    const valueStr = (parts[3] ?? "").replace(/\s/g, "");
    if (valueStr === "") continue;
    const value = parseFloat(valueStr);
    if (Number.isNaN(value)) continue;
    byIso[code] = value;
    byEntity[entity] = value;
    if (value < minValue) minValue = value;
    if (value > maxValue) maxValue = value;
  }

  if (minValue === Infinity) minValue = 0;
  if (maxValue === -Infinity) maxValue = 0;

  const result = { byIso, byEntity, minValue, maxValue };
  cache.set(key, result);
  return result;
}

/**
 * GET /api/owid/data?dataset=population-with-un-projections&year=2000
 * Returns { year, dataset, byIso, byEntity, minValue, maxValue }.
 */
export async function GET(request: NextRequest) {
  const dataset = request.nextUrl.searchParams.get("dataset");
  const yearParam = request.nextUrl.searchParams.get("year");
  if (!dataset?.trim()) {
    return NextResponse.json({ error: "Missing dataset" }, { status: 400 });
  }
  const year = yearParam != null ? parseInt(yearParam, 10) : new Date().getFullYear();
  if (Number.isNaN(year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  try {
    const data = await loadData(dataset, year);
    return NextResponse.json(
      { year, dataset, ...data },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load data";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
