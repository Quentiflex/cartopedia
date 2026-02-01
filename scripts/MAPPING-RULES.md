# Mapping rules: Wikidata → our ontology

Explicit, declarative mappings between Wikidata semantics and our ontology.  
All rules live in `mapping-rules.js`; this document describes the rationale.

## Property mappings

| Wikidata | Our ontology | Notes |
|----------|--------------|-------|
| `wdt:P31` → `wd:Q198` (instance of war) | `rdf:type` → `ex:War` | Class mapping |
| `wdt:P580` (start time) | `ex:startDate` | Normalized to `xsd:date` |
| `wdt:P582` (end time) | `ex:endDate` | Normalized to `xsd:date` |
| `wdt:P710` (participant) | `ex:hasParticipant` | Entity reference |
| `p:P625` / `psv:P625` (geo node) | `ex:latitude`, `ex:longitude` | Flattened from Wikibase geo |
| `rdfs:label` | `rdfs:label` | Kept as-is |
| entity IRI | `owl:sameAs` | Provenance link to Wikidata |

## Entity IDs

- Local IDs: `ex:wd_Q361`, `ex:wd_Q30` (prefix + Q-id)
- Provenance: `owl:sameAs <http://www.wikidata.org/entity/Q361>`
- Source: `dcterms:source <https://www.wikidata.org/>`

## Adding new mappings

1. Add the Wikidata predicate/class to `mapping-rules.js`
2. Implement the transformation in `2-transform-to-ontology.js`
3. Update this document
