export type CuratedType = {
  iri: string;
  label: string;
  description: string;
  category: string;
};

/** One distinct color per overlay category, used for both map markers and the legend. */
export const CATEGORY_COLORS: Record<string, string> = {
  "Conflicts & Military":  "#ef4444",
  "States & Polities":     "#3b82f6",
  "Diplomacy & Politics":  "#14b8a6",
  "People":                "#f59e0b",
  "Ideas & Culture":       "#ec4899",
  "Inventions & Science":  "#06b6d4",
  "Geography":             "#84cc16",
};

const WD = "http://www.wikidata.org/entity/";

export const CURATED_TYPES: CuratedType[] = [
  // ── Conflicts & Military ──────────────────────────────────────────────────
  { iri: `${WD}Q198`,     label: "War",               description: "armed conflict between states or groups",           category: "Conflicts & Military" },
  { iri: `${WD}Q178561`,  label: "Battle",            description: "combat encounter between opposing military forces", category: "Conflicts & Military" },
  { iri: `${WD}Q831663`,  label: "Military campaign", description: "series of military operations in a theatre of war", category: "Conflicts & Military" },
  { iri: `${WD}Q188055`,  label: "Military operation",description: "coordinated military actions",                      category: "Conflicts & Military" },
  { iri: `${WD}Q180684`,  label: "Conflict",          description: "general armed or political conflict",               category: "Conflicts & Military" },
  { iri: `${WD}Q645883`,  label: "Military unit",     description: "organisation within an armed force",               category: "Conflicts & Military" },
  { iri: `${WD}Q1520311`, label: "Military alliance", description: "formal agreement for mutual defence",              category: "Conflicts & Military" },
  { iri: `${WD}Q1656682`, label: "Siege",             description: "military blockade of a city or fortress",          category: "Conflicts & Military" },

  // ── States & Polities ─────────────────────────────────────────────────────
  { iri: `${WD}Q6256`,    label: "Country",           description: "distinct territorial body or political entity",    category: "States & Polities" },
  { iri: `${WD}Q3624078`, label: "Sovereign state",   description: "political entity with supreme authority",         category: "States & Polities" },
  { iri: `${WD}Q112099`,  label: "Empire",            description: "group of territories ruled by an emperor",         category: "States & Polities" },
  { iri: `${WD}Q208500`,  label: "Kingdom",           description: "state ruled by a king or queen",                  category: "States & Polities" },
  { iri: `${WD}Q7270`,    label: "Republic",          description: "state in which power rests with citizens",         category: "States & Polities" },
  { iri: `${WD}Q185441`,  label: "Duchy",             description: "territory ruled by a duke or duchess",            category: "States & Polities" },
  { iri: `${WD}Q1185011`, label: "Principality",      description: "territory ruled by a prince",                     category: "States & Polities" },
  { iri: `${WD}Q7275`,    label: "State",             description: "political organisation with centralised government", category: "States & Polities" },

  // ── Diplomacy & Politics ──────────────────────────────────────────────────
  { iri: `${WD}Q131569`,  label: "Treaty",            description: "formal agreement under international law",         category: "Diplomacy & Politics" },
  { iri: `${WD}Q625298`,  label: "Peace treaty",      description: "agreement to end a war",                          category: "Diplomacy & Politics" },
  { iri: `${WD}Q24764`,   label: "Political party",   description: "organisation that seeks political power",          category: "Diplomacy & Politics" },
  { iri: `${WD}Q179076`,  label: "Revolution",        description: "fundamental change in political power",           category: "Diplomacy & Politics" },
  { iri: `${WD}Q8465`,    label: "Confederation",     description: "union of sovereign states for common action",      category: "Diplomacy & Politics" },

  // ── People ────────────────────────────────────────────────────────────────
  { iri: `${WD}Q5`,       label: "Person",            description: "individual human being",                          category: "People" },
  { iri: `${WD}Q82955`,   label: "Politician",        description: "person involved in politics",                     category: "People" },
  { iri: `${WD}Q131512`,  label: "Ruler",             description: "person who rules a territory",                    category: "People" },
  { iri: `${WD}Q43845`,   label: "Military personnel",description: "person who serves in an armed force",             category: "People" },
  { iri: `${WD}Q1792571`, label: "Military commander",description: "person in command of military forces",            category: "People" },
  { iri: `${WD}Q8178443`, label: "Statesperson",      description: "experienced and respected political leader",      category: "People" },

  // ── Ideas & Culture ───────────────────────────────────────────────────────
  { iri: `${WD}Q11629`,   label: "Ideology",          description: "system of ideas and ideals",                      category: "Ideas & Culture" },
  { iri: `${WD}Q12271`,   label: "Architecture",      description: "art and technique of designing buildings",        category: "Ideas & Culture" },
  { iri: `${WD}Q11862`,   label: "Academic discipline",description: "academic field of study",                       category: "Ideas & Culture" },
  { iri: `${WD}Q483394`,  label: "Genre",             description: "category of artistic composition",               category: "Ideas & Culture" },

  // ── Inventions & Science ─────────────────────────────────────────────────
  { iri: `${WD}Q25403`,   label: "Invention",         description: "new device, method, or process",                  category: "Inventions & Science" },
  { iri: `${WD}Q7725634`, label: "Literary work",     description: "written artistic work",                          category: "Inventions & Science" },
  { iri: `${WD}Q12136`,   label: "Disease",           description: "abnormal condition affecting an organism",       category: "Inventions & Science" },
  { iri: `${WD}Q336`,     label: "Science",           description: "systematic enterprise of knowledge",             category: "Inventions & Science" },

  // ── Geography ─────────────────────────────────────────────────────────────
  { iri: `${WD}Q515`,     label: "City",              description: "large human settlement",                          category: "Geography" },
  { iri: `${WD}Q23442`,   label: "Island",            description: "landmass surrounded by water",                   category: "Geography" },
  { iri: `${WD}Q4022`,    label: "River",             description: "natural watercourse",                            category: "Geography" },
  { iri: `${WD}Q8502`,    label: "Mountain",          description: "large landform rising above the surrounding land", category: "Geography" },
  { iri: `${WD}Q82794`,   label: "Geographic region", description: "area defined by geographic characteristics",     category: "Geography" },
];

/** Point returned by the map-entities API */
export type WikidataMapEntity = {
  iri: string;
  label: string;
  description?: string;
  lat: number;
  lon: number;
  typeIri: string;
  typeLabel: string;
  /**
   * Year the entity's activity ended (P582 end time, or P585 point-in-time).
   * Undefined means still active → rendered at full opacity.
   * Used for time-based opacity: entities that ended earlier in the window are dimmed.
   */
  endYear?: number;
};
