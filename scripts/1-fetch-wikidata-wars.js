/**
 * Step 1 — Get wars and participating countries from Wikidata, write to imports.ttl
 *
 * What this script does:
 * 1. Sends a SPARQL query to the public Wikidata Query Service.
 * 2. Asks for the first 50 wars (start >= 1826-01-01) and their participants (P710).
 * 3. Converts each war into our ontology format (ex:War, dates, ex:hasParticipant).
 * 4. Converts each participant (country/state) into ex:Entity with label and owl:sameAs.
 * 5. Writes app/db/imports/imports.ttl (Turtle) for use with Fuseki.
 * 6. Saves raw JSON and prints a summary.
 *
 * No credentials needed for Wikidata. We only read public data.
 */

const fs = require("fs");
const path = require("path");

const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";
const OUTPUT_DIR = "scripts/output";
const IMPORTS_TTL_PATH = path.join(process.cwd(), "app", "db", "imports", "imports.ttl");

// Query 1: 50 wars + participants (P710) — kept light to avoid timeout
const SPARQL_WARS_AND_PARTICIPANTS = `
SELECT ?war ?warLabel ?start ?end ?participant ?participantLabel WHERE {
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
    bd:serviceParam wikibase:language "en".
  }
}
ORDER BY ?start
`.trim();

/** Build query 2: coordinates (P625) for a set of participant IRIs via VALUES. */
function buildCoordinatesQuery(participantIris) {
  if (participantIris.length === 0) return null;
  const values = participantIris.map((iri) => `<${iri}>`).join(" ");
  return `
SELECT ?participant ?lat ?lon WHERE {
  VALUES ?participant { ${values} }
  ?participant p:P625/psv:P625 ?coordNode .
  ?coordNode wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon .
}
`.trim();
}

