import { HomeClient } from "@/components/client/HomeClient";
import { getWarParticipations, getWars } from "@/lib/data";

const DEFAULT_START = 1826;
const DEFAULT_END = 1830;
const YEAR_MIN = 1820;
const YEAR_MAX = 2000;
const WINDOW_SIZE = 5;

type ViewMode = "map" | "gantt";

function clampStart(start: number): number {
  return Math.max(YEAR_MIN, Math.min(YEAR_MAX - WINDOW_SIZE + 1, start));
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string; view?: string }>;
}) {
  const params = await searchParams;
  const startParam = params.start != null ? parseInt(params.start, 10) : DEFAULT_START;
  const endParam = params.end != null ? parseInt(params.end, 10) : DEFAULT_END;
  const viewParam = params.view === "gantt" ? "gantt" : "map";

  const start = Number.isNaN(startParam) ? DEFAULT_START : clampStart(startParam);
  const end = Number.isNaN(endParam)
    ? Math.min(YEAR_MAX, start + WINDOW_SIZE - 1)
    : Math.max(start, Math.min(YEAR_MAX, endParam));
  const viewMode: ViewMode = viewParam;

  const [participations, wars] = await Promise.all([
    getWarParticipations(start, end),
    getWars(start, end),
  ]);

  const timeWindow = { start, end };

  return (
    <HomeClient
      participations={participations}
      wars={wars}
      timeWindow={timeWindow}
      viewMode={viewMode}
    />
  );
}
