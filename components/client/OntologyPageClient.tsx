"use client";

import { OntologyExplorer } from "./OntologyExplorer";
import type { OntologyData } from "@/lib/ontology";

type OntologyPageClientProps = {
  ontology: OntologyData;
};

/**
 * Full-page ontology view. Data is passed from the Server Component (ontology page).
 * Renders OntologyExplorer with a "Back to Cartopedia" link instead of a close button.
 */
export function OntologyPageClient({ ontology }: OntologyPageClientProps) {
  return (
    <OntologyExplorer
      open={true}
      onClose={() => {}}
      data={ontology}
      closeHref="/"
    />
  );
}
