import { NextResponse } from "next/server";
import { getOntology } from "@/lib/ontology";

export type { OntologyClass, OntologyProperty, OntologyData } from "@/lib/ontology";

/**
 * GET /api/ontology
 * Returns ontology from Fuseki or app/db/schema/ontology.ttl fallback.
 */
export async function GET() {
  try {
    const data = await getOntology();
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load ontology";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
