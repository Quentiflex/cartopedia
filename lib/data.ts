/**
 * Server-side data loading for wars and war participants.
 * Use from Server Components or API routes.
 */

import {
  buildWarParticipantsQuery,
  buildWarsQuery,
  runSparqlSelect,
  type SparqlBinding,
} from "@/lib/fuseki";
import type { War, WarParticipation } from "@/types/wars";

function parseParticipationBinding(b: SparqlBinding): {
  participant: string;
  participantLabel: string;
  lat: number;
  lon: number;
  war: string;
  warLabel: string;
  warStart: string;
  warEnd: string | null;
} | null {
  const participant = b.participant?.value;
  const participantLabel = b.participantLabel?.value;
  const war = b.war?.value;
  const warLabel = b.warLabel?.value;
  const warStart = b.warStart?.value;
  const latRaw = b.lat?.value;
  const lonRaw = b.lon?.value;
  if (
    !participant ||
    !participantLabel ||
    !war ||
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
    war,
    warLabel,
    warStart,
    warEnd: b.warEnd?.value ?? null,
  };
}

/**
 * Load war participants for a year range (for map). Server-only.
 */
export async function getWarParticipations(
  startYear: number,
  endYear: number
): Promise<WarParticipation[]> {
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
      wars: { id: string; label: string; startDate: string; endDate: string | null }[];
    }
  >();

  for (const b of bindings) {
    const row = parseParticipationBinding(b);
    if (!row) continue;
    const key = row.participant;
    const existing = byKey.get(key);
    const warEntry = {
      id: row.war,
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

  return Array.from(byKey.values()).map((v) => ({
    participantId: v.participantId,
    participantLabel: v.participantLabel,
    latitude: v.latitude,
    longitude: v.longitude,
    warLabels: v.warLabels,
    wars: v.wars,
  }));
}

/**
 * Load wars for a year range (for Gantt). Server-only.
 */
export async function getWars(
  startYear: number,
  endYear: number
): Promise<War[]> {
  const query = buildWarsQuery(startYear, endYear);
  const bindings = await runSparqlSelect(query);

  return bindings
    .filter(
      (b) =>
        b.war?.value &&
        b.warLabel?.value &&
        b.warStart?.value
    )
    .map((b) => ({
      id: b.war!.value!,
      label: b.warLabel!.value!,
      startDate: b.warStart!.value!,
      endDate: b.warEnd?.value ?? null,
    }));
}
