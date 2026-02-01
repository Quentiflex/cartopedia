# Scripts — 3-layer RDF pipeline

A gold-standard pipeline for ingesting Wikidata and transforming it into our ontology.

## Mental model

```
Wikidata (source)
   ↓  SPARQL CONSTRUCT
Staging / Canonical RDF (still Wikidata semantics)
   ↓  Explicit mapping rules
Our ontology + app DB (opinionated, stable)
```

## Pipeline steps

| Script | Layer | What it does |
|--------|-------|--------------|
| **1-ingest-wikidata** | 1 | Fetches wars from Wikidata via SPARQL CONSTRUCT. Stores raw RDF with `wdt:`, `wd:`, `p:`, `ps:` predicates. No conversion. |
| **2-transform-to-ontology** | 2 | Applies mapping rules (see `mapping-rules.js`) to convert staging → our ontology (`ex:War`, `ex:Entity`, etc.) |
| **3-upload-to-fuseki** | 3 | Uploads ontology schema + transformed data to Fuseki. Optionally uploads staging for provenance. |
| **4-verify-fuseki** | — | Runs a SPARQL query to list wars and confirm data is loaded. |

## How to run

```bash
node scripts/1-ingest-wikidata.js
node scripts/2-transform-to-ontology.js
node scripts/3-upload-to-fuseki.js
node scripts/4-verify-fuseki.js
```

Or:

```bash
npm run scripts:ingest
npm run scripts:transform
npm run scripts:upload-fuseki
npm run scripts:verify-fuseki
```

## Why this structure?

- **Layer 1 (Staging)**: Preserves provenance, original Q-IDs and P-IDs. You can re-interpret later without re-fetching.
- **Layer 2 (Mapping rules)**: Declarative, reproducible, versionable. All conversions live in `mapping-rules.js`.
- **Layer 3 (App DB)**: Your app queries the ontology; the pipeline keeps it fed.

## Optional: upload staging to Fuseki

To keep raw Wikidata in Fuseki for debugging or provenance:

```bash
UPLOAD_STAGING=1 node scripts/3-upload-to-fuseki.js
```

## Legacy script

`1-fetch-wikidata-wars.js` (old) — Fetched and converted in one step. Kept for reference; use the new pipeline instead.

## Requirements

- Fuseki at `http://127.0.0.1:3030/history/` (e.g. Docker) for upload and verify.
- Node 18+.
