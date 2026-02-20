/**
 * Server-side data loading for wars and war participants.
 *
 * The local Fuseki dataset is no longer used. War and participant data
 * is now served exclusively through the Wikidata overlay
 * (/api/wikidata/map-entities) on the client side.
 */

import type { War, WarParticipation } from "@/types/wars";

export async function getWarParticipations(
  _startYear: number,
  _endYear: number
): Promise<WarParticipation[]> {
  return [];
}

export async function getWars(
  _startYear: number,
  _endYear: number
): Promise<War[]> {
  return [];
}
