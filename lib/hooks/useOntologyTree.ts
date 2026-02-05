import { useMemo, useState } from "react";
import type { OntologyData } from "@/lib/ontology";
import {
  buildClassTree,
  treeToColumns,
  propertiesForClass,
  type OntologyClass,
  type OntologyProperty,
  type ClassTreeNode,
} from "@/lib/utils/ontology-utils";

export function useOntologyTree(data: OntologyData | null) {
  const [selectedClass, setSelectedClass] = useState<OntologyClass | null>(null);

  // Memoize tree columns computation
  const columns = useMemo<ClassTreeNode[][]>(() => {
    if (!data) return [];
    return treeToColumns(buildClassTree(data.classes));
  }, [data]);

  // Memoize properties computation
  const selectedProperties = useMemo<OntologyProperty[]>(() => {
    if (!data || !selectedClass) return [];
    return propertiesForClass(selectedClass.fullIri, data.classes, data.properties);
  }, [data, selectedClass]);

  // Reset selected class when dialog opens/closes
  const resetSelection = () => setSelectedClass(null);

  return {
    columns,
    selectedClass,
    selectedProperties,
    setSelectedClass,
    resetSelection,
  };
}
