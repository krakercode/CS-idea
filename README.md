# JESSPR-EAST

An always-on second-monitor dashboard: news, stocks, a sports/esports calendar,
a CS2 nade lineup + pro-play database, Spotify, and a system health monitor.
Built on [Tauri](https://tauri.app/) (Rust shell + native webview) with a
React/TypeScript frontend, chosen specifically to stay light enough to run
continuously without eating a monitor's worth of RAM the way an
Electron app would.

News, Stocks, Calendar, Analysis (CS2 Database's fourth view), System Health,
and Spotify all run on real data now. Stocks/News/general-sports Calendar/
System Health need no API key at all; Calendar's esports matches need a free
PandaScore key, Spotify needs your own login (and Premium for in-app
playback) - see each widget's notes below.

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

## Releasing & auto-updates

Installers are built and published automatically by
`.github/workflows/release.yml` (via
[tauri-action](https://github.com/tauri-apps/tauri-action)), and installed
apps check for and apply new versions themselves via Tauri's
[updater plugin](https://v2.tauri.app/plugin/updater/) (Settings -> Software
update, or automatically - nothing currently triggers a background check on
launch, so today it's a manual "Check for updates" click).

Windows-only, deliberately - this app only runs on the maintainer's Windows
machine, so building/signing macOS and Linux installers nobody uses was
wasted CI time. `tauri.conf.json`'s `bundle.targets` is `"nsis"` and the
release workflow runs a single `windows-latest` job (no build matrix).

### Cutting a release

1. Bump the version in **both** `package.json` and `src-tauri/tauri.conf.json`
   (they should match).
2. Tag and push:
   ```sh
   git tag app-v0.2.0
   git push origin app-v0.2.0
   ```
   (or trigger `release.yml` manually via Actions -> Release -> Run
   workflow, filling in the same tag name - useful if a direct tag push
   isn't possible in your environment).
3. The workflow builds a Windows NSIS installer (.exe) and opens a
   **draft** GitHub Release with it attached plus a signed `latest.json`
   update manifest.
4. Review the draft, then publish it. Existing installs pick up the new
   version the next time they check - the updater endpoint always points at
   this repo's *latest published* release, which GitHub only resolves to a
   **non-prerelease, non-draft** release. `release.yml`'s `finalize` job
   forces the prerelease flag off right after the build (tauri-action's own
   `prerelease: false` input hasn't reliably done that), so this should
   already be correct - if an update ever silently stops showing up as
   available, check the release isn't flagged prerelease on GitHub. Run
   `fix-release-flags.yml` (Actions -> Fix Release Flags -> Run workflow,
   given the tag) to correct an already-published one without rebuilding.

### One-time setup: the signing key

Update packages are cryptographically signed so an installed app can verify
one actually came from this repo before installing it - this is separate
from OS code-signing (see below). A keypair has already been generated for
this project; its **public** half is committed in
`src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). For the release
workflow to actually sign builds, add these two repository secrets
(repo Settings -> Secrets and variables -> Actions -> New repository
secret) - the private half is deliberately never committed to the repo, so
get the values from whoever generated the keypair:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

To generate your own keypair instead (e.g. if you want to rotate it):
`npx tauri signer generate -w ~/.tauri/jesspr-east.key`, then replace
`pubkey` in `tauri.conf.json` with the new public key and use the new
private key/password for the secrets above. Losing the private key means
existing installs can no longer verify (and therefore won't install) future
updates signed with a different one - they'd need reinstalling from a fresh
installer instead.

### What this doesn't cover

- **OS code-signing** is unrelated to the update-signing above and isn't
  set up - an unsigned build still shows a SmartScreen "unrecognized app"
  warning on first install (see below). That needs a paid Windows
  code-signing certificate; tauri-action supports it once you have one.

### How installing this looks on a PC

Run the `.exe` (NSIS) installer like any other app. Since it isn't
code-signed, SmartScreen shows an "unrecognized app" warning the first
time - click "More info" -> "Run anyway".

No separate runtime to install - Tauri uses Windows' built-in WebView2
instead of bundling Chromium, so the installer stays small (typically
5-15 MB).

## Architecture

```
src/
  app/
    Dashboard.tsx             - lays out visible widgets in a CSS grid, minute schedule tick
    widgets.config.ts         - the list of widgets on the dashboard (add one here)
    dashboardSettingsStore.ts - per-widget visibility/schedule/size, persisted to localStorage
    DashboardSettings.tsx     - the settings panel (opened via the ⚙ button)
    themeStore.ts             - active theme (preset or custom), persisted to localStorage
    ThemeSettings.tsx         - preset picker + custom color editor, shown in DashboardSettings
    updateService.ts         - wraps the Tauri updater plugin (check/download/install)
    UpdateSettings.tsx        - version display + "check for updates" UI, shown in DashboardSettings
  styles/
    theme.css       - the default (Dark) CSS custom properties every widget's CSS uses
    themes.ts       - preset palettes + the field list that drives the custom color editor
    theme-flair.css - non-color UI touches for specific presets (fonts, borders, texture)
  shared/
    WidgetShell.tsx       - common card chrome: title bar, refresh, expand, loading/error
    Overlay.tsx            - generic centered modal (portal + Escape + backdrop-click), used by
                              WidgetShell's expand and by DashboardSettings
    useWidgetViews.ts      - generic "multiple internal views" state (id, next/prev/select)
    ViewSwitcher.tsx        - tab + cycle-arrow UI for a widget's views, pairs with the hook above
    hooks/usePolling.ts    - fetch-once-then-poll hook every widget's data uses
    mock.ts, format.ts     - small helpers used by the mock providers/widgets
  widgets/
    news/       stocks/       calendar/       cs2db/        spotify/       systemhealth/    quotes/
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

Click the ⚙ button (fixed top-right) to open the settings panel.

**Appearance** (top of the panel) - pick a theme, or build your own:

- **Presets**: Dark (default), Light, Midnight (true black, OLED-friendly),
  High Contrast, plus five "for testing" themes riffing on specific games'/
  films' visual identities (researched, not official palettes) - **Disco
  Elysium** (muted, painterly sepia with a deep maroon accent), **Marathon**
  (Bungie's 2025 reboot - steely dark blue/black with neon pink and
  yellow), **Ultrakill** (black/white/blood-red/gold, high contrast),
  **Alien** (the Nostromo/Sulaco's own computer terminals - phosphor-green
  CRT text on near-black), and **Deus Ex: Human Revolution** (black and
  gold, built directly from reference screenshots of the game's own menu/
  augmentation UI).
- **Custom**: picking it reveals a color picker for each of the 10 themeable
  roles (background, surface, border, text, accent, positive/negative/
  warning, etc.) - see `THEME_COLOR_FIELDS` in `src/styles/themes.ts` for
  the full list. It starts from whatever preset was active when you
  switched, so you're tweaking rather than starting blank.

Every widget's CSS is already built entirely on the same 10 CSS custom
properties (`src/styles/theme.css`), so switching or customizing a theme
needs no per-widget work - `themeStore.ts`'s `applyTheme` just writes new
values onto `:root` via `element.style.setProperty`, and the cascade does
the rest. Applied on startup before the first render (see `main.tsx`) so
there's no flash of the default theme before your saved one loads.
Persisted to `localStorage` (key `dashboard-theme`).

These five game-inspired presets go a step further than color: `applyTheme`
also stamps `data-theme-style="<preset id>"` on `<html>`, and
`src/styles/theme-flair.css` uses that to layer on non-color UI touches
scoped to just those presets (Dark/Light/Midnight/High Contrast/Custom are
untouched by this file - pure color, as before):

- **Disco Elysium** - a double border, italic serif titles, a small ◆
  before each widget name, and a subtle painterly vignette texture.
- **Marathon** - clipped corner notches (a sci-fi HUD panel shape),
  monospace uppercase titles with a red/green chromatic-aberration
  text-shadow (the "glitch" look), and a scanline texture.
- **Ultrakill** - diagonal hazard-stripe accents on the header bar, a bold
  red left-border stripe on every widget, and heavy uppercase sans titles.
- **Alien** - a CRT scanline texture, monospace titles with a green glow
  and a `>` terminal prompt prefix, and body text in the same monospace
  font throughout.
- **Deus Ex: Human Revolution** - angled/chamfered panel corners (a
  `clip-path` polygon, same technique Marathon's notches use) with a gold
  border traced along the cut via a layered pseudo-element, since
  `clip-path` clips a plain border along with everything else; a subtle
  gold radial glow in the corner; bold uppercase titles with a soft gold
  text-shadow.

Disco Elysium/Marathon/Ultrakill are a best-effort approximation from
research (search results, art direction interviews), not a pixel-accurate
recreation of any game's real UI. Alien and Deus Ex: Human Revolution were
built directly against reference screenshots instead, so those are a
closer match. Everything here targets `.widget-shell`, so any future theme
can add its own flair the same
way just by adding a new `[data-theme-style="..."]` block.

Per widget, you can set:

- **Visibility** - *Always shown*, *Hidden*, or *Scheduled*. Scheduled adds a
  day-of-week picker (tap a letter to toggle that day) and a start/end time
  range; the widget only appears during that window. `Dashboard.tsx` re-checks
  every 60s, so a scheduled widget appears/disappears on its own as the clock
  crosses the boundary - no reload needed. An overnight window like
  22:00-02:00 works too (`isWidgetVisibleNow` in `dashboardSettingsStore.ts`
  handles the wraparound).

Size and position aren't in the settings panel - they're mouse-driven,
directly on the dashboard (`WidgetCell.tsx`):

- **Resize**: hover a widget, grab the ⌟ handle that appears in its
  bottom-right corner, and drag. Self-calibrating against the cell's own
  current rendered size (rather than assuming a fixed column width/row
  height, which isn't constant - rows are `minmax(260px, 1fr)`), clamped to
  1-3 columns and 1-2 rows, live-previewed as you drag and only written to
  `localStorage` on release.
- **Reposition**: grab the ⠿ handle that appears top-left, drag onto
  another widget, and drop - it's inserted right before whatever you
  dropped it on. Plain native HTML5 drag-and-drop, so it plays fine with
  the rest of each widget staying normally interactive (links, buttons,
  text selection) - only that small handle initiates a drag.

All of this is per-device, persisted to `localStorage` (`dashboard-widget-settings`
for size, `dashboard-widget-order` for position) - there's no sync or
account system, matching everything else in this app being local-first.
`widgets.config.ts`'s `defaultColSpan`/`defaultRowSpan` and the widget
list's own order are just the starting point before you've touched
anything.

### Widget notes

- **News** - real news, configured with plain keywords - edit the tag chips
  right in the widget (add one, click × to remove one; capped at 10, see
  `newsKeywordsStore.ts`) rather than needing to touch code. No RSS
  knowledge needed: each keyword is turned into a Google News search under
  the hood (`src-tauri/src/news.rs::NewsSourceRequest::resolve_url`) and
  fetched the same way as any other feed. `NEWS_KEYWORDS` in
  `newsSources.ts` is just the first-run default now, before the user has
  customized anything. If you *do* know a specific feed URL you'd rather
  follow directly, `NEWS_FEEDS` in the same file is the advanced,
  empty-by-default, code-only option for that. Either way, a source that's
  unreachable or fails to parse is dropped rather than failing the whole
  widget.
- **Stocks** - real quotes from Yahoo Finance's unofficial chart endpoint
  (`src-tauri/src/stocks.rs`) - no API key, but also undocumented and could
  change without notice; see "CS2 Analysis backend" for the same tradeoff
  Leetify's API has. The watchlist is editable in the widget itself (same
  tag-chip pattern as News, capped at 12, see `watchlistStore.ts`) -
  `watchlist.ts`'s `STOCK_WATCHLIST` is just the first-run default. Each
  quote also carries a month of daily closes for a per-row sparkline
  (color-coded with the same green/red as the change figure), toggleable
  via the 📈/📉 button in the header if you'd rather keep it text-only.
  Polls every 60s (deliberately not faster, since it's an unauthenticated
  endpoint). A symbol that fails to resolve is dropped, not fatal.
- **Calendar** - real data from two independent sources
  (`src-tauri/src/calendar.rs`), fetched concurrently and merged so one
  failing doesn't take down the other. Shows anything upcoming within 90
  days (not just the next week) - sports leagues go weeks between fixtures
  in their off-season, and a tighter window was silently hiding real,
  correctly-fetched events.
  - *General sports* - [TheSportsDB](https://www.thesportsdb.com/), using
    their long-documented shared free/test key (`"3"`, no signup). A
    small hard-coded set of leagues for now (Premier League, NBA) - both
    have real off-seasons, so an empty Calendar for weeks at a stretch can
    be correct, not broken.
  - *CS2/esports* - [PandaScore](https://pandascore.co)
    (`src-tauri/src/pandascore.rs`), a real esports API. Needs a free
    account and API key (pandascore.co), entered via the ⚙ button in the
    widget's header - persisted locally (`pandascoreKeyStore.ts`), never
    baked into the app since it's a per-account secret unlike Spotify's
    client ID. Without a key, only general sports show up. CS2 still lives
    under PandaScore's `csgo` videogame slug (kept for API stability
    across the CS:GO → CS2 rename). This module's response parsing hasn't
    been verified against a live call from the sandboxed environment this
    was built in - it's written defensively (every field optional,
    malformed/unexpected shape just yields fewer or no matches, never a
    panic) and unit-tested against a hand-built fixture. If matches come
    back missing a title/time/link once run against a real key, check
    PandaScore's actual response shape and adjust the structs in
    `pandascore.rs` - the rest of the pipeline doesn't change. (This
    replaced an earlier unofficial HLTV scraper, dropped because HLTV has
    no official API and is very likely behind anti-bot protection that a
    plain HTTP client can't get past anyway.)
  - Each event links out on click - PandaScore's official stream link when
    it provides one, otherwise a search query, since there's no reliable
    single source for general sports streams. Neither is a scraped/
    rehosted stream link.
- **CS2 Database** - four views, cycled with `useWidgetViews`/`ViewSwitcher`:
  - *Lineups* and *Pro Plays* - searchable/filterable by map, sample data in
    `widgets/cs2db/data/`, meant to be replaced/expanded (lineup positions
    can shift between patches, and the pro-play entries are placeholder
    fixtures - fake names/dates, not real match records). The map callouts
    used (Mirage Jungle, Inferno Banana, Nuke Secret, etc.) are all real and
    current, but the specific throw technique/from-to detail per lineup is
    starter content that's never been checked against a live source (this
    sandboxed dev environment can't reach csnades.gg or similar sites to
    verify one) - `LineupList` flags any entry without a `sourceUrl` as
    **unverified** right in the UI rather than only in a code comment, and
    always links out (a real source once one's set, otherwise a search
    query) so there's a way to actually confirm a throw before using it.
    Lineups are tagged `side: "T" | "CT"`, and CT lineups additionally carry
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
    from the Lineups view. Every card links out to a reference for the
    lineup - a specific `sourceUrl` if you've set one on that entry,
    otherwise a search query for it - rather than downloading and
    rehosting images from lineup sites, which isn't ours to redistribute.
  - *Analysis* - a real (not mock) integration: look up a Leetify profile by
    Steam64/profile ID for its rank/rating breakdown, recent matches, local
    rating-trend charts (built from a snapshot taken on each lookup), and
    rules-based training suggestions from the weakest rating dimensions.
    Lives in `widgets/cs2db/analysis/`, lazy-loaded (it pulls in `recharts`,
    which otherwise never touches the main bundle) and backed by Rust
    (`src-tauri/src/leetify_client.rs`, `db.rs`, `suggestions.rs`) - see
    below.
- **Spotify** - a remote control for whatever's already playing on Spotify
  elsewhere (your phone, the real desktop app, spotify.com in a browser
  tab), not a player that outputs audio itself. Auth is entirely on the
  Rust side (`src-tauri/src/spotify.rs`) so the access/refresh tokens never
  sit in localStorage. Uses Spotify's Authorization Code + PKCE flow (the
  right fit for a desktop app - no client secret to embed): "Connect" opens
  the system browser to Spotify's login page (via `tauri-plugin-opener`), a
  one-shot local server (`tauri-plugin-oauth`, pinned to port 14700)
  catches the redirect, and the code is exchanged for tokens which get
  stored via `tauri-plugin-store` (plaintext JSON in the app data dir -
  same tradeoff as the Leetify API key, not a real OS keychain). Access
  tokens are refreshed automatically when they're close to expiry.
  - **Why remote control, not local playback**: an earlier version tried
    turning JESSPR-EAST itself into a Spotify Connect device via the [Web
    Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk),
    so audio would play through the app directly. It never actually
    worked - the SDK needs Widevine DRM (EME) to decode audio locally, and
    WebView2 (the webview Tauri uses on Windows) doesn't support it - an
    open, unresolved [Microsoft feature
    request](https://github.com/MicrosoftEdge/WebView2Feedback/issues/4828).
    It's the same reason Electron apps can't run the SDK out of the box
    either. The player *looked* like it was working (track/position/pause
    all update correctly) because that state comes over Spotify's control
    channel regardless of whether local audio decode succeeds - there's no
    way for the app to even detect the failure. Given that's a platform
    limitation rather than a bug, the widget instead controls whatever
    Spotify device is already active via the plain Web API - which is
    honestly a better fit for a dashboard widget anyway.
  - `useNowPlaying.ts` polls `GET /me/player` every 5s for whatever's
    currently active anywhere on the account (track, position, pause
    state, volume, and which device it's on) and exposes transport actions
    (`play`/`pause`/`next`/`previous`/`seek`/`volume`) that call Spotify's
    Web API (`spotifyService.ts`) and immediately re-poll afterwards so the
    UI reflects the change without waiting out the full interval. If
    nothing's active anywhere, control calls 404 with `NO_ACTIVE_DEVICE`,
    surfaced as "open Spotify on your phone, computer, or spotify.com,
    then try again" rather than a raw error. Actually controlling playback
    (not just viewing it) needs Spotify Premium - Free accounts get a 403
    from Spotify's own API on any control call, same as the old SDK
    approach would have.
  - The **Library** tab (`LibraryView.tsx`) is a small Spotify browser, not
    just a saved-tracks list: sub-tabs for Liked Songs / Playlists / Albums
    / Artists, a search box (debounced, searches tracks/albums/artists/
    playlists at once), and clicking a playlist/album/artist drills into
    its tracks with a "Play all" button. Playing something from inside a
    playlist/album/artist uses `playContextHere` (Spotify's `context_uri` +
    `offset`), so playback continues naturally into the rest of it
    afterwards - plain track/search results use `playTrackHere` instead,
    since there's no context to continue into. Saved tracks still come
    from the Rust-side `spotify_saved_tracks` command (predates the rest);
    everything else (`spotifyService.ts`) is a direct `fetch()` to
    Spotify's Web API with a token exposed via `spotify_get_access_token` -
    the one deliberate exception to "tokens stay in Rust", since these
    calls need to be authenticated straight from the browser context and
    there's no reason to grow the Rust side one command per endpoint for
    that.
  - Every playback-control call funnels through `controlPlayback`, which
    only lets one request be in flight at a time (`playbackActionInFlight`)
    and gives every request a 10s timeout, so a stuck button can't be
    re-clicked into a pile of overlapping/hanging requests. A 401/403 from
    any browsing call (`getSpotify`) throws a distinguishable
    `SpotifyAuthError` instead of silently reading as "empty" - a token
    missing a scope that was added after you last connected looks
    identical to a genuinely empty playlist otherwise.
  - **One-time setup for a fork/new Client ID**: create an app at
    [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard),
    add `http://127.0.0.1:14700/callback` as a Redirect URI, and put the
    Client ID (not the secret - PKCE doesn't use one) in `CLIENT_ID` at the
    top of `spotify.rs`. Client IDs aren't secret, but they are
    per-developer-account, so a fork needs its own.
  - Scopes: `user-read-currently-playing` + `user-read-playback-state` +
    `user-top-read` (for "Of the Day", see below); `user-read-email` +
    `user-read-private` + `user-modify-playback-state` (actually
    controlling playback - play/pause/skip/seek/volume all `403` without
    this one); `user-library-read` + `playlist-read-private` +
    `playlist-read-collaborative` + `user-follow-read` (Library tab's
    saved tracks/albums, playlists, and followed artists respectively).
    Reconnect once if you connected before any of these were added -
    Spotify only grants scopes present at the time of consent, there's no
    way to add one to an existing token.
- **System Health** - the other real (not mock) widget, for the same reason
  as Analysis: there's no meaningful mock for "this machine's actual CPU/
  memory/disk load." CPU name + overall/per-core usage, RAM (and swap, if
  any is configured), free space per mounted disk, and temperature sensors
  where the OS exposes them (often empty in VMs/containers - that's
  expected, not a bug). Polls every 3s via `get_system_health`
  (`src-tauri/src/system_health.rs`, using the `sysinfo` crate). Color
  thresholds (green/yellow/red at 70%/90%) are in `SystemHealthWidget.tsx`.
- **Quotes** - a small local, curated set (`widgets/quotes/data/quotes.ts`),
  around twenty sources spanning science, philosophy, literature, computing,
  civil rights, and art, plus Volition (a skill/inner voice from Disco
  Elysium, ZA/UM 2019 - fictional, and labeled as such in the UI so it's
  never presented as a historical quote). Filter chips (one per speaker)
  narrow which pool it draws from; the shell's ⟳ button and a 10-minute
  auto-rotate both just pick a new random quote from that pool - see
  "Sourcing the quotes" below for how these were chosen and verified.
- **Of the Day** - five keyless-where-possible daily picks, tabbed with the
  same `ViewSwitcher` as CS2 Database (`src-tauri/src/of_the_day.rs`):
  - *Article* and *Picture* - Wikipedia's featured article and picture of
    the day, both from Wikimedia's public Feed REST API in one request, no
    API key.
  - *Song* - via Spotify (`spotify.rs::song_of_day`): if you've added
    favorite artists in this view (tag chips, `favoriteArtistsStore.ts`,
    localStorage), it deterministically picks one of them each day and
    searches Spotify for a track by them; otherwise it picks from your own
    top tracks (needs Spotify connected and the `user-top-read` scope).
    The pick is stable for the whole day (seeded off the date), not random
    on every refresh. Empty/prompts to connect if Spotify isn't linked.
  - *Recipe* - via TheMealDB (`recipe_of_the_day.rs`, keyless): a
    vegan/non-vegan toggle picks which category rotation it draws from
    (`Vegan` only vs. a fixed set of ordinary categories - TheMealDB's other
    categories, including "Vegetarian", aren't reliably free of animal
    products, so the non-vegan side doesn't try to guess), then a
    same-day-stable meal from that category via the same seeded-pick
    pattern as Song. Shows the full ingredient list and instructions.
  - *Games* - not a daily pick like the others, just a curated, user-editable
    list of links to actual daily puzzle games (Wordle, Worldle, TimeGuessr,
    Pokedoku, and a couple more by default) via the shared `itemListStore`
    pattern - add/remove your own, same as Shortcuts below.
- **Shortcuts** - a plain user-managed list of name+URL bookmarks, opened
  via `<ExternalLink>` in the OS browser. `shortcutsStore.ts` uses the
  shared `src/shared/itemListStore.ts` helper (capped, deduped,
  localStorage-persisted) - the same helper backs Of the Day's Games list.
- **Entertainment Centre** - launches a local executable (an emulator, a
  game, anything) with optional arguments straight from the dashboard,
  instead of digging through menus first. Add a shortcut (name, path,
  optional args) - a native "Browse..." file picker (`tauri-plugin-dialog`)
  fills in the path for you - then hit Launch. Backed by a plain Rust
  command, `launch_shortcut` (`src-tauri/src/main.rs`), which just calls
  `std::process::Command::new(path).args(args).spawn()` - deliberately not
  `tauri-plugin-shell`'s scoped `Command` API, since that's meant for a
  fixed, developer-declared allowlist of binaries the app itself wants to
  run, not "whatever the user points it at."
- **Habits & Reminders** - a small gamified habit tracker
  (`widgets/habits/`), two views:
  - *Tasks* - add recurring things worth doing daily (medication, chores,
    reading), each worth a point value; check them off as you do them.
    Shows today's points and a lifetime running total (`habitsStore.ts`,
    plain localStorage - a task list plus a per-day completion log, pruned
    to the last 30 days since only a 7-day rolling window is ever needed).
  - *Vitals* - a "vitality" score (0-100), a rolling average of the last 7
    *completed* days' checked-off ratio (today doesn't count against you
    until it's actually over) - driving a schematic human silhouette and a
    heartbeat-style pulse trace that both shift color/shape across three
    bands (stable/fatigued/critical, using the theme's own
    positive/warning/negative colors so it re-themes automatically) as
    vitality rises or falls. The heart rate number and pulse shape are
    purely cosmetic flavor, not a real physiological model - explicitly
    labeled as such in the widget itself.

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
- **GPU usage/memory/temperature is NVIDIA-only** (via
  [`nvml-wrapper`](https://docs.rs/nvml-wrapper), initialized once in
  `SystemHealthState::new()`). On a machine without an NVIDIA GPU or driver,
  `Nvml::init()` fails gracefully and `gpus` is just an empty array - the
  widget shows nothing rather than an error. AMD/Intel GPUs aren't
  supported yet; there's no cross-vendor equivalent of NVML without
  significantly more platform-specific work (e.g. Windows performance
  counters), so this was scoped to the common case first. This container
  has no GPU at all, so the NVIDIA path itself is unverified on real
  hardware - confirm the values look sane on an actual NVIDIA machine.

## News & Stocks backends

Both follow the same shape: a small Rust module (`src-tauri/src/news.rs`,
`stocks.rs`) that fetches over HTTP via a shared `reqwest::Client` (managed
in `HttpState`, with a browser-like `User-Agent` since some unofficial
endpoints reject the default one) and hands back plain JSON - no API keys,
no OAuth.

- **News** takes a list of sources tagged `keyword` or `feed`
  (`NewsSourceRequest`, a serde-tagged enum) from the frontend. A `keyword`
  source is resolved to a Google News search URL (`news.google.com/rss/search`,
  built with `reqwest::Url`'s query-pair encoding rather than hand-rolled
  string formatting, so special characters in a query can't break the
  request); a `feed` source is used as-is. Every source is then fetched
  *concurrently* (`futures::future::join_all`) and parsed with `feed-rs`,
  which handles both RSS and Atom. Per-source failures (unreachable,
  malformed XML) are swallowed and that source is just dropped from the
  results - one flaky source shouldn't blank the whole widget. Capped at 5
  articles per source, merged and sorted by published date.
- **Stocks** hits `query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=1mo&interval=1d`
  per ticker, concurrently, reading the `meta` block (price, previous
  close, currency, timestamp) plus `indicators.quote[0].close` (a month of
  daily closes, nulls dropped) for the sparkline - the rest of the response
  is still ignored. Same per-symbol failure tolerance as News.
- Both modules split the "parse a response" logic from the "make the HTTP
  request" logic specifically so the parsing can be unit-tested against an
  embedded fixture (`cargo test`) without a live connection - see the note
  above on why that split mattered while building this.

## Sourcing the quotes

The Quotes widget was built to a specific bar: verified, attributable
quotes only, each with context on when/why it was said - not the usual
internet "famous quotes" grab-bag, where a large fraction of what
circulates for figures like Napoleon is misattributed or has no real
primary source (several widely-repeated ones were deliberately left out of
this list for exactly that reason).

- Every historical quote (Napoleon, Lenin) was checked via live web search
  against multiple independent sources before being included - not pulled
  from memory alone. `sourceUrl` on each entry points to where you can
  verify it yourself. That said: translations vary (both are working from
  French/Russian originals) and secondary sources can still be wrong, so
  treat this as a solid starting point, not a guarantee - a real citation
  check before quoting these anywhere serious is still worth doing.
- Volition's lines are exact dialogue from Disco Elysium (ZA/UM, 2019),
  cross-checked against community-maintained transcripts and multiple
  independent quote compilations. It's fiction, not history - every
  Volition entry is tagged `speakerType: "fictional"` in
  `widgets/quotes/data/quotes.ts`, and the widget always renders a visible
  "(fictional)" label next to its name so it's never confused for a real
  attributed quote.
- Adding a source: `Quote` (`widgets/quotes/types.ts`) is `text`, `speaker`,
  `speakerType`, `work`, `context`, and an optional `sourceUrl`. Append to
  the array in `data/quotes.ts` - the widget's filter chips and rotation
  pick up any new speaker automatically.

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
- **External links go through `<ExternalLink>`, never a plain `<a
  target="_blank">`.** Tauri's webview doesn't reliably hand those off to
  the OS browser - clicking one can just silently do nothing. `ExternalLink`
  (`src/shared/ExternalLink.tsx`) intercepts the click and opens the URL via
  `@tauri-apps/plugin-opener`'s `openUrl`, which needs `"opener:default"` in
  `capabilities/default.json` (already there). Every external link in the
  app goes through it for this reason - if a new one gets added as a plain
  `<a>` instead, it'll look fine in review and then just not work.
