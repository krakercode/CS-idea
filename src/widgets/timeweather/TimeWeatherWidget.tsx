import { type FormEvent, useEffect, useRef, useState } from "react";
import { usePolling } from "../../shared/hooks/usePolling";
import { WidgetShell } from "../../shared/WidgetShell";
import { FONT_OPTIONS } from "../../styles/fonts";
import { getLocation, getUnit, setLocation, setUnit } from "./locationStore";
import {
  type ClockStyle,
  getClockFont,
  getClockStyle,
  getPrecisionMode,
  setClockFont,
  setClockStyle,
  setPrecisionMode,
} from "./clockSettingsStore";
import { fetchNetworkTimeOffsetMs } from "./timeSyncService";
import { AnalogueClock } from "./AnalogueClock";
import { describeWeatherCode, detectLocation, fetchWeather, searchLocations } from "./weatherService";
import type { TemperatureUnit, WeatherLocation } from "./types";
import "./TimeWeatherWidget.css";

const WEATHER_REFRESH_MS = 15 * 60_000;
// How often Precision Mode re-syncs against the network time source while
// it stays enabled - frequent enough to keep the offset fresh (correcting
// for local clock drift and re-estimating round-trip latency), rare enough
// not to hammer a free keyless API for a correction that's only ever a
// handful of milliseconds.
const PRECISION_RESYNC_MS = 10 * 60_000;

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dateFormatter = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });

