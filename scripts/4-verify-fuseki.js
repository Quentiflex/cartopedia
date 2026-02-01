/**
 * Step 4 — Verify data in Fuseki (list all wars)
 *
 * Sends a SPARQL SELECT to your local Fuseki and lists ex:War instances.
 *
 * Requirements: Fuseki running at http://127.0.0.1:3030/history/ with data loaded.
 * Run scripts 1 → 2 → 3 first.
 */

const FUSEKI_SPARQL_URL = "http://127.0.0.1:3030/history/sparql";
const auth = Buffer.from("admin:admin").toString("base64");

const SPARQL_QUERY = `
PREFIX ex: <http://example.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?war ?label ?start ?end WHERE {
  ?war a ex:War ;
       rdfs:label ?label ;
       ex:startDate ?start .
  OPTIONAL { ?war ex:endDate ?end }
}
ORDER BY ?start
`.trim();

async function main() {
  console.log("Verifying Fuseki — listing all wars...\n");
  console.log("Endpoint:", FUSEKI_SPARQL_URL);
  console.log("Query: SELECT ?war ?label ?start ?end WHERE { ?war a ex:War ; ... }\n");

  const response = await fetch(FUSEKI_SPARQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/sparql-query",
      Accept: "application/sparql-results+json",
      Authorization: `Basic ${auth}`,
    },
    body: SPARQL_QUERY,
  });

  const text = await response.text();

  if (!response.ok) {
    console.error("Request failed. Status:", response.status, response.statusText);
    console.error("Response:", (text || "(empty)").slice(0, 300));
    process.exit(1);
  }

  const trimmed = text.trim();
  if (trimmed.startsWith("<") || trimmed.startsWith("<?xml")) {
    console.error("Server returned XML instead of JSON.");
    console.error("Fuseki may not be running. Try:");
    console.error("  1. docker run -p 3030:3030 stain/jena-fuseki");
    console.error("  2. Create dataset 'history' at http://127.0.0.1:3030");
    console.error("  3. node scripts/3-upload-to-fuseki.js");
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("Invalid JSON from server:", trimmed.slice(0, 100), "...");
    process.exit(1);
  }

  const bindings = data.results?.bindings ?? [];

  if (bindings.length === 0) {
    console.log("No wars found. Run: node scripts/1-ingest-wikidata.js && node scripts/2-transform-to-ontology.js && node scripts/3-upload-to-fuseki.js");
    return;
  }

  console.log("Wars in your RDF database:\n");
  console.log("─".repeat(70));
  bindings.forEach((row, i) => {
    const label = row.label?.value ?? "(no label)";
    const start = row.start?.value ?? "—";
    const end = row.end?.value ?? "—";
    const warIri = row.war?.value ?? "";
    console.log(`${i + 1}. ${label}`);
    console.log(`   IRI: ${warIri}`);
    console.log(`   Start: ${start}  |  End: ${end}`);
    console.log("─".repeat(70));
  });
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
