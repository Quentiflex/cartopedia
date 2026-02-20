/**
 * Maps CShapes 2.0 cntry_name to ISO 3166-1 alpha-3 code for UN population lookup.
 * Only entries that differ from the UN "Entity" name or are historical variants.
 */
export const CSHAPES_NAME_TO_ISO: Record<string, string> = {
  "United States of America": "USA",
  Alaska: "USA",
  Hawaii: "USA",
  "Puerto Rico": "PRI",
  Newfoundland: "CAN",
  "Trinidad and Tobago": "TTO",
  Surinam: "SUR",
  "French Guyana": "GUF",
  "Germany (Prussia)": "DEU",
  "German Federal Republic": "DEU",
  "German Democratic Republic": "DEU",
  Danzig: "POL",
  "Austria-Hungary": "AUT", // split; use Austria for aggregate
  Czechoslovakia: "CZE", // use Czech Republic for aggregate
  "Italy/Sardinia": "ITA",
  "Italy\\/Sardinia": "ITA",
  "Macedonia (FYROM/North Macedonia)": "MKD",
  "Macedonia (FYROM\\/North Macedonia)": "MKD",
  Yugoslavia: "SRB", // use Serbia for aggregate
  "Bosnia-Herzegovina": "BIH",
  Rumania: "ROU",
  "Russia (Soviet Union)": "RUS",
  "Belarus (Byelorussia)": "BLR",
  "United Kingdom": "GBR",
  "Vietnam (North)": "VNM",
  "Vietnam (South)": "VNM",
  "Republic of Vietnam": "VNM",
  "Democratic Republic of Vietnam": "VNM",
  "Yemen (Arab Republic of Yemen)": "YEM",
  "Yemen (People's Democratic Republic of Yemen)": "YEM",
  "Tanganyika": "TZA",
  "Zanzibar": "TZA",
  "Ethiopia (Abyssinia)": "ETH",
  "German East Africa": "TZA",
  "French West Africa": "MLI",
  "French Equatorial Africa": "COG",
  "Spanish Sahara": "ESH",
  "Western Sahara": "ESH",
  "Ivory Coast": "CIV",
  "Swaziland": "SWZ",
  "British India": "IND",
  "Pakistan (West)": "PAK",
  "East Pakistan": "BGD",
  "Malaya": "MYS",
  "North Borneo": "MYS",
  "Sarawak": "MYS",
  "Republic of Vietnam": "VNM",
  "Taiwan": "TWN",
  "Korea (South)": "KOR",
  "Korea (North)": "PRK",
  "Cyprus (Turkish Republic of Northern Cyprus)": "CYP",
  "Czech Republic": "CZE",
  "Slovakia": "SVK",
  "Timor-Leste": "TLS",
  "East Timor": "TLS",
};

/**
 * Get ISO3 code for a CShapes country name. Returns the name itself if it's
 * already used as key in population data (Entity name), or the mapped ISO.
 * Population API returns data by ISO (Code column); UN Entity names often
 * match CShapes; this map handles historical/different names.
 */
export function cshapesNameToIso(cntryName: string): string | null {
  const normalized = cntryName.trim();
  if (CSHAPES_NAME_TO_ISO[normalized]) return CSHAPES_NAME_TO_ISO[normalized];
  // CShapes may have escaped slash
  if (CSHAPES_NAME_TO_ISO[normalized.replace(/\\\//g, "/")])
    return CSHAPES_NAME_TO_ISO[normalized.replace(/\\\//g, "/")];
  return null;
}
