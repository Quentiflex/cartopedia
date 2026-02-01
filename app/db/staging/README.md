# Staging Layer — Raw Wikidata RDF

This directory holds the **raw Wikidata semantics** before any transformation.

- **Purpose**: Preserve provenance, allow re-interpretation, never lose source data
- **Format**: Turtle with Wikidata predicates (`wdt:`, `wd:`, `p:`, `ps:`, etc.)
- **Do not** convert to our ontology here — that happens in the transform step
