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
  // The 5 most-used fonts on Google Fonts by its own analytics (see
  // main.tsx's import comment) - added as further self-hosted options
  // alongside the two above, same OFL licensing, same offline reasoning.
  { id: "roboto", label: "Roboto", cssValue: '"Roboto", system-ui, sans-serif' },
  { id: "open-sans", label: "Open Sans", cssValue: '"Open Sans", system-ui, sans-serif' },
  { id: "lato", label: "Lato", cssValue: '"Lato", system-ui, sans-serif' },
  { id: "montserrat", label: "Montserrat", cssValue: '"Montserrat", system-ui, sans-serif' },
  { id: "oswald", label: "Oswald", cssValue: '"Oswald", system-ui, sans-serif' },
];
