import type { CShapesCountry, WarParticipation } from "@/types/wars";

/**
 * Convert war participations to GeoJSON for map display.
 * Adds a `stackCount` property so the map can render a count badge when
 * multiple events share the exact same coordinates.
 */
export function participationsToGeoJSON(
  participations: WarParticipation[]
): GeoJSON.FeatureCollection {
  // Count how many participations share each rounded coordinate
  const coordCounts = new Map<string, number>();
  for (const p of participations) {
    const key = `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`;
    coordCounts.set(key, (coordCounts.get(key) ?? 0) + 1);
  }

  return {
    type: "FeatureCollection",
    features: participations.map((p, index) => {
      const key = `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`;
      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [p.longitude, p.latitude],
        },
        properties: {
          participantLabel: p.participantLabel,
          warLabels: p.warLabels.join(" · "),
          stackCount: coordCounts.get(key) ?? 1,
          index,
        },
      };
    }),
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
