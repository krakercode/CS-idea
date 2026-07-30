import { invoke } from "@tauri-apps/api/core";
import type { CalendarEvent, CalendarProvider } from "./types";

/**
 * Real data - TheSportsDB for general sports and an unofficial HLTV scraper
 * for CS2/esports (src-tauri/src/calendar.rs; no official HLTV API exists).
 * `daysAhead` is applied client-side since both upstream sources just return
 * their own notion of "upcoming".
 */
class RealCalendarProvider implements CalendarProvider {
  async fetchUpcoming(daysAhead: number): Promise<CalendarEvent[]> {
    const events = await invoke<CalendarEvent[]>("fetch_calendar");
    const horizonMs = daysAhead * 24 * 3600_000;
    const cutoff = Date.now() + horizonMs;
    return events.filter((e) => new Date(e.start_time).getTime() <= cutoff);
  }
}

let provider: CalendarProvider = new RealCalendarProvider();

export function getCalendarProvider(): CalendarProvider {
  return provider;
}

export function setCalendarProvider(next: CalendarProvider): void {
  provider = next;
}
