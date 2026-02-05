/**
 * War participation as returned from the RDF store for a given time window.
 * One entry per participant (country/entity) that has coordinates; may list
 * multiple wars in that window.
 */
export type WarParticipation = {
  participantId: string;
  participantLabel: string;
  latitude: number;
  longitude: number;
  warLabels: string[];
  wars: { id: string; label: string; startDate: string; endDate: string | null }[];
};

/**
 * War as returned for the Gantt chart: label and date range (can span multiple years).
 */
export type War = {
  id: string;
  label: string;
  startDate: string;
  endDate: string | null;
};

/**
 * CShapes country/territory feature as shown on the map for a given start date.
 * Used by the country detail panel when a polygon is clicked.
 */
export type CShapesCountry = {
  cntry_name: string;
  capname?: string;
  area?: number;
  gwsyear?: number;
  gweyear?: number;
};
