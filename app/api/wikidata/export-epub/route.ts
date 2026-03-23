import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { runLiveSparql, liveVal } from "@/lib/wikidata-live";

type ExportEntity = {
  iri: string;
  label: string;
  articleUrl?: string;
};

type EpubChapter = {
  title: string;
  data: string;
};

const USER_AGENT = "Cartopedia/1.0 (personal history explorer; https://github.com/cartopedia)";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toQid(iri: string): string {
  return iri.split(/[/#]/).pop() ?? iri;
}

function sanitizeFilePart(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "export";
}

function buildChapterXhtml(title: string, bodyHtml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>`;
}

function buildNavXhtml(chapters: EpubChapter[]): string {
  const links = chapters
    .map((c, i) => `<li><a href="chapter-${i + 1}.xhtml">${escapeHtml(c.title)}</a></li>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Table of Contents</title>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Table of Contents</h1>
      <ol>${links}</ol>
    </nav>
  </body>
</html>`;
}

function buildContentOpf(title: string, identifier: string, chapters: EpubChapter[]): string {
  const manifestItems = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    ...chapters.map(
      (_, i) => `<item id="chap${i + 1}" href="chapter-${i + 1}.xhtml" media-type="application/xhtml+xml"/>`
    ),
  ].join("");
  const spineItems = chapters.map((_, i) => `<itemref idref="chap${i + 1}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${escapeHtml(identifier)}</dc:identifier>
    <dc:title>${escapeHtml(title)}</dc:title>
    <dc:language>en</dc:language>
    <dc:creator>Cartopedia</dc:creator>
  </metadata>
  <manifest>${manifestItems}</manifest>
  <spine>${spineItems}</spine>
</package>`;
}

async function resolveArticleUrlsBySparql(entities: ExportEntity[]): Promise<Map<string, string>> {
  if (entities.length === 0) return new Map();
  const values = entities.map((e) => `<${e.iri.replace(/[<>]/g, "")}>`).join(" ");
  const query = `
PREFIX schema: <http://schema.org/>
SELECT ?entity ?articleUrl WHERE {
  VALUES ?entity { ${values} }
  ?articleUrl schema:about ?entity ;
              schema:inLanguage "en" ;
              schema:isPartOf <https://en.wikipedia.org/> .
}`.trim();
  const rows = await runLiveSparql(query, 20_000);
  const map = new Map<string, string>();
  for (const row of rows) {
    const entity = liveVal(row, "entity");
    const articleUrl = liveVal(row, "articleUrl");
    if (entity && articleUrl) map.set(entity, articleUrl);
  }
  return map;
}

async function fetchWikipediaExtract(articleUrl: string): Promise<string | null> {
  const titleMatch = articleUrl.match(/\/wiki\/([^?#]+)/);
  if (!titleMatch) return null;
  const title = decodeURIComponent(titleMatch[1]);
  try {
    // Use MediaWiki extracts API for the full plaintext article body.
    const params = new URLSearchParams({
      action: "query",
      prop: "extracts",
      explaintext: "1",
      exsectionformat: "plain",
      redirects: "1",
      format: "json",
      formatversion: "2",
      titles: title,
    });
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      query?: { pages?: Array<{ missing?: boolean; extract?: string }> };
    };
    const page = json.query?.pages?.[0];
    if (!page || page.missing || !page.extract) return null;
    return page.extract.trim() || null;
  } catch {
    return null;
  }
}

function plainTextToHtmlParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => `<p>${escapeHtml(chunk).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      title?: string;
      entities?: ExportEntity[];
    };
    const entities = (body.entities ?? []).filter((e) => e?.iri && e?.label).slice(0, 40);
    if (entities.length === 0) {
      return NextResponse.json({ error: "No selected entities provided" }, { status: 400 });
    }

    const providedUrlMap = new Map<string, string>();
    for (const e of entities) {
      if (e.articleUrl) providedUrlMap.set(e.iri, e.articleUrl);
    }
    const resolvedMap = await resolveArticleUrlsBySparql(
      entities.filter((e) => !providedUrlMap.has(e.iri))
    );

    const chapters: EpubChapter[] = [];
    for (const entity of entities) {
      const articleUrl = providedUrlMap.get(entity.iri) ?? resolvedMap.get(entity.iri);
      if (!articleUrl) continue;
      const extract = await fetchWikipediaExtract(articleUrl);
      if (!extract) continue;
      chapters.push({
        title: entity.label,
        data: `<h1>${escapeHtml(entity.label)}</h1>${plainTextToHtmlParagraphs(extract)}<p><a href="${articleUrl}">Wikipedia article</a></p><p><small>Wikidata: ${escapeHtml(toQid(entity.iri))}</small></p>`,
      });
    }

    if (chapters.length === 0) {
      return NextResponse.json(
        { error: "No English Wikipedia pages found for the selected entities." },
        { status: 400 }
      );
    }

    const now = new Date();
    const baseTitle = (body.title?.trim() || "Cartopedia export").slice(0, 80);
    const fileName = `${sanitizeFilePart(baseTitle)}-${now.toISOString().slice(0, 10)}.epub`;
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file(
      "META-INF/container.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
    );

    const oebps = zip.folder("OEBPS");
    if (!oebps) {
      return NextResponse.json({ error: "Failed to build EPUB archive" }, { status: 500 });
    }
    chapters.forEach((chapter, i) => {
      oebps.file(`chapter-${i + 1}.xhtml`, buildChapterXhtml(chapter.title, chapter.data));
    });
    oebps.file("nav.xhtml", buildNavXhtml(chapters));
    oebps.file(
      "content.opf",
      buildContentOpf(baseTitle, `urn:uuid:${crypto.randomUUID()}`, chapters)
    );

    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "EPUB export failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

