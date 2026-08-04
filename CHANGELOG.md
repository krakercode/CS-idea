# Changelog

All notable changes to JESSPR-EAST are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.6.1] - 2026-08-04

### Fixed

- **GAELJANK SOFTWORKS / One More Season code review** - `CoachScreen` built
  a fake `SeasonResult` object with an unsafe `as SeasonResult` cast just to
  satisfy `generateCoachFeedback`'s parameter type, even though that
  function only ever reads 5 of that type's dozen-plus fields - narrowed
  the function to take exactly the fields it uses (`CoachFeedbackInput`),
  so the cast (and the risk of it silently going stale if the function's
  needs ever changed) is gone entirely.
- Mid-season event eligibility (`eligibleEvents`) matched events against
  each other by comparing `e.title` to hardcoded string literals - any
  future copy edit to an event's title would silently disable its
  age/reputation/tier gating with no warning anywhere. Every event now
  carries a stable `id` separate from its display `title`, and eligibility
  is a single lookup table keyed by `id` instead of 11 scattered
  string-equality checks.
- Minor type cleanup: `currentEvent`'s state type and the position-list
  cast in `CreateScreen` both used indirect `typeof X[number]`/
  `(typeof X)[Y]` derivations instead of importing the actual `NarrativeEvent`/
  `Position` types directly - no behavior change, just clearer types.

Reviewed the rest of the ported game closely for a similar pass (stat
math, season simulation, league scheduling, event application) and didn't
find anything else - re-verified with a full browser-driven playthrough
across 4 simulated seasons after these changes, same as before them.

## [0.6.0] - 2026-08-04

### Added

- **GAELJANK SOFTWORKS widget** - an in-house "game label" widget: a small
  launcher listing playable games, each opening fullscreen in its own
  overlay. First cartridge: **One More Season**, a full football
  career-mode sim (Sunday league to the very top, youth trials, transfers,
  contract negotiations, international caps, a real simulated 38-game
  league season per year, retirement at 38) in a retro
  vidiprinter/teletext screen style. Ported from a standalone build (CDN
  React + in-browser Babel) into this app's actual React 19/Vite/
  TypeScript setup rather than loading a second React runtime - same game,
  same data and formulas, native to the app instead of an embedded HTML
  page. Built to hold more games later - adding one is a new entry in
  `gamesCatalog.ts`, no changes to the widget itself.

## [0.5.2] - 2026-08-04

Another full bug-fix/optimization pass: two parallel audits (frontend,
Rust backend) plus manual verification of every behavior-changing fix via
headless-browser testing - one additional real bug (the Spotify "Now
Playing" poll timing issue below) was found during that verification, not
by either audit.

### Fixed

- **Free-mode widgets' drag/resize handles were permanently invisible** -
  the hover-reveal CSS only matched grid-mode's wrapper class, never
  free-mode's. Confirmed via browser test (handle opacity 0 -> 1 on hover
  after the fix, was stuck at 0 before).
- **Spotify volume slider spammed the playback API mid-drag** - a range
  input's `onChange` fires continuously while dragging, and each call hit
  `controlPlayback`'s single-in-flight-request guard, throwing a spurious
  "still working" error for most of them. Now only sends the request once,
  on release/commit. Confirmed: 0 calls during a simulated 9-step drag, 1
  on release.
- **Spotify widget could show "Nothing playing" for up to 5 seconds after
  every launch, even mid-playback** - found while verifying the fix above,
  not by either audit. The "Now Playing" poll's very first fetch fires
  synchronously on mount, before the async "is Spotify connected" check
  has resolved, so that first fetch always saw "not connected" and nothing
  re-fetched until the next scheduled tick. Now explicitly refreshes the
  moment the connection check actually resolves.
- **Logging out of Spotify during an in-flight background token refresh
  could silently resurrect the session** - `logout()` wasn't synchronized
  with the same lock `ensure_fresh_token` uses, so a refresh already in
  flight could finish and write fresh tokens back right after logout
  cleared them.
- **A real Spotify error while fetching "Song of the Day" was
  indistinguishable from "never connected"** - both collapsed to the same
  `null`. Now surfaced as its own message in the UI.

### Changed

- Two DB-backed Tauri commands (`get_trend`, `get_suggestions`) now run
  their SQLite work via `spawn_blocking`, matching the pattern already
  used for the sibling write path - a stalled disk no longer risks
  blocking every other in-flight command.
