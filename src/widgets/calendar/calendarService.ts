import { invoke } from "@tauri-apps/api/core";
import { getPandaScoreKey } from "./pandascoreKeyStore";
import { getSelectedLeagueIds } from "./calendarLeaguesStore";
import type { CalendarEvent, CalendarProvider, LeagueOption } from "./types";

/**
 * Real data - TheSportsDB for general sports (keyless), and PandaScore for
 * esports/CS2 (src-tauri/src/pandascore.rs; needs a free user-supplied API
 * key, see pandascoreKeyStore.ts - esports events are just omitted without
 * one). `daysAhead` is applied client-side since both upstream sources just
 * return their own notion of "upcoming".
 */
class RealCalendarProvider implements CalendarProvider {
  async fetchUpcoming(daysAhead: number): Promise<CalendarEvent[]> {
    const pandascoreApiKey = await getPandaScoreKey();
    const sportsdbLeagueIds = getSelectedLeagueIds();
    const events = await invoke<CalendarEvent[]>("fetch_calendar", { pandascoreApiKey, sportsdbLeagueIds });
    const horizonMs = daysAhead * 24 * 3600_000;
    const cutoff = Date.now() + horizonMs;
    return events.filter((e) => new Date(e.start_time).getTime() <= cutoff);
  }
}

/** The curated league catalog for the picker UI - static reference data
 * (see src-tauri/src/calendar.rs::SPORTSDB_LEAGUE_CATALOG), not itself
 * subject to the mockable CalendarProvider swap since it's not "events". */
export function listAvailableLeagues(): Promise<LeagueOption[]> {
  return invoke("list_sportsdb_leagues");
}

let provider: CalendarProvider = new RealCalendarProvider();

export function getCalendarProvider(): CalendarProvider {
  return provider;
}

export function setCalendarProvider(next: CalendarProvider): void {
  provider = next;
}
