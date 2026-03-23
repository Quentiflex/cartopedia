import { DisciplineBrowser } from "@/components/client/DisciplineBrowser";

export const metadata = {
  title: "Concept Graph Browser — Cartopedia",
  description: "Browse Wikidata concept neighborhoods (2 hops up/down) for scientific disciplines.",
};

export default function DisciplineBrowserPage() {
  return <DisciplineBrowser />;
}

