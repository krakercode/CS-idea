import { DEFAULT_PRESET_ID, THEME_COLOR_FIELDS, THEME_PRESETS, type ThemeColors } from "../styles/themes";

export interface ThemeState {
  /** A THEME_PRESETS id, or "custom" to use customColors instead. */
  presetId: string;
  customColors: ThemeColors;
}

const STORAGE_KEY = "dashboard-theme";

function defaultPresetColors(): ThemeColors {
  const preset = THEME_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID) ?? THEME_PRESETS[0];
  return { ...preset.colors };
}

export function getThemeState(): ThemeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { presetId: DEFAULT_PRESET_ID, customColors: defaultPresetColors() };
    const parsed = JSON.parse(raw) as Partial<ThemeState>;
    return {
      presetId: parsed.presetId ?? DEFAULT_PRESET_ID,
      customColors: { ...defaultPresetColors(), ...parsed.customColors },
    };
  } catch {
    return { presetId: DEFAULT_PRESET_ID, customColors: defaultPresetColors() };
  }
}

function saveThemeState(state: ThemeState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best-effort - e.g. localStorage disabled/full. Theme still applies
    // for the current session, it just won't persist.
  }
}

export function resolveActivePalette(state: ThemeState): ThemeColors {
  if (state.presetId === "custom") return state.customColors;
  return THEME_PRESETS.find((p) => p.id === state.presetId)?.colors ?? defaultPresetColors();
}

/** Writes the active palette onto :root as inline style, which wins over
 * theme.css's :root block by cascade specificity - no per-theme CSS
 * classes needed for color. Also stamps `data-theme-style` with the preset
 * id so theme-flair.css can layer on non-color UI treatment (fonts,
 * border shape, texture) for specific presets - e.g. the game-inspired
 * ones - without affecting Custom or the plain presets. */
export function applyTheme(state: ThemeState): void {
  const palette = resolveActivePalette(state);
  const root = document.documentElement.style;
  for (const field of THEME_COLOR_FIELDS) {
    root.setProperty(field.cssVar, palette[field.key]);
  }
  document.documentElement.setAttribute("data-theme-style", state.presetId);
}

export function setPreset(presetId: string): ThemeState {
  const current = getThemeState();
  // Switching to Custom seeds customColors from whatever's on screen right
  // now (the outgoing preset), so tweaking starts from a familiar palette
  // instead of an arbitrary default.
  const next: ThemeState =
    presetId === "custom"
      ? { presetId, customColors: resolveActivePalette(current) }
      : { presetId, customColors: current.customColors };
  saveThemeState(next);
  applyTheme(next);
  return next;
}

export function setCustomColor(key: keyof ThemeColors, value: string): ThemeState {
  const current = getThemeState();
  const next: ThemeState = { presetId: "custom", customColors: { ...current.customColors, [key]: value } };
  saveThemeState(next);
  applyTheme(next);
  return next;
}
