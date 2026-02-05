"use client";

import { useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMapLibre } from "@/lib/hooks/useMapLibre";
import type { CShapesCountry, WarParticipation } from "@/types/wars";

export type TimeWindow = { start: number; end: number };

type MapProps = {
  participations: WarParticipation[];
  timeWindow: TimeWindow;
  onParticipationClick?: (participation: WarParticipation) => void;
  onCountryClick?: (country: CShapesCountry) => void;
};

export function Map({
  participations,
  timeWindow,
  onParticipationClick,
  onCountryClick,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // All map logic is encapsulated in the custom hook
  useMapLibre(containerRef, {
    participations,
    timeWindow,
    onParticipationClick,
    onCountryClick,
  });

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      aria-label="Interactive map of war participants"
    />
  );
}