export function TimeWeatherWidget() {
  const [now, setNow] = useState(() => new Date());
  const [location, setLocationState] = useState<WeatherLocation | null>(() => getLocation());
  const [unit, setUnitState] = useState<TemperatureUnit>(() => getUnit());
  const [showSettings, setShowSettings] = useState(() => !getLocation());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [clockStyle, setClockStyleState] = useState<ClockStyle>(() => getClockStyle());
  const [clockFont, setClockFontState] = useState<string>(() => getClockFont());
  const [precisionMode, setPrecisionModeState] = useState<boolean>(() => getPrecisionMode());
  const [syncOffsetMs, setSyncOffsetMs] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const {
    data: weather,
    loading,
    error,
    refresh,
  } = usePolling(
    () => (location ? fetchWeather(location, unit) : Promise.resolve(null)),
    WEATHER_REFRESH_MS,
  );

  // The clock ticks on its own 1s timer, independent of the weather poll -
  // no reason to refetch weather every second just to redraw the time.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Precision Mode: sync a local-clock offset against a network time
  // source on enable, then keep re-syncing on an interval for as long as
  // it stays on. A failed sync doesn't clear a previously-good offset -
  // still-a-bit-stale-but-corrected beats silently falling back to
  // whatever the device clock drifted to.
  useEffect(() => {
    if (!precisionMode) return;

    let cancelled = false;
    function sync() {
      setSyncing(true);
      setSyncError(null);
      fetchNetworkTimeOffsetMs()
        .then((offsetMs) => {
          if (cancelled) return;
          setSyncOffsetMs(offsetMs);
          setLastSyncedAt(new Date());
        })
        .catch((err: unknown) => {
          if (!cancelled) setSyncError(err instanceof Error ? err.message : "Time sync failed.");
        })
        .finally(() => {
          if (!cancelled) setSyncing(false);
        });
    }

    sync();
    const id = setInterval(sync, PRECISION_RESYNC_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [precisionMode]);

  // usePolling only (re)schedules off its own mount/intervalMs - changing
  // which location/unit its fetcher closes over doesn't retrigger a fetch
  // by itself, same as Calendar's handleToggleLeague calling refresh().
  // Skipped on the very first render since usePolling already fetches once
  // on mount - without the skip, picking up a saved location on load would
  // fire that same first fetch twice.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (location) refresh();
  }, [location, unit, refresh]);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await searchLocations(query));
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  function chooseLocation(loc: WeatherLocation) {
    setLocation(loc);
    setLocationState(loc);
    setResults([]);
    setQuery("");
    setShowSettings(false);
  }

  async function handleDetect() {
    setDetecting(true);
    setSearchError(null);
    try {
      chooseLocation(await detectLocation());
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Couldn't get your location.");
    } finally {
      setDetecting(false);
    }
  }

  function handleUnitChange(next: TemperatureUnit) {
    setUnit(next);
    setUnitState(next);
  }

  function handleClockStyleChange(next: ClockStyle) {
    setClockStyle(next);
    setClockStyleState(next);
  }

  function handleClockFontChange(next: string) {
    setClockFont(next);
    setClockFontState(next);
  }

  function handlePrecisionModeChange(next: boolean) {
    setPrecisionMode(next);
    setPrecisionModeState(next);
    if (!next) {
      setSyncError(null);
      setSyncOffsetMs(0);
    }
  }

  const headerActions = (
    <button
      type="button"
      className="widget-shell__icon-button"
      onClick={() => setShowSettings((v) => !v)}
      title="Location & units"
      aria-label="Location & units"
    >
      ⚙
    </button>
  );

  const description = weather ? describeWeatherCode(weather.weatherCode, weather.isDay) : null;
  const unitSymbol = unit === "celsius" ? "°C" : "°F";
  const displayedNow = precisionMode ? new Date(now.getTime() + syncOffsetMs) : now;
  const clockFontValue = FONT_OPTIONS.find((f) => f.id === clockFont)?.cssValue;

  return (
    <WidgetShell title="Time & Weather" loading={loading && !!location} error={error} onRefresh={refresh} headerActions={headerActions}>
      <div className="timeweather">
        <div className="timeweather__clock">
          {clockStyle === "analogue" ? (
            <AnalogueClock now={displayedNow} />
          ) : (
            <div className="timeweather__time" style={clockFontValue ? { fontFamily: clockFontValue } : undefined}>
              {timeFormatter.format(displayedNow)}
            </div>
          )}
          <div className="timeweather__date">{dateFormatter.format(displayedNow)}</div>
          {precisionMode && (
            <div className="timeweather__precision-status">
              {syncing && !lastSyncedAt
                ? "Syncing…"
                : syncError && !lastSyncedAt
                  ? syncError
                  : `⚛ Precision Mode - synced ${lastSyncedAt ? timeFormatter.format(lastSyncedAt) : ""}${syncError ? ` (last sync failed: ${syncError})` : ""}`}
            </div>
          )}
        </div>

        {showSettings && (
          <form className="timeweather__settings" onSubmit={handleSearch}>
            <label>Clock</label>
            <div className="timeweather__unit-toggle">
              <button
                type="button"
                className={clockStyle === "digital" ? "timeweather__unit--active" : ""}
                onClick={() => handleClockStyleChange("digital")}
              >
                Digital
              </button>
              <button
                type="button"
                className={clockStyle === "analogue" ? "timeweather__unit--active" : ""}
                onClick={() => handleClockStyleChange("analogue")}
              >
                Analogue
              </button>
            </div>

            {clockStyle === "digital" && (
              <label className="timeweather__inline-field">
                Digital font
                <select value={clockFont} onChange={(e) => handleClockFontChange(e.target.value)}>
                  {FONT_OPTIONS.map((font) => (
                    <option key={font.id} value={font.id}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="timeweather__inline-field timeweather__precision-toggle">
              <input
                type="checkbox"
                checked={precisionMode}
                onChange={(e) => handlePrecisionModeChange(e.currentTarget.checked)}
              />
              Precision Mode - sync against a network time source instead of the device clock
            </label>

            <label htmlFor="timeweather-location-search">Location</label>
            <div className="timeweather__settings-row">
              <input
                id="timeweather-location-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                placeholder="Search city…"
              />
              <button type="submit" disabled={searching}>
                Search
              </button>
            </div>
            <button type="button" className="timeweather__detect" onClick={handleDetect} disabled={detecting}>
              {detecting ? "Locating…" : "📍 Use my location"}
            </button>

            {searchError && <p className="timeweather__settings-error">{searchError}</p>}

            {results.length > 0 && (
              <ul className="timeweather__results">
                {results.map((r) => (
                  <li key={`${r.latitude},${r.longitude}`}>
                    <button type="button" onClick={() => chooseLocation(r)}>
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="timeweather__unit-toggle">
              <button
                type="button"
                className={unit === "celsius" ? "timeweather__unit--active" : ""}
                onClick={() => handleUnitChange("celsius")}
              >
                °C
              </button>
              <button
                type="button"
                className={unit === "fahrenheit" ? "timeweather__unit--active" : ""}
                onClick={() => handleUnitChange("fahrenheit")}
              >
                °F
              </button>
            </div>
          </form>
        )}

        {!location && !showSettings && (
          <p className="timeweather__hint">
            No location set -{" "}
            <button type="button" className="timeweather__hint-link" onClick={() => setShowSettings(true)}>
              search for one or use your location
            </button>
            .
          </p>
        )}

        {location && weather && description && (
          <div className="timeweather__weather">
            <div className="timeweather__weather-main">
              <span className="timeweather__icon" aria-hidden="true">
                {description.icon}
              </span>
              <span className="timeweather__temp">
                {Math.round(weather.temperature)}
                {unitSymbol}
              </span>
            </div>
            <div className="timeweather__location">{location.label}</div>
            <div className="timeweather__description">{description.label}</div>
            <div className="timeweather__details">
              <span>
                Feels like {Math.round(weather.apparentTemperature)}
                {unitSymbol}
              </span>
              <span>Humidity {Math.round(weather.humidityPercent)}%</span>
              <span>Wind {Math.round(weather.windKph)} km/h</span>
            </div>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
