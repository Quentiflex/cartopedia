export type Continent =
  | "Africa"
  | "Asia"
  | "Europe"
  | "North America"
  | "Oceania"
  | "South America";

/** Color code for each continent (e.g. for Gantt chart). */
export const CONTINENT_COLORS: Record<Continent, string> = {
  Africa: "#eab308",
  Asia: "#22c55e",
  Europe: "#3b82f6",
  "North America": "#ef4444",
  Oceania: "#a855f7",
  "South America": "#f97316",
};

/** Color code for each event type (map and Gantt). */
export const EVENT_TYPE_COLORS: Record<string, string> = {
  invention: "#f59e0b",
  geopolitic: "#3b82f6",
};

export const DEFAULT_EVENT_TYPE_COLOR = "#94a3b8";

function getContinentFromCoords([lon, lat]: [number, number]): Continent {
  if (lat >= 35 && lat <= 72 && lon >= -25 && lon <= 60) return "Europe";
  if (lon >= -170 && lon <= -50 && lat >= 15 && lat <= 72) return "North America";
  if (lon >= -85 && lon <= -35 && lat >= -56 && lat <= 12) return "South America";
  if (lon >= -20 && lon <= 52 && lat >= -35 && lat <= 37) return "Africa";
  if (lon >= 110 && lon <= 180 && lat >= -50 && lat <= 0) return "Oceania";
  if (lon >= -180 && lon <= -105 && lat >= -50 && lat <= 30) return "Oceania";
  return "Asia";
}

export type Event = {
  title: string;
  geography: { type: "Point"; coordinates: [number, number] };
  domain: string;
  year: number;
  type: string;
  continent: Continent;
};

type EventInput = Omit<Event, "continent">;

