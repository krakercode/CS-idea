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
    widgetGroupsStore.ts      - widget groups (built-in + custom) and per-widget group assignment
    DashboardSettings.tsx     - the settings panel (opened via the ⚙ button)
    themeStore.ts             - active theme (preset or custom), persisted to localStorage
    ThemeSettings.tsx         - preset picker + custom color editor, shown in DashboardSettings
    updateService.ts         - wraps the Tauri updater plugin (check/download/install)
    UpdateSettings.tsx        - version display + "check for updates" UI, shown in DashboardSettings
    GeneralSettings.tsx       - app-wide toggles (run-on-startup, sound enable/volume)
    WidgetCell.tsx            - one grid-mode widget cell: resize handle, native-DnD reorder handle
    FreeWidgetCell.tsx        - one free-size-mode widget cell: pixel resize/reposition, bring-to-front
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
    sound.ts               - synthesized click/ambient audio, volume settings, the meow sample
  assets/
    meow.ogg - the one real (not synthesized) sound file - see "Sound" below
  widgets/
    news/       stocks/       calendar/       cs2db/        spotify/       systemhealth/    quotes/
    pokemontcg/
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

**General** (also top of the panel, `GeneralSettings.tsx`) - launch
JESSPR-EAST automatically when Windows starts, via `tauri-plugin-autostart`;
and an "Enable sounds" toggle + volume slider covering both UI clicks and
theme ambience (see "Sound" below). Applies immediately, same "no save
button" pattern as Appearance below.

**Appearance** (top of the panel) - pick a theme, or build your own:

- **Presets**: Dark (default), Light, Midnight (true black, OLED-friendly),
  High Contrast, plus nine "for testing" themes riffing on specific games'/
  sites' visual identities (researched, not official palettes, except
  jesspring.io - see below) - **Disco Elysium** (muted, painterly sepia
  with a deep maroon accent), **Marathon** (Bungie's 2025 reboot - steely
  dark blue/black with neon pink and yellow), **Ultrakill**
  (black/white/blood-red/gold, high contrast), **Alien** (the
  Nostromo/Sulaco's own computer terminals - phosphor-green CRT text on
  near-black), **Deus Ex: Human Revolution** (black and gold, built
  directly from reference screenshots of the game's own menu/augmentation
  UI), **Halo 3** (translucent navy menu panels with a gold-highlighted
  selection, from a reference screenshot), **MGSV: iDroid** (cyan-on-navy
  field terminal, from a reference screenshot of Mother Base's development
  menu), **Metal Gear Solid** (a period-appropriate teal PS1-HUD palette
  that slowly color-cycles, echoing the original's codec screens - the
  least-verified of these, since its exact color-cycling look couldn't be
  independently confirmed), and **jesspring.io** (built by fetching the
  site's actual HTML/CSS directly rather than a screenshot - a darkened
  version of its own bright magenta as the base, with its real accent/
  button colors carried over unchanged).
- **Custom**: picking it reveals a color picker for each of the 10 themeable
  roles (background, surface, border, text, accent, positive/negative/
  warning, etc.) - see `THEME_COLOR_FIELDS` in `src/styles/themes.ts` for
  the full list. It starts from whatever preset was active when you
  switched, so you're tweaking rather than starting blank.

Also in Appearance: a **Font** picker (`src/styles/fonts.ts`, `FONT_OPTIONS`)
- System Default, Inter, Space Grotesk, plus **Roboto, Open Sans, Lato,
Montserrat, and Oswald**, the 5 most-used typefaces on Google Fonts by its
own July 2026 analytics (~50 trillion font views). All self-hosted via
`@fontsource/*` (SIL Open Font License) rather than loaded from Google's
CDN, same offline-first reasoning as everything else here - see `main.tsx`'s
imports. This is the same option list the Time & Weather widget's own
"Digital font" picker draws from (see "Widget notes" below).

Every widget's CSS is already built entirely on the same 10 CSS custom
properties (`src/styles/theme.css`), so switching or customizing a theme
needs no per-widget work - `themeStore.ts`'s `applyTheme` just writes new
values onto `:root` via `element.style.setProperty`, and the cascade does
the rest. Applied on startup before the first render (see `main.tsx`) so
there's no flash of the default theme before your saved one loads.
Persisted to `localStorage` (key `dashboard-theme`).

These eight game-inspired presets go a step further than color: `applyTheme`
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
- **Halo 3** - a soft gold radial glow in the corner, a gold accent border
  under the header, and a bold condensed title font.
- **MGSV: iDroid** - a faint cyan grid-line texture, monospace titles, and a
  `▸` prefix on each widget name.
- **Metal Gear Solid** - a double border (like Disco Elysium's, echoing
  military-HUD readouts) that slowly animates `filter: hue-rotate()`
  through a full cycle - pure CSS, no JS per-frame updates, layers cleanly
  on top of the color system without touching the `--color-*` variables
  themselves.
