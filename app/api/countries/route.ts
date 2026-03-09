import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * GET /api/countries?year=1500
 *
 * Returns a GeoJSON FeatureCollection of all administrative country
 * boundaries at admin_level = 2 that were active in the given year.
 * A boundary is considered active when:
 *   start_date IS NULL  OR  start_date.year <= year
 *   end_date   IS NULL  OR  end_date.year   >= year
 *
 * PostgreSQL's EXTRACT(YEAR FROM date) uses astronomical year numbering
 * (year 0 = 1 BC, year -1 = 2 BC, …).  The app timeline uses the same
 * signed-year convention (0 / negative = BC), so we shift by +1 for any
 * year <= 0 to align with PostgreSQL's internal representation.
 */
export async function GET(request: NextRequest) {
  const yearParam = request.nextUrl.searchParams.get("year");
  const year = yearParam != null ? parseInt(yearParam, 10) : NaN;

  if (Number.isNaN(year)) {
    return NextResponse.json(
      { error: "Missing or invalid year parameter" },
      { status: 400 }
    );
  }

  // Convert app year to PostgreSQL astronomical year (1 BC = year 0 in PostgreSQL).
  const pgYear = year <= 0 ? year + 1 : year;

  try {
    const client = await pool.connect();
    try {
      const result = await client.query<{
        id: number;
        name: string | null;
        wikidata_id: string | null;
        osm_relation_id: number | null;
        start_date: Date | null;
        end_date: Date | null;
        boundary_type: string | null;
        admin_level: number | null;
        place: string | null;
        historic: string | null;
        country_type: string | null;
        tags: Record<string, unknown>;
        geom_json: string;
      }>(
        `
        SELECT
          id,
          name,
          wikidata_id,
          osm_relation_id,
          start_date,
          end_date,
          boundary_type,
          admin_level,
          place,
          historic,
          country_type,
          tags,
          ST_AsGeoJSON(geom_simple) AS geom_json
        FROM country_boundaries
        WHERE
          boundary_type = 'administrative'
          AND admin_level = 2
          AND (start_date IS NULL OR EXTRACT(YEAR FROM start_date) <= $1)
          AND (end_date IS NULL OR EXTRACT(YEAR FROM end_date) >= $1)
        `,
        [pgYear]
      );

      const features: GeoJSON.Feature[] = result.rows.map((row) => ({
        type: "Feature",
        geometry: JSON.parse(row.geom_json) as GeoJSON.Geometry,
        properties: {
          id: row.id,
          name: row.name,
          wikidata_id: row.wikidata_id,
          osm_relation_id: row.osm_relation_id,
          start_date: row.start_date ? row.start_date.toISOString() : null,
          end_date: row.end_date ? row.end_date.toISOString() : null,
          boundary_type: row.boundary_type,
          admin_level: row.admin_level,
          place: row.place,
          historic: row.historic,
          country_type: row.country_type,
          tags: row.tags,
        },
      }));

      const geojson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features,
      };

      return NextResponse.json(geojson, {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate",
        },
      });
    } finally {
      client.release();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
