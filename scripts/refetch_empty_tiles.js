import fs from "fs";
import path from "path";

const OVERPASS_URL =
  "https://overpass-api.openhistoricalmap.org/api/interpreter";

const TILE_SIZE = 20;
const OUTPUT_DIR = "./ohm_tiles";

/** Consider a tile "empty" and refetch if file is smaller than this (bytes). */
const MIN_FILE_SIZE = 300;

/** Split failed tiles into this many sub-tiles (4 = 2x2, 8 = 4x2). Try 8 if 4 still fails. */
const SUB_TILE_COUNT = 8;

const TILE_FILENAME_REGEX =
  /^tile_(-?\d+)_(-?\d+)_(-?\d+)_(-?\d+)\.json$/;

function buildQuery(south, west, north, east) {
  return `
[out:json][timeout:600];

(
  relation
    ["boundary"="administrative"]
    ["admin_level"~"^(2|3|4)$"]
    (${south},${west},${north},${east});

  relation
    ["boundary"="political"]
    (${south},${west},${north},${east});

  relation
    ["boundary"="historic"]
    (${south},${west},${north},${east});

  relation
    ["place"~"^(country|empire|kingdom|state|protectorate|colony|confederation|union)$"]
    (${south},${west},${north},${east});

  relation
    ["historic"~"^(country|empire|kingdom|state)$"]
    (${south},${west},${north},${east});
);

out body;
>;
out skel qt;
`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasOverpassError(text) {
  return (
    text.includes("remark") ||
    text.includes("runtime error") ||
    text.includes("timeout")
  );
}

/**
 * Returns { refetch: boolean, reason?: string, size?: number }.
 */
function shouldRefetch(filePath) {
  if (!fs.existsSync(filePath)) return { refetch: false };

  const stat = fs.statSync(filePath);
  if (stat.size < MIN_FILE_SIZE) {
    return { refetch: true, reason: `size ${stat.size} B < ${MIN_FILE_SIZE} B`, size: stat.size };
  }

  try {
    const text = fs.readFileSync(filePath, "utf8");
    if (hasOverpassError(text)) {
      return { refetch: true, reason: "Overpass error in content", size: stat.size };
    }
    const data = JSON.parse(text);
    if (!data || typeof data !== "object") {
      return { refetch: true, reason: "invalid JSON structure", size: stat.size };
    }
    if (!Array.isArray(data.elements)) {
      return { refetch: true, reason: "missing elements array", size: stat.size };
    }
    return { refetch: false };
  } catch {
    return { refetch: true, reason: "corrupt or invalid JSON", size: stat.size };
  }
}

/**
 * Parse tile bounds from filename. Returns null if filename doesn't match.
 */
function parseTileFilename(name) {
  const m = name.match(TILE_FILENAME_REGEX);
  if (!m) return null;
  return {
    south: Number(m[1]),
    west: Number(m[2]),
    north: Number(m[3]),
    east: Number(m[4]),
  };
}

/**
 * Split a bbox into n sub-boxes (4 = 2x2, 8 = 4x2 lat x lon).
 */
function splitBbox(south, west, north, east, n) {
  const subTiles = [];
  const nLat = n === 8 ? 4 : 2;
  const nLon = n === 8 ? 2 : 2;
  const dLat = (north - south) / nLat;
  const dLon = (east - west) / nLon;

  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLon; j++) {
      subTiles.push({
        south: south + i * dLat,
        west: west + j * dLon,
        north: south + (i + 1) * dLat,
        east: west + (j + 1) * dLon,
      });
    }
  }
  return subTiles;
}

/**
 * Merge multiple Overpass JSON results into one (dedupe elements by type+id).
 */
