const STORAGE_KEY = "calendar-sportsdb-league-ids";

// Preserves the app's original hardcoded behavior (Premier League + NBA)
// for anyone who hasn't opened the new league picker yet - matches
// src-tauri/src/calendar.rs's DEFAULT_SPORTSDB_LEAGUE_IDS.
const DEFAULT_LEAGUE_IDS = ["4328", "4387"];

/**
 * Which TheSportsDB leagues (from the curated catalog - see
 * `list_sportsdb_leagues`) the user wants shown in the Calendar widget.
 * Same plain-string-array localStorage pattern as News' keywords/Stocks'
 * watchlist/Of the Day's favorite artists - no cap needed here since the
 * catalog itself is small and fixed.
 */
export function getSelectedLeagueIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_LEAGUE_IDS];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [...DEFAULT_LEAGUE_IDS];
  } catch {
    return [...DEFAULT_LEAGUE_IDS];
  }
}

function saveSelectedLeagueIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Best-effort - e.g. localStorage disabled/full. Keeps working for the
    // current session, it just won't persist.
  }
}

/** Toggles one league on/off, keeping everything else untouched -
 * deliberately allowed to reach an empty list (fetch_calendar falls back to
 * the same defaults on an empty list, so "just cleared everything" and
 * "never configured anything" behave the same either way). */
export function toggleLeagueId(id: string): string[] {
  const current = getSelectedLeagueIds();
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  saveSelectedLeagueIds(next);
  return next;
}
