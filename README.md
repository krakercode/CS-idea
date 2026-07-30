# JESSPR-EAST

An always-on second-monitor dashboard: news, stocks, a sports/esports calendar,
a CS2 nade lineup + pro-play database, Spotify, and a system health monitor.
Built on [Tauri](https://tauri.app/) (Rust shell + native webview) with a
React/TypeScript frontend, chosen specifically to stay light enough to run
continuously without eating a monitor's worth of RAM the way an
Electron app would.

News, Stocks, Analysis (CS2 Database's fourth view), and System Health all
run on real data now - no API keys required for any of them. Calendar and
Spotify are still mock/local (see their widget notes below for why, and
what's needed to make them real).

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
>
> One thing this environment genuinely can't verify: outbound network here
> is allowlisted to package registries and a few other known hosts, so News
> (RSS) and Stocks (Yahoo Finance) can't actually reach the internet from
> this container - `hltv.org`, `bbci.co.uk`, and `query1.finance.yahoo.com`
> are all blocked at the network policy level, confirmed via
> `$HTTPS_PROXY/__agentproxy/status`. Both widgets are built to degrade
> gracefully when a fetch fails (see below), which was confirmed - they show
> a clean empty state rather than erroring or crashing - but the "does the
> real request actually succeed and return real articles/quotes" question
> is only testable on a machine with normal internet access. The parsing
> logic itself *is* verified, via unit tests against embedded fixture
> data (`cargo test`).

## Architecture

```
src/
  app/
    Dashboard.tsx             - lays out visible widgets in a CSS grid, minute schedule tick
    widgets.config.ts         - the list of widgets on the dashboard (add one here)
    dashboardSettingsStore.ts - per-widget visibility/schedule/size, persisted to localStorage
    DashboardSettings.tsx     - the settings panel (opened via the ⚙ button)
  shared/
    WidgetShell.tsx       - common card chrome: title bar, refresh, expand, loading/error
    Overlay.tsx            - generic centered modal (portal + Escape + backdrop-click), used by
                              WidgetShell's expand and by DashboardSettings
    useWidgetViews.ts      - generic "multiple internal views" state (id, next/prev/select)
    ViewSwitcher.tsx        - tab + cycle-arrow UI for a widget's views, pairs with the hook above
    hooks/usePolling.ts    - fetch-once-then-poll hook every widget's data uses
    mock.ts, format.ts     - small helpers used by the mock providers/widgets
  widgets/
    news/       stocks/       calendar/       cs2db/        spotify/       systemhealth/
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
  (Lineups / Pro Plays / Profiles / Analysis, with ‹ › arrows to cycle and
  tabs to jump directly); any widget can adopt the same pattern later.

### Customizing the dashboard

Click the ⚙ button (fixed top-right) to open the settings panel. Per widget,
you can set:

- **Visibility** - *Always shown*, *Hidden*, or *Scheduled*. Scheduled adds a
  day-of-week picker (tap a letter to toggle that day) and a start/end time
  range; the widget only appears during that window. `Dashboard.tsx` re-checks
  every 60s, so a scheduled widget appears/disappears on its own as the clock
  crosses the boundary - no reload needed. An overnight window like
  22:00-02:00 works too (`isWidgetVisibleNow` in `dashboardSettingsStore.ts`
  handles the wraparound).
- **Width / Height** - Small/Medium/Large (grid column span) and
  Normal/Tall (grid row span).

All of this is per-device, persisted to `localStorage` (key
`dashboard-widget-settings`) - there's no sync or account system, matching
everything else in this app being local-first. `widgets.config.ts`'s
`defaultColSpan`/`defaultRowSpan` are just what a widget starts at before
you've touched its settings.

### Widget notes

- **News** - real RSS/Atom feeds, fetched and parsed on the Rust side
  (`src-tauri/src/news.rs`, using `feed-rs`). Feed list lives in
  `widgets/news/newsFeeds.ts` - edit that array (any RSS/Atom URL works) to
  change what it follows. A feed that's unreachable or fails to parse is
  dropped rather than failing the whole widget.
- **Stocks** - real quotes from Yahoo Finance's unofficial chart endpoint
  (`src-tauri/src/stocks.rs`) - no API key, but also undocumented and could
  change without notice; see "CS2 Analysis backend" for the same tradeoff
  Leetify's API has. Tickers live in `widgets/stocks/watchlist.ts`. Polls
  every 60s (deliberately not faster, since it's an unauthenticated
  endpoint). A symbol that fails to resolve is dropped, not fatal.
- **Calendar** - still mock/sample data, by choice: there's no good
  free/keyless API for esports schedules (HLTV has no official one, and
  scraping their site would violate their ToS), and general-sports-only
  felt like the wrong tradeoff for an app centered on CS2. Real esports
  data would need something like PandaScore (requires signing up for a free
  API key) wired into `calendarService.ts`.
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
- **System Health** - the other real (not mock) widget, for the same reason
  as Analysis: there's no meaningful mock for "this machine's actual CPU/
  memory/disk load." CPU name + overall/per-core usage, RAM (and swap, if
  any is configured), free space per mounted disk, and temperature sensors
  where the OS exposes them (often empty in VMs/containers - that's
  expected, not a bug). Polls every 3s via `get_system_health`
  (`src-tauri/src/system_health.rs`, using the `sysinfo` crate). Color
  thresholds (green/yellow/red at 70%/90%) are in `SystemHealthWidget.tsx`.

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

## System Health backend

`src-tauri/src/system_health.rs` wraps the [`sysinfo`](https://docs.rs/sysinfo)
crate behind one command, `get_system_health`. Implementation notes:

- A `System` instance lives in managed app state and is refreshed (not
  recreated) on every call. CPU usage is a delta between refreshes, so the
  *first* poll after launch can read low/zero - `sysinfo` needs two samples
  apart in time (it recommends `MINIMUM_CPU_UPDATE_INTERVAL`, ~200ms) for an
  accurate number, and the widget's own 3s poll interval comfortably clears
  that bar from the second reading on.
- Disks and temperature components are re-listed each call
  (`Disks::new_with_refreshed_list()` / `Components::new_with_refreshed_list()`)
  since, unlike CPU/memory, drives and sensors can appear/disappear (USB
  drives, etc.).
- There's a unit test (`cargo test --bin jesspr-east system_health -- --nocapture`)
  that asserts the values are plausible (non-zero memory, used ≤ total, at
  least one disk) - useful as a quick sanity check on a new machine, since
  this is the one widget where "does the underlying library actually work
  here" varies by OS/hardware.
- JSON field names are snake_case (Rust's default `Serialize` output,
  un-renamed) and `src/widgets/systemhealth/types.ts` mirrors them exactly
  rather than converting case - there's no real API contract to abstract
  away here, so a 1:1 mirror is simpler than adding a mapping layer.

## News & Stocks backends

Both follow the same shape: a small Rust module (`src-tauri/src/news.rs`,
`stocks.rs`) that fetches over HTTP via a shared `reqwest::Client` (managed
in `HttpState`, with a browser-like `User-Agent` since some unofficial
endpoints reject the default one) and hands back plain JSON - no API keys,
no OAuth.

- **News** fetches every configured feed *concurrently*
  (`futures::future::join_all`) and parses each with `feed-rs`, which
  handles both RSS and Atom. Per-feed failures (unreachable, malformed XML)
  are swallowed and that feed is just dropped from the results - one flaky
  source shouldn't blank the whole widget. Capped at 5 articles per feed,
  merged and sorted by published date.
- **Stocks** hits `query1.finance.yahoo.com/v8/finance/chart/{symbol}` per
  ticker, concurrently, and reads only the `meta` block (price, previous
  close, currency, timestamp) out of a much larger response. Same
  per-symbol failure tolerance as News.
- Both modules split the "parse a response" logic from the "make the HTTP
  request" logic specifically so the parsing can be unit-tested against an
  embedded fixture (`cargo test`) without a live connection - see the note
  above on why that split mattered while building this.

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