/** Turn a Wikidata datetime into xsd:date ("YYYY-MM-DD"). */
function toDateLiteral(value) {
  if (!value || typeof value !== "string") return null;
  const datePart = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

/** Escape a string for Turtle double-quoted string. */
function escapeTurtleString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

/** Extract Q-id from Wikidata entity IRI. */
function toQId(iri) {
  if (!iri || typeof iri !== "string") return "";
  const id = iri.split("/").pop()?.trim() || "";
  return id.startsWith("Q") ? id : "";
}

/**
 * Group bindings by war; each war has participants; participants may have lat/lon (P625).
 */
function groupByWar(bindings) {
  const warMap = new Map();
  const participantsMap = new Map(); // qId -> { qId, label, lat?, lon? }

  for (const row of bindings) {
    const warIri = row.war?.value ?? "";
    const warQId = toQId(warIri);
    if (!warQId) continue;

    const startRaw = row.start?.value ?? "";
    const start = toDateLiteral(startRaw);
    if (!start) continue;

    if (!warMap.has(warQId)) {
      warMap.set(warQId, {
        qId: warQId,
        label: row.warLabel?.value ?? "Unknown",
        start,
        end: toDateLiteral(row.end?.value ?? null),
        participantQIds: new Set(),
      });
    }
    const warEntry = warMap.get(warQId);

    const partIri = row.participant?.value;
    const partQId = toQId(partIri);
    const latRaw = row.lat?.value;
    const lonRaw = row.lon?.value;
    const lat = latRaw != null ? parseFloat(latRaw) : null;
    const lon = lonRaw != null ? parseFloat(lonRaw) : null;

    if (partQId) {
      warEntry.participantQIds.add(partQId);
      if (!participantsMap.has(partQId)) {
        participantsMap.set(partQId, {
          qId: partQId,
          label: row.participantLabel?.value ?? partQId,
          lat: lat,
          lon: lon,
        });
      } else if ((lat != null && lon != null) && participantsMap.get(partQId).lat == null) {
        participantsMap.get(partQId).lat = lat;
        participantsMap.get(partQId).lon = lon;
      }
    }
  }

  return { wars: Array.from(warMap.values()), participants: Array.from(participantsMap.values()) };
}

/** Turtle lines for one participant (ex:Entity), with ex:latitude/ex:longitude when available. */
function participantToTurtle(p) {
  const localId = `ex:wd_${p.qId}`;
  const wikidataEntity = `http://www.wikidata.org/entity/${p.qId}`;
  const lines = [
    `${localId} a ex:Entity ;`,
    `  rdfs:label "${escapeTurtleString(p.label)}"@en ;`,
  ];
  if (p.lat != null && p.lon != null && !Number.isNaN(p.lat) && !Number.isNaN(p.lon)) {
    lines.push(`  ex:latitude ${p.lat} ;`);
    lines.push(`  ex:longitude ${p.lon} ;`);
  }
  lines.push(`  owl:sameAs <${wikidataEntity}> ;`);
  lines.push(`  dcterms:source <https://www.wikidata.org/> .`);
  return lines.join("\n");
}

/** Turtle lines for one war (including ex:hasParticipant). */
function warToTurtle(w) {
  const localId = `ex:wd_${w.qId}`;
  const wikidataEntity = `http://www.wikidata.org/entity/${w.qId}`;
  const lines = [
    `${localId} a ex:War ;`,
    `  rdfs:label "${escapeTurtleString(w.label)}"@en ;`,
    `  ex:startDate "${w.start}"^^xsd:date ;`,
  ];
  if (w.end) lines.push(`  ex:endDate "${w.end}"^^xsd:date ;`);
  for (const qId of w.participantQIds) {
    lines.push(`  ex:hasParticipant ex:wd_${qId} ;`);
  }
  lines.push(`  owl:sameAs <${wikidataEntity}> ;`);
  lines.push(`  dcterms:source <https://www.wikidata.org/> .`);
  return lines.join("\n");
}

/** Build full Turtle document and write to imports.ttl */
function writeImportsTtl(wars, participants) {
  const prefixBlock = `@prefix ex: <http://example.org/ontology/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

`;

  const participantBlocks = participants.map(participantToTurtle);
  const warBlocks = wars.map(warToTurtle);
  const body = participantBlocks.join("\n\n") + "\n\n" + warBlocks.join("\n\n") + "\n";
  const content = prefixBlock + body;

  fs.mkdirSync(path.dirname(IMPORTS_TTL_PATH), { recursive: true });
  fs.writeFileSync(IMPORTS_TTL_PATH, content, "utf8");
  return { wars: wars.length, participants: participants.length };
}

async function runSparql(query) {
  const response = await fetch(WIKIDATA_SPARQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/sparql-query",
      Accept: "application/sparql-results+json",
      "User-Agent": "Cartopedia/1.0 (learning RDF)",
    },
    body: query,
  });
  if (!response.ok) {
    throw new Error(`Wikidata returned ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
  return data.results?.bindings ?? [];
}

async function main() {
  console.log("Fetching wars and participants from Wikidata (first 50 wars)...\n");
  console.log("Query 1: wars (start >= 1826-01-01, LIMIT 50) + participants (P710).");
  console.log("Endpoint:", WIKIDATA_SPARQL, "\n");

  const bindings = await runSparql(SPARQL_WARS_AND_PARTICIPANTS);

  if (bindings.length === 0) {
    console.log("No results returned.");
    return;
  }

  let { wars, participants } = groupByWar(bindings);

  // Query 2: coordinates (P625) for participants
  const participantIris = participants.map((p) => `http://www.wikidata.org/entity/${p.qId}`);
  const coordsQuery = buildCoordinatesQuery(participantIris);
  if (coordsQuery) {
    console.log("Fetching coordinates (P625) for", participantIris.length, "participants...\n");
    const coordsBindings = await runSparql(coordsQuery);
    const coordsByQId = new Map();
    for (const row of coordsBindings) {
      const qId = toQId(row.participant?.value ?? "");
      if (!qId) continue;
      const lat = parseFloat(row.lat?.value);
      const lon = parseFloat(row.lon?.value);
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) coordsByQId.set(qId, { lat, lon });
    }
    participants = participants.map((p) => {
      const c = coordsByQId.get(p.qId);
      return c ? { ...p, lat: c.lat, lon: c.lon } : p;
    });
  }

  const withCoords = participants.filter((p) => p.lat != null && p.lon != null).length;
  const { wars: numWars, participants: numParticipants } = writeImportsTtl(wars, participants);

  console.log("Converted to ontology format and wrote:");
  console.log(" ", numWars, "wars and", numParticipants, "participants (countries/entities)");
  console.log(" ", withCoords, "participants with coordinates (ex:latitude, ex:longitude) for mapping");
  console.log(" to:", IMPORTS_TTL_PATH);
  console.log("");

  // Summary: first 10 wars with their participants
  console.log("Summary (first 10 wars with participants):");
  console.log("─".repeat(80));
  wars.slice(0, 10).forEach((w, i) => {
    const partList = Array.from(w.participantQIds);
    const partLabels = partList
      .map((qId) => participants.find((p) => p.qId === qId)?.label ?? qId)
      .join(", ");
    console.log(`${i + 1}. ${w.label}`);
    console.log(`   Start: ${w.start}  |  End: ${w.end ?? "—"}`);
    console.log(`   Participants: ${partList.length ? partLabels : "(none)"}`);
    console.log("─".repeat(80));
  });
  if (wars.length > 10) {
    console.log("... and", wars.length - 10, "more wars (see imports.ttl).");
  }

  const outPath = path.join(process.cwd(), OUTPUT_DIR, "wikidata-wars.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify({ results: { bindings }, participantsWithCoords: withCoords }, null, 2),
    "utf8"
  );
  console.log("\nRaw response saved to:", outPath);
  console.log("\nDone. Run script 2 (upload-to-fuseki) to send imports.ttl to Fuseki.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
