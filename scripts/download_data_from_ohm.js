import fs from "fs";
import fetch from "node-fetch"; // remove if Node 18+
import path from "path";

const OVERPASS_URL =
  "https://overpass-api.openhistoricalmap.org/api/interpreter";

const TILE_SIZE = 20;
const OUTPUT_DIR = "./ohm_tiles";

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

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

async function fetchTile(south, west, north, east) {
  const filename = path.join(
    OUTPUT_DIR,
    `tile_${south}_${west}_${north}_${east}.json`
  );

  if (fs.existsSync(filename)) {
    console.log(`Skipping existing tile ${filename}`);
    return;
  }

  console.log(`Fetching tile ${south},${west},${north},${east}`);

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

      fs.writeFileSync(filename, text);
      console.log(`Saved ${filename}`);
      await sleep(2000);
      return;

    } catch (err) {
      console.log(
        `Attempt ${attempt} failed for tile ${south},${west}. Retrying...`
      );
      await sleep(5000);
    }
  }

  console.log(`Failed tile permanently: ${south},${west}`);
}

async function main() {
  for (let lat = -90; lat < 90; lat += TILE_SIZE) {
    for (let lon = -180; lon < 180; lon += TILE_SIZE) {
      const south = lat;
      const north = lat + TILE_SIZE;
      const west = lon;
      const east = lon + TILE_SIZE;

      await fetchTile(south, west, north, east);
    }
  }

  console.log("Download complete.");
}

main();