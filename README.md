# CS Idea Dashboard

An always-on second-monitor dashboard: news, stocks, a sports/esports calendar,
a CS2 nade lineup + pro-play database, and Spotify. Built on
[Tauri](https://tauri.app/) (Rust shell + native webview) with a
React/TypeScript frontend, chosen specifically to stay light enough to run
continuously without eating a monitor's worth of RAM the way an
Electron app would.

Everything currently runs on mock/local data - there are no real API keys or
network calls to configure yet. The goal of this pass was the base
structure: a clean widget architecture that's easy to extend, with each
widget's "swap this for a real data source" seam clearly marked.

## Stack

- **Shell:** Tauri 2 (Rust) - `src-tauri/`
- **Frontend:** React 19 + TypeScript, built with Vite - `src/`
- No UI framework/component library and no state management library. At this
  scale, plain CSS and React state keep the dependency list (and bundle)
  small; add one only when a widget's actual needs justify it.

## Getting started

```sh
npm install
npm run tauri dev    # runs the app in a native window
# or, frontend only, in a browser:
npm run dev
```

`npm run build` type-checks and builds the frontend; `npm run tauri build`
produces a native installer/binary. Rust dependencies resolve automatically
on first `tauri` build via Cargo.

Before packaging a real build, replace the placeholder icon
(`src-tauri/icons/icon.png`) with your own artwork and run
`npm run tauri icon path/to/your-icon.png` to generate the full icon set.

> **Note on this dev environment:** this scaffold was built and verified
> (TypeScript, Vite build, and the rendered UI via a headless browser) inside
> a container that has no GUI libraries (no `webkit2gtk`), so the Rust/Tauri
> side (`npm run tauri dev`/`build`) could not be compiled or run here. It's
> written to the standard Tauri v2 conventions and should build normally on
> a desktop machine with the [Tauri prerequisites](https://tauri.app/start/prerequisites/)
> installed - just hasn't been exercised end-to-end yet.

## Architecture

```
src/
  app/
    Dashboard.tsx        - lays out enabled widgets in a CSS grid
    widgets.config.ts    - the list of widgets on the dashboard (add one here)
  shared/
    WidgetShell.tsx       - common card chrome: title bar, refresh, loading/error
    hooks/usePolling.ts    - fetch-once-then-poll hook every widget's data uses
    mock.ts, format.ts     - small helpers used by the mock providers/widgets
  widgets/
    news/       stocks/       calendar/       cs2db/        spotify/
```

Each widget follows the same shape:

- `types.ts` - the widget's data model and a `Provider`/`Repository`
  interface describing how it's fetched.
- `<name>Service.ts` - a mock implementation of that interface, plus
  `get<Name>Provider()` / `set<Name>Provider()` so a real implementation
  (a real API, a local database, OAuth) can be swapped in later without
  touching the component.
- `<Name>Widget.tsx` (+ `.css`) - the UI, built on `WidgetShell` and
  `usePolling`.

**Adding a new widget:** copy this shape into `src/widgets/<name>/`, then add
one entry to `app/widgets.config.ts`. It's lazy-loaded automatically, so it
costs nothing in bundle size until it's enabled.

### Widget notes

- **News** - topics list lives in `widgets/news/userInterests.ts`; edit that
  array to change what it follows. No real source wired up yet (plan: RSS
  and/or a news API).
- **Stocks** - tickers live in `widgets/stocks/watchlist.ts`. Mock provider
  random-walks a price per symbol so polling has something to show.
- **Calendar** - sample esports/sports fixtures, filterable by category.
  Real version needs a schedule source per league/competition you care about.
- **CS2 Database** - the standout feature: nade lineups and notable pro
  plays, searchable/filterable by map. Sample data lives in
  `widgets/cs2db/data/` and is meant to be replaced/expanded - lineup
  positions can shift between patches, and the pro-play entries are
  placeholder fixtures (fake names/dates), not real match records. This is
  local data (not fetched from anywhere), so it's the one widget that could
  reasonably grow into its own small local database (e.g. via Tauri's SQL
  plugin) rather than a remote API.
- **Spotify** - "Connect" is currently a stub (flips a local flag; no real
  OAuth). The real integration is noted in `spotifyService.ts`: Spotify's
  Authorization Code + PKCE flow suits a desktop app well (no client secret
  to embed), using Tauri's shell/opener plugin to launch the system browser
  and a loopback redirect (or a custom URL scheme) to catch the callback.

## Design choices worth knowing about

- **Dark theme only**, tuned for something that's on-screen all day
  (`src/styles/theme.css` - CSS custom properties, easy to retheme).
- **Polling, not push**, since none of the target data sources need
  sub-second updates: `usePolling` fetches once on mount then on an
  interval per widget (stocks every 15s, calendar every 30m, etc.), and
  keeps the last good value on screen if a refresh fails rather than
  blanking the widget.
- **Per-widget code splitting** via `React.lazy` in `widgets.config.ts`,
  so the dashboard's JS payload scales with how many widgets are actually
  enabled.