- Spotify Library tabs (Liked Songs/Playlists/Albums/Artists) now show a
  note when a fetch comes back with a full page, since each tab silently
  capped at 50 items with no indication more might exist.
- Corrected a doc comment on the Pokémon TCG retry logic to match its
  actual (better) behavior - network errors are retried like 429/5xx, not
  failed immediately as the comment previously claimed.

## [0.5.1] - 2026-08-04

### Fixed

- **Pokémon TCG search failing intermittently** - root-caused, not guessed:
  a direct check against `api.pokemontcg.io` measured only 6/15 (40%)
  requests actually succeeding right now, the rest 500/502 - the upstream
  API is unstable, not something wrong in this app's request. Added an
  automatic retry (up to 5 attempts, a flat 250ms gap rather than growing
  backoff, since these are server errors rather than us being throttled)
  that only kicks in on 429/5xx - a real failure like a 404 still fails
  immediately. Confirmed live: 8/8 searches succeeded afterward against the
  same flaky API, versus the ~40% raw baseline.

### Changed

- Card thumbnails (Prices and Collection tabs) sized up from 44x61px to
  100x140px, same aspect ratio - the old size was too small to actually
  read anything on the card art.

## [0.5.0] - 2026-08-03

### Added

- **Transit Tracker widget** - a departure-board-style tracker, two tabs:
  - *Transit* (trains/buses/ferries) - search and track stops worldwide via
    [Transitland](https://transit.land) (needs a free user-supplied API
    key, same handling as PandaScore's), showing upcoming departures with
    route, headsign, mode, and real-time delay where the feed provides one.
  - *Flights* - search and track any of ~3,300 airports with scheduled
    service (offline search over a bundled, filtered
    [OurAirports](https://ourairports.com/data) dataset), showing recent
    arrivals/departures via [OpenSky Network](https://opensky-network.org) -
    free, no key needed. This is logged flight activity, not a live
    schedule board: no gate info, and arrivals specifically only cover
    "yesterday" since that's how OpenSky's free tier updates that endpoint;
    departures are much closer to real-time. See the README's "Transit
    Tracker" section for the full detail.

## [0.4.1] - 2026-08-03

### Changed

- **Sound is now real recordings, not synthesized** - v0.4.0 shipped every
  click/ambient sound procedurally generated via the Web Audio API to
  sidestep licensing questions, but it sounded cheap and thin in practice.
  Replaced with real, individually license-verified CC0/public-domain
  audio (see "Sound" in the README for the full credit list and sources).
  The one thing that was already a real sample, the meow easter egg, is
  unchanged. One of the new ambient tracks ("epic", used for Halo 3) opens
  with a ~4s silent fade-in in the source recording - playback now starts
  a few seconds in and loops from that same point, so switching to that
  theme doesn't sound like nothing happened for the first several seconds.

### Fixed

- The hidden meow button also triggered the app-wide UI click sound
  (it's a `<button>`, so it matched the same document-level click
  listener everything else does), so every meow overlapped with a second,
  unrelated click - it now only plays the meow.

## [0.4.0] - 2026-08-03

The three items deferred from v0.3 - all three needed either broader
network access or a decision on how to handle audio, both resolved this
round - plus a whole new widget.

### Added

- **Pokémon TCG widget**: a **Prices** tab to search cards and compare
  TCGPlayer (US) and Cardmarket (EU) prices side by side, in the same
  response from `api.pokemontcg.io`; a **Collection** tab to check off
  owned cards with a quantity stepper, a running estimated collection
  value, and a "Refresh prices" action; and a **Spend Tracker** tab to log
  pack/box purchases with per-pull value tracking (an optional lookup
  reuses the same price search to fill in a pull's value) and a running
  spent/pulled/net total. Works with no API key at all; an optional free
  key from pokemontcg.io just raises the rate limit, same shape as
  PandaScore's key handling.
- **jesspring.io theme preset** - built directly from the site's own
  fetched HTML/CSS (colors, the signature hard non-blurred drop shadow,
  zero border-radius) rather than a screenshot, since this was the one
  theme blocked on network access last round. Background/surface are
  darkened versions of the site's actual (very bright) magenta rather
  than a literal copy - fine for an occasional-visit personal site, too
  intense for something on-screen all day.
- **Sound**: UI clicks app-wide and a distinct ambient loop per theme
  preset, an "Enable sounds" toggle + volume slider in Settings, and a
  hidden easter-egg button in the CS2 Database widget that just meows.
  Every click/ambient sound is synthesized at runtime with the Web Audio
  API - not a licensing workaround, a better fit here: zero bundle size,
  zero attribution/redistribution questions, and easy to vary per theme
  (oscillator waveform/frequency/filter). The 9 flavor presets are grouped
  into 5 distinct ambient characters (a cold "hum" for Alien/MGSV
  iDroid/Deus Ex/Marathon, a warm "melancholy" pad for Disco Elysium/MGS1,
  a driving "aggressive" tone for Ultrakill, a spacious harmonic "epic"
  chord for Halo 3, a soft "chiptune" arpeggio for jesspring.io); the
  plain utility presets (Dark/Light/Midnight/High Contrast/Custom) get no
  ambient at all. The one exception to "everything is synthesized" is the
  meow sound itself - a real recording ("Meow of a pleading cat",
  dedicated to the public domain / CC0, from Wikimedia Commons), since a
  synthesized cat sound would read as a joke rather than a cat.

## [0.3.1] - 2026-08-02

A fix-and-optimization pass across the whole app, plus a couple of small
additions. No new widgets or themes this round.

### Fixed

- **Widget drag-reorder still didn't actually swap positions** after
  v0.3.0's `dragDropEnabled` fix got the drag events firing again - the
  remaining bug was in the reorder logic itself: it removed the dragged
  widget from the order array, then re-inserted it right before the drop
  target, which is a silent no-op specifically when dragging a widget onto
  its immediate right/below neighbor (dropping it back exactly where it
  started). `Dashboard.tsx` now swaps the two widgets' array indices
  directly.
- Habits & Reminders' "today" rolled over at UTC midnight instead of your
  local midnight, since it used `toISOString()` - anyone outside UTC could
  have a task logged (or read back) under the wrong calendar day, which
  also skewed the 7-day Vitals score.
- CS2 Database's search box lost focus after every keystroke - typing set
  the widget's `loading` flag, which swaps the whole widget body (search
  input included) for a "Loading…" placeholder, so the input remounted and
  dropped focus on every character. `loading` is now only ever true for
  the very first fetch, matching how every other widget already behaves.
- Switching several widgets to free-size mode for the first time could
  stack pairs of them exactly on top of each other - the default staggered
  position wrapped every 6 widgets, and there are more than 6 widgets.
- `formatBytes` (System Health's disk/memory/VRAM readouts) could round a
  value just under a unit boundary up to the next one and misdisplay it,
  e.g. "1024.0 MB" instead of "1.0 GB".
- Spotify reconnect could get permanently stuck after a login that timed
  out or was abandoned (closing the browser tab): the local OAuth callback
  listener stayed bound to its fixed port forever, so every later "Connect
  Spotify" attempt failed to bind it. The timeout path now explicitly
  cancels the listener.
- Concurrent Spotify token refreshes (routine given how often the widget
  polls) could race and invalidate the session, since Spotify sometimes
  rotates the refresh token on exchange and a losing concurrent request
  would use the now-stale one. Refreshes are now serialized.

### Changed

- **Settings page**: added a link to the GitHub repo in the footer.
- **License**: added an MIT `LICENSE` - fork it, modify it, ship your own
  build, just keep the copyright notice and license text intact.
- `usePolling`'s manual `refresh()` now actually resets the interval timer
  (it previously just fetched immediately without doing so, so a manual
  refresh right before a scheduled tick could fire two fetches back to
  back - the opposite of what its own doc comment promised).
- Dashboard widget cells (`WidgetCell`/`FreeWidgetCell`) are now memoized
  and driven by stable, id-parameterized callbacks, so the 60s schedule
  recheck tick no longer re-renders every mounted widget's whole subtree.
- System Health's disk/sensor readings now refresh the existing
  `Disks`/`Components` lists in place instead of re-enumerating every disk
  and sensor from the OS on every 3s poll.
- CS2 Analysis's local stats snapshots: writes now skip inserting a
  duplicate row when nothing actually changed since the last check, the
  trend chart's query is capped to the most recent 180 snapshots, and the
  SQLite write itself moved off the async runtime's worker thread
  (`spawn_blocking`) so a slow disk can't stall other concurrent commands.
- Removed a dead, unused Rust command (`spotify_now_playing` / a leftover
  from before the frontend switched to fetching now-playing directly) and
  a dead-code duplicate-id check in the shared `itemListStore` helper
  (unreachable given every caller already generates a fresh UUID).

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
