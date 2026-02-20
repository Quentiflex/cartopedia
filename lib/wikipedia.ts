const USER_AGENT = "Cartopedia/1.0 (personal history explorer; https://github.com/cartopedia)";
const TIMEOUT_MS = 5_000;

export type WikiSummary = {
  extract: string;
  thumbnail?: string;
  articleUrl: string;
};

/**
 * Fetch the Wikipedia REST summary for a given English Wikipedia article URL.
 * Returns null on any error or timeout — always safe to ignore.
 */
export async function fetchWikiSummary(
  articleUrl: string
): Promise<WikiSummary | null> {
  // Extract the article title from the URL, e.g. "https://en.wikipedia.org/wiki/France" → "France"
  const titleMatch = articleUrl.match(/\/wiki\/([^?#]+)/);
  if (!titleMatch) return null;
  const title = titleMatch[1]; // already URL-encoded in the sitelink URL

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
      }
    );
    clearTimeout(timer);
    if (!res.ok) return null;

    const data = await res.json() as {
      extract?: string;
      thumbnail?: { source: string };
      content_urls?: { desktop?: { page?: string } };
    };

    if (!data.extract) return null;
    return {
      extract: data.extract,
      thumbnail: data.thumbnail?.source,
      articleUrl: data.content_urls?.desktop?.page ?? articleUrl,
    };
  } catch {
    return null;
  }
}
