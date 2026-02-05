import { NextRequest, NextResponse } from "next/server";
import { runSparqlSelect } from "@/lib/fuseki";

/**
 * GET /api/ontology/entity?iri=...
 * Returns details of a single entity by IRI
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const iri = searchParams.get("iri");

  if (!iri) {
    return NextResponse.json(
      { error: "Missing iri parameter" },
      { status: 400 }
    );
  }

  // Query for outgoing properties (entity -> property -> value)
  const outgoingQuery = `
PREFIX ex: <http://example.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?label ?prop ?propLabel ?value ?valueLabel
WHERE {
  # Get the entity's label
  OPTIONAL { <${iri}> rdfs:label ?label }
  
  # Get all properties and values
  OPTIONAL { 
    <${iri}> ?prop ?value .
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
`.trim();

  // Query for incoming properties (other entities that reference this entity)
  const incomingQuery = `
PREFIX ex: <http://example.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?subject ?subjectLabel ?prop ?propLabel
WHERE {
  # Find entities that reference this entity
  ?subject ?prop <${iri}> .
  FILTER(?prop != <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>)
  FILTER(?prop != rdfs:label)
  FILTER(STRSTARTS(STR(?prop), "http://example.org/ontology/"))
  
  # Get subject's label
  OPTIONAL { ?subject rdfs:label ?subjectLabel }
  
  # Get property label
  OPTIONAL { ?prop rdfs:label ?propLabel . FILTER(LANG(?propLabel) = "en" || LANG(?propLabel) = "") }
}
ORDER BY ?prop ?subject
`.trim();

  try {
    const [outgoingBindings, incomingBindings] = await Promise.all([
      runSparqlSelect(outgoingQuery),
      runSparqlSelect(incomingQuery),
    ]);

    if (outgoingBindings.length === 0 && incomingBindings.length === 0) {
      return NextResponse.json(
        { error: "Entity not found" },
        { status: 404 }
      );
    }

    // Extract label and outgoing properties
    const label = (outgoingBindings[0] as any)?.label?.value ?? iri.split(/[/#]/).pop() ?? iri;
    
    const properties: Array<{ property: string; value: string; valueIri?: string; isLiteral: boolean }> = [];

    for (const binding of outgoingBindings) {
      const prop = (binding as any).prop?.value;
      const propLabel = (binding as any).propLabel?.value;
      const value = (binding as any).value;
      const valueLabel = (binding as any).valueLabel?.value;

      if (prop && value) {
        const isLiteral = value.type === "literal";
        const propertyName = propLabel ?? prop.split(/[/#]/).pop() ?? prop;
        const displayValue = isLiteral
          ? value.value
          : (valueLabel ?? value.value?.split(/[/#]/).pop() ?? value.value);

        properties.push({
          property: propertyName,
          value: displayValue,
          valueIri: isLiteral ? undefined : value.value,
          isLiteral,
        });
      }
    }

    // Extract incoming relationships (reverse properties)
    const incomingRelations: Array<{ property: string; subject: string; subjectIri: string }> = [];

    for (const binding of incomingBindings) {
      const subject = (binding as any).subject?.value;
      const subjectLabel = (binding as any).subjectLabel?.value;
      const prop = (binding as any).prop?.value;
      const propLabel = (binding as any).propLabel?.value;

      if (subject && prop) {
        const propertyName = propLabel ?? prop.split(/[/#]/).pop() ?? prop;
        const displaySubject = subjectLabel ?? subject.split(/[/#]/).pop() ?? subject;

        incomingRelations.push({
          property: propertyName,
          subject: displaySubject,
          subjectIri: subject,
        });
      }
    }

    return NextResponse.json({
      iri,
      label,
      properties,
      incomingRelations,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "SPARQL error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
