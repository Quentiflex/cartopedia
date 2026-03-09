import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
});

async function init() {
  const client = await pool.connect();

  try {
    // Ensure PostGIS exists
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS postgis;
    `);

    // Countries table (entity-level)
    await client.query(`
      CREATE TABLE IF NOT EXISTS countries (
        id SERIAL PRIMARY KEY,
        wikidata_id TEXT UNIQUE,
        name TEXT
      );
    `);

    // Historical boundary slices
    await client.query(`
      CREATE TABLE IF NOT EXISTS country_boundaries (
        id BIGSERIAL PRIMARY KEY,
        country_id INTEGER REFERENCES countries(id) ON DELETE CASCADE,
        osm_relation_id BIGINT UNIQUE,
        start_date DATE,
        end_date DATE,
        geom geometry(MultiPolygon, 4326)
      );
    `);

    // Spatial index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_country_boundaries_geom
      ON country_boundaries
      USING GIST (geom);
    `);

    // Time indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_country_boundaries_start
      ON country_boundaries (start_date);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_country_boundaries_end
      ON country_boundaries (end_date);
    `);

    // Optional: index for faster joins
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_country_boundaries_country_id
      ON country_boundaries (country_id);
    `);

    console.log("Database initialized with two-table structure.");
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

init();