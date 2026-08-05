export type EventCategory = "esports" | "sports";

// Field names are snake_case to match the JSON serde emits from
// src-tauri/src/calendar.rs verbatim - no transformation layer needed.
export interface CalendarEvent {
  id: string;
  title: string;
  competition: string;
  category: EventCategory;
  start_time: string; // RFC3339
  teams?: string[];
  /** Where clicking the event goes - a real match page (HLTV) when we have
   * one, otherwise a search-query fallback. See calendar.rs for why there's
   * no scraped/rehosted stream link. */
  link_url?: string;
}

export interface CalendarProvider {
  fetchUpcoming(daysAhead: number): Promise<CalendarEvent[]>;
}

/** One entry in the curated TheSportsDB league catalog (see
 * src-tauri/src/calendar.rs::SPORTSDB_LEAGUE_CATALOG) - static reference
 * data for the league picker, not itself an upcoming event. */
export interface LeagueOption {
  id: string;
  label: string;
  sport: string;
}
