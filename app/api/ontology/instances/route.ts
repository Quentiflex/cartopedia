import { NextRequest, NextResponse } from "next/server";
import { runSparqlSelect } from "@/lib/fuseki";

/**
 * GET /api/ontology/instances?classIri=...&page=1&limit=12&startYear=...&endYear=...&participant=...
 * Returns instances of a given ontology class with pagination and optional filters.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const classIri = searchParams.get("classIri");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "12", 10);
  
  // Optional filters
  const startYear = searchParams.get("startYear");
  const endYear = searchParams.get("endYear");
  const participantIri = searchParams.get("participant");

  if (!classIri) {
    return NextResponse.json(
      { error: "Missing classIri parameter" },
      { status: 400 }
    );
  }

  if (page < 1 || limit < 1 || limit > 100) {
    return NextResponse.json(
      { error: "Invalid pagination parameters" },
      { status: 400 }
    );
  }

  const offset = (page - 1) * limit;

  // Build filter conditions
  let dateFilter = "";
  if (startYear || endYear) {
    dateFilter = `
    # Date range filter
    OPTIONAL { ?instance <http://example.org/ontology/startDate> ?instanceStart }
    OPTIONAL { ?instance <http://example.org/ontology/endDate> ?instanceEnd }`;
    
    if (startYear && endYear) {
      dateFilter += `
    FILTER(
      (BOUND(?instanceStart) && YEAR(?instanceStart) <= ${endYear}) &&
      (!BOUND(?instanceEnd) || YEAR(?instanceEnd) >= ${startYear})
    )`;
    } else if (startYear) {
      dateFilter += `
    FILTER(!BOUND(?instanceEnd) || YEAR(?instanceEnd) >= ${startYear})`;
    } else if (endYear) {
      dateFilter += `
    FILTER(BOUND(?instanceStart) && YEAR(?instanceStart) <= ${endYear})`;
    }
  }

  let participantFilter = "";
  if (participantIri) {
    participantFilter = `
    # Participant filter
    ?instance <http://example.org/ontology/hasParticipant> <${participantIri}> .`;
  }

  // Query to get instances of the class AND all its subclasses (recursive) with their properties
  // Also fetch labels for referenced entities
  const query = `
PREFIX ex: <http://example.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?instance ?label ?prop ?propLabel ?value ?valueLabel
WHERE {
  # Match instances of the class or any of its subclasses
  ?instance a ?type .
  ?type rdfs:subClassOf* <${classIri}> .
  ${dateFilter}
  ${participantFilter}
  
  # Get the instance's own label
  OPTIONAL { ?instance rdfs:label ?label }
  
  # Get properties and values
  OPTIONAL { 
    ?instance ?prop ?value .
    FILTER(?prop != <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>)
    FILTER(?prop != rdfs:label)
    
    # Get property label
    OPTIONAL { ?prop rdfs:label ?propLabel . FILTER(LANG(?propLabel) = "en" || LANG(?propLabel) = "") }
    
    # If value is a resource (not a literal), try to get its label
    OPTIONAL { 
      ?value rdfs:label ?valueLabel .
      FILTER(LANG(?valueLabel) = "en" || LANG(?valueLabel) = "")
    }
  }
}
ORDER BY ?instance ?prop
`.trim();

  // Query to count total instances (including subclasses and filters)
  const countQuery = `
PREFIX ex: <http://example.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT (COUNT(DISTINCT ?instance) as ?total)
WHERE {
  ?instance a ?type .
  ?type rdfs:subClassOf* <${classIri}> .
  ${dateFilter}
  ${participantFilter}
}
`.trim();

  try {
    const [bindings, countBindings] = await Promise.all([
      runSparqlSelect(query),
      runSparqlSelect(countQuery),
    ]);

    const total = parseInt(
      (countBindings[0] as any)?.total?.value ?? "0",
      10
    );

    // Group properties by instance
    const instancesMap = new Map<
      string,
      {
        iri: string;
        label: string;
        properties: Array<{ property: string; value: string; valueIri?: string; isLiteral: boolean }>;
      }
    >();

    for (const binding of bindings) {
      const instanceIri = (binding as any).instance?.value;
      if (!instanceIri) continue;

      if (!instancesMap.has(instanceIri)) {
        instancesMap.set(instanceIri, {
          iri: instanceIri,
          label: (binding as any).label?.value ?? instanceIri.split(/[/#]/).pop() ?? instanceIri,
          properties: [],
        });
      }

      const instance = instancesMap.get(instanceIri)!;
      const prop = (binding as any).prop?.value;
      const propLabel = (binding as any).propLabel?.value;
      const value = (binding as any).value;
      const valueLabel = (binding as any).valueLabel?.value;

      if (prop && value) {
        const isLiteral = value.type === "literal";
        
        // Use human-readable labels when available
        const propertyName = propLabel ?? prop.split(/[/#]/).pop() ?? prop;
        const displayValue = isLiteral
          ? value.value
          : (valueLabel ?? value.value?.split(/[/#]/).pop() ?? value.value);

        instance.properties.push({
          property: propertyName,
          value: displayValue,
          valueIri: isLiteral ? undefined : value.value,
          isLiteral,
        });
      }
    }

    // Convert to array and apply pagination
    const allInstances = Array.from(instancesMap.values());
    const paginatedInstances = allInstances.slice(offset, offset + limit);

    return NextResponse.json({
      instances: paginatedInstances,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "SPARQL error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
