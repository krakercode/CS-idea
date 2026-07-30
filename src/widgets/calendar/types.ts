export type EventCategory = "esports" | "sports";

export interface CalendarEvent {
  id: string;
  title: string;
  competition: string;
  category: EventCategory;
  startTime: string; // ISO timestamp
  teams?: [string, string];
}

export interface CalendarProvider {
  fetchUpcoming(daysAhead: number): Promise<CalendarEvent[]>;
}