function mergeOverpassResults(results) {
  const seen = new Set();
  const elements = [];

  for (const data of results) {
    if (!data || !Array.isArray(data.elements)) continue;
    for (const el of data.elements) {
      const key = `${el.type}/${el.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      elements.push(el);
    }
  }

  return {
    version: results[0]?.version ?? 0.6,
    generator: results[0]?.generator ?? "refetch_empty_tiles",
    elements,
    osm3s: results[0]?.osm3s ?? {},
  };
}

/**
 * Fetch one bbox and return parsed JSON, or null on failure (no file write).
 */
async function fetchTileRaw(south, west, north, east) {
  const query = buildQuery(south, west, north, east);

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const response = await fetch(OVERPASS_URL, {
        method: "POST",
        body: query,
      });

      const text = await response.text();

      if (!response.ok || hasOverpassError(text)) {
        throw new Error("Overpass returned incomplete response");
      }

      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.elements)) {
        throw new Error("Invalid Overpass response");
      }
      console.log(`    -> ${data.elements.length} elements (${(text.length / 1024).toFixed(1)} KB raw)`);
      await sleep(2000);
      return data;
    } catch (err) {
      console.log(
        `  Attempt ${attempt} failed for sub-tile ${south.toFixed(1)},${west.toFixed(1)}. Retrying...`
      );
      await sleep(5000);
    }
  }
  return null;
}

/**
 * Refetch a tile by splitting into sub-tiles, fetching each, merging, and saving.
 */
async function fetchTileWithSubTiles(south, west, north, east) {
  const filename = path.join(
    OUTPUT_DIR,
    `tile_${south}_${west}_${north}_${east}.json`
  );

  console.log(`Refetching tile ${south},${west},${north},${east} (split into ${SUB_TILE_COUNT} sub-tiles)`);

  const subTiles = splitBbox(south, west, north, east, SUB_TILE_COUNT);
  const results = [];

  for (let i = 0; i < subTiles.length; i++) {
    const { south: s, west: w, north: n, east: e } = subTiles[i];
    console.log(`  Sub-tile ${i + 1}/${subTiles.length}: ${s.toFixed(1)},${w.toFixed(1)} to ${n.toFixed(1)},${e.toFixed(1)}`);
    const data = await fetchTileRaw(s, w, n, e);
    if (data) {
      results.push(data);
    } else {
      console.log(`  Sub-tile ${i + 1} failed permanently.`);
    }
  }

  if (results.length === 0) {
    console.log(`Failed tile permanently (all sub-tiles failed): ${south},${west}`);
    return false;
  }

  const merged = mergeOverpassResults(results);
  const json = JSON.stringify(merged);
  fs.writeFileSync(filename, json);
  const sizeBytes = Buffer.byteLength(json, "utf8");
  const sizeKB = (sizeBytes / 1024).toFixed(1);
  console.log(`  Merged: ${merged.elements.length} elements (after dedupe).`);
  console.log(`  Saved ${path.basename(filename)}: ${sizeBytes} B (${sizeKB} KB)\n`);
  return true;
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.log(`Directory ${OUTPUT_DIR} not found. Nothing to refetch.`);
    return;
  }

  const files = fs.readdirSync(OUTPUT_DIR);
  const toRefetch = [];

  for (const name of files) {
    const bounds = parseTileFilename(name);
    if (!bounds) continue;

    const filePath = path.join(OUTPUT_DIR, name);
    const check = shouldRefetch(filePath);
    if (check.refetch) {
      toRefetch.push({ ...bounds, reason: check.reason, oldSize: check.size });
    }
  }

  if (toRefetch.length === 0) {
    console.log("No empty or invalid tiles to refetch.");
    return;
  }

  console.log(`Found ${toRefetch.length} tile(s) to refetch (using ${SUB_TILE_COUNT} sub-tiles each):`);
  for (const t of toRefetch) {
    const sizeInfo = t.oldSize != null ? `, current size ${t.oldSize} B` : "";
    console.log(`  - tile_${t.south}_${t.west}_${t.north}_${t.east}.json (${t.reason}${sizeInfo})`);
  }
  console.log("");

  let ok = 0;
  let fail = 0;
  for (const t of toRefetch) {
    const success = await fetchTileWithSubTiles(t.south, t.west, t.north, t.east);
    if (success) ok++;
    else fail++;
  }

  console.log("Refetch complete.");
  console.log(`  Succeeded: ${ok} tile(s). Failed: ${fail} tile(s).`);
}

main();
