/**
 * Layer 2 — Transform staging RDF into our ontology
 *
 * Applies explicit mapping rules (see mapping-rules.js) to convert
 * raw Wikidata semantics → our ontology (ex:War, ex:Entity, etc.)
 *
 * Input:  app/db/staging/wikidata_wars_raw.ttl
 * Output: app/db/imports/imports.ttl
 *
 * Run after 1-ingest-wikidata.js
 */

const fs = require("fs");
const path = require("path");
const N3 = require("n3");
const {
  WD,
  WDT,
  P,
  PSV,
  WIKIBASE,
  EX,
  RDFS,
  RDF,
  OWL,
  XSD,
  DCTERMS,
  PROPERTY_MAP,
  CLASS_MAP,
  toLocalId,
} = require("./mapping-rules.js");

const STAGING_PATH = path.join(process.cwd(), "app", "db", "staging", "wikidata_wars_raw.ttl");
const IMPORTS_PATH = path.join(process.cwd(), "app", "db", "imports", "imports.ttl");

const WDT_P31 = WDT + "P31";
const WDT_P580 = WDT + "P580";
const WDT_P582 = WDT + "P582";
const WDT_P710 = WDT + "P710";
const P_P625 = P + "P625";
const GEO_LAT = WIKIBASE + "geoLatitude";
const GEO_LON = WIKIBASE + "geoLongitude";
const SOURCE = "https://www.wikidata.org/";

function escapeTurtleString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

