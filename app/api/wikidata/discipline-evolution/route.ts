import { NextRequest, NextResponse } from "next/server";
import { runLiveSparql, liveVal } from "@/lib/wikidata-live";
import { fetchWikiSummary } from "@/lib/wikipedia";

type DisciplineEvolutionRow = {
  iri: string;
  label: string;
  startYear: number | null;
  endYear: number | null;
  description?: string;
  wikiSummary?: {
    extract: string;
    articleUrl: string;
    thumbnail?: string;
  } | null;
};

type DisciplineEvolutionResponse = {
  discipline: { iri: string; label: string };
  disciplineValid: boolean;
  warning?: string;
  schoolType: { iri: string; label: string };
  economicsMode?: "school" | "concept";
  linkProperty: { code: string; label: string };
  items: DisciplineEvolutionRow[];
  yearRange: { min: number; max: number; step: number };
};

const WHITELISTED_LINK_PROPERTIES = new Set(["P361", "P279"]);

function qidOrIriToWikidataEntityIri(input: string): string | null {
  const trimmed = input.trim();
  if (/^Q\d+$/i.test(trimmed)) return `http://www.wikidata.org/entity/${trimmed.toUpperCase()}`;
  const normalized = trimmed.replace(/[<>]/g, "");
  if (/^https?:\/\/www\.wikidata\.org\/entity\/Q\d+$/i.test(normalized)) return normalized;
  return null;
}

type MappedRow = {
  iri: string;
  label: string;
  startYear: number | null;
  endYear: number | null;
  description: string | undefined;
  articleUrl: string | undefined;
};

async function attachWikiSummaries(rows: MappedRow[]): Promise<DisciplineEvolutionRow[]> {
  const enriched = await Promise.all(
    rows.map(async (row) => {
      const wikiSummary = row.articleUrl
        ? await Promise.race([
            fetchWikiSummary(row.articleUrl),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 4_000)),
          ])
        : null;
      return {
        iri: row.iri,
        label: row.label,
        startYear: row.startYear,
        endYear: row.endYear,
        description: row.description,
        wikiSummary,
      };
    })
  );
  return enriched;
}

