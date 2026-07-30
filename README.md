# CS Idea Dashboard

An always-on second-monitor dashboard: news, stocks, a sports/esports calendar,
a CS2 nade lineup + pro-play database, and Spotify. Built on
[Tauri](https://tauri.app/) (Rust shell + native webview) with a
React/TypeScript frontend, chosen specifically to stay light enough to run
continuously without eating a monitor's worth of RAM the way an
Electron app would.

Everything except the CS2 Database's Analysis view currently runs on
mock/local data - there are no real API keys or network calls to configure
for those yet. The goal of this pass was the base structure: a clean widget
architecture that's easy to extend, with each widget's "swap this for a real
data source" seam clearly marked. Analysis is the exception: it's a real,
working integration against Leetify's public CS2 stats API.

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

> **Note on this dev environment:** verified end-to-end in this container,
> including the Rust/Tauri side - `cargo check`/`cargo build` both pass, and
> `npm run tauri dev` was launched under a virtual X server (Xvfb) and ran
> without panicking. The GUI libraries (`webkit2gtk`, `gtk3`, etc.) needed
> for that aren't present by default here and were installed for this
> session only, so a fresh container may need
> `npm run tauri dev`/`build` re-verified once - see the
> [Tauri prerequisites](https://tauri.app/start/prerequisites/) for what's
> required on a real desktop machine (already standard there).

## Architecture

```
src/
  app/
    Dashboard.tsx        - lays out enabled widgets in a CSS grid
    widgets.config.ts    - the list of widgets on the dashboard (add one here)
  shared/
    WidgetShell.tsx       - common card chrome: title bar, refresh, expand, loading/error
    useWidgetViews.ts      - generic "multiple internal views" state (id, next/prev/select)
    ViewSwitcher.tsx        - tab + cycle-arrow UI for a widget's views, pairs with the hook above
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

**Every widget can be expanded and can have multiple internal views** - both
are properties of `WidgetShell`/`useWidgetViews`, not something each widget
builds itself:

- **Expand** is built into `WidgetShell` directly: every widget gets a ⤢
  button in its header for free, which portals the widget into a large
  centered overlay (`Escape` or clicking the backdrop closes it). Nothing
  extra is required to opt in.
- **Multiple views** (tabs a single widget can cycle between, as opposed to
  separate widgets) are opt-in: call `useWidgetViews([{id, label}, ...])` for
  the active-view state and `next`/`prev`/`setActiveId`, pass a
  `<ViewSwitcher>` as `WidgetShell`'s `headerActions`, and render each
  view's content based on `activeId`. CS2 Database is the current example
  (Lineups / Pro Plays / Analysis, with ‹ › arrows to cycle and tabs to jump
  directly); any widget can adopt the same pattern later.

### Widget notes

- **News** - topics list lives in `widgets/news/userInterests.ts`; edit that
  array to change what it follows. No real source wired up yet (plan: RSS
  and/or a news API).
- **Stocks** - tickers live in `widgets/stocks/watchlist.ts`. Mock provider
  random-walks a price per symbol so polling has something to show.
- **Calendar** - sample esports/sports fixtures, filterable by category.
  Real version needs a schedule source per league/competition you care about.
- **CS2 Database** - four views, cycled with `useWidgetViews`/`ViewSwitcher`:
  - *Lineups* and *Pro Plays* - searchable/filterable by map, sample data in
    `widgets/cs2db/data/`, meant to be replaced/expanded (lineup positions
    can shift between patches, and the pro-play entries are placeholder
    fixtures - fake names/dates, not real match records). Lineups are
    tagged `side: "T" | "CT"`, and CT lineups additionally carry
    `positions: string[]` referencing `data/positions.ts` - the named CT
    holding spots per map (Mirage's "Jungle", Inferno's "Banana", etc.)
    that Profiles is built on.
  - *Profiles* - pick the CT position you usually hold on a map
    (persisted locally per map via `profiles/profileStore.ts`,
    `localStorage`) and see that position's CT lineups together with every
    T-side lineup for the same map, in one screen - so there's nothing to
    go dig up when your team switches sides at halftime. Adding more
    positions/CT lineups is just adding entries to `data/positions.ts` and
    `data/lineups.ts`; the shared `<LineupList>` card renderer is reused
    from the Lineups view.
  - *Analysis* - a real (not mock) integration: look up a Leetify profile by
    Steam64/profile ID for its rank/rating breakdown, recent matches, local
    rating-trend charts (built from a snapshot taken on each lookup), and
    rules-based training suggestions from the weakest rating dimensions.
    Lives in `widgets/cs2db/analysis/`, lazy-loaded (it pulls in `recharts`,
    which otherwise never touches the main bundle) and backed by Rust
    (`src-tauri/src/leetify_client.rs`, `db.rs`, `suggestions.rs`) - see
    below.
- **Spotify** - "Connect" is currently a stub (flips a local flag; no real
  OAuth). The real integration is noted in `spotifyService.ts`: Spotify's
  Authorization Code + PKCE flow suits a desktop app well (no client secret
  to embed), using Tauri's shell/opener plugin to launch the system browser
  and a loopback redirect (or a custom URL scheme) to catch the callback.

## CS2 Analysis backend (Leetify)

Unlike the rest of the app, the Analysis view talks to a real external API
and keeps a local database:

- `src-tauri/src/leetify_client.rs` - HTTP client for Leetify's public API
  (`api-public.cs-prod.leetify.com`). The exact response schema wasn't
  directly verifiable while building this (the docs page returned 403 from
  this environment), so it passes through raw JSON and the frontend
  (`widgets/cs2db/analysis/analysisService.ts`) reads fields defensively. If
  Leetify's response shape differs from what's assumed, adjust the field
  lookups there and in `db.rs`/`suggestions.rs`.
- `src-tauri/src/db.rs` - a local SQLite database (via `rusqlite`, bundled -
  no system SQLite dependency) storing a rating snapshot on every profile
  lookup, which is what powers the trend chart.
- `src-tauri/src/suggestions.rs` - a small rules engine (not a Leetify
  feature) that ranks rating dimensions weakest-first and pairs each with a
  hand-written tip and drills.
- Settings (API key, recent players) persist via `@tauri-apps/plugin-store`
  / `tauri-plugin-store`, scoped under `widgets/cs2db/analysis/settingsStore.ts`.

Optionally grab a Leetify API key at https://leetify.com/app/developer and
paste it into Analysis's Settings tab - it works without one, just at
stricter rate limits. Data provided by Leetify; this project isn't
affiliated with or endorsed by them.

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
  enabled - Analysis takes this further and lazy-loads itself as a *view
  within* CS2 Database, so `recharts` only loads if that tab is opened.
- **Expand and multi-view as shell properties, not per-widget code** - see
  "Every widget can be expanded..." above. The intent is that this keeps
  paying off as more widgets grow multiple views instead of each one
  reinventing tabs/cycling/maximize.
