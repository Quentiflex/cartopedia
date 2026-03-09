"use client";

import { useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMapLibre, type MapFillMode } from "@/lib/hooks/useMapLibre";
import type { CShapesCountry, WarParticipation } from "@/types/wars";
import type { WikidataMapEntity } from "@/lib/wikidata-curated-types";

export type TimeWindow = { start: number; end: number };

type MapProps = {
  participations: WarParticipation[];
  timeWindow: TimeWindow;
  fillMode?: MapFillMode;
  owidDataset?: string;
  wikidataEntities?: WikidataMapEntity[];
  showCShapes?: boolean;
  showHistoricalCountries?: boolean;
  onHistoricalCountriesLoading?: (loading: boolean) => void;
  onParticipationClick?: (participation: WarParticipation) => void;
  onCountryClick?: (country: CShapesCountry) => void;
  onWikidataEntityClick?: (iri: string) => void;
};

export function Map({
  participations,
  timeWindow,
  fillMode = "default",
  owidDataset,
  wikidataEntities,
  showCShapes = true,
  showHistoricalCountries = true,
  onHistoricalCountriesLoading,
  onParticipationClick,
  onCountryClick,
  onWikidataEntityClick,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useMapLibre(containerRef, {
    participations,
    timeWindow,
    fillMode,
    owidDataset,
    wikidataEntities,
    showCShapes,
    showHistoricalCountries,
    onHistoricalCountriesLoading,
    onParticipationClick,
    onCountryClick,
    onWikidataEntityClick,
  });

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      aria-label="Interactive map of war participants"
    />
  );
}