function wikidataIdFromIri(iri: string): string {
  return iri.split(/[/#]/).pop() ?? iri;
}

function yearStepFromRange(min: number, max: number): number {
  const span = Math.abs(max - min);
  if (span > 250) return 10;
  if (span > 160) return 5;
  if (span > 80) return 2;
  return 1;
}

async function fetchLabel(iri: string): Promise<string> {
  const rows = await runLiveSparql(
    `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?label WHERE {
  <${iri}> rdfs:label ?label .
  FILTER(LANG(?label) = "en")
}
LIMIT 1`.trim(),
    10_000
  );
  return liveVal(rows[0] ?? {}, "label") ?? wikidataIdFromIri(iri);
}

function toWikidataBusyMessage(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const lower = msg.toLowerCase();
  if (lower.includes("aborted") || lower.includes("timeout") || lower.includes("timed out")) {
    return "Wikidata is temporarily busy or too slow right now. Please try again in a moment.";
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const disciplineRaw = request.nextUrl.searchParams.get("discipline") ?? "";
    const linkPropertyCodeRaw =
      request.nextUrl.searchParams.get("linkProperty") ?? "P361";
    const economicsModeRaw = request.nextUrl.searchParams.get("economicsMode") ?? "school";
    const limitRaw = request.nextUrl.searchParams.get("limit") ?? "40";

    const ACADEMIC_DISCIPLINE_QID = "Q11862829";
    const SOCIOLOGY_QID = "Q21201";
    const BRANCH_OF_SOCIOLOGY_QID = "Q105760881";
    const ECONOMICS_QID = "Q8134";
    const SCHOOL_OF_ECONOMIC_THOUGHT_QID = "Q3048444";
    const CONCEPT_QID = "Q151885";
    const DEFAULT_SCHOOL_TYPE_QID = "Q1387659";
    const economicsMode: "school" | "concept" =
      economicsModeRaw === "concept" ? "concept" : "school";

    const disciplineIri = qidOrIriToWikidataEntityIri(disciplineRaw);
    if (!disciplineIri) {
      return NextResponse.json(
        { error: "Missing/invalid `discipline` (expected Q-id or Wikidata entity IRI)" },
        { status: 400 }
      );
    }

    const linkPropertyCode = linkPropertyCodeRaw.trim().toUpperCase();
    if (!WHITELISTED_LINK_PROPERTIES.has(linkPropertyCode)) {
      return NextResponse.json(
        {
          error: `Unsupported linkProperty '${linkPropertyCode}'. Allowed: ${Array.from(WHITELISTED_LINK_PROPERTIES).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const selectedDisciplineQid = disciplineIri.split("/").pop()?.toUpperCase();
    const effectiveCategoryTypeIri =
      selectedDisciplineQid === SOCIOLOGY_QID
        ? `http://www.wikidata.org/entity/${BRANCH_OF_SOCIOLOGY_QID}`
        : selectedDisciplineQid === ECONOMICS_QID
          ? economicsMode === "concept"
            ? `http://www.wikidata.org/entity/${CONCEPT_QID}`
            : `http://www.wikidata.org/entity/${SCHOOL_OF_ECONOMIC_THOUGHT_QID}`
        : `http://www.wikidata.org/entity/${DEFAULT_SCHOOL_TYPE_QID}`;

    const limit = Math.max(5, Math.min(parseInt(limitRaw, 10) || 40, 80));

    // For now we use a small hardcoded mapping for the link-property label
    // (keeps this endpoint independent from predicate label resolution).
    const linkPropertyLabel = linkPropertyCode === "P361" ? "part of" : "subclass of";

    const [disciplineLabel, categoryTypeLabel] = await Promise.all([
      fetchLabel(disciplineIri),
      fetchLabel(effectiveCategoryTypeIri),
    ]);

    const disciplineValidationRows = await runLiveSparql(
      `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
SELECT (COUNT(*) AS ?count) WHERE {
  <${disciplineIri}> wdt:P31/wdt:P279* <http://www.wikidata.org/entity/${ACADEMIC_DISCIPLINE_QID}> .
}`.trim(),
      15_000
    );
    const disciplineValidComputed =
      parseInt(liveVal(disciplineValidationRows[0] ?? {}, "count") ?? "0", 10) > 0;

    // Start/end extraction:
    // - Start: P571 (inception), P580 (start time), P585 (point in time)
    // We currently compute only start years for responsiveness.
    let items: DisciplineEvolutionRow[] = [];

    items = await (async () => {
      const safeDiscipline = disciplineIri.replace(/[<>]/g, "");
      const safeCategoryType = effectiveCategoryTypeIri.replace(/[<>]/g, "");
      if (selectedDisciplineQid === SOCIOLOGY_QID) {
        // Requested behavior:
        // show entities directly instance-of branch of sociology (Q105760881).
        const sociologyQuery = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
SELECT
  ?school
  ?label
  ?startYear
  ?description
  ?articleUrl
WHERE {
  ?school wdt:P31 <${safeCategoryType}> .
  ?school rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  OPTIONAL { ?school schema:description ?description . FILTER(LANG(?description) = "en") }
  OPTIONAL {
    ?articleUrl schema:about ?school ;
                schema:inLanguage "en" ;
                schema:isPartOf <https://en.wikipedia.org/> .
  }

  OPTIONAL {
    ?school wdt:P571 ?inceptionDate .
    BIND(YEAR(?inceptionDate) AS ?yInception)
  }
  OPTIONAL {
    ?school wdt:P580 ?startDate .
    BIND(YEAR(?startDate) AS ?yStart)
  }
  OPTIONAL {
    ?school wdt:P585 ?pointDate .
    BIND(YEAR(?pointDate) AS ?yPoint)
  }
  BIND(COALESCE(?yInception, ?yStart, ?yPoint) AS ?startYear)
}
ORDER BY ?startYear ?label
LIMIT ${limit}`.trim();
        const rows = await runLiveSparql(sociologyQuery, 20_000);
        const mapped = rows
          .map((b) => {
            const iri = liveVal(b, "school");
            const label = liveVal(b, "label") ?? (iri ? wikidataIdFromIri(iri) : "");
            const startYearRaw = liveVal(b, "startYear");
            const startYear = startYearRaw != null ? parseInt(startYearRaw, 10) : null;
            const description = liveVal(b, "description");
            const articleUrl = liveVal(b, "articleUrl");
            if (!iri) return null;
            return { iri, label, startYear, endYear: startYear, description, articleUrl };
          })
          .filter((x): x is MappedRow => x != null);
        return attachWikiSummaries(mapped);
      }

      if (selectedDisciplineQid === ECONOMICS_QID) {
        // Requested behavior:
        // show entities as either:
        // - school mode: instance-of school of economic thought (Q3048444)
        // - concept mode: instance/subclass-of concept (Q151885)
        const economicsQuery = economicsMode === "school"
          ? `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
SELECT
  ?school
  ?label
  ?startYear
  ?description
  ?articleUrl
WHERE {
  ${economicsMode === "school"
    ? `?school wdt:P31 <${safeCategoryType}> .`
    : `?school wdt:P31/wdt:P279* <${safeCategoryType}> .
  ?school wdt:${linkPropertyCode} <${safeDiscipline}> .`}
  ?school rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  OPTIONAL { ?school schema:description ?description . FILTER(LANG(?description) = "en") }
  OPTIONAL {
    ?articleUrl schema:about ?school ;
                schema:inLanguage "en" ;
                schema:isPartOf <https://en.wikipedia.org/> .
  }

  OPTIONAL {
    ?school wdt:P571 ?inceptionDate .
    BIND(YEAR(?inceptionDate) AS ?yInception)
  }
  OPTIONAL {
    ?school wdt:P580 ?startDate .
    BIND(YEAR(?startDate) AS ?yStart)
  }
  OPTIONAL {
    ?school wdt:P585 ?pointDate .
    BIND(YEAR(?pointDate) AS ?yPoint)
  }
  BIND(COALESCE(?yInception, ?yStart, ?yPoint) AS ?startYear)
}
ORDER BY ?startYear ?label
LIMIT ${limit}`.trim()
          : `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
SELECT
  ?school
  ?label
  ?startYear
  ?description
  ?articleUrl
WHERE {
  {
    SELECT ?school WHERE {
      ?school wdt:P31 <${safeCategoryType}> .
      ?school wdt:${linkPropertyCode} <${safeDiscipline}> .
      FILTER NOT EXISTS { ?school wdt:P31 <http://www.wikidata.org/entity/Q5> }
    }
    LIMIT ${Math.min(limit * 10, 200)}
  }
  ?school rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  OPTIONAL { ?school schema:description ?description . FILTER(LANG(?description) = "en") }
  OPTIONAL {
    ?articleUrl schema:about ?school ;
                schema:inLanguage "en" ;
                schema:isPartOf <https://en.wikipedia.org/> .
  }
  OPTIONAL {
    ?school wdt:P571 ?inceptionDate .
    BIND(YEAR(?inceptionDate) AS ?yInception)
  }
  OPTIONAL {
    ?school wdt:P580 ?startDate .
    BIND(YEAR(?startDate) AS ?yStart)
  }
  OPTIONAL {
    ?school wdt:P585 ?pointDate .
    BIND(YEAR(?pointDate) AS ?yPoint)
  }
  BIND(COALESCE(?yInception, ?yStart, ?yPoint) AS ?startYear)
}
ORDER BY ?startYear ?label
LIMIT ${limit}`.trim();

        const rows = await runLiveSparql(
          economicsQuery,
          economicsMode === "concept" ? 45_000 : 20_000
        );
        const mapped = rows
          .map((b) => {
            const iri = liveVal(b, "school");
            const label = liveVal(b, "label") ?? (iri ? wikidataIdFromIri(iri) : "");
            const startYearRaw = liveVal(b, "startYear");
            const startYear = startYearRaw != null ? parseInt(startYearRaw, 10) : null;
            const description = liveVal(b, "description");
            const articleUrl = liveVal(b, "articleUrl");
            if (!iri) return null;
            return { iri, label, startYear, endYear: startYear, description, articleUrl };
          })
          .filter((x): x is MappedRow => x != null);

        return attachWikiSummaries(mapped);
      }

      const categoryTypeClause = `?school wdt:P31 <${safeCategoryType}> .`;
      const disciplineClause = `?school wdt:${linkPropertyCode} <${safeDiscipline}> .`;

      // Candidate cap to keep the query responsive: compute start years only
      // for a bounded set of linked schools (then sort/limit to the final N).
      const candidateLimit = Math.min(limit * 5, 80);

      const query = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
SELECT
  ?school
  ?label
  ?startYear
  ?description
  ?articleUrl
WHERE {
  {
    SELECT ?school (MIN(?sy) AS ?startYear) WHERE {
      {
        SELECT ?school WHERE {
          ${categoryTypeClause}
          ${disciplineClause}
        }
        LIMIT ${candidateLimit}
      }

      {
        ?school wdt:P571 ?d .
        BIND(YEAR(?d) AS ?sy)
      }
      UNION
      {
        ?school wdt:P580 ?d .
        BIND(YEAR(?d) AS ?sy)
      }
      UNION
      {
        ?school wdt:P585 ?d .
        BIND(YEAR(?d) AS ?sy)
      }
    }
    GROUP BY ?school
  }

  ?school rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  OPTIONAL { ?school schema:description ?description . FILTER(LANG(?description) = "en") }
  OPTIONAL {
    ?articleUrl schema:about ?school ;
                schema:inLanguage "en" ;
                schema:isPartOf <https://en.wikipedia.org/> .
  }
}
ORDER BY ?startYear ?label
LIMIT ${limit}`.trim();

      const rows = await runLiveSparql(query, 35_000);
      const mapped = rows
        .map((b) => {
          const iri = liveVal(b, "school");
          const label = liveVal(b, "label") ?? (iri ? wikidataIdFromIri(iri) : "");
          const startYearRaw = liveVal(b, "startYear");
          const startYear = startYearRaw != null ? parseInt(startYearRaw, 10) : null;
          const description = liveVal(b, "description");
          const articleUrl = liveVal(b, "articleUrl");
          if (!iri) return null;
          return { iri, label, startYear, endYear: startYear, description, articleUrl };
        })
        .filter((x): x is MappedRow => x != null && x.startYear != null);

      return attachWikiSummaries(mapped);
    })();

    const years = items.flatMap((it) =>
      [it.startYear, it.endYear ?? it.startYear].filter((y): y is number => typeof y === "number")
    );
    const yearMin = years.length ? Math.min(...years) : 0;
    const yearMax = years.length ? Math.max(...years) : 0;
    const step = yearStepFromRange(yearMin, yearMax);

    const response: DisciplineEvolutionResponse = {
      discipline: { iri: disciplineIri, label: disciplineLabel },
      disciplineValid: disciplineValidComputed,
      warning: disciplineValidComputed
        ? undefined
        : `The selected discipline does not appear to be an instance of ${ACADEMIC_DISCIPLINE_QID}. Results may be empty or unrelated.`,
      schoolType: { iri: effectiveCategoryTypeIri, label: categoryTypeLabel },
      economicsMode: selectedDisciplineQid === ECONOMICS_QID ? economicsMode : undefined,
      linkProperty: { code: linkPropertyCode, label: linkPropertyLabel },
      items: items.map((it) => ({ ...it, endYear: it.endYear ?? it.startYear })),
      yearRange: { min: yearMin, max: yearMax, step },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
    });
  } catch (err) {
    const msg = toWikidataBusyMessage(err);
    return NextResponse.json(
      { error: msg ?? (err instanceof Error ? err.message : "Neighborhood query error") },
      { status: msg ? 503 : 502 }
    );
  }
}

