import { OntologyPageClient } from "@/components/client/OntologyPageClient";
import { getOntology } from "@/lib/ontology";

export default async function OntologyPage() {
  const ontology = await getOntology();
  return <OntologyPageClient ontology={ontology} />;
}
