/**
 * Explicit mapping rules: Wikidata semantics → our ontology
 *
 * This is the declarative layer between staging (raw Wikidata) and the app DB.
 * All mappings live here — no ad-hoc conversion scattered in code.
 *
 * | Wikidata                     | Our ontology          |
 * |------------------------------|------------------------|
 * | wdt:P31 → wd:Q198 (war)      | rdf:type → ex:War     |
 * | p:P580 / ps:P580             | ex:startDate          |
 * | p:P582 / ps:P582             | ex:endDate            |
 * | wdt:P710                     | ex:hasParticipant     |
 * | wdt:P625 / p:P625 geo node   | ex:latitude, ex:longitude |
 * | rdfs:label                   | rdfs:label (keep)     |
 * | entity IRI                   | owl:sameAs (provenance) |
 */

const WD = "http://www.wikidata.org/entity/";
const WDT = "http://www.wikidata.org/prop/direct/";
const P = "http://www.wikidata.org/prop/";
const PS = "http://www.wikidata.org/prop/statement/";
const PSV = "http://www.wikidata.org/prop/statement/value/";
const WIKIBASE = "http://wikiba.se/ontology#";
const EX = "http://example.org/ontology/";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const OWL = "http://www.w3.org/2002/07/owl#";
const XSD = "http://www.w3.org/2001/XMLSchema#";
const DCTERMS = "http://purl.org/dc/terms/";

/** Wikidata predicate → our predicate (for direct properties) */
const PROPERTY_MAP = {
  [WDT + "P580"]: EX + "startDate", // start time
  [WDT + "P582"]: EX + "endDate",   // end time
  [WDT + "P710"]: EX + "hasParticipant",
};

/** Wikidata class Q-ID → our class */
const CLASS_MAP = {
  [WD + "Q198"]: EX + "War", // instance of (armed conflict)
};

/** Our ontology namespace for local IDs */
function toLocalId(wikidataIri) {
  const qId = wikidataIri.replace(WD, "").replace(/^.*\/(Q\d+)$/, "$1");
  return EX + "wd_" + qId;
}

module.exports = {
  WD,
  WDT,
  P,
  PS,
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
};
