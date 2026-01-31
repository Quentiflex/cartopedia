import { NextRequest, NextResponse } from "next/server";
import {
  buildWarParticipantsQuery,
  runSparqlSelect,
  type SparqlBinding,
} from "@/app/lib/fuseki";
import type { WarParticipation } from "@/app/types/wars";

function parseBinding(b: SparqlBinding): {
  participant: string;
  participantLabel: string;
  lat: number;
  lon: number;
  warLabel: string;
  warStart: string;
  warEnd: string | null;
} | null {
  const participant = b.participant?.value;
  const participantLabel = b.participantLabel?.value;
  const warLabel = b.warLabel?.value;
  const warStart = b.warStart?.value;
  const latRaw = b.lat?.value;
  const lonRaw = b.lon?.value;
  if (
    !participant ||
    !participantLabel ||
    !warLabel ||
    !warStart ||
    latRaw == null ||
    lonRaw == null
  ) {
    return null;
  }
  const lat = parseFloat(latRaw);
  const lon = parseFloat(lonRaw);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return {
    participant,
    participantLabel,
    lat,
    lon,
    warLabel,
    warStart,
    warEnd: b.warEnd?.value ?? null,
  };
}

/**
 * GET /api/war-participants?start=1826&end=1830
 * Returns participants (with coordinates) that took part in at least one war
 * overlapping the given year window, with war names and dates for map labels.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const startYear = startParam != null ? parseInt(startParam, 10) : 1820;
  const endYear = endParam != null ? parseInt(endParam, 10) : 1830;

  if (Number.isNaN(startYear) || Number.isNaN(endYear) || startYear > endYear) {
    return NextResponse.json(
      { error: "Invalid start/end years" },
      { status: 400 }
    );
  }

  try {
    const query = buildWarParticipantsQuery(startYear, endYear);
    const bindings = await runSparqlSelect(query);

    const byKey = new Map<
      string,
      {
        participantId: string;
        participantLabel: string;
        latitude: number;
        longitude: number;
        warLabels: string[];
        wars: { label: string; startDate: string; endDate: string | null }[];
      }
    >();

    for (const b of bindings) {
      const row = parseBinding(b);
      if (!row) continue;
      const key = row.participant;
      const existing = byKey.get(key);
      const warEntry = {
        label: row.warLabel,
        startDate: row.warStart,
        endDate: row.warEnd,
      };
      if (!existing) {
        byKey.set(key, {
          participantId: row.participant,
          participantLabel: row.participantLabel,
          latitude: row.lat,
          longitude: row.lon,
          warLabels: [row.warLabel],
          wars: [warEntry],
        });
      } else {
        if (!existing.warLabels.includes(row.warLabel)) {
          existing.warLabels.push(row.warLabel);
          existing.wars.push(warEntry);
        }
      }
    }

    const result: WarParticipation[] = Array.from(byKey.values()).map((v) => ({
      participantId: v.participantId,
      participantLabel: v.participantLabel,
      latitude: v.latitude,
      longitude: v.longitude,
      warLabels: v.warLabels,
      wars: v.wars,
    }));

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "SPARQL error";
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
