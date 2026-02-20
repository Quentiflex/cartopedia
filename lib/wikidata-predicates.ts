/**
 * Hardcoded mapping from Wikidata property codes (P-numbers) to English labels.
 *
 * Used as a fallback when rdfs:label for a property is not present in the
 * local Fuseki dataset.  The label resolution chain in the entity API is:
 *   1. rdfs:label from Fuseki (via BIND/REPLACE in SPARQL)
 *   2. This mapping
 *   3. Raw local name (P31, etc.)
 *
 * Properties are grouped by semantic category below for maintainability.
 * External-ID and string-type predicates are now excluded at the SPARQL level
 * via wikibase:propertyType filtering, so no blocklist is needed here.
 */

// ── Label map ─────────────────────────────────────────────────────────────────

export const WIKIDATA_PROPERTY_LABELS: Readonly<Record<string, string>> = {
  // Core / Classification
  P31:   "instance of",
  P279:  "subclass of",
  P361:  "part of",
  P527:  "has part",
  P1269: "facet of",
  P460:  "said to be the same as",
  P155:  "follows",
  P156:  "followed by",
  P2341: "indigenous to",
  P1535: "used by",
  P1423: "template has topic",

  // Time
  P580:  "start time",
  P582:  "end time",
  P571:  "inception",
  P576:  "dissolved / abolished",
  P585:  "point in time",
  P569:  "date of birth",
  P570:  "date of death",
  P619:  "time of spacecraft launch",
  P620:  "time of spacecraft landing",
  P729:  "service entry",
  P730:  "service retirement",
  P1619: "date of official opening",
  P2031: "work period (start)",
  P2032: "work period (end)",
  P577:  "publication date",
  P575:  "time of discovery or invention",

  // Geography
  P625:  "coordinate location",
  P276:  "location",
  P17:   "country",
  P131:  "located in",
  P30:   "continent",
  P36:   "capital",
  P1376: "capital of",
  P37:   "official language",
  P706:  "located on terrain feature",
  P421:  "time zone",
  P206:  "located next to body of water",
  P150:  "contains administrative division",
  P190:  "twinned with",
  P47:   "shares border with",
  P669:  "located on street",
  P281:  "postal code",
  P856:  "official website",
  P18:   "image",
  P41:   "flag image",
  P94:   "coat of arms image",
  P242:  "locator map image",
  P1765: "sea area",
  P403:  "mouth of the watercourse",
  P200:  "inflows",
  P201:  "lake outflow",
  P974:  "tributary",
  P2044: "elevation above sea level",
  P2046: "area",
  P2047: "duration",
  P2048: "height",
  P2049: "width",
  P2050: "wingspan",

  // Conflicts & Military
  P607:  "conflict",
  P710:  "participant",
  P1120: "number of deaths",
  P1121: "number of injured",
  P1139: "soldiers killed",
  P1138: "civilians killed",
  P1148: "number of wounded",
  P88:   "commissioned by",
  P747:  "has edition",
  P1889: "different from",
  P915:  "filming location",
  P880:  "armed forces",
  P750:  "distributed by",
  P127:  "owned by",
  P941:  "inspired by",
  P559:  "terminus",
  P1427: "starting point",
  P1444: "destination point",

  // People
  P19:   "place of birth",
  P20:   "place of death",
  P21:   "sex or gender",
  P22:   "father",
  P25:   "mother",
  P26:   "spouse",
  P27:   "country of citizenship",
  P40:   "child",
  P102:  "member of political party",
  P103:  "native language",
  P106:  "occupation",
  P108:  "employer",
  P119:  "place of burial",
  P734:  "family name",
  P735:  "given name",
  P39:   "position held",
  P69:   "educated at",
  P1412: "languages spoken or written",
  P166:  "award received",
  P101:  "field of work",
  P135:  "movement",
  P140:  "religion or worldview",
  P172:  "ethnic group",
  P1066: "student of",
  P185:  "doctoral student",
  P184:  "doctoral advisor",
  P463:  "member of",
  P1344: "participant in",
  P551:  "residence",
  P937:  "work location",

  // Organizations & States
  P112:  "founded by",
  P749:  "parent organization",
  P159:  "headquarters location",
  P169:  "chief executive officer",
  P488:  "chairperson",
  P35:   "head of state",
  P6:    "head of government",
  P122:  "basic form of government",
  P194:  "legislative body",
  P208:  "executive body",
  P209:  "highest judicial authority",
  P1313: "office held by head of government",
  P1906: "office held by head of state",
  P1365: "replaces",
  P1366: "replaced by",
  P199:  "business division",
  P355:  "subsidiary",
  P414:  "stock exchange",
  P452:  "industry",
  P1056: "product or material produced",
  P1128: "number of employees",
  P2769: "budget",

  // Works & Culture
  P50:   "author",
  P57:   "director",
  P58:   "screenwriter",
  P161:  "cast member",
  P162:  "producer",
  P170:  "creator",
  P175:  "performer",
  P176:  "manufacturer",
  P178:  "developer",
  P179:  "series",
  P180:  "depicts",
  P186:  "material used",
  P123:  "publisher",
  P407:  "language of work",
  P136:  "genre",
  P364:  "original language",
  P495:  "country of origin",
  P348:  "software version",
  P953:  "full text available at",
  P144:  "based on",
  P737:  "influenced by",
  P1877: "after a work by",
  P1104: "number of pages",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract the P-code from any Wikidata predicate IRI, e.g. "P31". */
export function extractPCode(iri: string): string {
  return iri.split(/[/#]/).pop() ?? iri;
}

/**
 * Resolve a human-readable label for a predicate IRI.
 * Returns the Fuseki label if provided, else looks up the hardcoded map,
 * else falls back to the raw local name.
 */
export function resolvePredicateLabel(iri: string, fusekiLabel?: string): string {
  if (fusekiLabel) return fusekiLabel;
  const code = extractPCode(iri);
  return WIKIDATA_PROPERTY_LABELS[code] ?? code;
}
