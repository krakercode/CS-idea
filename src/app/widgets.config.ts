import { lazy, type ComponentType } from "react";
import { DEFAULT_SCHEDULE, type WidgetUserSettings } from "./dashboardSettingsStore";

export interface WidgetDefinition {
  id: string;
  /** Display name used in the settings panel (matches each widget's own title). */
  label: string;
  Component: ComponentType;
  defaultColSpan: 1 | 2 | 3;
  defaultRowSpan: 1 | 2;
  /** Which built-in group (see widgetGroupsStore.ts) this widget starts in -
   * just the first-run bucket, same relationship to the group a widget ends
   * up in as defaultColSpan has to its actual on-screen size: the user can
   * freely move it to a different (or custom) group afterwards. */
  defaultGroupId: string;
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
    defaultGroupId: "info",
    label: "News",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() => import("../widgets/news/NewsWidget").then((m) => ({ default: m.NewsWidget }))),
  },
  {
    id: "stocks",
    defaultGroupId: "info",
    label: "Stocks",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() => import("../widgets/stocks/StocksWidget").then((m) => ({ default: m.StocksWidget }))),
  },
  {
    id: "calendar",
    defaultGroupId: "info",
    label: "Calendar",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() => import("../widgets/calendar/CalendarWidget").then((m) => ({ default: m.CalendarWidget }))),
  },
  {
    id: "cs2db",
    defaultGroupId: "games",
    label: "CS2 Database (WIP)",
    defaultColSpan: 2,
    defaultRowSpan: 1,
    Component: lazy(() =>
      import("../widgets/cs2db/CS2DatabaseWidget").then((m) => ({ default: m.CS2DatabaseWidget })),
    ),
  },
  {
    id: "spotify",
    defaultGroupId: "media",
    label: "Spotify",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() => import("../widgets/spotify/SpotifyWidget").then((m) => ({ default: m.SpotifyWidget }))),
  },
  {
    id: "systemhealth",
    defaultGroupId: "system",
    label: "System Health",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() =>
      import("../widgets/systemhealth/SystemHealthWidget").then((m) => ({ default: m.SystemHealthWidget })),
    ),
  },
  {
    id: "quotes",
    defaultGroupId: "info",
    label: "Quotes",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() => import("../widgets/quotes/QuotesWidget").then((m) => ({ default: m.QuotesWidget }))),
  },
  {
    id: "oftheday",
    defaultGroupId: "info",
    label: "Of the Day",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() => import("../widgets/oftheday/OfTheDayWidget").then((m) => ({ default: m.OfTheDayWidget }))),
  },
  {
    id: "shortcuts",
    defaultGroupId: "system",
    label: "Shortcuts",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() =>
      import("../widgets/shortcuts/ShortcutsWidget").then((m) => ({ default: m.ShortcutsWidget })),
    ),
  },
  {
    id: "entertainment",
    defaultGroupId: "media",
    label: "Entertainment Centre",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() =>
      import("../widgets/entertainment/EntertainmentCentreWidget").then((m) => ({
        default: m.EntertainmentCentreWidget,
      })),
    ),
  },
  {
    id: "habits",
    defaultGroupId: "info",
    label: "Habits & Reminders",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() => import("../widgets/habits/HabitsWidget").then((m) => ({ default: m.HabitsWidget }))),
  },
  {
    id: "pokemontcg",
    defaultGroupId: "games",
    label: "Pokémon TCG",
    defaultColSpan: 2,
    defaultRowSpan: 2,
    Component: lazy(() =>
      import("../widgets/pokemontcg/PokemonTcgWidget").then((m) => ({ default: m.PokemonTcgWidget })),
    ),
  },
  {
    id: "transit",
    defaultGroupId: "info",
    label: "Transit Tracker",
    defaultColSpan: 2,
    defaultRowSpan: 2,
    Component: lazy(() => import("../widgets/transit/TransitWidget").then((m) => ({ default: m.TransitWidget }))),
  },
  {
    id: "gaeljank",
    defaultGroupId: "games",
    label: "GAELJANK SOFTWORKS",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() =>
      import("../widgets/gaeljank/GaeljankSoftworksWidget").then((m) => ({ default: m.GaeljankSoftworksWidget })),
    ),
  },
  {
    id: "timeweather",
    defaultGroupId: "info",
    label: "Time & Weather",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() =>
      import("../widgets/timeweather/TimeWeatherWidget").then((m) => ({ default: m.TimeWeatherWidget })),
    ),
  },
  {
    id: "situationmonitor",
    defaultGroupId: "info",
    label: "Situation Monitor",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    Component: lazy(() =>
      import("../widgets/situationmonitor/SituationMonitorWidget").then((m) => ({
        default: m.SituationMonitorWidget,
      })),
    ),
  },
  {
    id: "worldmap",
    defaultGroupId: "info",
    label: "World Map",
    defaultColSpan: 2,
    defaultRowSpan: 2,
    Component: lazy(() => import("../widgets/worldmap/WorldMapWidget").then((m) => ({ default: m.WorldMapWidget }))),
  },
];

export function getDefaultSettings(): Record<string, WidgetUserSettings> {
  const defaults: Record<string, WidgetUserSettings> = {};
  WIDGETS.forEach((widget, index) => {
    defaults[widget.id] = {
      visibility: "always",
      // Each widget needs its own schedule object - sharing DEFAULT_SCHEDULE
      // directly would mean every widget's default aliases the same array.
      schedule: { ...DEFAULT_SCHEDULE, days: [...DEFAULT_SCHEDULE.days] },
      colSpan: widget.defaultColSpan,
      rowSpan: widget.defaultRowSpan,
      sizeMode: "grid",
      // Staggered so switching several widgets to free mode without moving
      // them yet doesn't just stack them exactly on top of each other -
      // `% WIDGETS.length` (not a fixed constant) so the stagger never
      // wraps back to a used offset no matter how many widgets exist.
      freeX: 40 + (index % WIDGETS.length) * 24,
      freeY: 40 + (index % WIDGETS.length) * 24,
      freeWidth: 360,
      freeHeight: 300,
    };
  });
  return defaults;
}
