import { useEffect, useState } from "react";
import { WidgetShell } from "../../shared/WidgetShell";
import { getCs2Repository } from "./cs2Service";
import type { Cs2Map, GrenadeType, NadeLineup, ProPlay } from "./types";
import "./CS2DatabaseWidget.css";

type Tab = "lineups" | "proplays";

const GRENADE_TYPES: GrenadeType[] = ["smoke", "flash", "molotov", "he"];

export function CS2DatabaseWidget() {
  const repo = getCs2Repository();
  const maps = repo.listMaps();

  const [tab, setTab] = useState<Tab>("lineups");
  const [search, setSearch] = useState("");
  const [mapFilter, setMapFilter] = useState<Cs2Map | "">("");
  const [grenadeFilter, setGrenadeFilter] = useState<GrenadeType | "">("");

  const [lineups, setLineups] = useState<NadeLineup[]>([]);
  const [proPlays, setProPlays] = useState<ProPlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load =
      tab === "lineups"
        ? repo
            .fetchLineups({ map: mapFilter || undefined, grenadeType: grenadeFilter || undefined, search })
            .then((result) => !cancelled && setLineups(result))
        : repo.fetchProPlays({ map: mapFilter || undefined, search }).then((result) => !cancelled && setProPlays(result));

    load
      .then(() => !cancelled && setError(null))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [tab, search, mapFilter, grenadeFilter, repo]);

  const headerActions = (
    <div className="cs2-widget__tabs">
      <button
        type="button"
        className={`cs2-widget__tab ${tab === "lineups" ? "cs2-widget__tab--active" : ""}`}
        onClick={() => setTab("lineups")}
      >
        Lineups
      </button>
      <button
        type="button"
        className={`cs2-widget__tab ${tab === "proplays" ? "cs2-widget__tab--active" : ""}`}
        onClick={() => setTab("proplays")}
      >
        Pro Plays
      </button>
    </div>
  );

  return (
    <WidgetShell title="CS2 Database" loading={loading} error={error} headerActions={headerActions}>
      <div className="cs2-widget__filters">
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="cs2-widget__search"
        />
        <select value={mapFilter} onChange={(e) => setMapFilter(e.target.value as Cs2Map | "")}>
          <option value="">All maps</option>
          {maps.map((map) => (
            <option key={map} value={map}>
              {map}
            </option>
          ))}
        </select>
        {tab === "lineups" && (
          <select value={grenadeFilter} onChange={(e) => setGrenadeFilter(e.target.value as GrenadeType | "")}>
            <option value="">All nades</option>
            {GRENADE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        )}
      </div>

      {tab === "lineups" ? (
        <ul className="cs2-widget__list">
          {lineups.length === 0 && <p className="cs2-widget__empty">No lineups match.</p>}
          {lineups.map((lineup) => (
            <li key={lineup.id} className="cs2-widget__card">
              <div className="cs2-widget__card-header">
                <span className="cs2-widget__card-title">{lineup.name}</span>
                <span className={`cs2-widget__badge cs2-widget__badge--${lineup.grenadeType}`}>{lineup.grenadeType}</span>
              </div>
              <div className="cs2-widget__card-meta">
                {lineup.map} · {lineup.from} → {lineup.to} · {lineup.technique}
              </div>
              <p className="cs2-widget__card-description">{lineup.description}</p>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="cs2-widget__list">
          {proPlays.length === 0 && <p className="cs2-widget__empty">No plays match.</p>}
          {proPlays.map((play) => (
            <li key={play.id} className="cs2-widget__card">
              <div className="cs2-widget__card-header">
                <span className="cs2-widget__card-title">
                  {play.player} <span className="cs2-widget__card-team">({play.team})</span>
                </span>
                <span className="cs2-widget__card-meta">{play.date}</span>
              </div>
              <div className="cs2-widget__card-meta">
                {play.map} · {play.event}
              </div>
              <p className="cs2-widget__card-description">{play.description}</p>
              <div className="cs2-widget__tags">
                {play.tags.map((tag) => (
                  <span key={tag} className="cs2-widget__tag">
                    {tag}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}
