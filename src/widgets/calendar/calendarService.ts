import { invoke } from "@tauri-apps/api/core";
import { getPandaScoreKey } from "./pandascoreKeyStore";
import type { CalendarEvent, CalendarProvider } from "./types";

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
    const events = await invoke<CalendarEvent[]>("fetch_calendar", { pandascoreApiKey });
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
