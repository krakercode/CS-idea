# Changelog

All notable changes to JESSPR-EAST are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] - 0.1.1

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

### In progress

- New "___ of the Day" widget: Wikipedia featured article, Wikimedia
  picture of the day, and a personalized song of the day via Spotify.

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
