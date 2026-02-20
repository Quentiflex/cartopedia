/**
 * Cartopedia basemap style: physical geography only.
 * Uses Protomaps (free, OSM data) with boundaries and admin labels removed
 * so historical CShapes overlays are not contaminated by modern borders.
 *
 * Keep: coastlines (earth), water, rivers, cities.
 * Remove: country boundaries, admin/region labels, roads, buildings.
 */

import {
  layers,
  namedFlavor,
  type Flavor,
} from "@protomaps/basemaps";
import type {
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";

const EXCLUDED_LAYER_IDS = new Set([
  // Country boundaries and admin borders
  "boundaries_country",
  "boundaries",
  // Admin labels (country names, state/region names)
  "places_country",
  "places_region",
  // Roads and transport (modern infrastructure)
  "roads_runway",
  "roads_taxiway",
  "landuse_runway",
  "roads_tunnels_other_casing",
  "roads_tunnels_minor_casing",
  "roads_tunnels_link_casing",
  "roads_tunnels_major_casing",
  "roads_tunnels_other",
  "roads_tunnels_minor",
  "roads_tunnels_link",
  "roads_tunnels_major",
  "roads_tunnels_highway",
  "roads_pier",
  "roads_minor_service_casing",
  "roads_minor_casing",
  "roads_link_casing",
  "roads_major_casing_late",
  "roads_highway_casing_late",
  "roads_other",
  "roads_link",
  "roads_minor_service",
  "roads_minor",
  "roads_major_casing_early",
  "roads_major",
  "roads_highway_casing_early",
  "roads_highway",
  "roads_rail",
  "roads_bridges_other_casing",
  "roads_bridges_link_casing",
  "roads_bridges_minor_casing",
  "roads_bridges_major_casing",
  "roads_bridges_other",
  "roads_bridges_minor",
  "roads_bridges_link",
  "roads_bridges_major",
  "roads_bridges_highway_casing",
  "roads_bridges_highway",
  // Road labels
  "roads_oneway",
  "roads_labels_minor",
  "roads_shields",
  "roads_labels_major",
  // Buildings
  "buildings",
  "address_label",
  // POIs (optional – remove for cleaner historical base)
  "pois",
  // Landuse (parks, industrial, etc. – keep it minimal)
  "landuse_park",
  "landuse_urban_green",
  "landuse_hospital",
  "landuse_industrial",
  "landuse_school",
  "landuse_beach",
  "landuse_zoo",
  "landuse_aerodrome",
  "landuse_pedestrian",
  "landuse_pier",
  // Subplace labels (neighbourhoods – optional, keeping for now)
  // "places_subplace",  // uncomment to remove
]);

function shouldExcludeLayer(id: string): boolean {
  return EXCLUDED_LAYER_IDS.has(id);
}

/**
 * Returns MapLibre layers for a physical-geography-only basemap:
 * coastlines (earth), water, rivers, landcover, cities.
 * No country boundaries, admin labels, or roads.
 */
export function getCartopediaBasemapLayers(
  sourceId: string,
  flavor: Flavor = namedFlavor("light"),
  options?: { lang?: string }
): LayerSpecification[] {
  const allLayers = layers(sourceId, flavor, {
    lang: options?.lang ?? "en",
  });
  return allLayers.filter((layer) => {
    if (layer.id && shouldExcludeLayer(layer.id)) return false;
    return true;
  });
}

/**
 * Build full MapLibre style for Cartopedia.
 * Uses Protomaps PMTiles – free, no API key.
 */
export function getCartopediaMapStyle(
  pmtilesUrl: string,
  options?: { lang?: string; flavor?: "light" | "dark" | "white" }
): StyleSpecification {
  const flavor = namedFlavor(options?.flavor ?? "light");
  const styleLayers = getCartopediaBasemapLayers("protomaps", flavor, {
    lang: options?.lang ?? "en",
  });

  return {
    version: 8 as const,
    projection: { type: "globe" as const },
    glyphs:
      "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sprite: `https://protomaps.github.io/basemaps-assets/sprites/v4/${options?.flavor ?? "light"}`,
    sources: {
      protomaps: {
        type: "vector",
        url: `pmtiles://${pmtilesUrl}`,
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: styleLayers,
  };
}
