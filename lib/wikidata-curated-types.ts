export type CuratedType = {
  iri: string;
  label: string;
  description: string;
  category: string;
};

/** One distinct color per overlay category, used for both map markers and the legend. */
export const CATEGORY_COLORS: Record<string, string> = {
  "Conflicts & Military":    "#ef4444",
  "States & Polities":       "#3b82f6",
  "Diplomacy & Politics":    "#14b8a6",
  "People":                  "#f59e0b",
  "Religion & Architecture": "#a78bfa",
  "Ideas & Culture":         "#ec4899",
  "Inventions & Science":    "#06b6d4",
  "Geography":               "#84cc16",
  "Disasters & Crises":      "#f97316",
};

const WD = "http://www.wikidata.org/entity/";

export const CURATED_TYPES: CuratedType[] = [
  // ── Conflicts & Military ──────────────────────────────────────────────────
  { iri: `${WD}Q198`,     label: "War",                description: "armed conflict between states or groups",            category: "Conflicts & Military" },
  { iri: `${WD}Q178561`,  label: "Battle",             description: "combat encounter between opposing military forces",  category: "Conflicts & Military" },
  { iri: `${WD}Q831663`,  label: "Military campaign",  description: "series of military operations in a theatre of war", category: "Conflicts & Military" },
  { iri: `${WD}Q188055`,  label: "Military operation", description: "coordinated military actions",                       category: "Conflicts & Military" },
  { iri: `${WD}Q180684`,  label: "Conflict",           description: "general armed or political conflict",                category: "Conflicts & Military" },
  { iri: `${WD}Q1520311`, label: "Military alliance",  description: "formal agreement for mutual defence",               category: "Conflicts & Military" },
  { iri: `${WD}Q1656682`, label: "Siege",              description: "military blockade of a city or fortress",           category: "Conflicts & Military" },
  { iri: `${WD}Q124757`,  label: "Rebellion",          description: "organised resistance against authority",             category: "Conflicts & Military" },
  { iri: `${WD}Q189760`,  label: "Assassination",      description: "targeted killing of a prominent individual",        category: "Conflicts & Military" },
  { iri: `${WD}Q3199915`, label: "Massacre",           description: "mass killing of many people",                       category: "Conflicts & Military" },

  // ── States & Polities ─────────────────────────────────────────────────────
  { iri: `${WD}Q6256`,    label: "Country",            description: "distinct territorial body or political entity",     category: "States & Polities" },
  { iri: `${WD}Q3624078`, label: "Sovereign state",    description: "political entity with supreme authority",           category: "States & Polities" },
  { iri: `${WD}Q112099`,  label: "Empire",             description: "group of territories ruled by an emperor",          category: "States & Polities" },
  { iri: `${WD}Q208500`,  label: "Kingdom",            description: "state ruled by a king or queen",                   category: "States & Polities" },
  { iri: `${WD}Q7270`,    label: "Republic",           description: "state in which power rests with citizens",          category: "States & Polities" },
  { iri: `${WD}Q185441`,  label: "Duchy",              description: "territory ruled by a duke or duchess",             category: "States & Polities" },
  { iri: `${WD}Q1185011`, label: "Principality",       description: "territory ruled by a prince",                      category: "States & Polities" },
  { iri: `${WD}Q7275`,    label: "State",              description: "political organisation with centralised government", category: "States & Polities" },
  { iri: `${WD}Q133156`,  label: "Colony",             description: "territory under the political control of another",  category: "States & Polities" },

  // ── Diplomacy & Politics ──────────────────────────────────────────────────
  { iri: `${WD}Q131569`,  label: "Treaty",             description: "formal agreement under international law",          category: "Diplomacy & Politics" },
  { iri: `${WD}Q625298`,  label: "Peace treaty",       description: "agreement to end a war",                           category: "Diplomacy & Politics" },
  { iri: `${WD}Q24764`,   label: "Political party",    description: "organisation that seeks political power",           category: "Diplomacy & Politics" },
  { iri: `${WD}Q179076`,  label: "Revolution",         description: "fundamental change in political power",            category: "Diplomacy & Politics" },
  { iri: `${WD}Q8465`,    label: "Confederation",      description: "union of sovereign states for common action",       category: "Diplomacy & Politics" },
  { iri: `${WD}Q1344`,    label: "Annexation",         description: "acquisition of territory by a state",              category: "Diplomacy & Politics" },

  // ── People ────────────────────────────────────────────────────────────────
  // Note: Q5 (Person) is intentionally omitted — too broad (billions of entries)
  // Use the specific subtypes below instead.
  { iri: `${WD}Q82955`,   label: "Politician",         description: "person involved in politics",                      category: "People" },
  { iri: `${WD}Q131512`,  label: "Ruler",              description: "person who rules a territory",                     category: "People" },
  { iri: `${WD}Q116`,     label: "Monarch",            description: "hereditary head of state",                         category: "People" },
  { iri: `${WD}Q1792571`, label: "Military commander", description: "person in command of military forces",             category: "People" },
  { iri: `${WD}Q43845`,   label: "Military personnel", description: "person who serves in an armed force",              category: "People" },
  { iri: `${WD}Q8178443`, label: "Statesperson",       description: "experienced and respected political leader",       category: "People" },
  { iri: `${WD}Q4964182`, label: "Philosopher",        description: "person who studies fundamental questions",         category: "People" },
  { iri: `${WD}Q901`,     label: "Scientist",          description: "person who conducts scientific research",          category: "People" },
  { iri: `${WD}Q483501`,  label: "Artist",             description: "person who creates art",                          category: "People" },
  { iri: `${WD}Q11631`,   label: "Astronomer",         description: "scientist in the field of astronomy",             category: "People" },

  // ── Religion & Architecture ───────────────────────────────────────────────
  { iri: `${WD}Q44613`,   label: "Monastery",          description: "building or complex for monastic communities",     category: "Religion & Architecture" },
  { iri: `${WD}Q2977`,    label: "Cathedral",          description: "central church of a bishop's diocese",            category: "Religion & Architecture" },
  { iri: `${WD}Q16970`,   label: "Church",             description: "building used for Christian worship",             category: "Religion & Architecture" },
  { iri: `${WD}Q23413`,   label: "Castle",             description: "fortified medieval structure",                    category: "Religion & Architecture" },
  { iri: `${WD}Q3918`,    label: "University",         description: "institution of higher education and research",    category: "Religion & Architecture" },
  { iri: `${WD}Q33506`,   label: "Museum",             description: "institution that cares for a collection of artefacts", category: "Religion & Architecture" },
  { iri: `${WD}Q24354`,   label: "Theatre",            description: "building or outdoor area for performing arts",    category: "Religion & Architecture" },

  // ── Ideas & Culture ───────────────────────────────────────────────────────
  // Abstract concepts (genre, ideology) have no coordinates and never appear on the map.
  // Only include types that have real-world instances with locations.
  { iri: `${WD}Q7725634`, label: "Literary work",      description: "written artistic work (placed at country of origin)", category: "Ideas & Culture" },

  // ── Inventions & Science ─────────────────────────────────────────────────
  // Placed via P495 (country of origin) → resolved to that country's coordinates.
  // Abstract type classes (Science, Academic discipline) omitted — no map location.
  { iri: `${WD}Q25403`,   label: "Invention",          description: "new device, method, or process",                  category: "Inventions & Science" },
  { iri: `${WD}Q11976103`,label: "Scientific discovery",description: "new knowledge gained through scientific research", category: "Inventions & Science" },

  // ── Geography ─────────────────────────────────────────────────────────────
  { iri: `${WD}Q515`,     label: "City",               description: "large human settlement",                          category: "Geography" },
  { iri: `${WD}Q23442`,   label: "Island",             description: "landmass surrounded by water",                   category: "Geography" },
  { iri: `${WD}Q4022`,    label: "River",              description: "natural watercourse",                            category: "Geography" },
  { iri: `${WD}Q8502`,    label: "Mountain",           description: "large landform rising above the surrounding land", category: "Geography" },
  { iri: `${WD}Q82794`,   label: "Geographic region",  description: "area defined by geographic characteristics",     category: "Geography" },
  { iri: `${WD}Q44782`,   label: "Port",               description: "location on a coast or river for loading ships", category: "Geography" },

  // ── Disasters & Crises ────────────────────────────────────────────────────
  { iri: `${WD}Q2277`,    label: "Famine",             description: "widespread scarcity of food",                     category: "Disasters & Crises" },
  { iri: `${WD}Q3241045`, label: "Epidemic",           description: "rapid spread of disease across a region",        category: "Disasters & Crises" },
  { iri: `${WD}Q8150`,    label: "Earthquake",         description: "shaking of Earth's surface from seismic activity", category: "Disasters & Crises" },
  { iri: `${WD}Q8068`,    label: "Flood",              description: "overflow of water onto normally dry land",        category: "Disasters & Crises" },
  { iri: `${WD}Q192935`,  label: "Natural disaster",   description: "major adverse natural event",                    category: "Disasters & Crises" },
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
