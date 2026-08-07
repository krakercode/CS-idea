import type { TemperatureUnit, WeatherLocation, WeatherSnapshot } from "./types";

/**
 * Open-Meteo (open-meteo.com) - free, keyless, CORS-open (confirmed:
 * access-control-allow-origin: *), so unlike most of this app's data
 * widgets there's no Rust backend command or user-supplied API key here,
 * just a plain client-side fetch (same reasoning as spotifyService.ts's
 * browser-side calls once a token exists).
 */
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const REQUEST_TIMEOUT_MS = 10_000;

/** A hung connection (flaky wifi, a captive portal, a firewall that drops
 * rather than rejects) would otherwise leave the widget's loading/searching
 * state stuck forever - fetch has no built-in timeout, so this is the
 * difference between that and a normal, displayable error. */
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Timed out - check your connection.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchWeather(location: WeatherLocation, unit: TemperatureUnit): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
    temperature_unit: unit,
  });
  const res = await fetchWithTimeout(`${FORECAST_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Weather request failed (${res.status}).`);
  const data = (await res.json()) as {
    current: {
      temperature_2m: number;
      apparent_temperature: number;
      relative_humidity_2m: number;
      weather_code: number;
      wind_speed_10m: number;
      is_day: number;
    };
  };
  return {
    temperature: data.current.temperature_2m,
    apparentTemperature: data.current.apparent_temperature,
    humidityPercent: data.current.relative_humidity_2m,
    windKph: data.current.wind_speed_10m,
    weatherCode: data.current.weather_code,
    isDay: data.current.is_day === 1,
    unit,
  };
}

export async function searchLocations(query: string): Promise<WeatherLocation[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const params = new URLSearchParams({ name: trimmed, count: "5", language: "en", format: "json" });
  const res = await fetchWithTimeout(`${GEOCODING_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Location search failed (${res.status}).`);
  const data = (await res.json()) as {
    results?: Array<{ name: string; latitude: number; longitude: number; admin1?: string; country?: string }>;
  };
  return (data.results ?? []).map((r) => ({
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

/** Browser geolocation, not a reverse-geocoding call - this only ever runs
 * from an explicit "Use my location" click (a user gesture, which is also
 * what the permission prompt needs), so there's no unprompted background
 * location access. */
export function detectLocation(): Promise<WeatherLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation isn't available."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ label: "My location", latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(new Error(err.message || "Couldn't get your location.")),
      { timeout: 10_000 },
    );
  });
}

/** WMO weather codes (the scheme Open-Meteo's `weather_code` uses) collapsed
 * into the handful of buckets worth telling apart in a small widget. */
export function describeWeatherCode(code: number, isDay: boolean): { label: string; icon: string } {
  if (code === 0) return isDay ? { label: "Clear sky", icon: "☀️" } : { label: "Clear sky", icon: "🌙" };
  if (code <= 2) return isDay ? { label: "Partly cloudy", icon: "⛅" } : { label: "Partly cloudy", icon: "☁️" };
  if (code === 3) return { label: "Overcast", icon: "☁️" };
  if (code === 45 || code === 48) return { label: "Fog", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: "🌦️" };
  if (code >= 61 && code <= 67) return { label: "Rain", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "Snow", icon: "❄️" };
  if (code >= 80 && code <= 82) return { label: "Rain showers", icon: "🌦️" };
  if (code === 85 || code === 86) return { label: "Snow showers", icon: "🌨️" };
  if (code >= 95) return { label: "Thunderstorm", icon: "⛈️" };
  return { label: "—", icon: "🌡️" };
}
