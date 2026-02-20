/**
 * Server-side ontology loading from app/db/schema/ontology.ttl.
 * Use from Server Components or API routes.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const EX = "http://example.org/ontology/";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const XSD = "http://www.w3.org/2001/XMLSchema#";

function localName(iri: string): string {
  if (iri.startsWith(EX)) return iri.slice(EX.length);
  if (iri.startsWith(RDFS)) return "rdfs:" + iri.slice(RDFS.length);
  if (iri.startsWith(RDF)) return "rdf:" + iri.slice(RDF.length);
  if (iri.startsWith(XSD)) return "xsd:" + iri.slice(XSD.length);
  return iri;
}

export type OntologyClass = {
  id: string;
  fullIri: string;
  label: string;
  comment: string | null;
  subClassOf: string | null;
};

export type OntologyProperty = {
  id: string;
  fullIri: string;
  label: string;
  comment: string | null;
  domain: string | null;
  range: string | null;
};

export type OntologyData = {
  classes: OntologyClass[];
  properties: OntologyProperty[];
};

function expandPrefixed(value: string, prefixes: Record<string, string>): string {
  if (value.startsWith("<") && value.endsWith(">"))
    return value.slice(1, -1);
  const [pre, local] = value.split(":", 2);
  if (pre && local && prefixes[pre]) return prefixes[pre] + local;
  return value;
}

function parseObjectLiteral(line: string): string {
  const match = line.match(/"([^"]*)"(?:\s*@\w+)?\s*[.;]/);
  return match ? match[1] : "";
}

function parseTtl(content: string): OntologyData {
  const prefixes: Record<string, string> = {
    ex: EX,
    rdfs: RDFS,
    rdf: RDF,
    xsd: XSD,
    owl: "http://www.w3.org/2002/07/owl#",
    dcterms: "http://purl.org/dc/terms/",
  };

  const classes: Map<string, OntologyClass> = new Map();
  const properties: Map<string, OntologyProperty> = new Map();

  const lines = content.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    const subjectMatch = trimmed.match(/^(ex:\w+)\s+a\s+(rdfs:Class|rdf:Property)\s*[.;]/);
    if (subjectMatch) {
      const subject = expandPrefixed(subjectMatch[1], prefixes);
      const type = subjectMatch[2];
      const subjectLocal = localName(subject);
      i++;

      if (type === "rdfs:Class") {
        let label = subjectLocal;
        let comment: string | null = null;
        let subClassOf: string | null = null;

        while (i < lines.length) {
          const next = lines[i].trim();
          if (!next) break;
          if (next.startsWith("rdfs:label")) {
            label = parseObjectLiteral(lines[i]) || label;
          } else if (next.startsWith("rdfs:comment")) {
            comment = parseObjectLiteral(lines[i]);
          } else if (next.startsWith("rdfs:subClassOf")) {
            const m = next.match(/rdfs:subClassOf\s+(ex:\w+)\s*[.;]/);
            subClassOf = m ? expandPrefixed(m[1], prefixes) : null;
          }
          if (next.endsWith(".")) {
            i++;
            break;
          }
          i++;
        }
        classes.set(subject, {
          id: subjectLocal,
          fullIri: subject,
          label,
          comment,
          subClassOf,
        });
      } else {
        let label = subjectLocal;
        let comment: string | null = null;
        let domain: string | null = null;
        let range: string | null = null;

        while (i < lines.length) {
          const next = lines[i].trim();
          if (!next) break;
          if (next.startsWith("rdfs:label")) {
            label = parseObjectLiteral(lines[i]) || label;
          } else if (next.startsWith("rdfs:comment")) {
            comment = parseObjectLiteral(lines[i]);
          } else if (next.startsWith("rdfs:domain")) {
            const m = next.match(/rdfs:domain\s+(ex:\w+|xsd:\w+)\s*[.;]/);
            domain = m ? expandPrefixed(m[1], prefixes) : null;
          } else if (next.startsWith("rdfs:range")) {
            const m = next.match(/rdfs:range\s+(ex:\w+|xsd:\w+)\s*[.;]/);
            range = m ? expandPrefixed(m[1], prefixes) : null;
          }
          if (next.endsWith(".")) {
            i++;
            break;
          }
          i++;
        }
        properties.set(subject, {
          id: subjectLocal,
          fullIri: subject,
          label,
          comment,
          domain,
          range,
        });
      }
      i++;
      continue;
    }
    i++;
  }

  return {
    classes: Array.from(classes.values()),
    properties: Array.from(properties.values()),
  };
}

/**
 * Load ontology from app/db/schema/ontology.ttl.
 * Safe to call from Server Components and API routes.
 */
export async function getOntology(): Promise<OntologyData> {
  const path = join(process.cwd(), "app", "db", "schema", "ontology.ttl");
  const content = await readFile(path, "utf-8");
  return parseTtl(content);
}
