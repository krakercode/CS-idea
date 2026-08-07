import type { SituationUpdate } from "./types";

/**
 * ReliefWeb (reliefweb.int) - UN OCHA's curated feed of humanitarian
 * situation reports and analysis from 4,000+ organizations, released
 * under CC BY 4.0. CORS-open, but unlike GDELT it requires a registered
 * "appname" (a short manual-approval form - see README) before the API
 * will answer at all (a bare request 403s with a link to request one),
 * so this is the optional half of the widget - same "paste a free key
 * you had to go get" pattern as Calendar's PandaScore integration.
 *
 * Field shapes below are ReliefWeb API v2's long-documented, stable
 * `profile=list` response schema - not re-verified against a live call
 * this round (getting an appname needs an interactive form submission +
 * manual review this session can't complete), same caveat pandascore.rs
 * and transit.rs already carry for the same reason. Read defensively:
 * every field optional, a shape mismatch drops that one report rather
 * than failing the widget.
 */
const RELIEFWEB_URL = "https://api.reliefweb.int/v2/reports";
const REQUEST_TIMEOUT_MS = 10_000;

interface ReliefWebReport {
  id?: string;
  fields?: {
    title?: string;
    url?: string;
    url_alias?: string;
    date?: { created?: string };
    source?: Array<{ name?: string }>;
    country?: Array<{ name?: string }>;
  };
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

export async function fetchReliefWebReports(appname: string, limit = 15): Promise<SituationUpdate[]> {
  const trimmed = appname.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    appname: trimmed,
    limit: String(limit),
    profile: "list",
  });
  params.append("sort[]", "date:desc");

  const res = await fetchWithTimeout(`${RELIEFWEB_URL}?${params.toString()}`);
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error("ReliefWeb rejected this appname - check it's approved (see README).");
    }
    throw new Error(`ReliefWeb request failed (${res.status}).`);
  }

  let data: { data?: ReliefWebReport[] };
  try {
    data = (await res.json()) as { data?: ReliefWebReport[] };
  } catch {
    return [];
  }

  const updates: SituationUpdate[] = [];
  for (const report of data.data ?? []) {
    const f = report.fields;
    const title = f?.title;
    const url = f?.url_alias || f?.url;
    const publishedAt = f?.date?.created;
    if (!title || !url || !publishedAt) continue;

    updates.push({
      id: report.id ?? url,
      title,
      url,
      source: f?.source?.[0]?.name ?? "ReliefWeb",
      country: f?.country?.[0]?.name ?? null,
      publishedAt,
      kind: "reliefweb",
    });
  }
  return updates;
}
