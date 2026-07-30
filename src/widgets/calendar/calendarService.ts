import { delay } from "../../shared/mock";
import type { CalendarEvent, CalendarProvider } from "./types";

const SAMPLE_FIXTURES: Array<Omit<CalendarEvent, "id" | "startTime"> & { hoursFromNow: number }> = [
  { hoursFromNow: 5, title: "Quarterfinal", competition: "CS2 Major", category: "esports", teams: ["Team A", "Team B"] },
  { hoursFromNow: 20, title: "Group Stage", competition: "CS2 Major", category: "esports", teams: ["Team C", "Team D"] },
  { hoursFromNow: 30, title: "League Match", competition: "Premier League", category: "sports", teams: ["Club X", "Club Y"] },
  { hoursFromNow: 48, title: "Semifinal", competition: "Dota 2 Regional League", category: "esports", teams: ["Team E", "Team F"] },
  { hoursFromNow: 70, title: "Playoff Game", competition: "NBA", category: "sports", teams: ["Club Z", "Club W"] },
  { hoursFromNow: 96, title: "Grand Final", competition: "CS2 Major", category: "esports", teams: ["Team A", "Team C"] },
];

/**
 * Placeholder provider - fixed sample fixtures shifted relative to "now"
 * so the widget always shows something upcoming. Swap this for a
 * RealCalendarProvider (e.g. an esports/sports schedule API) implementing
 * the same interface.
 */
class MockCalendarProvider implements CalendarProvider {
  async fetchUpcoming(daysAhead: number): Promise<CalendarEvent[]> {
    await delay(200);

    const horizonMs = daysAhead * 24 * 3600_000;
    return SAMPLE_FIXTURES.filter((f) => f.hoursFromNow * 3600_000 <= horizonMs)
      .map((f, i) => ({
        id: `${f.competition}-${i}`,
        title: f.title,
        competition: f.competition,
        category: f.category,
        teams: f.teams,
        startTime: new Date(Date.now() + f.hoursFromNow * 3600_000).toISOString(),
      }))
      .sort((a, b) => (a.startTime > b.startTime ? 1 : -1));
  }
}

let provider: CalendarProvider = new MockCalendarProvider();

export function getCalendarProvider(): CalendarProvider {
  return provider;
}

export function setCalendarProvider(next: CalendarProvider): void {
  provider = next;
}
