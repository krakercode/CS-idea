import { lazy, type ComponentType } from "react";
import { DEFAULT_SCHEDULE, type WidgetUserSettings } from "./dashboardSettingsStore";

export interface WidgetDefinition {
  id: string;
  /** Display name used in the settings panel (matches each widget's own title). */
  label: string;
  Component: ComponentType;
  defaultColSpan: 1 | 2 | 3;
  defaultRowSpan: 1 | 2;
}

/**
 * The single place that decides what shows up on the dashboard. To add a
 * new widget: build it under src/widgets/<name>/, then add one entry here.
 * Each component is lazy-loaded so a disabled widget never ships its code
 * to the bundle - keeps things light as more widgets get added over time.
 *
 * Visibility, schedule, and actual on-screen size are user-configurable at
 * runtime (see dashboardSettingsStore.ts + app/DashboardSettings.tsx) - the
 * col/row span here are just the starting defaults for a first run.
 */
export const WIDGETS: WidgetDefinition[] = [
  {
    id: "news",
    label: "News",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() => import("../widgets/news/NewsWidget").then((m) => ({ default: m.NewsWidget }))),
  },
  {
    id: "stocks",
    label: "Stocks",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() => import("../widgets/stocks/StocksWidget").then((m) => ({ default: m.StocksWidget }))),
  },
  {
    id: "calendar",
    label: "Calendar",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() => import("../widgets/calendar/CalendarWidget").then((m) => ({ default: m.CalendarWidget }))),
  },
  {
    id: "cs2db",
    label: "CS2 Database",
    defaultColSpan: 2,
    defaultRowSpan: 1,
    Component: lazy(() =>
      import("../widgets/cs2db/CS2DatabaseWidget").then((m) => ({ default: m.CS2DatabaseWidget })),
    ),
  },
  {
    id: "spotify",
    label: "Spotify",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() => import("../widgets/spotify/SpotifyWidget").then((m) => ({ default: m.SpotifyWidget }))),
  },
  {
    id: "systemhealth",
    label: "System Health",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() =>
      import("../widgets/systemhealth/SystemHealthWidget").then((m) => ({ default: m.SystemHealthWidget })),
    ),
  },
  {
    id: "quotes",
    label: "Quotes",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() => import("../widgets/quotes/QuotesWidget").then((m) => ({ default: m.QuotesWidget }))),
  },
];

export function getDefaultSettings(): Record<string, WidgetUserSettings> {
  const defaults: Record<string, WidgetUserSettings> = {};
  for (const widget of WIDGETS) {
    defaults[widget.id] = {
      visibility: "always",
      // Each widget needs its own schedule object - sharing DEFAULT_SCHEDULE
      // directly would mean every widget's default aliases the same array.
      schedule: { ...DEFAULT_SCHEDULE, days: [...DEFAULT_SCHEDULE.days] },
      colSpan: widget.defaultColSpan,
      rowSpan: widget.defaultRowSpan,
    };
  }
  return defaults;
}
