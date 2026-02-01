import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

/** CShapes GeoJSON is large; cache parsed data in memory per process. */
let cachedGeoJSON: GeoJSON.FeatureCollection | null = null;

async function getCShapesGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  if (cachedGeoJSON) return cachedGeoJSON;
  const filePath = path.join(
    process.cwd(),
    "app",
    "db",
    "CShapes-2.0.geojson"
  );
  const raw = await readFile(filePath, "utf-8");
  cachedGeoJSON = JSON.parse(raw) as GeoJSON.FeatureCollection;
  return cachedGeoJSON;
}

/**
 * GET /api/cshapes?start=1886&end=1890
 * Returns GeoJSON FeatureCollection of CShapes territories active in the year range.
 * A feature is included if its existence [gwsyear, gweyear] overlaps [start, end].
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const start =
    startParam != null ? parseInt(startParam, 10) : 1886;
  const end = endParam != null ? parseInt(endParam, 10) : 1890;

  if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
    return NextResponse.json(
      { error: "Invalid start/end years" },
      { status: 400 }
    );
  }

  try {
    const full = await getCShapesGeoJSON();
    const features = (full.features ?? []).filter((f) => {
      const p = f.properties as {
        gwsyear?: number;
        gweyear?: number;
      } | null;
      if (!p || p.gwsyear == null || p.gweyear == null) return false;
      return p.gwsyear <= end && p.gweyear >= start;
    });
    const filtered: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features,
    };
    return NextResponse.json(filtered, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load CShapes";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
