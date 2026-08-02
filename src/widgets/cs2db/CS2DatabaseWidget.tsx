import { lazy, Suspense, useEffect, useState } from "react";
import { WidgetShell } from "../../shared/WidgetShell";
import { ViewSwitcher } from "../../shared/ViewSwitcher";
import { useWidgetViews } from "../../shared/useWidgetViews";
import { ExternalLink } from "../../shared/ExternalLink";
import { getCs2Repository } from "./cs2Service";
import { LineupList } from "./LineupList";
import { ProfilesView } from "./profiles/ProfilesView";
import type { Cs2Map, GrenadeType, NadeLineup, ProPlay } from "./types";
import "./CS2DatabaseWidget.css";

const AnalysisView = lazy(() => import("./analysis/AnalysisView").then((m) => ({ default: m.AnalysisView })));

const GRENADE_TYPES: GrenadeType[] = ["smoke", "flash", "molotov", "he"];

const VIEWS = [
  { id: "lineups", label: "Lineups" },
  { id: "proplays", label: "Pro Plays" },
  { id: "profiles", label: "Profiles" },
  { id: "analysis", label: "Analysis" },
  { id: "nades", label: "Nade Site" },
];

const SELF_MANAGED_VIEWS = new Set(["analysis", "profiles", "nades"]);

export function CS2DatabaseWidget() {
  const repo = getCs2Repository();
  const maps = repo.listMaps();

  const { activeId, setActiveId, next, prev } = useWidgetViews(VIEWS);
  const [search, setSearch] = useState("");
  const [mapFilter, setMapFilter] = useState<Cs2Map | "">("");
  const [grenadeFilter, setGrenadeFilter] = useState<GrenadeType | "">("");

  const [lineups, setLineups] = useState<NadeLineup[]>([]);
  const [proPlays, setProPlays] = useState<ProPlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (SELF_MANAGED_VIEWS.has(activeId)) return;
    let cancelled = false;

    // Deliberately not `setLoading(true)` here - `loading` should stay true
    // only for the very first fetch (WidgetShell swaps children, search
    // input included, for a "Loading..." placeholder while it's true, so
    // re-arming it on every search/filter change would unmount the input
    // mid-keystroke and drop focus).
    const load =
      activeId === "lineups"
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
  }, [activeId, search, mapFilter, grenadeFilter, repo]);

  const headerActions = (
    <ViewSwitcher views={VIEWS} activeId={activeId} onSelect={setActiveId} onNext={next} onPrev={prev} />
  );

  return (
    <WidgetShell
      title="CS2 Database (WIP)"
      loading={!SELF_MANAGED_VIEWS.has(activeId) && loading}
      error={!SELF_MANAGED_VIEWS.has(activeId) ? error : null}
      headerActions={headerActions}
    >
      {(activeId === "lineups" || activeId === "proplays") && (
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
          {activeId === "lineups" && (
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
      )}

      {activeId === "lineups" && <LineupList lineups={lineups} />}

      {activeId === "proplays" && (
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

      {activeId === "profiles" && <ProfilesView />}

      {activeId === "analysis" && (
        <Suspense fallback={<p className="cs2-widget__empty">Loading analysis…</p>}>
          <AnalysisView />
        </Suspense>
      )}

      {activeId === "nades" && (
        <div className="cs2-widget__nade-site">
          <div className="cs2-widget__nade-site-bar">
            <span className="cs2-widget__nade-site-note">
              Embedded from csnades.gg - some sites block being framed like this, so if nothing loads below, use
              this instead:
            </span>
            <ExternalLink href="https://csnades.gg" className="cs2-widget__nade-site-link">
              Open in browser ↗
            </ExternalLink>
          </div>
          <iframe
            src="https://csnades.gg"
            title="csnades.gg"
            className="cs2-widget__nade-site-frame"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </WidgetShell>
  );
}
