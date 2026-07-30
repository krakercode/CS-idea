export interface FontOption {
  id: string;
  label: string;
  /** Value written to --font-sans. Includes the system fallback stack so a
   * font that somehow fails to load still degrades gracefully. */
  cssValue: string;
}

export const DEFAULT_FONT_ID = "system";

/**
 * A couple of free (SIL Open Font License), self-hosted fonts as
 * alternatives to the system default - see main.tsx for the @fontsource
 * imports that actually ship the font files. Self-hosted rather than
 * loaded from a CDN so the app stays fully offline-capable.
 */
export const FONT_OPTIONS: FontOption[] = [
  { id: "system", label: "System Default", cssValue: '"Segoe UI", system-ui, -apple-system, sans-serif' },
  { id: "inter", label: "Inter", cssValue: '"Inter", system-ui, sans-serif' },
  { id: "space-grotesk", label: "Space Grotesk", cssValue: '"Space Grotesk", system-ui, sans-serif' },
];
