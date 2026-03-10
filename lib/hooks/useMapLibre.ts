import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { participationsToGeoJSON, featureToCountry, emptyGeoJSON } from "@/lib/utils/map-utils";
import { cshapesNameToIso } from "@/lib/cshapes-to-iso";
import type { CShapesCountry, WarParticipation } from "@/types/wars";
import { CURATED_TYPES, CATEGORY_COLORS, type WikidataMapEntity } from "@/lib/wikidata-curated-types";

export type MapFillMode = "default" | "population";

// CARTO dark-matter: reliable, free, no API key required.
// Matches the app's dark UI and keeps country/water contrast without clutter.
const DEMOTILES_STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Layers in the demotiles style that draw political boundaries
const BOUNDARY_LAYER_PATTERN = /admin|boundary|disputed/i;

const DEFAULT_CENTER: [number, number] = [10, 30];
const DEFAULT_ZOOM = 2;
const SOURCE_CSHAPES_ID = "cshapes";
const LAYER_CSHAPES_FILL_ID = "cshapes-fill";
const LAYER_CSHAPES_LINE_ID = "cshapes-line";
const SOURCE_ID = "war-participants";
const LAYER_CIRCLES_ID = "war-participants-circles";
const LAYER_CIRCLES_COUNT_ID = "war-participants-count";
const LAYER_LABELS_ID = "war-participants-labels";
const SOURCE_WIKIDATA = "wikidata-overlay";
const LAYER_WIKIDATA_CIRCLES = "wikidata-overlay-circles";
const LAYER_WIKIDATA_LABELS = "wikidata-overlay-labels";
const SOURCE_HIST_COUNTRIES = "historical-countries";
const LAYER_HIST_COUNTRIES_FILL = "historical-countries-fill";
const LAYER_HIST_COUNTRIES_LINE = "historical-countries-line";

const PARTICIPANT_COLOR = "#f59e0b";
const LABEL_COLOR = "#fef3c7";
const CSHAPES_FILL = "rgba(59, 130, 246, 0.2)";
const CSHAPES_LINE = "rgba(59, 130, 246, 0.6)";
const HIST_COUNTRIES_FILL = "rgba(34, 197, 94, 0.15)";
const HIST_COUNTRIES_LINE = "rgba(34, 197, 94, 0.7)";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Choropleth: linear scale from min to max; no data = transparent gray */
function choroplethFill(minValue: number, maxValue: number): unknown[] {
  const noData = "rgba(240, 240, 240, 0.6)";
  const low = "rgba(158, 202, 225, 0.85)";
  const mid = "rgba(66, 146, 198, 0.9)";
  const high = "rgba(33, 113, 181, 0.95)";
  const top = "rgba(8, 81, 156, 0.98)";
  if (minValue === maxValue) {
    return ["interpolate", ["linear"], ["coalesce", ["get", "value"], minValue], minValue, mid];
  }
  const range = maxValue - minValue;
  const q1 = minValue + range * 0.25;
  const q2 = minValue + range * 0.5;
  const q3 = minValue + range * 0.75;
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "value"], minValue - 1],
    minValue - 1,
    noData,
    minValue,
    low,
    q1,
    low,
    q2,
    mid,
    q3,
    high,
    maxValue,
    top,
  ];
}

type UseMapLibreOptions = {
  participations: WarParticipation[];
  timeWindow: { start: number; end: number };
  fillMode?: MapFillMode;
  owidDataset?: string;
  wikidataEntities?: WikidataMapEntity[];
  /** Show the CShapes political boundaries layer (default true). */
  showCShapes?: boolean;
  /** Show historical country boundaries from the PostgreSQL DB (default true). */
  showHistoricalCountries?: boolean;
  /** Called with true when a countries fetch starts, false when it finishes. */
  onHistoricalCountriesLoading?: (loading: boolean) => void;
  onParticipationClick?: (participation: WarParticipation) => void;
  onCountryClick?: (country: CShapesCountry) => void;
  onWikidataEntityClick?: (iri: string) => void;
};

