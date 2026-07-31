import { NEWS_KEYWORDS } from "./newsSources";

const STORAGE_KEY = "news-keywords";
const MAX_KEYWORDS = 10;

/** User-editable version of the keyword list the News widget searches for -
 * NEWS_KEYWORDS in newsSources.ts is just the first-run default. Persisted
 * to localStorage, same pattern as dashboardSettingsStore/themeStore. */
export function getKeywords(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...NEWS_KEYWORDS];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [...NEWS_KEYWORDS];
  } catch {
    return [...NEWS_KEYWORDS];
  }
}

function saveKeywords(keywords: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keywords));
  } catch {
    // Best-effort - e.g. localStorage disabled/full. Keeps working for the
    // current session, it just won't persist.
  }
}

/** Adds a keyword (trimmed, case-insensitive de-duplicated, capped at
 * MAX_KEYWORDS so the widget can't be configured into hammering the
 * upstream search feed with dozens of concurrent requests). Returns the
 * updated list; a no-op (returns the unchanged list) for a blank or
 * already-present keyword, or once the cap's been hit. */
export function addKeyword(keyword: string): string[] {
  const trimmed = keyword.trim();
  const current = getKeywords();
  if (!trimmed || current.length >= MAX_KEYWORDS) return current;
  if (current.some((k) => k.toLowerCase() === trimmed.toLowerCase())) return current;

  const next = [...current, trimmed];
  saveKeywords(next);
  return next;
}

export function removeKeyword(keyword: string): string[] {
  const next = getKeywords().filter((k) => k !== keyword);
  saveKeywords(next);
  return next;
}

export { MAX_KEYWORDS };
