import type { DashboardSettings, WidgetUserSettings } from "./dashboardSettingsStore";

/**
 * Two different kinds of preset, not one:
 *
 * - "visibility" (built-in only) - just a list of widgets to show; every
 *   other widget on the dashboard, including ones added after this preset
 *   shipped, gets hidden. There's no way to guess a user's preferred
 *   sizes/positions for a mode like "Gaming" ahead of time, so built-ins
 *   only ever touch visibility, leaving whatever size/position each widget
 *   already had alone.
 * - "snapshot" (custom only) - a full copy of the user's actual current
 *   settings + grid order at the moment they hit "Save current layout,"
 *   restored wholesale on Apply. This is the only kind that can capture a
 *   real arrangement, since it's built from one that already exists.
 */
export type LayoutPreset =
  | { id: string; name: string; builtin: true; kind: "visibility"; showWidgetIds: string[] }
  | { id: string; name: string; builtin: false; kind: "snapshot"; settings: DashboardSettings; order: string[] };

/** First-run presets. Widget ids reference widgets.config.ts's WIDGETS
 * list - an id here for a widget that no longer exists is simply ignored
 * on apply, same defensive-drop convention as everywhere else. */
export const BUILTIN_PRESETS: LayoutPreset[] = [
  {
    id: "productivity",
    name: "Productivity",
    builtin: true,
    kind: "visibility",
    showWidgetIds: [
      "news",
      "stocks",
      "calendar",
      "situationmonitor",
      "habits",
      "transit",
      "timeweather",
      "shortcuts",
      "quotes",
      "oftheday",
    ],
  },
  {
    id: "gaming",
    name: "Gaming",
    builtin: true,
    kind: "visibility",
    showWidgetIds: ["gaeljank", "cs2db", "pokemontcg", "spotify", "entertainment", "systemhealth"],
  },
  {
    id: "background",
    name: "Background",
    builtin: true,
    kind: "visibility",
    showWidgetIds: ["timeweather", "quotes", "oftheday", "systemhealth"],
  },
];

const CUSTOM_PRESETS_KEY = "dashboard-layout-presets";

function isDashboardSettings(value: unknown): value is DashboardSettings {
  return typeof value === "object" && value !== null;
}

function readCustomPresets(): LayoutPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is LayoutPreset =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as { id?: unknown }).id === "string" &&
        typeof (p as { name?: unknown }).name === "string" &&
        (p as { kind?: unknown }).kind === "snapshot" &&
        isDashboardSettings((p as { settings?: unknown }).settings) &&
        Array.isArray((p as { order?: unknown }).order),
    );
  } catch {
    return [];
  }
}

function writeCustomPresets(presets: LayoutPreset[]): void {
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // Best-effort - e.g. localStorage disabled/full. Keeps working for the
    // current session, it just won't persist.
  }
}

export function getPresets(): LayoutPreset[] {
  return [...BUILTIN_PRESETS, ...readCustomPresets()];
}

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "layout";
}

/** Saves the dashboard's current settings + grid order as a new named
 * preset. Ids are disambiguated against every existing preset (built-in
 * or custom) the same way widget group ids are. */
export function savePreset(name: string, settings: DashboardSettings, order: string[]): LayoutPreset {
  const trimmed = name.trim() || "New layout";
  const existingIds = new Set(getPresets().map((p) => p.id));
  let id = slugify(trimmed);
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${slugify(trimmed)}-${suffix}`;
    suffix += 1;
  }
  const preset: LayoutPreset = { id, name: trimmed, builtin: false, kind: "snapshot", settings, order };
  writeCustomPresets([...readCustomPresets(), preset]);
  return preset;
}

export function renamePreset(id: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  writeCustomPresets(readCustomPresets().map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
}

export function deletePreset(id: string): void {
  if (BUILTIN_PRESETS.some((p) => p.id === id)) {
    throw new Error("Built-in layouts can't be deleted.");
  }
  writeCustomPresets(readCustomPresets().filter((p) => p.id !== id));
}

/** Resolves what a preset means for the dashboard right now: the settings
 * map to apply, and (for a snapshot) the grid order to restore. A
 * "visibility" preset never touches order - it's a filter over whatever
 * arrangement already exists, not a replacement for it. */
export function resolvePresetApplication(
  preset: LayoutPreset,
  currentSettings: DashboardSettings,
  allWidgetIds: string[],
): { settings: DashboardSettings; order?: string[] } {
  if (preset.kind === "visibility") {
    const next: DashboardSettings = {};
    for (const id of allWidgetIds) {
      const current = currentSettings[id];
      if (!current) continue;
      next[id] = { ...current, visibility: preset.showWidgetIds.includes(id) ? "always" : "hidden" };
    }
    return { settings: next };
  }

  // Snapshot: widgets the snapshot doesn't know about (added since it was
  // saved) keep whatever state they're already in, rather than being
  // forced hidden or guessed at.
  const next: DashboardSettings = { ...currentSettings };
  for (const id of allWidgetIds) {
    const saved = preset.settings[id];
    if (saved) next[id] = saved as WidgetUserSettings;
  }
  return { settings: next, order: preset.order };
}
