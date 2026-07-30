import { lazy, type ComponentType } from "react";

export interface WidgetDefinition {
  id: string;
  enabled: boolean;
  /** How many grid columns this widget spans in the dashboard grid. */
  span: 1 | 2 | 3;
  Component: ComponentType;
}

/**
 * The single place that decides what shows up on the dashboard. To add a
 * new widget: build it under src/widgets/<name>/, then add one entry here.
 * Each component is lazy-loaded so a disabled widget never ships its code
 * to the bundle - keeps things light as more widgets get added over time.
 */
export const WIDGETS: WidgetDefinition[] = [
  {
    id: "news",
    enabled: true,
    span: 1,
    Component: lazy(() => import("../widgets/news/NewsWidget").then((m) => ({ default: m.NewsWidget }))),
  },
  {
    id: "stocks",
    enabled: true,
    span: 1,
    Component: lazy(() => import("../widgets/stocks/StocksWidget").then((m) => ({ default: m.StocksWidget }))),
  },
  {
    id: "calendar",
    enabled: true,
    span: 1,
    Component: lazy(() => import("../widgets/calendar/CalendarWidget").then((m) => ({ default: m.CalendarWidget }))),
  },
  {
    id: "cs2db",
    enabled: true,
    span: 2,
    Component: lazy(() =>
      import("../widgets/cs2db/CS2DatabaseWidget").then((m) => ({ default: m.CS2DatabaseWidget })),
    ),
  },
  {
    id: "spotify",
    enabled: true,
    span: 1,
    Component: lazy(() => import("../widgets/spotify/SpotifyWidget").then((m) => ({ default: m.SpotifyWidget }))),
  },
];
