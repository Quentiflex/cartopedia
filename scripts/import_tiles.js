import fs from "fs";
import path from "path";
import pkg from "pg";
import dotenv from "dotenv";
import osmtogeojson from "osmtogeojson";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
});

const TILE_DIR = "./ohm_tiles";

/* =========================
   DATE NORMALIZER
========================= */

function normalizeDate(value) {
  if (!value) return null;

  const isBC = value.startsWith("-");
  const raw = isBC ? value.slice(1) : value;

  const yearMatch = raw.match(/^(\d{4})/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1], 10);

  if (isBC && year > 4713) return null;

  if (/^\d{4}$/.test(raw)) {
    const date = `${raw}-01-01`;
    return isBC ? `${date} BC` : date;
  }

  if (/^\d{4}-\d{2}$/.test(raw)) {
    const date = `${raw}-01`;
    return isBC ? `${date} BC` : date;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return isBC ? `${raw} BC` : raw;
  }

  return null;
}

/* =========================
   OSM ID PARSER
   osmtogeojson sets feature IDs as "relation/12345" – strip the prefix.
========================= */

function parseOsmId(id) {
  if (id == null) return null;
  const str = String(id);
  const numeric = str.includes("/") ? str.split("/").pop() : str;
  const n = parseInt(numeric, 10);
  return Number.isNaN(n) ? null : n;
}

/* =========================
   IMPORT FILE
========================= */

async function importFile(filePath) {
  console.log(`\nProcessing ${path.basename(filePath)}`);

  const raw = fs.readFileSync(filePath, "utf-8");
  const osmJson = JSON.parse(raw);

  // Build a lookup of raw OSM tags keyed by relation id.
  // osmtogeojson can produce features with incomplete/missing properties
  // (e.g. for skeleton members), so we always prefer the authoritative tags
  // that come directly from the OSM JSON relation elements.
  const relationTagsById = new Map();
  for (const el of osmJson.elements ?? []) {
    if (el.type === "relation" && el.tags) {
      relationTagsById.set(el.id, el.tags);
    }
  }

  const geojson = osmtogeojson(osmJson);

  const client = await pool.connect();

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  try {
    await client.query("BEGIN");

    for (const feature of geojson.features) {
      if (!feature.geometry) {
        skipped++;
        continue;
      }

      // Only store polygon-like features (country boundaries are areas)
      const gtype = feature.geometry.type;
      if (gtype !== "Polygon" && gtype !== "MultiPolygon") {
        skipped++;
        continue;
      }

      const osmId = parseOsmId(feature.id);
      if (!osmId) {
        skipped++;
        continue;
      }

      // Prefer raw OSM relation tags (always complete) over osmtogeojson props
      const rawTags = relationTagsById.get(osmId);
      if (!rawTags) {
        // Not a relation (e.g. a closed way that became a Polygon) — skip;
        // we only want named boundary relations, not individual member ways.
        skipped++;
        continue;
      }

      const wikidataId = rawTags.wikidata || null;
      const name = rawTags["name:en"] || rawTags.name || null;
      const boundaryType = rawTags.boundary || null;
      const adminLevel = rawTags.admin_level ? parseInt(rawTags.admin_level, 10) : null;
      const place = rawTags.place || null;
      const historic = rawTags.historic || null;
      const countryType = rawTags.country || null;
      const startDate = normalizeDate(rawTags.start_date);
      const endDate = normalizeDate(rawTags.end_date);

      // Normalize to MultiPolygon for consistent geom column type
      let geometry = feature.geometry;
      if (geometry.type === "Polygon") {
        geometry = {
          type: "MultiPolygon",
          coordinates: [geometry.coordinates],
        };
      }

      try {
        await client.query(
          `
          INSERT INTO country_boundaries (
            country_id,
            osm_relation_id,
            boundary_type,
            admin_level,
            place,
            historic,
            country_type,
            start_date,
            end_date,
            geom,
            wikidata_id,
            name,
            tags
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            ST_SetSRID(ST_GeomFromGeoJSON($10), 4326),
            $11, $12, $13
          )
          ON CONFLICT (osm_relation_id) DO UPDATE SET
            boundary_type  = EXCLUDED.boundary_type,
            admin_level    = EXCLUDED.admin_level,
            place          = EXCLUDED.place,
            historic       = EXCLUDED.historic,
            country_type   = EXCLUDED.country_type,
            start_date     = EXCLUDED.start_date,
            end_date       = EXCLUDED.end_date,
            geom           = EXCLUDED.geom,
            wikidata_id    = EXCLUDED.wikidata_id,
            name           = EXCLUDED.name,
            tags           = EXCLUDED.tags;
          `,
          [
            null,                   // country_id – nullable grouping key, populated separately
            osmId,
            boundaryType,
            adminLevel,
            place,
            historic,
            countryType,
            startDate,
            endDate,
            JSON.stringify(geometry),
            wikidataId,
            name,
            JSON.stringify(rawTags),
          ]
        );
        inserted++;
      } catch (rowErr) {
        console.error(`  Row error (osm_id=${osmId}): ${rowErr.message}`);
        errors++;
      }
    }

    await client.query("COMMIT");
    console.log(
      `  Done: ${inserted} inserted, ${skipped} skipped (no geom / non-polygon), ${errors} errors`
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`  Fatal error importing ${filePath}:`, err.message);
  } finally {
    client.release();
  }
}

/* =========================
   MAIN
========================= */

async function main() {
  const files = fs.readdirSync(TILE_DIR).filter((f) => f.endsWith(".json"));

  console.log(`Found ${files.length} tile file(s) in ${TILE_DIR}`);

  for (const file of files) {
    const filePath = path.join(TILE_DIR, file);
    await importFile(filePath);
  }

  await pool.end();
  console.log("\nAll tiles imported.");
}

main();
