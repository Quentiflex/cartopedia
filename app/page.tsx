import { HomeClient } from "@/components/client/HomeClient";

// Default: year 1500, with a 50-year memory window (events from 1450–1500)
const DEFAULT_END = 1500;
const DEFAULT_START = DEFAULT_END - 50;
const YEAR_MIN = -1000;
const YEAR_MAX = new Date().getFullYear();

type ViewMode = "map" | "gantt";

function clampYear(year: number): number {
  return Math.max(YEAR_MIN, Math.min(YEAR_MAX, year));
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string; view?: string; entity?: string }>;
}) {
  const params = await searchParams;
  const startParam = params.start != null ? parseInt(params.start, 10) : DEFAULT_START;
  const endParam = params.end != null ? parseInt(params.end, 10) : DEFAULT_END;
  const viewParam = params.view === "gantt" ? "gantt" : "map";

  const start = clampYear(Number.isNaN(startParam) ? DEFAULT_START : startParam);
  const end = clampYear(
    Number.isNaN(endParam) ? DEFAULT_END : Math.max(start, endParam)
  );
  const viewMode: ViewMode = viewParam;
  // Wikidata entity ID (e.g. "Q31") to open on load, if present in URL
  const entityId = typeof params.entity === "string" && params.entity.match(/^Q\d+$/)
    ? params.entity
    : undefined;

  return (
    <HomeClient
      participations={[]}
      wars={[]}
      timeWindow={{ start, end }}
      viewMode={viewMode}
      initialEntityId={entityId}
    />
  );
}
