import type { TemperatureUnit, WeatherLocation } from "./types";

const LOCATION_KEY = "timeweather-location";
const UNIT_KEY = "timeweather-unit";

function isWeatherLocation(value: unknown): value is WeatherLocation {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.label === "string" && typeof v.latitude === "number" && typeof v.longitude === "number";
}

/** No location is picked on first run - the widget prompts for one (search
 * or "use my location") rather than assuming somewhere, same reasoning as
 * Calendar's "no esports source configured" prompt for a missing API key. */
export function getLocation(): WeatherLocation | null {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isWeatherLocation(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setLocation(location: WeatherLocation): void {
  try {
    localStorage.setItem(LOCATION_KEY, JSON.stringify(location));
  } catch {
    // Best-effort - e.g. localStorage disabled/full. Keeps working for the
    // current session, it just won't persist.
  }
}

export function getUnit(): TemperatureUnit {
  return localStorage.getItem(UNIT_KEY) === "fahrenheit" ? "fahrenheit" : "celsius";
}

export function setUnit(unit: TemperatureUnit): void {
  try {
    localStorage.setItem(UNIT_KEY, unit);
  } catch {
    // Best-effort, same as setLocation above.
  }
}
