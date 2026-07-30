export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  positive: string;
  negative: string;
  warning: string;
}

/**
 * Single source of truth mapping each themeable color to its CSS custom
 * property and a friendly label - drives both `applyTheme` (themeStore.ts)
 * and the custom-color editor UI (ThemeSettings.tsx), so adding a new
 * themeable color is one entry here instead of three places.
 */
export const THEME_COLOR_FIELDS: { key: keyof ThemeColors; cssVar: string; label: string }[] = [
  { key: "bg", cssVar: "--color-bg", label: "Background" },
  { key: "surface", cssVar: "--color-surface", label: "Widget surface" },
  { key: "surfaceRaised", cssVar: "--color-surface-raised", label: "Raised surface" },
  { key: "border", cssVar: "--color-border", label: "Border" },
  { key: "text", cssVar: "--color-text", label: "Text" },
  { key: "textMuted", cssVar: "--color-text-muted", label: "Muted text" },
  { key: "accent", cssVar: "--color-accent", label: "Accent" },
  { key: "positive", cssVar: "--color-positive", label: "Positive" },
  { key: "negative", cssVar: "--color-negative", label: "Negative" },
  { key: "warning", cssVar: "--color-warning", label: "Warning" },
];

export interface ThemePreset {
  id: string;
  label: string;
  colors: ThemeColors;
}

export const DEFAULT_PRESET_ID = "dark";

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "dark",
    label: "Dark",
    colors: {
      bg: "#0d1117",
      surface: "#161b22",
      surfaceRaised: "#1c2229",
      border: "#2a313c",
      text: "#e6edf3",
      textMuted: "#8b949e",
      accent: "#58a6ff",
      positive: "#3fb950",
      negative: "#f85149",
      warning: "#d29922",
    },
  },
  {
    id: "light",
    label: "Light",
    colors: {
      bg: "#f6f8fa",
      surface: "#ffffff",
      surfaceRaised: "#f0f2f5",
      border: "#d0d7de",
      text: "#1f2328",
      textMuted: "#59636e",
      accent: "#0969da",
      positive: "#1a7f37",
      negative: "#cf222e",
      warning: "#9a6700",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    colors: {
      bg: "#000000",
      surface: "#0a0a0f",
      surfaceRaised: "#14141c",
      border: "#26262f",
      text: "#e8e8ec",
      textMuted: "#8888a0",
      accent: "#7c8cff",
      positive: "#4ade80",
      negative: "#f87171",
      warning: "#fbbf24",
    },
  },
  {
    id: "high-contrast",
    label: "High Contrast",
    colors: {
      bg: "#000000",
      surface: "#000000",
      surfaceRaised: "#1a1a1a",
      border: "#ffffff",
      text: "#ffffff",
      textMuted: "#cccccc",
      accent: "#ffdd00",
      positive: "#00ff66",
      negative: "#ff3333",
      warning: "#ffaa00",
    },
  },
  // Three "for testing" themes riffing on specific games' visual identities -
  // not official palettes, just researched approximations.
  {
    id: "disco-elysium",
    label: "Disco Elysium",
    colors: {
      // Muted, painterly, sepia-toned melancholy with a deep maroon accent
      // (the game's own color direction: dark blues/grays for the
      // protagonist's internal state, earth tones throughout, splashes of
      // vibrant color for emotional emphasis).
      bg: "#1a1512",
      surface: "#241d18",
      surfaceRaised: "#2e251e",
      border: "#4a3c30",
      text: "#e8dcc8",
      textMuted: "#a89a82",
      accent: "#a83c3c",
      positive: "#7a9471",
      negative: "#b3503f",
      warning: "#c9a227",
    },
  },
  {
    id: "marathon",
    label: "Marathon",
    colors: {
      // Bungie's 2025 reboot: "hyper-saturated pinks and neon yellows pop
      // among the cold steely blues and latex blacks" - strong, saturated,
      // contrasting colors with little gradient/blending.
      bg: "#0a0e14",
      surface: "#12181f",
      surfaceRaised: "#1a222b",
      border: "#2a3844",
      text: "#e8f0f5",
      textMuted: "#7c93a3",
      accent: "#ff3ec9",
      positive: "#3effc0",
      negative: "#ff3e5e",
      warning: "#e8ff3e",
    },
  },
  {
    id: "ultrakill",
    label: "Ultrakill",
    colors: {
      // Blood red / stark white / black / gold - V1's own color scheme,
      // high contrast, metal-album-cover energy.
      bg: "#0a0a0a",
      surface: "#141414",
      surfaceRaised: "#1e1e1e",
      border: "#3a3a3a",
      text: "#f5f5f5",
      textMuted: "#999999",
      accent: "#e0102a",
      positive: "#d4af37",
      negative: "#ff1744",
      warning: "#ffd700",
    },
  },
];
