# Changelog

All notable changes to JESSPR-EAST are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

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