/**
 * Compute the display opacity for an entity based on when it stopped being
 * active relative to the time window.
 *
 * Rule: the "current year" is the window's last year (end).
 *   • No end date, or ended at/after windowEnd  → 1.0  (still active, fully visible)
 *   • Ended at windowEnd - 1                    → ~0.75 (just ended, slightly dimmed)
 *   • Ended at windowStart                      → 0.0  (oldest in window, invisible)
 *   • Ended before windowStart                  → 0.0  (gone, invisible)
 *
 * Linear interpolation between windowStart (0.0) and windowEnd (1.0).
 */
function entityOpacity(endYear: number | undefined, timeWindow: { start: number; end: number }): number {
  const { start, end } = timeWindow;
  // No known end date, or ended at/after the window's last year → fully visible.
  if (endYear == null || endYear >= end) return 1.0;
  // Ended before the window even started → invisible.
  if (endYear <= start) return 0.0;
  // Linear fade: endYear just before `end` is almost fully visible; at `start` is invisible.
  return (endYear - start) / (end - start);
}

function categoryColor(typeIri: string): string {
  const meta = CURATED_TYPES.find((t) => t.iri === typeIri);
  return meta ? (CATEGORY_COLORS[meta.category] ?? "#a855f7") : "#a855f7";
}

function wikidataToGeoJSON(
  entities: WikidataMapEntity[],
  timeWindow: { start: number; end: number }
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: entities.map((e) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [e.lon, e.lat] },
      properties: {
        iri: e.iri,
        label: e.label,
        description: e.description ?? "",
        typeLabel: e.typeLabel,
        color: categoryColor(e.typeIri),
        opacity: entityOpacity(e.endYear, timeWindow),
        endYear: e.endYear ?? null,
      },
    })),
  };
}

/**
 * Custom hook for MapLibre GL initialization and management
 * Handles map lifecycle, data updates, and event handlers
 */
