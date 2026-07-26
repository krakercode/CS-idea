import { useEffect, useState } from "react";
import "./App.css";
import { AttributionBadge } from "./components/AttributionBadge";
import { PlayerSearch } from "./components/PlayerSearch";
import { StatCards } from "./components/StatCards";
import { RatingRadar } from "./components/RatingRadar";
import { MatchHistoryTable } from "./components/MatchHistoryTable";
import { TrendChart } from "./components/TrendChart";
import { SuggestionsPanel } from "./components/SuggestionsPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import {
  JsonValue,
  Snapshot,
  Suggestion,
  asMatchList,
  fetchMatchHistory,
  fetchProfile,
  friendlyError,
  getSuggestions,
  getTrend,
  pick,
} from "./lib/leetify";
import { addRecentPlayer, getApiKey, getRecentPlayers, setApiKey } from "./lib/settingsStore";

type Tab = "overview" | "matches" | "trends" | "suggestions" | "settings";

function App() {
  const [apiKey, setApiKeyState] = useState("");
  const [recentPlayers, setRecentPlayers] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("overview");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<JsonValue | null>(null);
  const [matches, setMatches] = useState<JsonValue[]>([]);
  const [trend, setTrend] = useState<Snapshot[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    getApiKey().then((key) => setApiKeyState(key ?? ""));
    getRecentPlayers().then(setRecentPlayers);
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
        // Match history is secondary — profile is still shown if this fails.
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
    await setApiKey(key);
  }

  const playerName = profile ? pick(profile, ["name", "steam_name", "nickname"]) : null;

  return (
    <main className="container">
      <header className="app-header">
        <h1>CS Training Widget</h1>
        <p className="muted">Leetify stats, trends, and training suggestions in one place.</p>
      </header>

      <PlayerSearch recentPlayers={recentPlayers} loading={loading} onSearch={handleSearch} />

      {error && <p className="status-error">{error}</p>}

      {profile && (
        <nav className="tabs">
          {(["overview", "matches", "trends", "suggestions", "settings"] as Tab[]).map((t) => (
            <button
              key={t}
              className={t === tab ? "tab active" : "tab"}
              onClick={() => setTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
      )}

      {!profile && !loading && !error && (
        <p className="muted">Enter a Steam64 ID or Leetify profile ID above to get started.</p>
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
          <h3>{playerName ? `${playerName}'s` : "Rating"} trend over time</h3>
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
    </main>
  );
}

export default App;
