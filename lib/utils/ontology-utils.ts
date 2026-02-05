import type { OntologyData } from "@/lib/ontology";

export type OntologyClass = OntologyData["classes"][number];
export type OntologyProperty = OntologyData["properties"][number];

export type ClassTreeNode = {
  cls: OntologyClass;
  children: ClassTreeNode[];
};

/**
 * Extract local name from an IRI
 */
export function localName(iri: string): string {
  if (iri.startsWith("http://example.org/ontology/"))
    return iri.slice("http://example.org/ontology/".length);
  if (iri.startsWith("http://www.w3.org/2001/XMLSchema#"))
    return "xsd:" + iri.slice("http://www.w3.org/2001/XMLSchema#".length);
  return iri;
}

/**
 * Build a tree structure from flat list of classes
 */
export function buildClassTree(classes: OntologyClass[]): ClassTreeNode[] {
  const byIri = new Map(classes.map((c) => [c.fullIri, c]));
  const roots: ClassTreeNode[] = [];
  const nodeByIri = new Map<string, ClassTreeNode>();

  // Create nodes
  classes.forEach((cls) => {
    nodeByIri.set(cls.fullIri, { cls, children: [] });
  });

  // Build tree structure
  classes.forEach((cls) => {
    const node = nodeByIri.get(cls.fullIri)!;
    if (cls.subClassOf == null || !byIri.has(cls.subClassOf)) {
      roots.push(node);
    } else {
      const parent = nodeByIri.get(cls.subClassOf);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  });

  return roots;
}

/**
 * Convert tree structure to columns (levels) for display
 */
export function treeToColumns(roots: ClassTreeNode[]): ClassTreeNode[][] {
  const columns: ClassTreeNode[][] = [];
  let current = roots;
  while (current.length > 0) {
    columns.push(current);
    current = current.flatMap((n) => n.children);
  }
  return columns;
}

/**
 * Get all properties for a class (including inherited)
 */
export function propertiesForClass(
  clsIri: string,
  classes: OntologyClass[],
  properties: OntologyProperty[]
): OntologyProperty[] {
  const ancestors = new Set<string>();
  let current: string | null = clsIri;
  const byIri = new Map(classes.map((c) => [c.fullIri, c]));
  
  // Collect all ancestor classes
  while (current) {
    ancestors.add(current);
    const c = byIri.get(current);
    current = c?.subClassOf ?? null;
  }
  
  // Filter properties by domain
  return properties.filter(
    (p) => p.domain != null && ancestors.has(p.domain)
  );
}
