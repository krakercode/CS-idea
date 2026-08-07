import type { SituationUpdate } from "./types";

/**
 * The GDELT Project (gdeltproject.org) - an open, academic (Google
 * Jigsaw-supported) global news monitoring database, updated every 15
 * minutes from tens of thousands of outlets worldwide. Its DOC 2.0 API is
 * fully keyless and CORS-open (confirmed: access-control-allow-origin: *)
 * unlike ReliefWeb below, which needs a registered appname - this is the
 * always-on primary source. Every result keeps its own source domain and
 * link, same "judge the source yourself" attribution the News widget
 * already relies on for its Google News results.
 */
const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
const REQUEST_TIMEOUT_MS = 10_000;

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  domain: string;
  sourcecountry?: string;
}

function parseGdeltDate(seendate: string): string {
  // "20260807T113000Z" -> "2026-08-07T11:30:00Z". Falls back to "now"
  // (sorts to the top rather than crashing) if GDELT ever changes this
  // format - the article itself is still real and worth showing.
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seendate);
  if (!m) return new Date().toISOString();
  const [, y, mo, d, h, mi, s] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Timed out - check your connection.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** English-language sources only (`sourcelang:english`) - GDELT covers
 * dozens of languages, but a widget of untranslated headlines isn't
 * readable, and GDELT's translation mode is a heavier, separate feature
 * this doesn't need. Topics are OR'd together as one query - a multi-word
 * topic is quoted as a phrase, a single word isn't (GDELT would otherwise
 * read unquoted multi-word text as an AND of separate terms). */
export async function fetchSituationNews(topics: string[], maxRecords = 30): Promise<SituationUpdate[]> {
  if (topics.length === 0) return [];

  const clause = topics.map((t) => (t.trim().includes(" ") ? `"${t.trim()}"` : t.trim())).join(" OR ");
  const params = new URLSearchParams({
    query: `(${clause}) sourcelang:english`,
    mode: "artlist",
    maxrecords: String(maxRecords),
    format: "json",
    sort: "datedesc",
    timespan: "2d",
  });

  const res = await fetchWithTimeout(`${GDELT_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`GDELT request failed (${res.status}).`);

  let data: { articles?: GdeltArticle[] };
  try {
    data = (await res.json()) as { articles?: GdeltArticle[] };
  } catch {
    // GDELT returns plain text (not JSON) for some malformed-query cases
    // rather than a proper error status - read as "no results" instead of
    // failing the whole widget over it.
    return [];
  }

  return (data.articles ?? [])
    .filter((a) => a.url && a.title)
    .map((a) => ({
      id: a.url,
      title: a.title,
      url: a.url,
      source: a.domain || new URL(a.url).hostname,
      country: a.sourcecountry || null,
      publishedAt: parseGdeltDate(a.seendate),
      kind: "news" as const,
    }));
}
