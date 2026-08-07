const STORAGE_KEY = "situation-monitor-topics";
const MAX_TOPICS = 8;

/** Deliberately event-type terms, not named countries/conflicts - a
 * fixed default list of specific flashpoints goes stale the moment a
 * crisis ends or a new one starts, and picking which named conflicts are
 * "the" ones to watch by default isn't a call this app should make.
 * Editable the same way News' keywords are (see newsKeywordsStore.ts). */
export const DEFAULT_WATCH_TOPICS = ["armed conflict", "ceasefire", "humanitarian crisis", "natural disaster"];

export function getWatchTopics(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_WATCH_TOPICS];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === "string")
      : [...DEFAULT_WATCH_TOPICS];
  } catch {
    return [...DEFAULT_WATCH_TOPICS];
  }
}

function saveTopics(topics: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(topics));
  } catch {
    // Best-effort - e.g. localStorage disabled/full. Keeps working for the
    // current session, it just won't persist.
  }
}

export function addWatchTopic(topic: string): string[] {
  const trimmed = topic.trim();
  const current = getWatchTopics();
  if (!trimmed || current.length >= MAX_TOPICS) return current;
  if (current.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return current;

  const next = [...current, trimmed];
  saveTopics(next);
  return next;
}

export function removeWatchTopic(topic: string): string[] {
  const next = getWatchTopics().filter((t) => t !== topic);
  saveTopics(next);
  return next;
}

export { MAX_TOPICS };
