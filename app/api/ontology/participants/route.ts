import { NextResponse } from "next/server";
import { runSparqlSelect } from "@/lib/fuseki";

/**
 * GET /api/ontology/participants
 * Returns list of all participants (entities that participated in events)
 */
export async function GET() {
  const query = `
PREFIX ex: <http://example.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?participant ?label
WHERE {
  ?event ex:hasParticipant ?participant .
  OPTIONAL { ?participant rdfs:label ?label }
}
ORDER BY ?label
`.trim();

  try {
    const bindings = await runSparqlSelect(query);

    const participants = bindings
      .map((binding: any) => ({
        iri: binding.participant?.value,
        label: binding.label?.value ?? binding.participant?.value?.split(/[/#]/).pop() ?? binding.participant?.value,
      }))
      .filter((p) => p.iri);

    return NextResponse.json(participants);
  } catch (err) {
    const message = err instanceof Error ? err.message : "SPARQL error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
