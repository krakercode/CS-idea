# Changelog

All notable changes to JESSPR-EAST are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- Spotify: playback still 404'd even after 0.1.3's retry logic - the real
  bug was that `deviceId` gets cached once from the SDK's `ready` event and
  can go stale later (the SDK's connection drops and re-establishes
  without a clean `not_ready`, or the initial registration just hadn't
  propagated yet), and a stale id 404s every request that targets it no
  matter how many times it's retried. `transferAndPlay` now looks up the
  *live* device id from `/me/player/devices` by name immediately before
  every playback action instead of trusting a cached value.
- Spotify: nothing stopped a re-click on a stuck "Play"/"Play all" button
  from firing a whole new transfer+play sequence on top of one already in
  flight - every playback action is now serialized (one at a time,
  buttons disabled while busy) and every Spotify API call from the
  frontend now has a 10s timeout, so a slow/hung request can't just pile
  up indefinitely. This was the actual likely source of the reported wifi
  slowdown, not the widget data polling (audited all of it - News/Stocks/
  Calendar/Of the Day poll every 10min/60s/30min/1hr respectively, nothing
  unreasonable there).
- Minor: the Spotify Player view's progress-bar tick ran every second
  forever once the widget mounted, even with nothing loaded - now only
  runs while something's actually playing.

## [0.1.3] - 2026-07-31

### Changed

- CS2 Database is now labeled "(WIP)" everywhere it's shown (widget title,
  Settings panel) - most of its lineup data is still unverified starter
  content (see the per-card "unverified" badges added earlier), and
  encoding real ones one-by-one from source links isn't done. Not a
  regression, just being upfront about where it's actually at.

### Added

- Spotify: the Library tab is a real browser now, not just Liked Songs -
  sub-tabs for Playlists, Albums, and followed Artists, each drilling into
  its tracks with a "Play all" that keeps going into the rest of it
  afterwards, plus a debounced search across tracks/albums/artists/
  playlists at once. Needs a reconnect (more scopes: playback control
  itself, playlists, followed artists) if you connected before this landed.
- CS2 Database: the first actually-sourced lineup (Mirage window smoke
  from Back Alley, from a real csnades.gg link) - `technique` is now
  optional on a lineup rather than always guessed, since it's not always
  something derivable from a source URL alone.

### Fixed

- Every external link in the app (news articles, calendar match/stream
  links, CS2 lineup references, Of the Day's article/picture/song, Leetify
  attribution, PandaScore/Spotify signup links) was a plain
  `<a target="_blank">`, which Tauri's webview doesn't reliably hand off to
  the OS browser - clicking one could just silently do nothing. Replaced
  every one with a shared `<ExternalLink>` that opens the URL via the
  opener plugin's JS API instead (`"opener:default"` added to
  `capabilities/default.json`, which was missing it entirely).
- CS2 Database: lineup cards without a real `sourceUrl` now show a visible
  **unverified** badge plus a page-level notice, instead of only a code
  comment nobody using the app would ever see - starter placeholder
  content (the throw technique/from-to detail) was easy to mistake for a
  tested lineup. The map callouts themselves (Jungle, Banana, Secret,
  etc.) are all real and current; what's unverified is the specific throw
  detail, which this sandboxed dev environment has no way to check against
  a live source (csnades.gg and even a plain web search both 403 from
  here) - every card links out so it can actually be confirmed.
