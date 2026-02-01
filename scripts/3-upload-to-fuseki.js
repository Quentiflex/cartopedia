/**
 * Layer 3 — Upload RDF into Fuseki
 *
 * 1. Uploads the ontology (schema) so the store has classes/properties.
 * 2. Uploads the transformed data (imports.ttl) — our ontology format.
 * 3. Optionally uploads staging (raw Wikidata) to named graph for provenance/debug.
 *
 * Requirements: Fuseki running at http://127.0.0.1:3030/history/
 *
 * Run after 2-transform-to-ontology.js
 */

const fs = require("fs");
const path = require("path");

const FUSEKI_DATA_URL = "http://127.0.0.1:3030/history/data";
const FUSEKI_STAGING_GRAPH = "http://127.0.0.1:3030/history/data?graph=urn:cartopedia:staging:wikidata";
const AUTH = Buffer.from("admin:admin").toString("base64");
const ONTOLOGY_PATH = path.join(process.cwd(), "app", "db", "schema", "ontology.ttl");
const IMPORTS_PATH = path.join(process.cwd(), "app", "db", "imports", "imports.ttl");
const STAGING_PATH = path.join(process.cwd(), "app", "db", "staging", "wikidata_wars_raw.ttl");

const UPLOAD_STAGING = process.env.UPLOAD_STAGING === "1";

async function postTurtle(url, body, label) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/turtle",
      Authorization: `Basic ${AUTH}`,
    },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${label}: ${response.status} ${response.statusText} — ${text || "(empty)"}`);
  }
  return response.text();
}

async function main() {
  console.log("Layer 3 — Uploading RDF to Fuseki...\n");
  console.log("Endpoint:", FUSEKI_DATA_URL);
  console.log("Auth: admin (basic auth)\n");

  if (fs.existsSync(ONTOLOGY_PATH)) {
    console.log("1. Ontology:", ONTOLOGY_PATH);
    const ontology = fs.readFileSync(ONTOLOGY_PATH, "utf8");
    await postTurtle(FUSEKI_DATA_URL, ontology, "Ontology upload");
    console.log("   OK.\n");
  } else {
    console.log("1. Ontology: skipped (file not found).\n");
  }

  if (!fs.existsSync(IMPORTS_PATH)) {
    console.error("Error: Transformed data not found:", IMPORTS_PATH);
    console.error("Run 2-transform-to-ontology.js first.");
    process.exit(1);
  }

  console.log("2. Data (our ontology):", IMPORTS_PATH);
  const ttl = fs.readFileSync(IMPORTS_PATH, "utf8");
  await postTurtle(FUSEKI_DATA_URL, ttl, "Data upload");
  console.log("   OK.\n");

  if (UPLOAD_STAGING && fs.existsSync(STAGING_PATH)) {
    console.log("3. Staging (raw Wikidata, optional):", STAGING_PATH);
    const staging = fs.readFileSync(STAGING_PATH, "utf8");
    await postTurtle(FUSEKI_STAGING_GRAPH, staging, "Staging upload");
    console.log("   OK (named graph).\n");
  } else if (UPLOAD_STAGING && !fs.existsSync(STAGING_PATH)) {
    console.log("3. Staging: skipped (file not found). Set UPLOAD_STAGING=1 to include.\n");
  } else {
    console.log("3. Staging: skipped (set UPLOAD_STAGING=1 to upload raw Wikidata for provenance).\n");
  }

  console.log("Run script 4 (verify-fuseki) to list wars in the database.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
