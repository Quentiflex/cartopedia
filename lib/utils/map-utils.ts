import type { CShapesCountry, WarParticipation } from "@/types/wars";

/**
 * Convert war participations to GeoJSON for map display
 */
export function participationsToGeoJSON(
  participations: WarParticipation[]
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: participations.map((p, index) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [p.longitude, p.latitude],
      },
      properties: {
        participantLabel: p.participantLabel,
        warLabels: p.warLabels.join(" · "),
        warLabelsList: p.warLabels,
        index,
      },
    })),
  };
}

/**
 * Convert GeoJSON feature properties to CShapes country object
 */
export function featureToCountry(
  properties: Record<string, unknown> | null
): CShapesCountry | null {
  if (!properties || typeof properties.cntry_name !== "string") return null;
  return {
    cntry_name: properties.cntry_name as string,
    capname: typeof properties.capname === "string" ? properties.capname : undefined,
    area: typeof properties.area === "number" ? properties.area : undefined,
    gwsyear: typeof properties.gwsyear === "number" ? properties.gwsyear : undefined,
    gweyear: typeof properties.gweyear === "number" ? properties.gweyear : undefined,
  };
}

/**
 * Empty GeoJSON collection for initial state
 */
export const emptyGeoJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