- Spotify: playing a track from Library could fail with "Spotify couldn't
  start playback (status 404)" - a device that's only just registered via
  the Web Playback SDK isn't always immediately targetable by the Web API
  yet, a known race in these integrations. `playTrackHere` now explicitly
  transfers playback to the device first (rather than relying on
  `/me/player/play`'s `device_id` param to do it implicitly) and retries
  a 404 a couple of times with a short delay before giving up.

## [0.1.2] - 2026-07-31

### Added

- Spotify: a real, fully functional in-app player via Spotify's Web
  Playback SDK - JESSPR-EAST becomes its own Spotify Connect device, so
  music plays through the app directly instead of needing the (much
  heavier) official Spotify client running. Play/pause/skip, click-to-seek,
  volume, and a Library tab listing saved tracks to play. Needs Spotify
  Premium and a reconnect (new scopes) if you connected before this landed.
- Calendar: esports/CS2 matches now come from PandaScore, a real API with
  a free key (entered via the widget's ⚙ button), replacing the old
  unofficial HLTV scraper - more reliable, and not at risk of anti-bot
  blocking the way scraping HLTV directly was.

### Fixed

- Calendar: general sports showing "nothing upcoming" for weeks at a time
  wasn't a bug in the fetch - it was a 7-day cutoff throwing away real,
  correctly-fetched fixtures during a league's off-season. Widened to 90
  days.
- Release workflow: GitHub only resolves `/releases/latest` (what the
  updater's endpoint URL depends on) to a non-prerelease release, but both
  0.1.0 and 0.1.1 came out flagged prerelease despite tauri-action's
  `prerelease: false` input - silently breaking auto-updates. `release.yml`
  now force-corrects the flag right after the build via `gh release edit`,
  regardless of what tauri-action does; `fix-release-flags.yml` is a
  one-off utility to correct an already-published release without a
  rebuild.
- Update check: a failed check (network error, a 404, a bad signature -
  anything) was silently reported as "you're up to date" instead of as a
  failure, since `checkForUpdate()` caught every error and returned `null`,
  identically to a genuine no-update result. Errors now surface as a
  distinct state with the underlying message.

## [0.1.1] - 2026-07-31

### Added

- System Health: NVIDIA GPU usage, VRAM used/total, and temperature
  (via `nvml-wrapper`). Empty/hidden on machines without an NVIDIA
  GPU or driver; AMD/Intel aren't supported yet.
- CS2 Database: every lineup card now links out to a reference for that
  setup (a specific source once verified and added, otherwise a search
  query) instead of downloading/rehosting images from lineup sites.
- Spotify: real Authorization Code + PKCE integration (`spotify.rs`) -
  tokens live on the Rust side only, refreshed automatically, replacing
  the previous connect-stub. Shows currently playing track/artist/album
  and progress; read-only, can't control playback.
- News: the keyword list is now editable right in the widget (add/remove
  tag chips, capped at 10, persisted) instead of only via
  `newsSources.ts`.
- Stocks: the watchlist is now editable right in the widget (same
  tag-chip pattern, capped at 12, persisted) instead of only via
  `watchlist.ts`. Each quote also carries a month of daily closes for a
  per-row sparkline, color-coded up/down, toggleable from the header.
- Dashboard: widgets are now resized and repositioned by dragging directly
  on the dashboard (a resize handle bottom-right, a move handle top-left)
  instead of Width/Height dropdowns in Settings, which are gone -
  Visibility/Scheduled are still there, untouched.
- Calendar: real match data (`calendar.rs`) - TheSportsDB for general
  sports, an unofficial HLTV scraper for CS2/esports (no official HLTV API
  exists), fetched concurrently so one source failing doesn't affect the
  other. Each event links out on click - the match's own HLTV page for
  esports, a search query for general sports.
- New "Of the Day" widget (`of_the_day.rs`): Wikipedia's featured article
  and picture of the day (one keyless request, via Wikimedia's Feed REST
  API), plus a Spotify song of the day - personalized from user-entered
  favorite artists when set, otherwise the user's own top tracks (new
  `user-top-read` scope; existing Spotify connections need to reconnect
  once to pick it up). The daily pick is stable all day, not re-randomized
  on every refresh.

## [0.1.0] - first installable release

### Added

- Initial dashboard scaffold on Tauri 2 + React/TypeScript: News, Stocks,
  Calendar, CS2 Database, and Spotify widgets, all on mock data behind
  swappable provider interfaces.
- Shared widget infrastructure: `WidgetShell` (chrome, loading/error
  states, expand-to-overlay), `usePolling`, generic multi-view/cycling
  (`useWidgetViews` + `ViewSwitcher`), shared `Overlay`.
- System Health widget: real (not mock) CPU/memory/disk/temperature
  stats via `sysinfo`.
- Real News (RSS/Atom via `feed-rs`) and Stocks (Yahoo Finance's
  unofficial chart endpoint) integrations - keyless, no API keys
  required. News resolves plain keywords/tickers to a Google News
  search feed so no RSS knowledge is needed; direct feed URLs remain an
  advanced option.
- CS2 Database: Lineups and Pro Plays (searchable/filterable), a
  Profiles view (pick your usual CT position per map, see it alongside
  T-side lineups together), and a real Analysis view backed by the
  Leetify API (player rating breakdown, match history, local
  rating-trend charts, rules-based training suggestions).
- Customizable per-widget visibility (always/scheduled/hidden with
  day+time windows) and size, via a settings panel.
- Customizable visual themes: Dark/Light/Midnight/High Contrast presets,
  a full custom color editor, three game-inspired presets (Disco
  Elysium, Marathon, Ultrakill) with non-color UI "flair" (fonts,
  borders, texture), and a font picker (Inter, Space Grotesk,
  self-hosted).
- Quotes widget: a small, deliberately curated set of verified,
  attributable quotes (Napoleon, Lenin) plus Disco Elysium's Volition,
  clearly labeled as fictional.
- Installer + auto-updater: GitHub Actions release workflow building
  signed Windows/macOS/Linux installers, in-app update checking via
  Tauri's updater plugin.

### Fixed

- Full `cargo clippy` pass, dead-code removal, and a manual bug-hunt
  pass across core files (a shared-object aliasing bug in default widget
  schedules, a search race condition in the CS2 Analysis view, a stale
  API-key field on first load).
