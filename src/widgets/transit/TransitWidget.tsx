import { type FormEvent, useEffect, useMemo, useState } from "react";
import { WidgetShell } from "../../shared/WidgetShell";
import { ViewSwitcher } from "../../shared/ViewSwitcher";
import { useWidgetViews } from "../../shared/useWidgetViews";
import { ExternalLink } from "../../shared/ExternalLink";
import { getTransitlandKey, setTransitlandKey } from "./transitKeyStore";
import { getAirportArrivals, getAirportDepartures, getTransitDepartures, searchTransitStops } from "./transitService";
import { addTrackedStop, getTrackedStops, removeTrackedStop } from "./trackedStopsStore";
import { addTrackedAirport, getTrackedAirports, removeTrackedAirport } from "./trackedAirportsStore";
import { searchAirports } from "./airportSearch";
import type { Airport, FlightMovement, TrackedAirport, TransitDeparture, TransitStop } from "./types";
import "./TransitWidget.css";

const VIEWS = [
  { id: "transit", label: "Transit" },
  { id: "flights", label: "Flights" },
];

const flightTimeFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** "14:33:00" -> "14:33"; passes through anything that isn't a plain
 * HH:MM(:SS) string (defensive against a feed-shape surprise) rather than
 * mangling it. */
function formatTransitTime(time: string | null): string {
  if (!time) return "—";
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : time;
}

function formatDelay(seconds: number | null): string | null {
  if (seconds == null || Math.abs(seconds) < 60) return null;
  const minutes = Math.round(Math.abs(seconds) / 60);
  return seconds > 0 ? `+${minutes}m late` : `${minutes}m early`;
}

function airportLabel(airport: Airport): string {
  return `${airport.name}${airport.city ? ` · ${airport.city}` : ""} (${airport.iata ?? airport.icao})`;
}

/** Departure-board-style tracker: search + track train/bus/ferry stops
 * (Transitland, needs a free user-supplied API key) and airports (recent
 * flight activity via OpenSky, no key needed - see opensky.rs for why this
 * is "recent activity", not a live gate/schedule board). */