const rawEvents: EventInput[] = [
    {
      "title": "Theory of Relativity",
      "geography": { "type": "Point", "coordinates": [13.4050, 52.5200] },
      "domain": "physics",
      "year": 1905,
      "type":"invention"
    },
    {
      "title": "Quantum Mechanics",
      "geography": { "type": "Point", "coordinates": [9.9937, 53.5511] },
      "domain": "physics",
      "year": 1925,
      "type":"invention"
    },
    {
      "title": "Discovery of Penicillin",
      "geography": { "type": "Point", "coordinates": [-0.1276, 51.5074] },
      "domain": "medicine",
      "year": 1928, 
      "type":"invention"
    },
    {
      "title": "Radio Broadcasting",
      "geography": { "type": "Point", "coordinates": [-74.0060, 40.7128] },
      "domain": "engineering",
      "year": 1920, 
      "type":"invention"
    },
    {
      "title": "Nuclear Fission",
      "geography": { "type": "Point", "coordinates": [16.3738, 48.2082] },
      "domain": "physics",
      "year": 1938,
      "type":"invention"
    },
    {
      "title": "Jet Engine",
      "geography": { "type": "Point", "coordinates": [-1.4701, 52.4068] },
      "domain": "engineering",
      "year": 1937,
      "type":"invention"
    },
    {
      "title": "Television",
      "geography": { "type": "Point", "coordinates": [-0.1276, 51.5074] },
      "domain": "engineering",
      "year": 1927,
      "type":"invention"
    },
    {
      "title": "Radar Technology",
      "geography": { "type": "Point", "coordinates": [-1.1581, 52.9548] },
      "domain": "engineering",
      "year": 1935,
      "type":"invention"
    },
    {
      "title": "First Electronic Computer (ENIAC)",
      "geography": { "type": "Point", "coordinates": [-75.1652, 39.9526] },
      "domain": "computer science",
      "year": 1945,
      "type":"invention"
    },
    {
      "title": "Transistor",
      "geography": { "type": "Point", "coordinates": [-74.1724, 40.7357] },
      "domain": "electronics",
      "year": 1947,
      "type":"invention"
    },
    {
      "title": "DNA Double Helix Structure",
      "geography": { "type": "Point", "coordinates": [-0.1276, 51.5074] },
      "domain": "biology",
      "year": 1953,
      "type":"invention"
    },
    {
      "title": "Polio Vaccine",
      "geography": { "type": "Point", "coordinates": [-79.9959, 40.4406] },
      "domain": "medicine",
      "year": 1955,
      "type":"invention"
    },
    {
      "title": "Laser",
      "geography": { "type": "Point", "coordinates": [-118.2437, 34.0522] },
      "domain": "physics",
      "year": 1960,
      "type":"invention"
    },
    {
      "title": "Integrated Circuit",
      "geography": { "type": "Point", "coordinates": [-96.7970, 32.7767] },
      "domain": "electronics",
      "year": 1958,
      "type":"invention"
    },
    {
      "title": "Human Spaceflight",
      "geography": { "type": "Point", "coordinates": [37.6173, 55.7558] },
      "domain": "astronomy",
      "year": 1961,
      "type":"invention"
    },
    {
      "title": "Moon Landing",
      "geography": { "type": "Point", "coordinates": [-95.3698, 29.7604] },
      "domain": "astronomy",
      "year": 1969,
      "type":"invention"
    },
    {
      "title": "ARPANET (Precursor to the Internet)",
      "geography": { "type": "Point", "coordinates": [-118.4452, 34.0689] },
      "domain": "computer science",
    "year": 1969,
      "type":"invention"
    },
    {
      "title": "Personal Computer",
      "geography": { "type": "Point", "coordinates": [-122.2711, 37.8044] },
      "domain": "computer science",
      "year": 1975,
      "type":"invention"
    },
    {
      "title": "Magnetic Resonance Imaging (MRI)",
      "geography": { "type": "Point", "coordinates": [-71.0589, 42.3601] },
      "domain": "medicine",
      "year": 1977,
      "type":"invention"
    },
    {
      "title": "Global Positioning System (GPS)",
      "geography": { "type": "Point", "coordinates": [-77.0369, 38.9072] },
      "domain": "engineering",
      "year": 1978,
      "type":"invention"
    },
    {
      "title": "Artificial Heart",
      "geography": { "type": "Point", "coordinates": [-95.3698, 29.7604] },
      "domain": "medicine",
      "year": 1982,
      "type":"invention"
    },
    {
      "title": "Mobile Phone",
      "geography": { "type": "Point", "coordinates": [-87.6298, 41.8781] },
      "domain": "engineering",
      "year": 1973,
      "type":"invention"
    },
    {
      "title": "World Wide Web",
      "geography": { "type": "Point", "coordinates": [6.1432, 46.2044] },
      "domain": "computer science",
      "year": 1989,
      "type":"invention"
    },
    {
      "title": "Hubble Space Telescope",
      "geography": { "type": "Point", "coordinates": [-80.6043, 28.6084] },
      "domain": "astronomy",
      "year": 1990,
      "type":"invention"
    },
    {
      "title": "Lithium-Ion Battery",
      "geography": { "type": "Point", "coordinates": [139.6917, 35.6895] },
      "domain": "chemistry",
      "year": 1991,
      "type":"invention"
    },
    {
      "title": "CRISPR Gene Editing (Early Discovery)",
      "geography": { "type": "Point", "coordinates": [2.3522, 48.8566] },
      "domain": "biology",
      "year": 1987,
      "type":"invention"
    },
    {
      "title": "Concorde Supersonic Flight",
      "geography": { "type": "Point", "coordinates": [-0.4543, 51.4700] },
      "domain": "engineering",
      "year": 1969,
      "type":"invention"
    },
    {
      "title": "CT Scan",
      "geography": { "type": "Point", "coordinates": [-0.1276, 51.5074] },
      "domain": "medicine",
      "year": 1971,
      "type":"invention"
    },
    {
      "title": "Discovery of the Expanding Universe",
      "geography": { "type": "Point", "coordinates": [-118.3004, 34.1184] },
      "domain": "astronomy",
    "year": 1929,
      "type":"invention"
    },
    {
      "title": "First Artificial Satellite (Sputnik 1)",
      "geography": { "type": "Point", "coordinates": [37.6173, 55.7558] },
      "domain": "astronomy",
      "year": 1957,
      "type":"invention"
    },
    {
      "title": "Velcro",
      "geography": { "type": "Point", "coordinates": [6.6323, 46.5197] },
      "domain": "materials science",
      "year": 1941,
      "type":"invention"
    },
    {
      "title": "Discovery of Plate Tectonics",
      "geography": { "type": "Point", "coordinates": [-122.4194, 37.7749] },
      "domain": "geology",
      "year": 1967,
      "type":"invention"
    },
    {
      "title": "Email",
      "geography": { "type": "Point", "coordinates": [-71.1097, 42.3736] },
      "domain": "computer science",
      "year": 1971,
      "type":"invention"
    },
    {
      "title": "Pacemaker",
      "geography": { "type": "Point", "coordinates": [18.0686, 59.3293] },
      "domain": "medicine",
      "year": 1958,
      "type":"invention"
    },
    {
      "title": "Compact Disc (CD)",
      "geography": { "type": "Point", "coordinates": [4.8952, 52.3702] },
      "domain": "electronics",
      "year": 1982,
      "type":"invention"
    },
    {
      "title": "Start of World War I",
      "geography": { "type": "Point", "coordinates": [18.4131, 43.8563] },
      "domain": "war",
      "type": "geopolitic",
      "year": 1914
    },
    {
      "title": "Russian Revolution",
      "geography": { "type": "Point", "coordinates": [30.3351, 59.9343] },
      "domain": "revolution",
      "type": "geopolitic",
      "year": 1917
    },
    {
      "title": "Treaty of Versailles",
      "geography": { "type": "Point", "coordinates": [2.1204, 48.8049] },
      "domain": "diplomacy",
      "type": "geopolitic",
      "year": 1919
    },
    {
      "title": "Creation of the League of Nations",
      "geography": { "type": "Point", "coordinates": [6.1432, 46.2044] },
      "domain": "international organization",
      "type": "geopolitic",
      "year": 1920
    },
    {
      "title": "Rise of Nazi Germany (Hitler becomes Chancellor)",
      "geography": { "type": "Point", "coordinates": [13.4050, 52.5200] },
      "domain": "political shift",
      "type": "geopolitic",
      "year": 1933
    },
    {
      "title": "Spanish Civil War",
      "geography": { "type": "Point", "coordinates": [-3.7038, 40.4168] },
      "domain": "war",
      "type": "geopolitic",
      "year": 1936
    },
    {
      "title": "Munich Agreement",
      "geography": { "type": "Point", "coordinates": [11.5820, 48.1351] },
      "domain": "diplomacy",
      "type": "geopolitic",
      "year": 1938
    },
    {
      "title": "Start of World War II",
      "geography": { "type": "Point", "coordinates": [21.0122, 52.2297] },
      "domain": "war",
      "type": "geopolitic",
      "year": 1939
    },
    {
      "title": "Attack on Pearl Harbor",
      "geography": { "type": "Point", "coordinates": [-157.9500, 21.3490] },
      "domain": "war",
      "type": "geopolitic",
      "year": 1941
    },
    {
      "title": "Yalta Conference",
      "geography": { "type": "Point", "coordinates": [34.1667, 44.5000] },
      "domain": "diplomacy",
      "type": "geopolitic",
      "year": 1945
    },
    {
      "title": "End of World War II in Europe",
      "geography": { "type": "Point", "coordinates": [13.4050, 52.5200] },
      "domain": "war",
      "type": "geopolitic",
      "year": 1945
    },
    {
      "title": "Creation of the United Nations",
      "geography": { "type": "Point", "coordinates": [-122.4194, 37.7749] },
      "domain": "international organization",
      "type": "geopolitic",
      "year": 1945
    },
    {
      "title": "Beginning of the Cold War",
      "geography": { "type": "Point", "coordinates": [-77.0369, 38.9072] },
      "domain": "geopolitical tension",
      "type": "geopolitic",
      "year": 1947
    },
    {
      "title": "Creation of NATO",
      "geography": { "type": "Point", "coordinates": [-77.0369, 38.9072] },
      "domain": "military alliance",
      "type": "geopolitic",
      "year": 1949
    },
    {
      "title": "Chinese Communist Revolution",
      "geography": { "type": "Point", "coordinates": [116.4074, 39.9042] },
      "domain": "revolution",
      "type": "geopolitic",
      "year": 1949
    },
    {
      "title": "Korean War",
      "geography": { "type": "Point", "coordinates": [126.9780, 37.5665] },
      "domain": "war",
      "type": "geopolitic",
      "year": 1950
    },
    {
      "title": "Creation of the Warsaw Pact",
      "geography": { "type": "Point", "coordinates": [21.0122, 52.2297] },
      "domain": "military alliance",
      "type": "geopolitic",
      "year": 1955
    },
    {
      "title": "Suez Crisis",
      "geography": { "type": "Point", "coordinates": [32.5530, 29.9668] },
      "domain": "international conflict",
      "type": "geopolitic",
      "year": 1956
    },
    {
      "title": "Cuban Revolution",
      "geography": { "type": "Point", "coordinates": [-82.3666, 23.1136] },
      "domain": "revolution",
      "type": "geopolitic",
      "year": 1959
    },
    {
      "title": "Construction of the Berlin Wall",
      "geography": { "type": "Point", "coordinates": [13.4050, 52.5200] },
      "domain": "geopolitical division",
      "type": "geopolitic",
      "year": 1961
    },
    {
      "title": "Cuban Missile Crisis",
      "geography": { "type": "Point", "coordinates": [-82.3666, 23.1136] },
      "domain": "nuclear crisis",
      "type": "geopolitic",
      "year": 1962
    },
    {
      "title": "Vietnam War Escalation",
      "geography": { "type": "Point", "coordinates": [105.8342, 21.0278] },
      "domain": "war",
      "type": "geopolitic",
      "year": 1965
    },
    {
      "title": "Six-Day War",
      "geography": { "type": "Point", "coordinates": [35.2137, 31.7683] },
      "domain": "war",
      "type": "geopolitic",
      "year": 1967
    },
    {
      "title": "Prague Spring",
      "geography": { "type": "Point", "coordinates": [14.4378, 50.0755] },
      "domain": "political uprising",
      "type": "geopolitic",
      "year": 1968
    },
    {
      "title": "Détente between USA and USSR",
      "geography": { "type": "Point", "coordinates": [37.6173, 55.7558] },
      "domain": "diplomacy",
      "type": "geopolitic",
      "year": 1972
    },
    {
      "title": "Fall of Saigon",
      "geography": { "type": "Point", "coordinates": [106.6297, 10.8231] },
      "domain": "war",
      "type": "geopolitic",
      "year": 1975
    },
    {
      "title": "Iranian Revolution",
      "geography": { "type": "Point", "coordinates": [51.3890, 35.6892] },
      "domain": "revolution",
      "type": "geopolitic",
      "year": 1979
    },
    {
      "title": "Soviet Invasion of Afghanistan",
      "geography": { "type": "Point", "coordinates": [69.2075, 34.5553] },
      "domain": "war",
      "type": "geopolitic",
      "year": 1979
    },
    {
      "title": "Creation of the European Union (Maastricht Treaty)",
      "geography": { "type": "Point", "coordinates": [5.6900, 50.8514] },
      "domain": "economic union",
      "type": "geopolitic",
      "year": 1992
    },
    {
      "title": "Fall of the Berlin Wall",
      "geography": { "type": "Point", "coordinates": [13.4050, 52.5200] },
      "domain": "geopolitical shift",
      "type": "geopolitic",
      "year": 1989
    },
    {
      "title": "Collapse of the Soviet Union",
      "geography": { "type": "Point", "coordinates": [37.6173, 55.7558] },
      "domain": "state dissolution",
      "type": "geopolitic",
      "year": 1991
    },
    {
      "title": "Gulf War",
      "geography": { "type": "Point", "coordinates": [47.4818, 29.3117] },
      "domain": "war",
      "type": "geopolitic",
      "year": 1991
    },
    {
      "title": "End of Apartheid (Mandela elected)",
      "geography": { "type": "Point", "coordinates": [18.4241, -33.9249] },
      "domain": "political transition",
      "type": "geopolitic",
      "year": 1994
    },
    {
      "title": "NATO Intervention in Kosovo",
      "geography": { "type": "Point", "coordinates": [21.1655, 42.6629] },
      "domain": "military intervention",
      "type": "geopolitic",
      "year": 1999
    }
  ];

export const events: Event[] = rawEvents.map((e) => ({
  ...e,
  continent: getContinentFromCoords(e.geography.coordinates),
}));

/** Unique event types present in the dataset (e.g. "invention", "geopolitic"). */
export function getEventTypes(): string[] {
  const set = new Set(events.map((e) => e.type));
  return Array.from(set).sort();
}

/** Order of continents for the Gantt chart (top to bottom). */
const CONTINENT_ORDER: Continent[] = [
  "Europe",
  "North America",
  "Asia",
  "South America",
  "Africa",
  "Oceania",
];

/** Unique continents present in the dataset, in display order. */
export function getContinents(): Continent[] {
  const set = new Set(events.map((e) => e.continent));
  return CONTINENT_ORDER.filter((c) => set.has(c));
}
