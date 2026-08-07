import { DEFAULT_FONT_ID } from "../../styles/fonts";

export type ClockStyle = "digital" | "analogue";

const CLOCK_STYLE_KEY = "timeweather-clock-style";
const CLOCK_FONT_KEY = "timeweather-clock-font";
const PRECISION_MODE_KEY = "timeweather-precision-mode";

export function getClockStyle(): ClockStyle {
  return localStorage.getItem(CLOCK_STYLE_KEY) === "analogue" ? "analogue" : "digital";
}

export function setClockStyle(style: ClockStyle): void {
  try {
    localStorage.setItem(CLOCK_STYLE_KEY, style);
  } catch {
    // Best-effort - e.g. localStorage disabled/full. Keeps working for the
    // current session, it just won't persist.
  }
}

/** A FONT_OPTIONS id (styles/fonts.ts) - only used by the digital face. */
export function getClockFont(): string {
  return localStorage.getItem(CLOCK_FONT_KEY) ?? DEFAULT_FONT_ID;
}

export function setClockFont(fontId: string): void {
  try {
    localStorage.setItem(CLOCK_FONT_KEY, fontId);
  } catch {
    // Best-effort, same as setClockStyle above.
  }
}

export function getPrecisionMode(): boolean {
  return localStorage.getItem(PRECISION_MODE_KEY) === "on";
}

export function setPrecisionMode(enabled: boolean): void {
  try {
    localStorage.setItem(PRECISION_MODE_KEY, enabled ? "on" : "off");
  } catch {
    // Best-effort, same as setClockStyle above.
  }
}
