# Changelog

All notable changes to JESSPR-EAST are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.0] - 2026-08-02

First wave of a v0.3 batch - three items (a jesspring.io-inspired theme,
ambient/click audio, and a hidden easter-egg button that needs that audio)
are deferred until network access allows sourcing reference screenshots
and audio, not included here.

### Added

- **Fullscreen**, two levels: the whole app window (⛶ button or F11) via
  Tauri's window API, and per-widget (a new ⛶ next to each widget's
  existing ⤢ Expand) - fills the entire window with just that widget,
  distinct from Expand's smaller centered modal.
- **Free-size widget mode** - a per-widget "Snap to grid / Free size"
  toggle in Settings. Free-size widgets leave the CSS Grid entirely and
  float at an arbitrary pixel position/size, dragged and resized directly
  rather than snapping to grid units - in addition to (not instead of) the
  existing grid-snap resize/reorder.
- CS2 Database: a new **Nade Site** view embedding csnades.gg directly via
  `<iframe>`, alongside (not replacing) the existing homegrown Lineups
  database - with an always-visible "Open in browser instead" link next to
  it either way, since this sandbox can't verify whether the site allows
  being framed.
- **Run on startup** toggle (new "General" settings row), via
  `tauri-plugin-autostart`.
- Three new theme presets, built directly against reference screenshots
  where provided: **Halo 3** (translucent navy menu panels, gold-highlighted
  selection), **MGSV: iDroid** (cyan field-terminal grid), and **Metal Gear
  Solid** (a period-appropriate teal palette that slowly color-cycles via
  `filter: hue-rotate()` - the least-verified of the three, since the exact
  cycling look on the original couldn't be independently confirmed).

### Fixed

- Dragging a widget to reorder it didn't actually work. Root cause: Tauri's
  `dragDropEnabled` window option defaults to `true`, and by Tauri's own
  documentation that has to be `false` for in-page HTML5 drag-and-drop to
  work on Windows (this app's only build target) - it was never set, so
  Tauri's own native drag-drop handling was swallowing the page's drag
  events the whole time. Also added a `dataTransfer.setData()` call the
  drag handler was missing, since some engines won't treat a drag as valid
  without it - cheap defense-in-depth alongside the real fix.
- Stocks: the % change and the sparkline next to it are two different time
  windows on the same row (day-over-day vs. trailing month) and neither was
  labeled, so "down 20%" gave no sense of over what period. Both figures
  were already accurate - audited end to end to confirm - just needed
  `(1D)`/`(1M)` tags making the window explicit.

### Changed

- PandaScore stays user-supplied, not baked into the app - a shared key
  committed to this public repo would be extractable from the installer by
  anyone the moment it shipped. Smoothed onboarding instead: the "no
  esports source configured" hint now links straight to PandaScore's
  signup page instead of requiring a click into Settings first to find it.
- Habits & Reminders: redid the Vitals silhouette from a solid-filled shape
  to a stroke-only outline (closer to a med-bay body-scan readout, per
  reference screenshots), and wrapped the whole readout in a small sci-fi
  HUD frame - corner brackets, a "SCANNING…" label, and a few generated
  flavor-text lines that shift wording across the three vitality bands.

## [0.2.1] - 2026-08-01

### Fixed

- Habits & Reminders: tasks could only be added or removed, not edited -
  renaming one or changing its point value meant deleting it and starting
  over. Each task now has an in-place edit (✎ next to it, matching the
  existing add form's layout). Also added a generic `update()` to the
  shared `itemListStore` helper this and Shortcuts/Entertainment
  Centre/Of the Day's puzzle links all use, so the same fix is available
  to those for free if they ever need it.

## [0.2.0] - 2026-08-01

### Added

- New **Habits & Reminders** widget - a small gamified habit tracker.
  Add recurring tasks (medication, chores, reading, anything) worth a
  point value, check them off daily, and watch a "vitality" score - a
  rolling 7-day completion average - drive a schematic human silhouette
  and a heartbeat-style pulse trace through three color-coded bands
  (stable/fatigued/critical) as it rises or falls. Purely a flavor
  gamification layer, explicitly labeled as such in the widget itself -
  not a real health metric.
- Two new theme presets, built directly against reference screenshots
  (Deus Ex) or the source material's own well-known look (Alien) rather
  than researched-from-search-snippets like the existing three game
  presets: **Alien** (phosphor-green CRT terminal, à la the Nostromo/
  Sulaco's own computers) and **Deus Ex: Human Revolution** (black and
  gold, angled/chamfered panel corners). The Deus Ex corners needed a new
  technique this codebase didn't have yet - `clip-path` clips a plain
  border along with the rest of the shell, so a layered pseudo-element
  fakes a border tracing the same angled cut instead.

## [0.1.6] - 2026-08-01

### Added

- New **Shortcuts** widget - a plain user-managed list of name+URL
  bookmarks, opened via the OS browser. Backed by a new shared helper,
  `src/shared/itemListStore.ts`, extracted since three separate lists
  (this, Of the Day's Games, Entertainment Centre) all needed the same
  capped/deduped/localStorage-persisted CRUD logic.
- Of the Day: a **Recipe** view (TheMealDB, keyless) with a vegan/
  non-vegan toggle, and a **Games** view - a curated, user-editable list of
  daily puzzle game links (Wordle, Worldle, TimeGuessr, Pokedoku, and a
  couple more by default).
- New **Entertainment Centre** widget - add a local shortcut (name, path to
  an executable, optional arguments) and launch it straight from the
  dashboard instead of digging through menus first. A native "Browse..."
  file picker (new `tauri-plugin-dialog` dependency) fills in the path.
  Backed by a new plain Rust command, `launch_shortcut`, deliberately not
  `tauri-plugin-shell` - see the README's Entertainment Centre section for
  why.
- Quotes: roughly seventeen new real, individually verified entries
  (science, philosophy, literature, computing, civil rights, art -
  Sagan, Feynman, Ada Lovelace, Woolf, de Beauvoir, Turing, Douglass,
  Baldwin, Morrison, Le Guin, Wollstonecraft, Wittgenstein, Kahlo, Carson,
  Lorde, Darwin, Anthony), each cross-checked against a primary or
  scholarly source during a live search rather than pulled from memory -
  several commonly-misattributed candidates (a Marie Curie line with no
  traceable original source, a Maya Angelou quote actually traced to Carl
  W. Buehner) were deliberately left out after failing that check, same
  bar the existing Napoleon/Lenin entries were held to.

### Changed

- Release pipeline is Windows-only now - this app only runs on the
  maintainer's Windows machine, so building/signing macOS and Linux
  installers nobody used was wasted CI time on every release.
  `release.yml`'s build matrix collapses to a single `windows-latest` job,
  and `tauri.conf.json`'s bundle target is `"nsis"` instead of `"all"`.

## [0.1.5] - 2026-08-01

### Changed

- Spotify: the in-app player never actually worked - 0.1.4 fixed the 404s,
  but the underlying reason audio never came out was that the Web Playback
  SDK needs Widevine DRM to decode audio locally, and WebView2 (Tauri's
  Windows webview) doesn't support it. Confirmed this is a real platform
  gap (an open, unresolved Microsoft issue, the same reason Electron apps
  can't run this SDK either), not something fixable with more retry/timeout
  logic - the player *looked* like it was working because track/position/
  pause state is pushed over Spotify's control channel independent of
  whether local decode succeeds, so there was no way for the app to even
  detect the failure. Pivoted the widget to remote-control an already-active
  Spotify device (phone, desktop app, spotify.com) instead of trying to be
  one - no DRM involved, works reliably everywhere, and is a better fit for
  a dashboard widget than expecting it to be your speaker. Removes the SDK
  entirely; `usePlayer.ts`/`webPlaybackSdk.ts` are gone, replaced by
  `useNowPlaying.ts` polling `/me/player` every 5s.

### Fixed

- Spotify Library: a 403 from a scope missing on an old token (e.g. not
  reconnecting since 0.1.3 added Library scopes) silently read as "No
  playlists found" - identical to a genuinely empty library - since
  `getSpotify()` treated every non-2xx response the same way. Now throws a
  distinguishable error surfaced as "try reconnecting Spotify" instead.

## [0.1.4] - 2026-07-31

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