/** Parse xsd:dateTime or similar to YYYY-MM-DD */
function toDateLiteral(value) {
  if (!value || typeof value !== "string") return null;
  const datePart = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

async function main() {
  if (!fs.existsSync(STAGING_PATH)) {
    console.error("Staging file not found. Run 1-ingest-wikidata.js first.");
    process.exit(1);
  }

  console.log("Layer 2 — Transform staging → ontology\n");
  console.log("Input:", STAGING_PATH);
  console.log("Output:", IMPORTS_PATH);
  console.log("");

  const parser = new N3.Parser();
  const content = fs.readFileSync(STAGING_PATH, "utf8");
  const quads = parser.parse(content);

  const store = new N3.Store();
  quads.forEach((q) => store.add(q));

  const wars = new Map();       // qId -> { label, start, end, participants }
  const participants = new Map(); // qId -> { label, lat?, lon? }
  const coordNodes = new Map();   // bnode -> { lat, lon }

  for (const q of quads) {
    const { subject, predicate, object } = q;
    const subjId = subject.id || subject.value;
    const predId = predicate.id || predicate.value;
    const objId = object.id || object.value;
    const objVal = object.value;

    if (!subjId.startsWith(WD)) continue;

    const qId = subjId.replace(WD, "").replace(/^.*\/(Q\d+)$/, "$1");
    if (!qId.startsWith("Q")) continue;

    // P31 instance of → check if war (Q198)
    if (predId === WDT_P31 && objId === WD + "Q198") {
      if (!wars.has(qId)) wars.set(qId, { label: null, start: null, end: null, participants: new Set() });
    }

    // P580 start, P582 end
    if (predId === WDT_P580 && objVal) {
      const w = wars.get(qId);
      if (w) w.start = toDateLiteral(objVal);
    }
    if (predId === WDT_P582 && objVal) {
      const w = wars.get(qId);
      if (w) w.end = toDateLiteral(objVal);
    }

    // P710 participant
    if (predId === WDT_P710 && objId.startsWith(WD)) {
      const partQId = objId.replace(WD, "").replace(/^.*\/(Q\d+)$/, "$1");
      if (partQId.startsWith("Q")) {
        const w = wars.get(qId);
        if (w) w.participants.add(partQId);
        if (!participants.has(partQId)) participants.set(partQId, { label: null, lat: null, lon: null });
      }
    }

    // rdfs:label
    if (predId === RDFS + "label" && object.termType === "Literal") {
      const label = object.value;
      if (wars.has(qId)) wars.get(qId).label = label;
      if (participants.has(qId)) participants.get(qId).label = label;
    }
  }

  // P625 coordinates: ?participant p:P625 ?stmt . ?stmt psv:P625 ?coordNode . ?coordNode geoLat/geoLon
  const { DataFactory } = N3;
  const psvP625 = DataFactory.namedNode(PSV + "P625");
  const geoLat = DataFactory.namedNode(GEO_LAT);
  const geoLon = DataFactory.namedNode(GEO_LON);
  for (const q of quads) {
    const predId = (q.predicate.id || q.predicate.value) || "";
    if (predId !== P_P625 || q.object.termType !== "BlankNode") continue;
    const stmtBnode = q.object;
    const subjId = (q.subject.id || q.subject.value) || "";
    if (!subjId.startsWith(WD)) continue;
    const psvQuads = store.getQuads(stmtBnode, psvP625, null, null);
    if (psvQuads.length === 0) continue;
    const coordNode = psvQuads[0].object;
    const latQuads = store.getQuads(coordNode, geoLat, null, null);
    const lonQuads = store.getQuads(coordNode, geoLon, null, null);
    if (!latQuads.length || !lonQuads.length) continue;
    const lat = parseFloat(latQuads[0].object.value);
    const lon = parseFloat(lonQuads[0].object.value);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
    const partQId = subjId.replace(WD, "").replace(/^.*\/(Q\d+)$/, "$1");
    if (partQId.startsWith("Q") && participants.has(partQId)) {
      participants.get(partQId).lat = lat;
      participants.get(partQId).lon = lon;
    }
  }

  // Build Turtle output
  const prefixBlock = `@prefix ex: <http://example.org/ontology/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

`;

  const lines = [];

  // Participants first (entities)
  for (const [qId, p] of participants) {
    const localId = `ex:wd_${qId}`;
    const wikidataEntity = `${WD}${qId}`;
    lines.push(`${localId} a ex:Entity ;`);
    lines.push(`  rdfs:label "${escapeTurtleString(p.label || qId)}"@en ;`);
    if (p.lat != null && p.lon != null) {
      lines.push(`  ex:latitude ${p.lat} ;`);
      lines.push(`  ex:longitude ${p.lon} ;`);
    }
    lines.push(`  owl:sameAs <${wikidataEntity}> ;`);
    lines.push(`  dcterms:source <${SOURCE}> .`);
    lines.push("");
  }

  // Wars
  for (const [qId, w] of wars) {
    if (!w.start) continue; // skip if no start date
    const localId = `ex:wd_${qId}`;
    const wikidataEntity = `${WD}${qId}`;
    lines.push(`${localId} a ex:War ;`);
    lines.push(`  rdfs:label "${escapeTurtleString(w.label || qId)}"@en ;`);
    lines.push(`  ex:startDate "${w.start}"^^xsd:date ;`);
    if (w.end) lines.push(`  ex:endDate "${w.end}"^^xsd:date ;`);
    for (const partQId of w.participants) {
      lines.push(`  ex:hasParticipant ex:wd_${partQId} ;`);
    }
    lines.push(`  owl:sameAs <${wikidataEntity}> ;`);
    lines.push(`  dcterms:source <${SOURCE}> .`);
    lines.push("");
  }

  const body = lines.join("\n");
  const output = prefixBlock + body;

  fs.mkdirSync(path.dirname(IMPORTS_PATH), { recursive: true });
  fs.writeFileSync(IMPORTS_PATH, output, "utf8");

  const numWars = wars.size;
  const numParticipants = participants.size;
  const withCoords = [...participants.values()].filter((p) => p.lat != null && p.lon != null).length;

  console.log("Transformed:");
  console.log(" ", numWars, "wars");
  console.log(" ", numParticipants, "participants");
  console.log(" ", withCoords, "participants with coordinates");
  console.log("\nWritten to:", IMPORTS_PATH);
  console.log("\nRun script 3 (upload-to-fuseki) to load into Fuseki.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
