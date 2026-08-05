import { type FormEvent, useEffect, useMemo, useState } from "react";
import { usePolling } from "../../shared/hooks/usePolling";
import { WidgetShell } from "../../shared/WidgetShell";
import { ExternalLink } from "../../shared/ExternalLink";
import { getCalendarProvider, listAvailableLeagues } from "./calendarService";
import { getSelectedLeagueIds, toggleLeagueId } from "./calendarLeaguesStore";
import { getPandaScoreKey, setPandaScoreKey } from "./pandascoreKeyStore";
import type { EventCategory, LeagueOption } from "./types";
import "./CalendarWidget.css";

const REFRESH_INTERVAL_MS = 30 * 60_000;
// TheSportsDB's `eventsnextleague` endpoint returns each league's next ~15
// fixtures regardless of how far out they are - a 7-day cutoff here was
// silently discarding every one of them during an off-season gap (e.g. the
// weeks before a new Premier League/NBA season kicks off), which is exactly
// what "nothing upcoming" turned out to be. A wide cutoff is just a safety
// net against a source ever returning something absurdly far out, not a
// meaningful curation window.
const DAYS_AHEAD = 90;

const FILTERS: Array<{ label: string; value: EventCategory | "all" }> = [
  { label: "All", value: "all" },
  { label: "Esports", value: "esports" },
  { label: "Sports", value: "sports" },
];

const dateFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

export function CalendarWidget() {
  const [filter, setFilter] = useState<EventCategory | "all">("all");
  const [showSettings, setShowSettings] = useState(false);
  const [pandaScoreKey, setPandaScoreKeyState] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [selectedLeagueIds, setSelectedLeagueIds] = useState<string[]>(() => getSelectedLeagueIds());
  const { data, loading, error, refresh } = usePolling(
    () => getCalendarProvider().fetchUpcoming(DAYS_AHEAD),
    REFRESH_INTERVAL_MS,
  );

  useEffect(() => {
    getPandaScoreKey().then((key) => {
      setPandaScoreKeyState(key ?? "");
      setKeyDraft(key ?? "");
    });
    listAvailableLeagues().then(setLeagues);
  }, []);

  function handleToggleLeague(id: string) {
    setSelectedLeagueIds(toggleLeagueId(id));
    refresh();
  }

  const leaguesBySport = useMemo(() => {
    const groups = new Map<string, LeagueOption[]>();
    for (const league of leagues) {
      const group = groups.get(league.sport) ?? [];
      group.push(league);
      groups.set(league.sport, group);
    }
    return groups;
  }, [leagues]);

  async function handleSaveKey(e: FormEvent) {
    e.preventDefault();
    const trimmed = keyDraft.trim();
    await setPandaScoreKey(trimmed);
    setPandaScoreKeyState(trimmed);
    setShowSettings(false);
    refresh();
  }

  const events = useMemo(() => data?.filter((e) => filter === "all" || e.category === filter) ?? [], [data, filter]);

  const headerActions = (
    <div className="calendar-widget__header-actions">
      <div className="calendar-widget__filters">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`calendar-widget__filter ${filter === f.value ? "calendar-widget__filter--active" : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="widget-shell__icon-button"
        onClick={() => setShowSettings((v) => !v)}
        title="Esports data source settings"
        aria-label="Esports data source settings"
      >
        ⚙
      </button>
    </div>
  );

  return (
    <WidgetShell title="Calendar" loading={loading} error={error} onRefresh={refresh} headerActions={headerActions}>
      {showSettings && (
        <form className="calendar-widget__settings" onSubmit={handleSaveKey}>
          <label htmlFor="pandascore-api-key">PandaScore API key (esports/CS2 matches)</label>
          <p className="calendar-widget__settings-hint">
            Free at{" "}
            <ExternalLink href="https://pandascore.co">pandascore.co</ExternalLink>
            . Without a key, only general sports show up.
          </p>
          <div className="calendar-widget__settings-row">
            <input
              id="pandascore-api-key"
              type="password"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.currentTarget.value)}
              placeholder="Paste your API key"
            />
            <button type="submit">Save</button>
          </div>

          <label className="calendar-widget__leagues-label">Leagues &amp; sports to show</label>
          <div className="calendar-widget__leagues">
            {Array.from(leaguesBySport.entries()).map(([sport, sportLeagues]) => (
              <div key={sport} className="calendar-widget__league-group">
                <div className="calendar-widget__league-group-title">{sport}</div>
                {sportLeagues.map((league) => (
                  <label key={league.id} className="calendar-widget__league-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedLeagueIds.includes(league.id)}
                      onChange={() => handleToggleLeague(league.id)}
                    />
                    {league.label}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </form>
      )}

      {!pandaScoreKey && !showSettings && (
        <p className="calendar-widget__hint">
          No esports source configured - CS2/esports matches need a free key from{" "}
          <ExternalLink href="https://pandascore.co">pandascore.co</ExternalLink>, then{" "}
          <button type="button" className="calendar-widget__hint-link" onClick={() => setShowSettings(true)}>
            paste it here
          </button>
          . General sports already work with no key.
        </p>
      )}

      {events.length === 0 && <p className="calendar-widget__empty">Nothing upcoming.</p>}
      <ul className="calendar-widget__list">
        {events.map((event) => {
          const row = (
            <>
              <span className="calendar-widget__time">{dateFormatter.format(new Date(event.start_time))}</span>
              <div className="calendar-widget__details">
                <span className="calendar-widget__title">
                  {event.teams && event.teams.length === 2 ? event.teams.join(" vs ") : event.title}
                </span>
                <span className="calendar-widget__competition">
                  {event.competition} · {event.title}
                </span>
              </div>
              <span className={`calendar-widget__badge calendar-widget__badge--${event.category}`}>
                {event.category}
              </span>
            </>
          );

          return event.link_url ? (
            <li key={event.id} className="calendar-widget__row">
              <ExternalLink className="calendar-widget__link" href={event.link_url} title="Open match page / find a stream">
                {row}
              </ExternalLink>
            </li>
          ) : (
            <li key={event.id} className="calendar-widget__row">
              {row}
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}
