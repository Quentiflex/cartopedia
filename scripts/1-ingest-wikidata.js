/**
 * Layer 1 — Ingest Wikidata as raw RDF (staging)
 *
 * Fetches wars and participants from Wikidata and stores them using
 * Wikidata predicates (wdt:, wd:, p:, ps:). No conversion to our ontology.
 *
 * Output: app/db/staging/wikidata_wars_raw.ttl
 *
 * Why this layer?
 * - Preserves provenance (original Q-IDs, P-IDs)
 * - Allows re-interpretation later
 * - You don't lose information you didn't know you needed
 */

const fs = require("fs");
const path = require("path");

const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";
const STAGING_DIR = path.join(process.cwd(), "app", "db", "staging");
const STAGING_FILE = path.join(STAGING_DIR, "wikidata_wars_raw.ttl");

// CONSTRUCT: wars with P31 (instance of), P580 (start), P582 (end), P710 (participant), labels
const CONSTRUCT_WARS = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX bd: <http://www.bigdata.com/rdf#>
PREFIX wikibase: <http://wikiba.se/ontology#>

CONSTRUCT {
  ?war wdt:P31 wd:Q198 .
  ?war wdt:P580 ?start .
  ?war rdfs:label ?warLabel .
  ?war wdt:P710 ?participant .
  ?participant rdfs:label ?participantLabel .
}
WHERE {
  {
    SELECT ?war WHERE {
      ?war wdt:P31/wdt:P279* wd:Q198 .
      ?war wdt:P580 ?start .
      FILTER (?start >= "1826-01-01T00:00:00Z"^^xsd:dateTime)
    }
    ORDER BY ?start
    LIMIT 50
  }
  ?war wdt:P580 ?start .
  OPTIONAL { ?war wdt:P582 ?end . }
  OPTIONAL { ?war wdt:P710 ?participant . }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
    ?war rdfs:label ?warLabel .
    ?participant rdfs:label ?participantLabel .
  }
}
`.trim();

// CONSTRUCT: add end dates (P582) for the same wars as above
const CONSTRUCT_END_DATES = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

CONSTRUCT {
  ?war wdt:P582 ?end .
}
WHERE {
  {
    SELECT ?war WHERE {
      ?war wdt:P31/wdt:P279* wd:Q198 .
      ?war wdt:P580 ?start .
      FILTER (?start >= "1826-01-01T00:00:00Z"^^xsd:dateTime)
    }
    ORDER BY ?start
    LIMIT 50
  }
  ?war wdt:P582 ?end .
}
`.trim();

/** Build CONSTRUCT for coordinates (P625) — preserves Wikidata p:/psv: structure. */
function buildConstructCoords(iris) {
  if (iris.length === 0) return null;
  const values = iris.map((i) => `<${i}>`).join(" ");
  return `
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX psv: <http://www.wikidata.org/prop/statement/value/>
PREFIX wikibase: <http://wikiba.se/ontology#>

CONSTRUCT {
  ?participant p:P625 ?stmt .
  ?stmt psv:P625 ?coordNode .
  ?coordNode wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon .
}
WHERE {
  VALUES ?participant { ${values} }
  ?participant p:P625/psv:P625 ?coordNode .
  ?coordNode wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon .
  BIND(BNODE() AS ?stmt)
}
`.trim();
}

async function runConstruct(query) {
  const response = await fetch(WIKIDATA_SPARQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/sparql-query",
      Accept: "text/turtle",
      "User-Agent": "Cartopedia/1.0 (Wikidata staging ingest)",
    },
    body: query,
  });
  if (!response.ok) {
    throw new Error(`Wikidata returned ${response.status}: ${response.statusText}`);
  }
  return response.text();
}

/** Extract entity IRIs from Turtle content for follow-up queries. */
function extractParticipantIris(ttl) {
  const iris = new Set();
  // Match full IRIs <http://www.wikidata.org/entity/Q123> or prefixed wd:Q123
  const fullRe = /<http:\/\/www\.wikidata\.org\/entity\/(Q\d+)>/g;
  const prefixedRe = /\bwd:(Q\d+)\b/g;
  let m;
  while ((m = fullRe.exec(ttl)) !== null) iris.add(`http://www.wikidata.org/entity/${m[1]}`);
  while ((m = prefixedRe.exec(ttl)) !== null) iris.add(`http://www.wikidata.org/entity/${m[1]}`);
  return Array.from(iris);
}

async function main() {
  console.log("Layer 1 — Ingesting Wikidata as raw RDF (staging)\n");
  console.log("Endpoint:", WIKIDATA_SPARQL);
  console.log("Output:", STAGING_FILE);
  console.log("");

  const parts = [];

  console.log("1. CONSTRUCT: wars + participants + labels...");
  const warsTtl = await runConstruct(CONSTRUCT_WARS);
  parts.push(warsTtl);
  console.log("   OK.\n");

  console.log("2. CONSTRUCT: end dates (P582)...");
  const endDatesTtl = await runConstruct(CONSTRUCT_END_DATES);
  parts.push(endDatesTtl);
  console.log("   OK.\n");

  const participants = extractParticipantIris(warsTtl);
  console.log("3. CONSTRUCT: coordinates (P625) for", participants.length, "participants...");
  const coordsQuery = buildConstructCoords(participants);
  if (coordsQuery) {
    const coordsTtl = await runConstruct(coordsQuery);
    parts.push(coordsTtl);
    console.log("   OK.\n");
  } else {
    console.log("   Skipped (no participants).\n");
  }

  const prefixBlock = `@prefix wd: <http://www.wikidata.org/entity/> .
@prefix wdt: <http://www.wikidata.org/prop/direct/> .
@prefix p: <http://www.wikidata.org/prop/> .
@prefix ps: <http://www.wikidata.org/prop/statement/> .
@prefix psv: <http://www.wikidata.org/prop/statement/value/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix wikibase: <http://wikiba.se/ontology#> .

`;
  const combined = prefixBlock + parts.join("\n\n");

  fs.mkdirSync(STAGING_DIR, { recursive: true });
  fs.writeFileSync(STAGING_FILE, combined, "utf8");

  console.log("Staging RDF written to:", STAGING_FILE);
  console.log("(Wikidata semantics preserved — run script 2 to transform to our ontology)\n");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