- **jesspring.io** - zero border-radius and a hard, non-blurred offset
  drop shadow (the site's own CSS literally uses `box-shadow: <color>
  10px 10px` with no blur, on every card/button/image - reproduced here),
  a subtle diagonal magenta stripe in the header echoing its real dither
  texture, and widget titles in "Press Start 2P" (a properly-licensed
  Google/Fontsource pixel font - the site's own "PixelCraft" is a paid
  font just hosted through a font-conversion CDN, so it wasn't used).

Disco Elysium/Marathon/Ultrakill/Metal Gear Solid are a best-effort
approximation from research (search results, art direction interviews),
not a pixel-accurate recreation of any game's real UI - Metal Gear Solid
especially, since its exact color-cycling behavior couldn't be
independently verified either. Alien, Deus Ex: Human Revolution, Halo 3,
and MGSV: iDroid were built directly against reference screenshots
instead, so those are a closer match; jesspring.io was built directly
against the site's own fetched source, closer still. Everything here
targets `.widget-shell`, so any future theme can add its own flair the
same way just by adding a new `[data-theme-style="..."]` block.

Per widget, you can set:

- **Visibility** - *Always shown*, *Hidden*, or *Scheduled*. Scheduled adds a
  day-of-week picker (tap a letter to toggle that day) and a start/end time
  range; the widget only appears during that window. `Dashboard.tsx` re-checks
  every 60s, so a scheduled widget appears/disappears on its own as the clock
  crosses the boundary - no reload needed. An overnight window like
  22:00-02:00 works too (`isWidgetVisibleNow` in `dashboardSettingsStore.ts`
  handles the wraparound).
- **Size mode** - *Snap to grid* (default) or *Free size*. Grid mode is
  everything below; free size takes a widget out of the CSS Grid entirely
  and floats it at an arbitrary pixel position/size instead (see below).
- **Group** - which section of the settings panel a widget is filed under
  (see "Widget groups" below). Purely an organizing device for this panel -
  it doesn't affect where a widget renders on the dashboard itself.

#### Widget groups

As the widget list grows, the settings panel groups them under headers -
**Info**, **Games**, **Media**, **System** by default (`BUILTIN_GROUPS` in
`widgetGroupsStore.ts`), matching each widget's `defaultGroupId` in
`widgets.config.ts`. Each group header has:

- **Show all / Hide all** - sets every widget in that group to *Always
  shown* / *Hidden* in one click, for decluttering the dashboard by
  category instead of one widget at a time.
- **✎ (rename)** - works on built-in groups too, so "Info" can become
  whatever fits, without losing its contents or its undeletable status.
- **✕ (delete)** - custom groups only (built-ins are guarded against
  deletion, since every widget needs *some* group to resolve to). Deleting
  a group doesn't delete its widgets - they fall back to their own
  built-in default group, same as any other reset-to-default.

A **"+ Add group"** field at the bottom of the widget list creates a new
custom group, which then shows up as just another option in every widget's
**Group** dropdown - move a widget into it (or into "Ungrouped") the same
way you'd change its Visibility or Size mode. All of this - custom groups,
renames, and per-widget group assignments - is local-only,
`localStorage`-persisted (`dashboard-widget-groups`,
`dashboard-widget-group-assignments`, `dashboard-widget-group-builtin-names`),
same as the rest of this panel.

#### Layout presets

A **"Layout…"** dropdown next to the ⚙ button (top-right of the window) lets
you switch the whole dashboard's arrangement in one click, and the settings
panel's "Layout presets" section (`layoutPresetsStore.ts`) manages them.
Two different kinds under one name:

- **Built-in** (Productivity, Gaming, Background) - each just a list of
  widgets to show; applying one sets those to *Always shown* and everything
  else to *Hidden*, leaving whatever size/position each widget already had
  alone. There's no way to guess a good arrangement for "Gaming" ahead of
  time, so built-ins only ever touch visibility. **Productivity** shows
  News/Stocks/Calendar/Situation Monitor/Habits/Transit/Time & Weather/
  Shortcuts/Quotes/Of the Day; **Gaming** shows GAELJANK SOFTWORKS/CS2
  Database/Pokémon TCG/Spotify/Entertainment Centre/System Health;
  **Background** shows just Time & Weather/Quotes/Of the Day/System
  Health, for running the dashboard as ambient background on a second
  screen.
- **Custom** - "+ Save layout" captures a full snapshot of the dashboard's
  *actual current state* - every widget's visibility, size, position, and
  the grid order - as a new named preset. Applying one restores that exact
  arrangement, not just a visibility filter. Rename (✎) and delete (✕) work
  the same way widget groups' do; built-ins can't be deleted.

Custom presets are `localStorage`-persisted (`dashboard-layout-presets`);
built-ins are hardcoded, not stored, so they can't drift or be corrupted.

Position/size themselves aren't set from a form - they're mouse-driven,
directly on the dashboard:

- **Grid mode** (`WidgetCell.tsx`) - **Resize**: hover a widget, grab the
  ⌟ handle bottom-right, and drag; self-calibrating against the cell's own
  current rendered size (rows are `minmax(260px, 1fr)`, not a fixed
  height), clamped to 1-3 columns/1-2 rows, live-previewed and only
  written to `localStorage` on release. **Reposition**: grab the ⠿ handle
  top-left, drag onto another widget, and drop - inserted right before
  whatever you dropped it on, via native HTML5 drag-and-drop. (If this
  ever stops working: Tauri's `dragDropEnabled` window option defaults to
  `true`, and per Tauri's own docs that has to be `false` for in-page
  HTML5 drag-and-drop to work on Windows - already set in
  `tauri.conf.json`, but worth knowing if a future Tauri upgrade resets
  it.)
- **Free mode** (`FreeWidgetCell.tsx`) - same ⌟/⠿ handles, same
  self-calibrating pointer-capture technique, but resize tracks raw pixel
  width/height instead of snapping to grid units, and the drag handle
  repositions by direct pixel offset instead of native drag-and-drop
  (there's no ordered list to insert into - it just floats wherever you
  drop it). Clicking/dragging a free widget brings it to the front of the
  stack. Free widgets are still children of the same scrollable dashboard
  container, so they scroll with the grid rather than staying fixed to the
  window.

All of this is per-device, persisted to `localStorage`
(`dashboard-widget-settings` for size/size-mode, `dashboard-widget-order`
for grid position) - there's no sync or account system, matching
everything else in this app being local-first. `widgets.config.ts`'s
`defaultColSpan`/`defaultRowSpan` and the widget list's own order are just
the starting point before you've touched anything.

### Fullscreen

Two independent levels: the ⛶ button (top-right, next to ⚙) or F11
toggles the whole app window fullscreen via Tauri's window API
(`getCurrentWindow().setFullscreen()`) - needs `core:window:allow-set-
fullscreen` in `capabilities/default.json`, since read-only fullscreen
state is granted by default but changing it isn't. Separately, every
widget's own ⛶ header button (next to ⤢ Expand) fills the *entire window*
with just that widget, not just a centered modal - `Overlay.tsx` gained a
`fullBleed` option for this (zero backdrop padding, panel sized 100%×100%
instead of the existing expand view's capped `1100px × 800px`), so it's a
small additive change to the existing expand-to-overlay mechanism rather
than a new one.

### Sound

UI clicks app-wide and a per-theme ambient loop, played via the Web Audio
API (`src/shared/sound.ts`). An earlier version generated every sound
procedurally instead (sidesteps licensing questions entirely, zero bundle
size) - it worked, but sounded cheap and thin, so it was replaced with
real recordings before shipping. Every file is CC0 or dedicated to the
public domain, individually verified:

- `click.mp3` - ["Diamond Click (Luxury UI
  Click)"](https://freesound.org/people/LilMati/sounds/703884/) by LilMati
- `ambient-hum.mp3` - ["Industrial Factory/Fans
  Loop"](https://freesound.org/people/IanStarGem/sounds/271096/) by
  IanStarGem
- `ambient-melancholy.mp3` -
  ["AmbientLoop.wav"](https://freesound.org/people/IgalBlech/sounds/399164/)
  by IgalBlech
- `ambient-aggressive.mp3` - ["Experimental
  Drone"](https://freesound.org/people/Jedo/sounds/396864/) by Jedo
- `ambient-epic.mp3` - ["Em Pentatonic Pads
  80bpm"](https://freesound.org/people/BuytheField/sounds/436130/) by
  BuytheField - opens with a ~4s silent fade-in in the source recording,
  so playback starts a few seconds in and loops from that same point
  (`AudioBufferSourceNode.loopStart`), not back to the silent intro
- `ambient-chiptune.mp3` - ["8 bit arpeggio 001 major 120 bpm square 037
  C4"](https://freesound.org/people/josefpres/sounds/660386/) by josefpres
- `meow.ogg` - ["Meow of a pleading
  cat"](https://commons.wikimedia.org/wiki/File:Meow_of_a_pleading_cat.oga)
  on Wikimedia Commons

Clicks are wired via one delegated `click` listener at the document level
(`App.tsx`) rather than touching every button in every widget individually
- it covers every current and future one for free. Ambient is tied into
the existing theme system: `themeStore.ts`'s `applyTheme` (the single
choke point every theme change already runs through) calls
`sound.setAmbientTheme()`, which crossfades to a profile grouping the 9
flavor presets into 5 distinct characters rather than 9 shallow bespoke
ones - a cold "hum" (Alien, MGSV: iDroid, Deus Ex, Marathon), a warm
"melancholy" pad (Disco Elysium, Metal Gear Solid), a driving "aggressive"
tone (Ultrakill), a spacious harmonic "epic" chord (Halo 3), and a soft
"chiptune" arpeggio (jesspring.io). Dark/Light/Midnight/High Contrast/
Custom get no ambient at all - picking a plain theme for a quiet, plain
look shouldn't come with forced background noise. An "Enable sounds"
toggle + volume slider live in Settings → General.

The hidden "meow" button tucked into the CS2 Database widget's filter bar
(a tiny, unlabeled dot - look for it) plays `meow.ogg` and nothing else -
it stops the click straight from bubbling to the app-wide click listener,
so it doesn't also trigger a second, unrelated click sound on top of the
meow.

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
  endpoint). A symbol that fails to resolve is dropped, not fatal. The %
  change and the sparkline are two genuinely different time windows on the
  same row - % change is day-over-day (Yahoo's `previousClose` vs. current
  price), the sparkline is the trailing month (`range=1mo&interval=1d`) -
  both were already accurate, just unlabeled, so a small `(1D)`/`(1M)` tag
  next to each now makes that explicit instead of leaving "down 20%"
  ambiguous about what it's down over.
- **Calendar** - real data from two independent sources
  (`src-tauri/src/calendar.rs`), fetched concurrently and merged so one
  failing doesn't take down the other. Shows anything upcoming within 90
  days (not just the next week) - sports leagues go weeks between fixtures
  in their off-season, and a tighter window was silently hiding real,
  correctly-fetched events.
  - *General sports* - [TheSportsDB](https://www.thesportsdb.com/), using
    their long-documented shared free/test key (`"3"`, no signup). A
    curated, live-verified 17-league catalog spanning 8 sports (soccer,
    basketball, American football, ice hockey, baseball, motorsport, MMA,
    golf, rugby) - pick which ones show up via the ⚙ button in the
    widget's header, grouped by sport. Selections persist locally
    (`calendarLeaguesStore.ts`) and default to the app's original
    Premier League + NBA pairing until changed. Off-season leagues can
    still mean an empty Calendar for weeks at a stretch - that's correct,
    not broken.
  - *CS2/esports* - [PandaScore](https://pandascore.co)
    (`src-tauri/src/pandascore.rs`), a real esports API. Needs a free
    account and API key (pandascore.co), entered via the ⚙ button in the
    widget's header - persisted locally (`pandascoreKeyStore.ts`), never
    baked into the app since it's a per-account secret unlike Spotify's
    client ID (and this repo is public - a shared key committed to source
    would be extractable from the installer by anyone the moment it
    shipped). Without a key, only general sports show up - both the
    settings form and the "no esports source configured" hint link
    straight to the signup page so getting one doesn't need a second
    search. CS2 still lives
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
- **CS2 Database** - five views, cycled with `useWidgetViews`/`ViewSwitcher`:
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
  - *Nade Site* - csnades.gg embedded directly in an `<iframe>`, since the
    homegrown Lineups database above is unverified starter content and a
    real, actively-maintained site is a better source of truth for actual
    throw techniques. Can't verify from this sandboxed dev environment
    whether csnades.gg sends headers that block being framed (and reliably
    detecting a silent frame-block via JS is inconsistent across browser
    engines, so this isn't gated on a check) - there's always a visible
    "Open in browser instead ↗" link right next to the embed regardless of
    whether it loads, not just as an error fallback. The Lineups/Pro Plays/
    Profiles/Analysis views are untouched for now; whether to retire the
    homegrown database in favor of this is a call for once it's actually
    been seen working (or not) in the real app.
- **Pokémon TCG** - four views, cycled with `useWidgetViews`/`ViewSwitcher`:
  - *Prices* - search any card by name against
    [api.pokemontcg.io](https://pokemontcg.io)
    (`src-tauri/src/pokemon_tcg.rs`), a free API that works with no key at
    all (an optional free key just raises the rate limit, same handling as
    PandaScore's). Each result shows TCGPlayer (US) and Cardmarket (EU)
    prices side by side, straight from that one response - a genuine
    comparison between two independent markets, not two separate
    integrations.
  - *Collection* - check off cards you own with a quantity stepper
    (`collectionStore.ts`, `localStorage`, no artificial cap the way the
    smaller list-stores elsewhere have - a real collection can run into
    the hundreds), a running estimated total value, and a "Refresh prices"
    action that re-fetches current prices for everything you own.
  - *Spend Tracker* - log pack/box purchases (product + cost) and, per
    purchase, the individual cards pulled with a value each
    (`spendStore.ts`) - an optional 🔍 lookup reuses the Prices search to
    fill in a pull's value instead of typing it by hand. Running totals
    for spent / pulled value / net gain-or-loss.
  - *Shopping* - price comparisons for boosters, singles and more across
    1,000+ retailers, embedded from [TCGCompare.com](https://tcgcompare.com)
    - same embed-the-real-site pattern as the CS2 widget's Nade Site tab,
    for the same reason: no self-serve API gives true per-named-retailer
    pricing, and scraping individual retailers directly would violate
    their terms of service. A visible "Open in browser instead ↗" link
    covers sites that block being framed.
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
    reading), each worth a point value; check them off as you do them. Both
    the name and point value are editable in place (✎ next to each task) -
    editing a task's points reshapes what it's worth for every past
    completion too, not just future ones, since the lifetime total is
    summed from each task's *current* point value rather than one frozen
    at the moment it was logged. Shows today's points and a lifetime
    running total (`habitsStore.ts`, plain localStorage - a task list plus
    a per-day completion log, pruned to the last 30 days since only a
    7-day rolling window is ever needed).
  - *Vitals* - a "vitality" score (0-100), a rolling average of the last 7
    *completed* days' checked-off ratio (today doesn't count against you
    until it's actually over) - driving a schematic, **outline-style**
    human silhouette (redone from an earlier solid-filled version to read
    closer to a med-bay body-scan readout, per reference screenshots) and a
    heartbeat-style pulse trace that both shift color/shape across three
    bands (stable/fatigued/critical, using the theme's own
    positive/warning/negative colors so it re-themes automatically) as
    vitality rises or falls. Wrapped in a small sci-fi HUD frame (corner
    brackets, a "SCANNING…" label, a short list of generated flavor-text
    readout lines like "› Cardiac output: NOMINAL" that shift wording per
    band) - the flavor lines are wording only, derived from the same single
    vitality score, not a separate per-body-part data model. The heart
    rate number and pulse shape are purely cosmetic flavor, not a real
    physiological model - explicitly labeled as such in the widget itself.

- **Transit Tracker** - a departure-board-style widget, two tabs:
  - *Transit* (trains/buses/ferries) - search any stop worldwide by name via
    [Transitland](https://transit.land) (`src-tauri/src/transit.rs`), which
    aggregates GTFS + GTFS-realtime feeds from thousands of agencies across
    50+ countries - one integration instead of one per transit agency. Needs
    a free API key (per-account secret, so it's user-supplied via the ⚙
    button, same handling as PandaScore's, never baked in). Track up to 10
    stops (`trackedStopsStore.ts`); each shows upcoming departures with
    route, headsign, mode, and real-time delay where the underlying feed
    provides one. Like `pandascore.rs`, this module's response shape
    couldn't be verified against a live call (getting a real key needs an
    interactive signup this environment can't complete) - built from
    Transitland's documented REST API + GTFS field names, read defensively
    (every field optional, a shape mismatch drops a field or a departure,
    never panics).
  - *Flights* - recent arrivals/departures for any of ~3,300 airports with
    scheduled service, via [OpenSky Network](https://opensky-network.org)
    (`src-tauri/src/opensky.rs`) - free and keyless (a modest daily credit
    budget applies, well within what an on-demand, not auto-polled, fetch
    needs). Airport search is instant and offline: `airportsData.ts` bundles
    a filtered copy of [OurAirports](https://ourairports.com/data)' airport
    database (public domain), trimmed from ~85k rows to large/medium
    airports with scheduled airline service. Worth being clear about what
    this actually is: OpenSky is built from real ADS-B tracking data, not
    an airline schedule feed, so there's no gate info, no delay status, and
    it can only show flights that already happened - departures cover
    roughly the last few hours, but arrivals specifically only ever have
    data through "yesterday" since that's how OpenSky's own nightly batch
    process updates that endpoint. It's a recent-activity log, not a live
    departure board, and the widget labels it that way rather than implying
    real-time gate/schedule info. The flight-object response fields
    (callsign/firstSeen/lastSeen/estDepartureAirport/estArrivalAirport) are
    OpenSky's long-standing public schema, not re-confirmed live this round
    either - the docs page's own property table wasn't rendering any
    content when checked, an apparent gap on their end - so this is read
    defensively the same way.

- **Time & Weather** - the device's own local time (just `Intl.DateTimeFormat`
  against `new Date()`, ticking every second - no API, no timezone lookup,
  it's whatever the OS clock already says) plus current conditions from
  [Open-Meteo](https://open-meteo.com), free, keyless, and CORS-open like
  Lichess above, so this is a plain client-side `fetch` too. No location is
  assumed on first run - search by city name (Open-Meteo's own geocoding
  endpoint) or "📍 Use my location" (browser geolocation, only ever
  triggered by that explicit click, never on load). °C/°F is a toggle in
  the same settings panel. Every request carries a 10s client-side timeout
  (`fetchWithTimeout` in `weatherService.ts`) - `fetch` has no built-in
  one, and without it a dropped connection would leave the widget's
  loading/searching state stuck rather than showing a normal error.
  The clock itself has three more settings (`clockSettingsStore.ts`):
  **Digital or Analogue** (the latter an SVG face in the same hollow-line
  style as the World Map below - `AnalogueClock.tsx`); a **Digital font**
  picker, the same `FONT_OPTIONS` list Appearance uses; and **Precision
  Mode**, which syncs a local-clock offset against a keyless, CORS-open
  network time API (`timeapi.io`, itself NTP-synced) rather than trusting
  the device's own clock, which can be wrong (unset, drifted, a stalled
  VM clock) with no way for a browser to query real NTP/an atomic clock
  directly. `timeSyncService.ts` estimates round-trip latency (splitting
  it evenly between request and response, same idea NTP itself uses) and
  re-syncs every 10 minutes while enabled; a failed sync keeps the last
  good offset rather than silently reverting to the raw device clock.
- **Situation Monitor** - live coverage of open-ended "watch topics"
  (`watchTopicsStore.ts`, same editable-tag pattern as News' keywords;
  defaults to neutral event-type terms - armed conflict, ceasefire,
  humanitarian crisis, natural disaster - deliberately not named countries
  or conflicts, since a fixed default list of "the" flashpoints to watch
  goes stale the moment one ends and a new one starts) via [The GDELT
  Project](https://www.gdeltproject.org)'s DOC 2.0 API
  (`gdeltService.ts`) - an open, keyless, CORS-open global news monitoring
  database (Google Jigsaw-supported, updated every 15 minutes from tens of
  thousands of outlets) - filtered to English-language sources for
  readability. Every result keeps its own source domain and link, the same
  "judge the outlet yourself" attribution News already relies on.
  Optionally supplemented with official UN/NGO situation reports from
  [ReliefWeb](https://reliefweb.int) (`reliefwebService.ts`, CC BY 4.0) -
  unlike GDELT, ReliefWeb needs a registered "appname" (a short manual-
  approval form, not a secret - their own docs say it's for usage
  monitoring, not authentication) before it'll answer at all, so this half
  is opt-in via the ⚙ button, same "paste a free key you had to go get"
  pattern as Calendar's PandaScore integration. Its field shapes are
  ReliefWeb API v2's long-documented `profile=list` schema, not
  re-verified against a live call this round (getting an appname needs an
  interactive form + manual review this session couldn't complete) - same
  caveat pandascore.rs/transit.rs already carry for the same reason; read
  defensively, a shape mismatch drops that one report rather than the
  widget. The two sources fetch concurrently (`Promise.allSettled`) so one
  failing - or ReliefWeb simply not being configured - never takes out the
  other.
- **World Map** - a fully vectorized (SVG, not raster) world map in the
  dashboard's hollow-line style (see the CS2 Analysis rating radar for the
  same "thin stroked lines, no fill" idea) - every country is `fill: none`
  with just a stroke outline, so it scales to any widget size with zero
  quality loss, unlike a raster/tile-based map. Click a country for a
  small anchored panel near the click point (closer to a real right-click
  context menu than the app's usual centered modal, since that's the
  natural gesture here) showing its flag, capital, region, UN membership,
  and a link to its Wikipedia article. Entirely offline and keyless - the
  whole dataset is bundled, nothing is fetched at runtime:
  - **Geometry** (`mapData.ts`) - `world-atlas`'s `countries-50m.json`
    (ISC), TopoJSON derived from [Natural Earth](https://www.naturalearthdata.com)'s
    public-domain Admin-0 country boundaries at 1:50m scale - not the
    smaller 110m file, since that drops 4 of the disputed territories
    below; not the larger 10m file, since its extra coastline detail
    doesn't resolve into anything visible at the size this widget is
    actually viewed at. Projected once at module load with d3-geo's
    Natural Earth projection, fitted to a fixed 960x500 viewBox - the SVG
    itself renders that viewBox at `width: 100%`, which is what actually
    keeps the map scaling losslessly (vector coordinates rescaled by the
    browser, not raster pixels being stretched).
  - **Country info** (`countryMetadata.ts`) - matched by numeric ISO code
    (`ccn3`) against [`world-countries`](https://github.com/mledoze/countries)
    (ODbL-licensed - a share-alike database license, unlike the rest of
    this MIT-licensed app's dependencies, called out here the same way
    js-dos's GPL-2.0 is above), which covers ~235 of the topology's 241 features;
    a handful of contested/unrecognized entities it doesn't carry at all
    (Kosovo, Northern Cyprus, Somaliland, plus the non-country Siachen
    Glacier) are filled in by hand in the same file.
  - **Disputed territories** (`disputedTerritories.ts`) - shaded with a
    horizontal-line hatch fill (an SVG `<pattern>`) instead of a solid
    color, so contested status reads as a *texture*, not just another
    color in the palette. Limited to entities that are *also* their own
    separately-selectable polygon in this dataset - Crimea, for instance,
    is drawn as part of Ukraine's outline here, not its own shape, so it
    isn't (and can't accurately be) called out; Gibraltar, the Kuril
    Islands, and Ceuta/Melilla are too small to appear as distinct shapes
    at 1:50m either. The ten covered - **Kosovo**, **Northern Cyprus**,
    **Somaliland**, **Palestine**, **Taiwan**, **Western Sahara**, the
    **Siachen Glacier**, the **Chagos Archipelago/British Indian Ocean
    Territory**, the **Falkland Islands**, and **South Georgia and the
    South Sandwich Islands** - each get a short, deliberately
    non-editorializing note (who administers it, who claims it, roughly
    how many states recognize what) rather than a position on any of them,
    the same "here's what's reported" stance Situation Monitor takes
    toward its own sources.
- **GAELJANK SOFTWORKS** - a small "game label" widget: a launcher listing
  playable games (`src/widgets/gaeljank/gamesCatalog.ts`), each opening
  fullscreen in its own `Overlay` when you hit Play, with a "quit to menu"
  button to back out. Adding a future game is one new entry in that
  catalog file - no changes needed to the widget itself.
  - **One More Season** (`games/onemoreseason/`) - a full football
    career-mode sim: pick a nation, position, and career ambition, work
    through youth trials, then join a real club's academy at 16 (e.g. "AC
    Milan U21" for a player who chose Italy, drawn from that nation's own
    club pool - never a generic national-federation stand-in) rather than
    skipping straight to a first professional contract. From 18 onward,
    each end-of-season trial has a chance of a professional contract
    offer - promoting you into that same club's first team - scaling with
    your stats and reputation. Keep playing academy seasons and trying
    again each year if it doesn't come. Miss out at every trial through 21
    and the academy lets you go - a real "didn't make it" ending, distinct
    from retiring at 38, that still totals up whatever you built during
    your academy years. Once signed pro, live out real 38-game simulated
    league seasons (a genuine 20-club table, a real
    schedule, Poisson-sampled goals/assists so a striker's season reads as
    believably streaky rather than a flat average) interspersed with
    narrative events - transfer interest, contract standoffs, international
    call-ups, discipline hearings, derby weeks, and more - all the way to
    retirement at 38, with a legacy score and a final verdict on whether you
    hit your original ambition. Rendered in a retro football-vidiprinter/
    teletext screen style (self-hosted `VT323` + `IBM Plex Mono`, same
    self-hosting reasoning as every other font here - this needs to keep
    working without a network connection). Ported from a standalone,
    hand-built HTML file (CDN React 18 + in-browser Babel, no bundler) into
    this app's actual React 19/Vite/TypeScript setup - same data tables,
    formulas, and copy, just compiled and bundled properly instead of
    shipping a second React runtime and transpiling JSX at runtime inside
    an already-bundled desktop app. Entirely self-contained and
    deterministic-per-random-seed (no network calls, no API key) - the one
    thing it doesn't do yet is persist an in-progress career across closing
    the widget or restarting the app, unlike most of this app's other
    per-widget state.
  - **DOS Arcade** (`games/dosarcade/`) - a small cabinet of real, playable
    DOS games running via [js-dos](https://js-dos.com) (DOSBox compiled to
    WebAssembly), not a native emulator dependency. Self-hosted, not a CDN
    embed: `scripts/setup-jsdos-assets.mjs` copies the plain-DOSBox backend
    (skipping the much larger DOSBox-X/Windows-9x backend this app doesn't
    need) from `node_modules` into `public/js-dos/` on every
    install/dev/build, so `js-dos` and `emulators` stay ordinary
    dependencies instead of committed binaries. **Licensing note:** js-dos
    itself is **GPL-2.0** (so is DOSBox, which it wraps) - unlike the rest
    of this MIT-licensed app. It's bundled unmodified as a separate
    dependency (standard "mere aggregation," same as any other
    differently-licensed npm package), called out explicitly here rather
    than left unstated.
      Every title here is checked against its own bundled documentation,
      not just an aggregator site's category tag - that tag alone isn't
      reliable (a "public domain" listing for one game turned out to
      just mean "developer-adjacent").
      - **Jetpack** (Adept Software, 1993) - the opening cartridge.
        Verified freeware straight from the source: the game's own
        bundled `README.TXT` states "they are now released as freeware,"
        and the original developer's own still-live page at
        [adeptsoftware.com/jetpack](https://www.adeptsoftware.com/jetpack/)
        labels the download itself "FREEWARE."
      - **Major Stryker** (Apogee Software, 1993) - a vertical-scrolling
        shoot-'em-up, all 3 episodes unlocked. Its own bundled
        `readme.txt` has Apogee's tech support writing in March 2006:
        "This game is released as freeware... You are free to play the
        game as we've released it, but not free to... [sell it or] use
        the materials in other projects" - matches 3D Realms' official
        site, which carries the same statement. The in-game splash still
        reads "This game is NOT shareware" - a leftover from the
        original 1993 build, superseded by the 2006 freeware readme, not
        a contradiction of it.
      - **Blocks from Hell** (1990) - a tight, no-frills falling-block
        puzzler in the Tetris mold (a distinct, non-trademarked name -
        Tetris itself is still commercially licensed and wasn't a
        candidate). Its own bundled `.doc` says plainly: "This game is
        free... You may distribute it freely provided the contents...
        remain intact."
      - **Digger** (Windmill Software, 1983) - a Dig Dug-style arcade
        classic. This is the developer's own public-domain sample
        release; its bundled `.doc` states "This is a public domain
        sample program and may be copied and distributed at will."
      - **ZZT** (Epic MegaGames, 1991) - Tim Sweeney's text-mode
        puzzle-adventure and game-creation system. **A real licensing
        nuance, not swept under the rug:** Epic's own bundled
        `license.txt` explicitly states the program is "NOT public
        domain or free software or 'freeware'" - it's a no-cost but
        restrictive EULA, not true freeware, and forbids calling it
        freeware in any redistribution. It does, however, explicitly
        permit no-charge redistribution (e.g. "distribution by BBS's and
        online services"). [Museum of ZZT](https://museumofzzt.com), the
        dedicated ZZT preservation project, serves the identical file
        under the same terms - there's no cleaner version in
        circulation. Separately, [Adrian Siekierka's "Reconstruction of
        ZZT"](https://github.com/asiekierka/reconstruction-of-zzt) is a
        genuinely MIT-licensed, byte-identical reverse-engineered
        rebuild made "with Epic's permission" - the actual open-source
        answer here - but building it requires a Turbo Pascal 5.5-era
        toolchain this session couldn't assemble, so the bundle here is
        still Epic's original binary under Epic's own no-cost terms.
      - **Xargon** (Epic MegaGames / Allen Pilgrim, 1994) - a sprawling
        platformer. Widely reported as freed by the original developer
        in 2008 alongside its source code, but the specific freeware
        announcement text couldn't be located within this session's
        reach (GitHub's release/API pages weren't reachable from this
        sandbox); the bundled file itself still carries Epic's original
        commercial-era license doc.
      - **Tyrian** (Eclipse/Epic MegaGames, 1995) - a vertical shoot-'em-up,
        later the basis for the open-source [OpenTyrian](https://github.com/opentyrian/opentyrian)
        engine reimplementation. Reported made freeware by Epic in 2004;
        this bundle uses the data files from
        [camanis.net](https://camanis.net/tyrian/) - the exact source
        OpenTyrian's own project recommends - but even that most-authoritative
        available copy still ships Epic's original commercial-era
        license doc, not updated freeware terms. (OpenTyrian's *engine*
        is MIT-licensed and open source; it's the original *data files*
        whose documentation remains unresolved, and the engine can't run
        without them.)
      
      One more candidate, **One Must Fall: 2097** (Diversions
      Entertainment, 1994), was researched but left out this round - not
      for licensing reasons (it's reported freeware, in the same
      unresolved-documentation boat as the three above), but because its
      installer is a genuinely multi-step interactive wizard whose timing
      proved too fragile to automate reliably in this environment. Its
      own open-source reimplementation, [OpenOMF](https://openomf.org),
      remains a real option for a future attempt.

      The bundle ships each game's original, unmodified files packaged
      as a `.jsdos` archive (see `games/dosarcade/bundles/`). More
      freeware/public-domain titles can be added the same way - a
      confirmed-freeware `.jsdos` bundle (checked against the game's own
      docs, not just a listing site's tag) plus an entry in
      `dosGamesCatalog.ts`. **Note:** each cartridge is started with
      js-dos's `autoStart` option - without it, js-dos shows its own
      nearly-blank "click to play" splash first (needed to unlock audio
      under browsers' autoplay policy), which read as the widget loading a
      blank screen since nothing about that splash explained what it
      was waiting for. `autoStart` skips straight to booting, since the
      widget's own Play click already is the user gesture that policy
      needs.
  - **Retrocade** (`games/retrocade/`) - unlike DOS Arcade, ships no games at
    all: a NES/Game Boy/Game Boy Color/GBA/Genesis front end for ROMs the
    user supplies themselves, via
    [Nostalgist.js](https://nostalgist.js.org) (a wrapper around RetroArch's
    libretro cores compiled to WebAssembly). The ROM folder is a real,
    user-writable directory - `<app data dir>/roms/` (created on first
    launch by `src-tauri/src/main.rs`'s `setup()`, same as the CS2 stats
    SQLite db's directory) - not anything bundled or embedded, so it
    survives app updates and reinstalls exactly like the CS2 database does.
    A "📂 Open ROMs Folder" button reveals it in the OS file manager
    directly from the widget (`open_roms_folder`, using the opener plugin
    already in use elsewhere in this app); drop files in and hit the same
    button in-widget to see them listed, no restart needed.
      Only 4 systems are offered, each mapped to one libretro core by file
      extension (`src-tauri/src/roms.rs`'s `SYSTEM_FOR_EXTENSION`, mirrored
      in `retroSystems.ts` on the frontend) - **NES** (`.nes`, via
      [FCEUmm](https://github.com/libretro/libretro-fceumm), GPL-2.0),
      **Game Boy/Color** (`.gb`/`.gbc`, via
      [Gambatte](https://github.com/libretro/gambatte-libretro), GPL-2.0),
      **Game Boy Advance** (`.gba`, via
      [mGBA](https://github.com/libretro/mgba), MPL-2.0), and
      **Genesis/Mega Drive** (`.md`/`.gen`/`.smd`, via
      [Genesis Plus GX](https://github.com/libretro/Genesis-Plus-GX),
      GPL-2.0/3.0). Deliberately not SNES: upstream Snes9x, the only SNES
      core available from this build repo, is
      ["non-commercial use only"](https://www.snes9x.com/phpbb3/viewtopic.php?t=4835) -
      not actually redistributable - so it's excluded, the same kind of
      licensing check DOS Arcade's own bundle applies to each of its games.
      Self-hosted, not a CDN embed: by default Nostalgist fetches each core
      (plus the zip.js library used to unpack it) from jsDelivr's GitHub CDN
      at runtime; `scripts/setup-nostalgist-assets.mjs` instead downloads
      and unpacks the 4 cores above once, at install/dev/build time, from a
      version-pinned [retroarch-emscripten-build](https://github.com/arianrhodsandlot/retroarch-emscripten-build)
      release into `public/nostalgist/cores/` (gitignored, same reasoning as
      `public/js-dos/`), and `RetrocadeGame.tsx` points Nostalgist's own
      `resolveCoreJs`/`resolveCoreWasm` hooks at those local files - no core
      or zip-library fetch ever happens at runtime, online or off. A ROM
      itself is read via a `read_rom` Tauri command that returns a raw IPC
      response rather than JSON (`tauri::ipc::Response`, resolved by
      `invoke()` straight into an `ArrayBuffer`) - GBA ROMs run up to 32MB,
      and JSON-encoding that as a number array would multiply the transfer
      size for no benefit. `read_rom` also rejects any filename containing
      a path separator and re-checks the canonicalized result still
      resolves inside the ROM directory, since the filename crosses an IPC
      boundary from the frontend.
  - **Lichess** (`games/lichess/`) - there's no [Lichess API](https://lichess.org/api)
    endpoint for embedding an actual playable game (that needs an account
    and Lichess's own websocket-driven client, which this app doesn't
    reimplement), so this cartridge instead uses what Lichess *does* offer
    for free, keyless embedding: its `/training/frame` and `/tv/frame`
    endpoints (purpose-built for exactly this, unlike the rest of
    lichess.org, which blocks being framed), showing today's puzzle and a
    live Lichess TV feed respectively, tabbed between the two. Puzzle
    rating/themes come from `/api/puzzle/daily` (also keyless, CORS-open).
    A "Play on Lichess ↗" link (`ExternalLink`, opens in the system
    browser) covers actually playing a real game. If an iframe hasn't
    loaded after 6 seconds - a restrictive network, firewall, or blocker -
    a fallback message with a direct link takes its place instead of
    leaving the widget looking stuck blank.

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

## License

MIT - see [LICENSE](LICENSE). Fork it, modify it, ship your own build; just
keep the copyright notice and license text intact.