export function TransitWidget() {
  const { activeId, setActiveId, next, prev } = useWidgetViews(VIEWS);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState("");

  const [stopQuery, setStopQuery] = useState("");
  const [stopResults, setStopResults] = useState<TransitStop[]>([]);
  const [searchingStops, setSearchingStops] = useState(false);
  const [stopSearchError, setStopSearchError] = useState<string | null>(null);
  const [trackedStops, setTrackedStops] = useState<TransitStop[]>(() => getTrackedStops());
  const [departures, setDepartures] = useState<Record<string, TransitDeparture[]>>({});
  const [departuresLoading, setDeparturesLoading] = useState<Record<string, boolean>>({});

  const [airportQuery, setAirportQuery] = useState("");
  const airportResults = useMemo(() => searchAirports(airportQuery), [airportQuery]);
  const [trackedAirports, setTrackedAirports] = useState<TrackedAirport[]>(() => getTrackedAirports());
  const [arrivals, setArrivals] = useState<Record<string, FlightMovement[]>>({});
  const [flightDepartures, setFlightDepartures] = useState<Record<string, FlightMovement[]>>({});
  const [flightsLoading, setFlightsLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getTransitlandKey().then((key) => {
      setApiKeyState(key);
      setKeyDraft(key ?? "");
    });
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    trackedStops.forEach((stop) => void refreshDepartures(stop.id, apiKey));
    // Only re-runs when the key itself changes (e.g. first loaded, or
    // saved/cleared in Settings) - adding/removing a stop refreshes itself
    // directly instead of re-fetching every tracked stop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    trackedAirports.forEach((airport) => void refreshAirport(airport.icao));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveKey(e: FormEvent) {
    e.preventDefault();
    const trimmed = keyDraft.trim();
    await setTransitlandKey(trimmed);
    setApiKeyState(trimmed || null);
    setShowSettings(false);
  }

  async function refreshDepartures(stopId: string, key: string) {
    setDeparturesLoading((cur) => ({ ...cur, [stopId]: true }));
    try {
      const result = await getTransitDepartures(key, stopId);
      setDepartures((cur) => ({ ...cur, [stopId]: result }));
    } finally {
      setDeparturesLoading((cur) => ({ ...cur, [stopId]: false }));
    }
  }

  async function handleSearchStops(e: FormEvent) {
    e.preventDefault();
    const trimmed = stopQuery.trim();
    if (!trimmed || !apiKey) {
      setStopResults([]);
      return;
    }
    setSearchingStops(true);
    setStopSearchError(null);
    try {
      setStopResults(await searchTransitStops(apiKey, trimmed));
    } catch (err) {
      setStopSearchError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearchingStops(false);
    }
  }

  function handleAddStop(stop: TransitStop) {
    setTrackedStops(addTrackedStop(stop));
    if (apiKey) void refreshDepartures(stop.id, apiKey);
  }

  function handleRemoveStop(id: string) {
    setTrackedStops(removeTrackedStop(id));
    setDepartures((cur) => {
      const next = { ...cur };
      delete next[id];
      return next;
    });
  }

  async function refreshAirport(icao: string) {
    setFlightsLoading((cur) => ({ ...cur, [icao]: true }));
    try {
      const [arr, dep] = await Promise.all([getAirportArrivals(icao), getAirportDepartures(icao)]);
      setArrivals((cur) => ({ ...cur, [icao]: arr }));
      setFlightDepartures((cur) => ({ ...cur, [icao]: dep }));
    } finally {
      setFlightsLoading((cur) => ({ ...cur, [icao]: false }));
    }
  }

  function handleAddAirport(airport: Airport) {
    setTrackedAirports(addTrackedAirport(airport));
    void refreshAirport(airport.icao);
  }

  function handleRemoveAirport(icao: string) {
    setTrackedAirports(removeTrackedAirport(icao));
    setArrivals((cur) => {
      const next = { ...cur };
      delete next[icao];
      return next;
    });
    setFlightDepartures((cur) => {
      const next = { ...cur };
      delete next[icao];
      return next;
    });
  }

  const headerActions = (
    <div className="transit-widget__header-actions">
      <ViewSwitcher views={VIEWS} activeId={activeId} onSelect={setActiveId} onNext={next} onPrev={prev} />
      {activeId === "transit" && (
        <button
          type="button"
          className="widget-shell__icon-button"
          onClick={() => setShowSettings((v) => !v)}
          title="Transitland API key settings"
          aria-label="Transitland API key settings"
        >
          ⚙
        </button>
      )}
    </div>
  );

  return (
    <WidgetShell title="Transit Tracker" loading={false} error={null} headerActions={headerActions}>
      {activeId === "transit" && (
        <div className="transit-widget__section">
          {showSettings && (
            <form className="transit-widget__settings" onSubmit={handleSaveKey}>
              <label htmlFor="transitland-api-key">Transitland API key (trains/buses/ferries)</label>
              <p className="transit-widget__settings-hint">
                Free at <ExternalLink href="https://transit.land">transit.land</ExternalLink> - required for stop
                search and departures.
              </p>
              <div className="transit-widget__settings-row">
                <input
                  id="transitland-api-key"
                  type="password"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.currentTarget.value)}
                  placeholder="Paste your API key"
                />
                <button type="submit">Save</button>
              </div>
            </form>
          )}

          {!apiKey && !showSettings && (
            <p className="transit-widget__hint">
              No Transitland key configured - train/bus/ferry stops need a free key from{" "}
              <ExternalLink href="https://transit.land">transit.land</ExternalLink>, then{" "}
              <button type="button" className="transit-widget__hint-link" onClick={() => setShowSettings(true)}>
                paste it here
              </button>
              .
            </p>
          )}

          <form className="transit-widget__search-form" onSubmit={handleSearchStops}>
            <input
              type="text"
              value={stopQuery}
              onChange={(e) => setStopQuery(e.target.value)}
              placeholder="Search stop/station name…"
              className="transit-widget__search-input"
              disabled={!apiKey}
            />
            <button type="submit" disabled={searchingStops || !apiKey}>
              {searchingStops ? "…" : "Search"}
            </button>
          </form>

          {stopSearchError && <p className="transit-widget__error">{stopSearchError}</p>}
          {!searchingStops && !stopSearchError && stopResults.length === 0 && stopQuery.trim() && apiKey && (
            <p className="transit-widget__empty">No matches.</p>
          )}

          {stopResults.length > 0 && (
            <ul className="transit-widget__results">
              {stopResults.map((stop) => {
                const tracked = trackedStops.some((s) => s.id === stop.id);
                return (
                  <li key={stop.id} className="transit-widget__result-row">
                    <div className="transit-widget__row-info">
                      <span className="transit-widget__stop-name">{stop.name}</span>
                      {(stop.modes.length > 0 || stop.agencies.length > 0) && (
                        <span className="transit-widget__stop-meta">
                          {[...stop.modes, ...stop.agencies].join(" · ")}
                        </span>
                      )}
                    </div>
                    <button type="button" disabled={tracked} onClick={() => handleAddStop(stop)}>
                      {tracked ? "Tracked" : "Track"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {trackedStops.length === 0 ? (
            <p className="transit-widget__empty">No stops tracked yet - search above to add one.</p>
          ) : (
            <div className="transit-widget__tracked-list">
              {trackedStops.map((stop) => (
                <div key={stop.id} className="transit-widget__board">
                  <header className="transit-widget__board-header">
                    <span className="transit-widget__stop-name">{stop.name}</span>
                    <div className="transit-widget__board-actions">
                      <button
                        type="button"
                        className="widget-shell__icon-button"
                        onClick={() => apiKey && void refreshDepartures(stop.id, apiKey)}
                        title="Refresh"
                        aria-label={`Refresh ${stop.name}`}
                      >
                        ⟳
                      </button>
                      <button
                        type="button"
                        className="transit-widget__remove"
                        onClick={() => handleRemoveStop(stop.id)}
                        aria-label={`Stop tracking ${stop.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  </header>

                  {departuresLoading[stop.id] ? (
                    <p className="transit-widget__empty">Loading…</p>
                  ) : (departures[stop.id] ?? []).length === 0 ? (
                    <p className="transit-widget__empty">No upcoming departures.</p>
                  ) : (
                    <ul className="transit-widget__departure-list">
                      {(departures[stop.id] ?? []).map((d, i) => {
                        const delay = formatDelay(d.delaySeconds);
                        return (
                          <li key={i} className="transit-widget__departure-row">
                            <span className="transit-widget__departure-time">
                              {formatTransitTime(d.estimatedTime ?? d.scheduledTime)}
                            </span>
                            <div className="transit-widget__departure-info">
                              <span>
                                {d.mode} {d.routeName}
                              </span>
                              {d.headsign && <span className="transit-widget__stop-meta">→ {d.headsign}</span>}
                            </div>
                            {delay && (
                              <span
                                className={`transit-widget__delay ${
                                  d.delaySeconds && d.delaySeconds > 0
                                    ? "transit-widget__delay--late"
                                    : "transit-widget__delay--early"
                                }`}
                              >
                                {delay}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeId === "flights" && (
        <div className="transit-widget__section">
          <p className="transit-widget__hint">
            Recent logged flight activity, not a live schedule - no gate info or future flights (see README). No key
            needed.
          </p>

          <form className="transit-widget__search-form" onSubmit={(e) => e.preventDefault()}>
            <input
              type="text"
              value={airportQuery}
              onChange={(e) => setAirportQuery(e.target.value)}
              placeholder="Search airport, city, or IATA code…"
              className="transit-widget__search-input"
            />
          </form>

          {airportQuery.trim() && airportResults.length === 0 && <p className="transit-widget__empty">No matches.</p>}

          {airportResults.length > 0 && (
            <ul className="transit-widget__results">
              {airportResults.map((airport) => {
                const tracked = trackedAirports.some((a) => a.icao === airport.icao);
                return (
                  <li key={airport.icao} className="transit-widget__result-row">
                    <div className="transit-widget__row-info">
                      <span className="transit-widget__stop-name">{airportLabel(airport)}</span>
                    </div>
                    <button type="button" disabled={tracked} onClick={() => handleAddAirport(airport)}>
                      {tracked ? "Tracked" : "Track"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {trackedAirports.length === 0 ? (
            <p className="transit-widget__empty">No airports tracked yet - search above to add one.</p>
          ) : (
            <div className="transit-widget__tracked-list">
              {trackedAirports.map((airport) => (
                <div key={airport.icao} className="transit-widget__board">
                  <header className="transit-widget__board-header">
                    <span className="transit-widget__stop-name">{airportLabel(airport)}</span>
                    <div className="transit-widget__board-actions">
                      <button
                        type="button"
                        className="widget-shell__icon-button"
                        onClick={() => void refreshAirport(airport.icao)}
                        title="Refresh"
                        aria-label={`Refresh ${airport.name}`}
                      >
                        ⟳
                      </button>
                      <button
                        type="button"
                        className="transit-widget__remove"
                        onClick={() => handleRemoveAirport(airport.icao)}
                        aria-label={`Stop tracking ${airport.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  </header>

                  {flightsLoading[airport.icao] ? (
                    <p className="transit-widget__empty">Loading…</p>
                  ) : (
                    <div className="transit-widget__flight-columns">
                      <div>
                        <h3 className="transit-widget__flight-column-title">Departures</h3>
                        {(flightDepartures[airport.icao] ?? []).length === 0 ? (
                          <p className="transit-widget__empty">None in the last few hours.</p>
                        ) : (
                          <ul className="transit-widget__departure-list">
                            {(flightDepartures[airport.icao] ?? []).map((f, i) => (
                              <li key={i} className="transit-widget__departure-row">
                                <span className="transit-widget__departure-time">
                                  {flightTimeFormatter.format(new Date(f.timeUnix * 1000))}
                                </span>
                                <div className="transit-widget__departure-info">
                                  <span>{f.callsign ?? "Unknown flight"}</span>
                                  {f.otherAirport && <span className="transit-widget__stop-meta">→ {f.otherAirport}</span>}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <h3 className="transit-widget__flight-column-title">Arrivals (yesterday, UTC)</h3>
                        {(arrivals[airport.icao] ?? []).length === 0 ? (
                          <p className="transit-widget__empty">None logged.</p>
                        ) : (
                          <ul className="transit-widget__departure-list">
                            {(arrivals[airport.icao] ?? []).map((f, i) => (
                              <li key={i} className="transit-widget__departure-row">
                                <span className="transit-widget__departure-time">
                                  {flightTimeFormatter.format(new Date(f.timeUnix * 1000))}
                                </span>
                                <div className="transit-widget__departure-info">
                                  <span>{f.callsign ?? "Unknown flight"}</span>
                                  {f.otherAirport && <span className="transit-widget__stop-meta">from {f.otherAirport}</span>}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
