import { useEffect, useState } from "react";
import { AttributionBadge } from "./components/AttributionBadge";
import { PlayerSearch } from "./components/PlayerSearch";
import { StatCards } from "./components/StatCards";
import { RatingRadar } from "./components/RatingRadar";
import { MatchHistoryTable } from "./components/MatchHistoryTable";
import { TrendChart } from "./components/TrendChart";
import { SuggestionsPanel } from "./components/SuggestionsPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import {
  asMatchList,
  fetchMatchHistory,
  fetchProfile,
  friendlyError,
  getSuggestions,
  getTrend,
  pick,
} from "./analysisService";
import type { JsonValue, Snapshot, Suggestion } from "./types";
import { addRecentPlayer, getApiKey, getRecentPlayers, setApiKey } from "./settingsStore";
import "./AnalysisView.css";

type InnerTab = "overview" | "matches" | "trends" | "suggestions" | "settings";

const INNER_TABS: InnerTab[] = ["overview", "matches", "trends", "suggestions", "settings"];

/**
 * Player lookup + rating breakdown + match history + local rating trends +
 * rules-based training suggestions, pulled from Leetify's public API. This
 * is the "Analysis" view of the CS2 Database widget - it owns its own
 * internal tabs since it's really a small app in its own right, ported in
 * as one view among CS2DatabaseWidget's Lineups / Pro Plays / Analysis.
 */
export function AnalysisView() {
  const [apiKey, setApiKeyState] = useState("");
  const [recentPlayers, setRecentPlayers] = useState<string[]>([]);
  const [tab, setTab] = useState<InnerTab>("overview");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<JsonValue | null>(null);
  const [matches, setMatches] = useState<JsonValue[]>([]);
  const [trend, setTrend] = useState<Snapshot[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    // Best-effort: local settings persistence needs a real Tauri runtime
    // (the store plugin), so fail quietly outside of one (e.g. `vite dev`
    // in a plain browser tab) rather than surfacing an error on load.
    getApiKey()
      .then((key) => setApiKeyState(key ?? ""))
      .catch(() => {});
    getRecentPlayers()
      .then(setRecentPlayers)
      .catch(() => {});
  }, []);

  async function handleSearch(playerId: string) {
    setLoading(true);
    setError(null);
    setProfile(null);
    setMatches([]);
    setTrend([]);
    setSuggestions([]);

    try {
      const p = await fetchProfile(playerId, apiKey || null);
      setProfile(p);
      setRecentPlayers(await addRecentPlayer(playerId));

      try {
        const history = await fetchMatchHistory(playerId, apiKey || null);
        setMatches(asMatchList(history));
      } catch {
        // Match history is secondary - profile is still shown if this fails.
      }

      try {
        setTrend(await getTrend(playerId));
        setSuggestions(await getSuggestions(playerId));
      } catch {
        // Local cache reads shouldn't normally fail; ignore if they do.
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveApiKey(key: string) {
    setApiKeyState(key);
    try {
      await setApiKey(key);
    } catch {
      // Same as above - persistence needs a real Tauri runtime.
    }
  }

  const playerName = profile ? pick(profile, ["name", "steam_name", "nickname"]) : null;

  return (
    <div className="analysis">
      <PlayerSearch recentPlayers={recentPlayers} loading={loading} onSearch={handleSearch} />

      {error && <p className="analysis__status-error">{error}</p>}

      {profile && (
        <nav className="analysis__tabs">
          {INNER_TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`analysis__tab ${t === tab ? "analysis__tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
      )}

      {!profile && !loading && !error && (
        <p className="analysis__muted">Enter a Steam64 ID or Leetify profile ID above to get started.</p>
      )}

      {profile && tab === "overview" && (
        <section>
          <StatCards profile={profile} />
          <RatingRadar rating={pick(profile, ["rating"])} />
        </section>
      )}

      {profile && tab === "matches" && (
        <section>
          <MatchHistoryTable matches={matches} />
        </section>
      )}

      {profile && tab === "trends" && (
        <section>
          <h4>{playerName ? `${playerName}'s` : "Rating"} trend over time</h4>
          <TrendChart snapshots={trend} />
        </section>
      )}

      {profile && tab === "suggestions" && (
        <section>
          <SuggestionsPanel suggestions={suggestions} />
        </section>
      )}

      {(tab === "settings" || !profile) && (
        <section>
          <SettingsPanel apiKey={apiKey} onSave={handleSaveApiKey} />
        </section>
      )}

      <AttributionBadge />
    </div>
  );
}
