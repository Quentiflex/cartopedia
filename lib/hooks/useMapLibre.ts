import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { getCartopediaMapStyle } from "@/lib/protomaps-style";
import { participationsToGeoJSON, featureToCountry, emptyGeoJSON } from "@/lib/utils/map-utils";
import type { CShapesCountry, WarParticipation } from "@/types/wars";

// PMTiles protocol: register once for app lifetime
let pmtilesProtocolRegistered = false;
function ensurePmtilesProtocol() {
  if (!pmtilesProtocolRegistered) {
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    pmtilesProtocolRegistered = true;
  }
}

const PROTOMAPS_PMTILES_URL =
  "https://r2-public.protomaps.com/protomaps-sample-datasets/protomaps-basemap-opensource-20230408.pmtiles";

const DEFAULT_CENTER: [number, number] = [10, 30];
const DEFAULT_ZOOM = 2;
const SOURCE_CSHAPES_ID = "cshapes";
const LAYER_CSHAPES_FILL_ID = "cshapes-fill";
const LAYER_CSHAPES_LINE_ID = "cshapes-line";
const SOURCE_ID = "war-participants";
const LAYER_CIRCLES_ID = "war-participants-circles";
const LAYER_LABELS_ID = "war-participants-labels";

const PARTICIPANT_COLOR = "#f59e0b";
const LABEL_COLOR = "#fef3c7";
const CSHAPES_FILL = "rgba(59, 130, 246, 0.2)";
const CSHAPES_LINE = "rgba(59, 130, 246, 0.6)";

type UseMapLibreOptions = {
  participations: WarParticipation[];
  timeWindow: { start: number; end: number };
  onParticipationClick?: (participation: WarParticipation) => void;
  onCountryClick?: (country: CShapesCountry) => void;
};

/**
 * Custom hook for MapLibre GL initialization and management
 * Handles map lifecycle, data updates, and event handlers
 */
export function useMapLibre(
  containerRef: React.RefObject<HTMLDivElement | null>,
  { participations, timeWindow, onParticipationClick, onCountryClick }: UseMapLibreOptions
) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const sourceAddedRef = useRef(false);
  
  // Store latest values in refs to avoid recreating event handlers
  const participationsRef = useRef(participations);
  const onParticipationClickRef = useRef(onParticipationClick);
  const onCountryClickRef = useRef(onCountryClick);
  
  participationsRef.current = participations;
  onParticipationClickRef.current = onParticipationClick;
  onCountryClickRef.current = onCountryClick;

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current) return;

    ensurePmtilesProtocol();
    const mapStyle = getCartopediaMapStyle(PROTOMAPS_PMTILES_URL, {
      lang: "en",
      flavor: "light",
    });

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      // Add CShapes source and layers
      map.addSource(SOURCE_CSHAPES_ID, {
        type: "geojson",
        data: emptyGeoJSON,
      });
      
      map.addLayer({
        id: LAYER_CSHAPES_FILL_ID,
        type: "fill",
        source: SOURCE_CSHAPES_ID,
        paint: {
          "fill-color": CSHAPES_FILL,
          "fill-outline-color": CSHAPES_LINE,
        },
      });
      
      map.addLayer({
        id: LAYER_CSHAPES_LINE_ID,
        type: "line",
        source: SOURCE_CSHAPES_ID,
        paint: {
          "line-color": CSHAPES_LINE,
          "line-width": 1,
        },
      });

      // Load initial CShapes data
      const src = map.getSource(SOURCE_CSHAPES_ID) as maplibregl.GeoJSONSource | undefined;
      if (src) {
        const start = timeWindow.start;
        fetch(`/api/cshapes?start=${start}&end=${start}`)
          .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
          .then((data: GeoJSON.FeatureCollection) => src.setData(data))
          .catch(() => src.setData(emptyGeoJSON));
      }

      // Add war participants source and layers
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: participationsToGeoJSON(participationsRef.current),
      });
      
      map.addLayer({
        id: LAYER_CIRCLES_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": 10,
          "circle-color": PARTICIPANT_COLOR,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });
      
      map.addLayer({
        id: LAYER_LABELS_ID,
        type: "symbol",
        source: SOURCE_ID,
        layout: {
          "text-field": ["get", "warLabels"],
          "text-size": 11,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-max-width": 14,
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        },
        paint: {
          "text-color": LABEL_COLOR,
          "text-halo-color": "rgba(0,0,0,0.85)",
          "text-halo-width": 1.5,
        },
      });

      // Participation circles hover and click
      map.on("mouseenter", LAYER_CIRCLES_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", LAYER_CIRCLES_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", LAYER_CIRCLES_ID, (e) => {
        const cb = onParticipationClickRef.current;
        if (!cb || !e.features?.[0]?.properties) return;
        const p = e.features[0].properties as { index?: number };
        const idx = typeof p.index === "number" ? p.index : -1;
        const part = participationsRef.current[idx];
        if (part) cb(part);
      });

      // CShapes hover and click
      map.on("mouseenter", LAYER_CSHAPES_FILL_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", LAYER_CSHAPES_FILL_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", LAYER_CSHAPES_FILL_ID, (e) => {
        const cb = onCountryClickRef.current;
        if (!cb || !e.features?.[0]?.properties) return;
        const country = featureToCountry(
          e.features[0].properties as Record<string, unknown>
        );
        if (country) cb(country);
      });

      sourceAddedRef.current = true;
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      sourceAddedRef.current = false;
    };
  }, [containerRef, timeWindow.start]);

  // Update participations data when it changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;
    
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(participationsToGeoJSON(participations));
    }
  }, [participations]);

  // Update CShapes data when time window changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;
    
    const source = map.getSource(SOURCE_CSHAPES_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    
    const { start } = timeWindow;
    fetch(`/api/cshapes?start=${start}&end=${start}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: GeoJSON.FeatureCollection) => source.setData(data))
      .catch(() => source.setData(emptyGeoJSON));
  }, [timeWindow]);

  return mapRef;
}
