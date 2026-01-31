# Scripts — step-by-step RDF pipeline

Run these in order when you want to refresh or understand the flow. No need to remember curl commands.

| Script | What it does |
|--------|--------------|
| **1-fetch-wikidata-wars** | Queries Wikidata for wars (read-only). Shows results in the console and saves JSON. |
| **2-upload-to-fuseki** | Uploads the Turtle file(s) from `app/db/imports/` into your local Fuseki. |
| **3-verify-fuseki** | Runs a SPARQL query on Fuseki to list all wars and prints the result. |

**How to run**

From the project root:

```bash
node scripts/1-fetch-wikidata-wars.js
node scripts/2-upload-to-fuseki.js
node scripts/3-verify-fuseki.js
```

Or use the npm scripts (see `package.json`):

```bash
npm run scripts:fetch-wikidata
npm run scripts:upload-fuseki
npm run scripts:verify-fuseki
```

**Requirements**

- Fuseki running at `http://127.0.0.1:3030/history/` (e.g. via Docker) for upload and verify.
- Node 18+ (for `fetch`).
