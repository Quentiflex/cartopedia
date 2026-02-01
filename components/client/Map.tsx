"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { getCartopediaMapStyle } from "@/lib/protomaps-style";
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

// Protomaps (free, no API key): physical geography only – coastlines, water, rivers, cities.
// No country boundaries or admin labels, so CShapes historical overlays stay credible.
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

function participationsToGeoJSON(
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

export type TimeWindow = { start: number; end: number };

type MapProps = {
  participations: WarParticipation[];
  timeWindow: TimeWindow;
  onParticipationClick?: (participation: WarParticipation) => void;
  onCountryClick?: (country: CShapesCountry) => void;
};

const emptyGeoJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function featureToCountry(properties: Record<string, unknown> | null): CShapesCountry | null {
  if (!properties || typeof properties.cntry_name !== "string") return null;
  return {
    cntry_name: properties.cntry_name as string,
    capname: typeof properties.capname === "string" ? properties.capname : undefined,
    area: typeof properties.area === "number" ? properties.area : undefined,
    gwsyear: typeof properties.gwsyear === "number" ? properties.gwsyear : undefined,
    gweyear: typeof properties.gweyear === "number" ? properties.gweyear : undefined,
  };
}

export function Map({
  participations,
  timeWindow,
  onParticipationClick,
  onCountryClick,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const sourceAddedRef = useRef(false);
  const participationsRef = useRef(participations);
  const timeWindowRef = useRef(timeWindow);
  const onParticipationClickRef = useRef(onParticipationClick);
  const onCountryClickRef = useRef(onCountryClick);
  participationsRef.current = participations;
  timeWindowRef.current = timeWindow;
  onParticipationClickRef.current = onParticipationClick;
  onCountryClickRef.current = onCountryClick;

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
      (() => {
        const src = map.getSource(SOURCE_CSHAPES_ID) as
          | maplibregl.GeoJSONSource
          | undefined;
        if (!src) return;
        const { start } = timeWindowRef.current;
        fetch(`/api/cshapes?start=${start}&end=${start}`)
          .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
          .then((data: GeoJSON.FeatureCollection) => src.setData(data))
          .catch(() => src.setData(emptyGeoJSON));
      })();
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
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;
    const source = map.getSource(SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (source) {
      source.setData(participationsToGeoJSON(participations));
    }
  }, [participations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;
    const source = map.getSource(SOURCE_CSHAPES_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!source) return;
    const { start } = timeWindow;
    fetch(`/api/cshapes?start=${start}&end=${start}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: GeoJSON.FeatureCollection) => source.setData(data))
      .catch(() => source.setData(emptyGeoJSON));
  }, [timeWindow]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      aria-label="Interactive map of war participants"
    />
  );
}