export function useMapLibre(
  containerRef: React.RefObject<HTMLDivElement | null>,
  { participations, timeWindow, fillMode = "default", owidDataset, wikidataEntities, showCShapes = true, showHistoricalCountries = true, onHistoricalCountriesLoading, onParticipationClick, onCountryClick, onWikidataEntityClick }: UseMapLibreOptions
) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const sourceAddedRef = useRef(false);

  const participationsRef = useRef(participations);
  const onParticipationClickRef = useRef(onParticipationClick);
  const onCountryClickRef = useRef(onCountryClick);
  const onWikidataEntityClickRef = useRef(onWikidataEntityClick);
  const timeWindowRef = useRef(timeWindow);
  const fillModeRef = useRef(fillMode);
  const owidDatasetRef = useRef(owidDataset);
  const wikidataEntitiesRef = useRef(wikidataEntities);
  const showCShapesRef = useRef(showCShapes);
  const showHistoricalCountriesRef = useRef(showHistoricalCountries);

  participationsRef.current = participations;
  onParticipationClickRef.current = onParticipationClick;
  onCountryClickRef.current = onCountryClick;
  onWikidataEntityClickRef.current = onWikidataEntityClick;
  timeWindowRef.current = timeWindow;
  fillModeRef.current = fillMode;
  owidDatasetRef.current = owidDataset;
  wikidataEntitiesRef.current = wikidataEntities;
  showCShapesRef.current = showCShapes;
  showHistoricalCountriesRef.current = showHistoricalCountries;
  const onHistoricalCountriesLoadingRef = useRef(onHistoricalCountriesLoading);
  onHistoricalCountriesLoadingRef.current = onHistoricalCountriesLoading;

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DEMOTILES_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.on("style.load", () => {
      // Enable globe projection
      try {
        map.setProjection({ type: "globe" });
      } catch {
        // ignore if globe not supported in this build
      }
      // Remove all political boundary layers
      const styleLayers = map.getStyle().layers ?? [];
      for (const layer of styleLayers) {
        if (BOUNDARY_LAYER_PATTERN.test(layer.id)) {
          map.removeLayer(layer.id);
        }
      }
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      // ── CShapes source and layers (optional) ───────────────────────────────
      map.addSource(SOURCE_CSHAPES_ID, { type: "geojson", data: emptyGeoJSON });

      if (showCShapesRef.current) {
        map.addLayer({
          id: LAYER_CSHAPES_FILL_ID,
          type: "fill",
          source: SOURCE_CSHAPES_ID,
          paint: { "fill-color": CSHAPES_FILL, "fill-outline-color": CSHAPES_LINE },
        });
        map.addLayer({
          id: LAYER_CSHAPES_LINE_ID,
          type: "line",
          source: SOURCE_CSHAPES_ID,
          paint: { "line-color": CSHAPES_LINE, "line-width": 1 },
        });

        // Load CShapes data as soon as map is ready (effect may have run before "load")
        const src = map.getSource(SOURCE_CSHAPES_ID) as maplibregl.GeoJSONSource | undefined;
        if (src) {
          const start = timeWindowRef.current.start;
          const isChoropleth = fillModeRef.current === "population";
          if (!isChoropleth) {
            fetch(`/api/cshapes?start=${start}&end=${start}`)
              .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
              .then((data: GeoJSON.FeatureCollection) => src.setData(data))
              .catch(() => src.setData(emptyGeoJSON));
            map.setPaintProperty(LAYER_CSHAPES_FILL_ID, "fill-color", CSHAPES_FILL);
          } else {
            const dataset = owidDatasetRef.current ?? "population-with-un-projections";
            Promise.all([
              fetch(`/api/cshapes?start=${start}&end=${start}`).then((r) =>
                r.ok ? r.json() : Promise.reject(new Error(r.statusText))
              ) as Promise<GeoJSON.FeatureCollection>,
              fetch(`/api/owid/data?dataset=${encodeURIComponent(dataset)}&year=${start}`).then((r) =>
                r.ok ? r.json() : Promise.reject(new Error(r.statusText))
              ) as Promise<{ byIso: Record<string, number>; byEntity: Record<string, number>; minValue: number; maxValue: number }>,
            ])
            .then(([cshapesData, { byEntity, byIso, minValue, maxValue }]) => {
              const features = (cshapesData.features ?? []).map((f) => {
                const props = { ...(f.properties as Record<string, unknown>) };
                const name = typeof props.cntry_name === "string" ? props.cntry_name : "";
                const iso = cshapesNameToIso(name);
                const value = byEntity[name] ?? (iso ? byIso[iso] : undefined);
                props.value = typeof value === "number" ? value : undefined;
                return { ...f, properties: props };
              });
              src.setData({ type: "FeatureCollection", features });
              map.setPaintProperty(LAYER_CSHAPES_FILL_ID, "fill-color", choroplethFill(minValue, maxValue));
            })
            .catch(() => {
              src.setData(emptyGeoJSON);
              map.setPaintProperty(LAYER_CSHAPES_FILL_ID, "fill-color", CSHAPES_FILL);
            });
          }
        }
      } // end if (showCShapesRef.current)

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
      
      // Count badge: shown on top of circles when multiple events share the same spot
      map.addLayer({
        id: LAYER_CIRCLES_COUNT_ID,
        type: "symbol",
        source: SOURCE_ID,
        filter: [">", ["get", "stackCount"], 1],
        layout: {
          "text-field": ["to-string", ["get", "stackCount"]],
          "text-size": 10,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#1c1917",
          "text-halo-color": "#f59e0b",
          "text-halo-width": 1,
        },
      });

      map.addLayer({
        id: LAYER_LABELS_ID,
        type: "symbol",
        source: SOURCE_ID,
        layout: {
          "text-field": ["get", "warLabels"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 2, 12, 8, 15],
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-max-width": 14,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-optional": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,1)",
          "text-halo-width": 2,
        },
      });

      // ── Wikidata overlay ────────────────────────────────────────────────────
      map.addSource(SOURCE_WIKIDATA, {
        type: "geojson",
        data: wikidataToGeoJSON(wikidataEntitiesRef.current ?? [], timeWindowRef.current),
      });

      map.addLayer({
        id: LAYER_WIKIDATA_CIRCLES,
        type: "circle",
        source: SOURCE_WIKIDATA,
        paint: {
          "circle-radius": 7,
          "circle-color": ["get", "color"],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#fff",
          "circle-opacity": ["get", "opacity"],
          "circle-stroke-opacity": ["get", "opacity"],
        },
      });

      map.addLayer({
        id: LAYER_WIKIDATA_LABELS,
        type: "symbol",
        source: SOURCE_WIKIDATA,
        layout: {
          "text-field": [
            "format",
            ["get", "label"],    { "font-scale": 1.0 },
            "\n",                {},
            ["get", "typeLabel"], { "font-scale": 0.75 },
          ],
          "text-size": ["interpolate", ["linear"], ["zoom"], 2, 12, 8, 15],
          "text-offset": [0, 1.3],
          "text-anchor": "top",
          "text-max-width": 14,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-optional": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,1)",
          "text-halo-width": 2,
          "text-opacity": ["get", "opacity"],
        },
      });

      // Wikidata overlay hover tooltip
      const wikidataPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "cartopedia-hover-popup",
      });

      const showWikidataPopup = (e: maplibregl.MapLayerMouseEvent) => {
        // Use queryRenderedFeatures so ordering is consistent with the click handler.
        // De-duplicate by IRI in case the same feature appears multiple times.
        const features = map.queryRenderedFeatures(e.point, { layers: [LAYER_WIKIDATA_CIRCLES] });
        const seen = new Set<string>();
        const rows: string[] = [];

        for (const f of features) {
          const props = (f.properties ?? {}) as {
            iri?: string; label?: string; typeLabel?: string;
            description?: string; endYear?: number | null;
          };
          const iri = props.iri ?? "";
          if (seen.has(iri)) continue;
          seen.add(iri);

          const label = props.label ?? "";
          const typeLabel = props.typeLabel ?? "";
          const description = props.description ?? "";
          const endYear = typeof props.endYear === "number" ? props.endYear : null;

          const secondaryParts: string[] = [];
          if (typeLabel) secondaryParts.push(escapeHtml(typeLabel));
          if (endYear !== null) secondaryParts.push(`ended ${endYear}`);
          const secondary = secondaryParts.join(" · ");

          rows.push(
            `<div style="margin:2px 0"><strong>${escapeHtml(label)}</strong>` +
            (secondary ? `<br/><span style="color:#a1a1aa;font-size:0.85em">${secondary}</span>` : "") +
            (description ? `<br/><span style="color:#d4d4d8;font-size:0.8em">${escapeHtml(description)}</span>` : "") +
            `</div>`
          );
        }

        if (!rows.length) return;

        const header = rows.length > 1
          ? `<div style="color:#a1a1aa;font-size:0.8em;margin-bottom:6px">${rows.length} events at this location</div>`
          : "";

        wikidataPopup
          .setLngLat(e.lngLat)
          .setHTML(header + rows.join("<hr style='border-color:#3f3f46;margin:4px 0'/>"))
          .addTo(map);
      };

      map.on("mouseenter", LAYER_WIKIDATA_CIRCLES, (e) => {
        map.getCanvas().style.cursor = "pointer";
        showWikidataPopup(e);
      });
      map.on("mousemove", LAYER_WIKIDATA_CIRCLES, (e) => {
        showWikidataPopup(e);
      });
      map.on("mouseleave", LAYER_WIKIDATA_CIRCLES, () => {
        map.getCanvas().style.cursor = "";
        wikidataPopup.remove();
      });

      // Participation circles hover tooltip
      const participationPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "cartopedia-hover-popup",
      });

      const getParticipationsAtPoint = (point: maplibregl.Point): WarParticipation[] => {
        const features = map.queryRenderedFeatures(point, { layers: [LAYER_CIRCLES_ID] });
        const indices = [
          ...new Set(
            features
              .map((f) => {
                const p = f.properties as { index?: unknown } | undefined;
                return typeof p?.index === "number" ? p.index : null;
              })
              .filter((v): v is number => v !== null)
          ),
        ];
        return indices
          .map((idx) => participationsRef.current[idx])
          .filter((p): p is WarParticipation => !!p);
      };

      const showParticipationPopup = (e: maplibregl.MapLayerMouseEvent) => {
        const participationsAtPoint = getParticipationsAtPoint(e.point);
        if (!participationsAtPoint.length) return;

        const warRows: string[] = [];
        for (const part of participationsAtPoint) {
          for (const war of part.wars) {
            const startYear = war.startDate?.split("-")[0] ?? "";
            const endYear = war.endDate?.split("-")[0] ?? "";
            const dateStr = endYear && endYear !== startYear
              ? `${startYear} – ${endYear}`
              : startYear;
            warRows.push(
              `<div style="margin:2px 0"><strong>${escapeHtml(war.label)}</strong>` +
              (dateStr ? `<br/><span style="color:#a1a1aa;font-size:0.85em">${escapeHtml(dateStr)}</span>` : "") +
              `</div>`
            );
          }
        }

        const header = participationsAtPoint.length > 1
          ? `<div style="color:#a1a1aa;font-size:0.8em;margin-bottom:6px">${participationsAtPoint.length} events at this location</div>`
          : "";

        participationPopup
          .setLngLat(e.lngLat)
          .setHTML(header + warRows.join("<hr style='border-color:#3f3f46;margin:4px 0'/>"))
          .addTo(map);
      };

      map.on("mouseenter", LAYER_CIRCLES_ID, (e) => {
        map.getCanvas().style.cursor = "pointer";
        showParticipationPopup(e);
      });
      map.on("mousemove", LAYER_CIRCLES_ID, (e) => {
        showParticipationPopup(e);
      });
      map.on("mouseleave", LAYER_CIRCLES_ID, () => {
        map.getCanvas().style.cursor = "";
        participationPopup.remove();
      });

      // CShapes hover: show value tooltip when in choropleth mode
      const hoverPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "cartopedia-hover-popup",
      });
      const showHoverPopup = (lngLat: maplibregl.LngLat, props: Record<string, unknown>) => {
        const name = (typeof props.cntry_name === "string" ? props.cntry_name : "") || "Unknown";
        const raw = props.value;
        const value =
          typeof raw === "number"
            ? raw >= 1e6
              ? `${(raw / 1e6).toFixed(2)}M`
              : raw >= 1e3
                ? `${(raw / 1e3).toFixed(2)}K`
                : Number.isInteger(raw)
                  ? String(raw)
                  : raw.toFixed(2)
            : "—";
        hoverPopup.setLngLat(lngLat).setHTML(`<strong>${escapeHtml(name)}</strong><br/>${escapeHtml(value)}`).addTo(map);
      };
      map.on("mouseenter", LAYER_CSHAPES_FILL_ID, (e) => {
        if (map.queryRenderedFeatures(e.point, { layers: [LAYER_CIRCLES_ID, LAYER_WIKIDATA_CIRCLES] }).length) return;
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (f?.properties && fillModeRef.current === "population") showHoverPopup(e.lngLat, f.properties as Record<string, unknown>);
      });
      map.on("mousemove", LAYER_CSHAPES_FILL_ID, (e) => {
        if (map.queryRenderedFeatures(e.point, { layers: [LAYER_CIRCLES_ID, LAYER_WIKIDATA_CIRCLES] }).length) { hoverPopup.remove(); return; }
        const f = e.features?.[0];
        if (f?.properties && fillModeRef.current === "population") showHoverPopup(e.lngLat, f.properties as Record<string, unknown>);
      });
      map.on("mouseleave", LAYER_CSHAPES_FILL_ID, () => {
        map.getCanvas().style.cursor = "";
        hoverPopup.remove();
      });

      // ── Historical countries from PostgreSQL DB ──────────────────────────────
      map.addSource(SOURCE_HIST_COUNTRIES, { type: "geojson", data: emptyGeoJSON });

      map.addLayer({
        id: LAYER_HIST_COUNTRIES_FILL,
        type: "fill",
        source: SOURCE_HIST_COUNTRIES,
        paint: {
          "fill-color": HIST_COUNTRIES_FILL,
          "fill-outline-color": HIST_COUNTRIES_LINE,
        },
      });

      map.addLayer({
        id: LAYER_HIST_COUNTRIES_LINE,
        type: "line",
        source: SOURCE_HIST_COUNTRIES,
        paint: {
          "line-color": HIST_COUNTRIES_LINE,
          "line-width": 1.5,
        },
      });

      // Add a hover popup showing the country name
      const histPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "cartopedia-hover-popup",
      });
      const showHistPopup = (e: maplibregl.MapLayerMouseEvent) => {
        // Let event/wikidata tooltips win.
        const overPoints = map.queryRenderedFeatures(e.point, { layers: [LAYER_CIRCLES_ID, LAYER_WIKIDATA_CIRCLES] });
        if (overPoints.length) { histPopup.remove(); return; }
        const features = map.queryRenderedFeatures(e.point, { layers: [LAYER_HIST_COUNTRIES_FILL] });
        if (features.length === 0) return;
        const names = [
          ...new Set(
            features
              .map((f) => {
                const p = f.properties as Record<string, unknown>;
                return typeof p.name === "string" ? p.name : null;
              })
              .filter((n): n is string => n !== null)
          ),
        ];
        const html = names.map((n) => `<strong>${escapeHtml(n)}</strong>`).join("<br/>");
        histPopup.setLngLat(e.lngLat).setHTML(html).addTo(map);
      };

      map.on("mouseenter", LAYER_HIST_COUNTRIES_FILL, (e) => {
        if (map.queryRenderedFeatures(e.point, { layers: [LAYER_CIRCLES_ID, LAYER_WIKIDATA_CIRCLES] }).length) return;
        map.getCanvas().style.cursor = "pointer";
        showHistPopup(e);
      });
      map.on("mousemove", LAYER_HIST_COUNTRIES_FILL, (e) => {
        showHistPopup(e);
      });
      map.on("mouseleave", LAYER_HIST_COUNTRIES_FILL, () => {
        map.getCanvas().style.cursor = "";
        histPopup.remove();
      });

      // ── Single unified click handler — priority: events > wikidata > hist countries > cshapes ──
      map.on("click", (e) => {
        // Priority 1: war event circles
        const eventParticipations = getParticipationsAtPoint(e.point);
        if (eventParticipations.length) {
          const cb = onParticipationClickRef.current;
          if (cb) cb(eventParticipations[0]);
          return;
        }

        // Priority 2: wikidata overlay circles
        const wikidataFeatures = map.queryRenderedFeatures(e.point, { layers: [LAYER_WIKIDATA_CIRCLES] });
        if (wikidataFeatures.length) {
          const cb = onWikidataEntityClickRef.current;
          const { iri } = (wikidataFeatures[0].properties ?? {}) as { iri?: string };
          if (cb && iri) cb(iri);
          return;
        }

        // Priority 3: historical countries
        const histFeatures = map.queryRenderedFeatures(e.point, { layers: [LAYER_HIST_COUNTRIES_FILL] });
        if (histFeatures.length) {
          const cb = onWikidataEntityClickRef.current;
          const props = histFeatures[0].properties as Record<string, unknown>;
          const qid = typeof props.wikidata_id === "string" ? props.wikidata_id : null;
          if (cb && qid) cb(`http://www.wikidata.org/entity/${qid}`);
          return;
        }

        // Priority 4: CShapes country polygons
        const cshapesFeatures = map.queryRenderedFeatures(e.point, { layers: [LAYER_CSHAPES_FILL_ID] });
        if (cshapesFeatures.length) {
          const cb = onCountryClickRef.current;
          const country = featureToCountry(cshapesFeatures[0].properties as Record<string, unknown>);
          if (cb && country) cb(country);
          return;
        }
      });

      if (showHistoricalCountriesRef.current) {
        const { end } = timeWindowRef.current;
        const src = map.getSource(SOURCE_HIST_COUNTRIES) as maplibregl.GeoJSONSource | undefined;
        if (src) {
          onHistoricalCountriesLoadingRef.current?.(true);
          fetch(`/api/countries?year=${end}`)
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
            .then((data: GeoJSON.FeatureCollection) => src.setData(data))
            .catch(() => src.setData(emptyGeoJSON))
            .finally(() => onHistoricalCountriesLoadingRef.current?.(false));
        }
      }

      // Ensure event and Wikidata overlays render above country polygons
      for (const layerId of [
        LAYER_CIRCLES_ID,
        LAYER_CIRCLES_COUNT_ID,
        LAYER_LABELS_ID,
        LAYER_WIKIDATA_CIRCLES,
        LAYER_WIKIDATA_LABELS,
      ]) {
        if (map.getLayer(layerId)) {
          map.moveLayer(layerId);
        }
      }

      sourceAddedRef.current = true;
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      sourceAddedRef.current = false;
    };
  }, [containerRef]);

  // Update participations data when it changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;
    
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(participationsToGeoJSON(participations));
    }
  }, [participations]);

  // Recompute and push wikidata GeoJSON when either the entities or the time
  // window changes (opacity depends on both).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;
    const src = map.getSource(SOURCE_WIKIDATA) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(wikidataToGeoJSON(wikidataEntities ?? [], timeWindowRef.current));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wikidataEntities]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;
    const src = map.getSource(SOURCE_WIKIDATA) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(wikidataToGeoJSON(wikidataEntitiesRef.current ?? [], timeWindow));
  // Use primitive values as deps so this only fires when the window actually moves
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindow.start, timeWindow.end]);

  // Update CShapes data and fill style when time window or fill mode changes
  useEffect(() => {
    if (!showCShapes) return;
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;

    const source = map.getSource(SOURCE_CSHAPES_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const { start } = timeWindow;
    const isChoropleth = fillMode === "population";

    if (!isChoropleth) {
      fetch(`/api/cshapes?start=${start}&end=${start}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
        .then((data: GeoJSON.FeatureCollection) => source.setData(data))
        .catch(() => source.setData(emptyGeoJSON));
      map.setPaintProperty(LAYER_CSHAPES_FILL_ID, "fill-color", CSHAPES_FILL);
      return;
    }

    const dataset = owidDataset ?? "population-with-un-projections";
    Promise.all([
      fetch(`/api/cshapes?start=${start}&end=${start}`).then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(res.statusText))
      ) as Promise<GeoJSON.FeatureCollection>,
      fetch(`/api/owid/data?dataset=${encodeURIComponent(dataset)}&year=${start}`).then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(res.statusText))
      ) as Promise<{ byIso: Record<string, number>; byEntity: Record<string, number>; minValue: number; maxValue: number }>,
    ])
      .then(([cshapesData, { byEntity, byIso, minValue, maxValue }]) => {
        const features = (cshapesData.features ?? []).map((f) => {
          const props = { ...(f.properties as Record<string, unknown>) };
          const name = typeof props.cntry_name === "string" ? props.cntry_name : "";
          const iso = cshapesNameToIso(name);
          const value = byEntity[name] ?? (iso ? byIso[iso] : undefined);
          props.value = typeof value === "number" ? value : undefined;
          return { ...f, properties: props };
        });
        source.setData({ type: "FeatureCollection", features });
        map.setPaintProperty(LAYER_CSHAPES_FILL_ID, "fill-color", choroplethFill(minValue, maxValue));
      })
      .catch(() => {
        source.setData(emptyGeoJSON);
        map.setPaintProperty(LAYER_CSHAPES_FILL_ID, "fill-color", CSHAPES_FILL);
      });
  }, [timeWindow, fillMode, owidDataset]);

  // Refresh historical countries when the chosen year (end) changes
  useEffect(() => {
    if (!showHistoricalCountries) return;
    const map = mapRef.current;
    if (!map || !sourceAddedRef.current) return;
    const src = map.getSource(SOURCE_HIST_COUNTRIES) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const { end } = timeWindow;
    onHistoricalCountriesLoadingRef.current?.(true);
    fetch(`/api/countries?year=${end}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: GeoJSON.FeatureCollection) => src.setData(data))
      .catch(() => src.setData(emptyGeoJSON))
      .finally(() => onHistoricalCountriesLoadingRef.current?.(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindow.end, showHistoricalCountries]);

  return mapRef;
}
