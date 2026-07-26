import { JsonValue, pick, renderRankValue } from "../lib/leetify";

export function StatCards({ profile }: { profile: JsonValue }) {
  const ranks: JsonValue = pick(profile, ["ranks"]) ?? {};
  const winrate = pick(profile, ["winrate", "win_rate"]);
  const totalMatches = pick(profile, ["total_matches", "matches_count"]);
  const name = pick(profile, ["name", "steam_name", "nickname"]);
  const privacyMode = pick(profile, ["privacy_mode", "private"]);

  const rankEntries = Object.entries(ranks || {}).filter(([, v]) => v !== null && v !== undefined);

  return (
    <div className="stat-cards">
      {name && <h2 className="player-name">{name}</h2>}
      {privacyMode ? (
        <p className="muted">
          This profile has privacy mode enabled — Leetify may withhold some stats.
        </p>
      ) : null}
      <div className="card-grid">
        {winrate !== undefined && (
          <div className="stat-card">
            <span className="stat-label">Winrate</span>
            <span className="stat-value">
              {typeof winrate === "number"
                ? `${Math.round(winrate <= 1 ? winrate * 100 : winrate)}%`
                : String(winrate)}
            </span>
          </div>
        )}
        {totalMatches !== undefined && (
          <div className="stat-card">
            <span className="stat-label">Matches</span>
            <span className="stat-value">{String(totalMatches)}</span>
          </div>
        )}
        {rankEntries.map(([key, value]) => (
          <div className="stat-card" key={key}>
            <span className="stat-label">{key.replace(/_/g, " ")}</span>
            <span className="stat-value">{renderRankValue(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
