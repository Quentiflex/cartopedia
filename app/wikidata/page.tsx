import { WikidataExplorer } from "@/components/client/WikidataExplorer";

export const metadata = {
  title: "Wikidata Explorer — Cartopedia",
  description: "Browse and navigate the Wikidata knowledge graph",
};

export default function WikidataPage() {
  return <WikidataExplorer />;
}
