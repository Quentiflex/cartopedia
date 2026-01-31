"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { WarParticipation } from "@/app/types/wars";

const MAP_STYLE = "https://demotiles.maplibre.org/globe.json";
const DEFAULT_CENTER: [number, number] = [10, 30];
const DEFAULT_ZOOM = 2;
const SOURCE_ID = "war-participants";
const LAYER_CIRCLES_ID = "war-participants-circles";
const LAYER_LABELS_ID = "war-participants-labels";

const PARTICIPANT_COLOR = "#f59e0b";
const LABEL_COLOR = "#fef3c7";

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

type MapProps = {
  participations: WarParticipation[];
  onParticipationClick?: (participation: WarParticipation) => void;
};

export function Map({ participations, onParticipationClick }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const sourceAddedRef = useRef(false);
  const participationsRef = useRef(participations);
  const onParticipationClickRef = useRef(onParticipationClick);
  participationsRef.current = participations;
  onParticipationClickRef.current = onParticipationClick;

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
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

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      aria-label="Interactive map of war participants"
    />
  );
}
