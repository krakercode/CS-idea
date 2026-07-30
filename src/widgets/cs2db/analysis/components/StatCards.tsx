import { pick, renderRankValue } from "../analysisService";
import type { JsonValue } from "../types";

export function StatCards({ profile }: { profile: JsonValue }) {
  const ranks: JsonValue = pick(profile, ["ranks"]) ?? {};
  const winrate = pick(profile, ["winrate", "win_rate"]);
  const totalMatches = pick(profile, ["total_matches", "matches_count"]);
  const name = pick(profile, ["name", "steam_name", "nickname"]);
  const privacyMode = pick(profile, ["privacy_mode", "private"]);

  const rankEntries = Object.entries(ranks || {}).filter(([, v]) => v !== null && v !== undefined);

  return (
    <div className="analysis__stat-cards">
      {name && <h3 className="analysis__player-name">{name}</h3>}
      {privacyMode ? (
        <p className="analysis__muted">This profile has privacy mode enabled — Leetify may withhold some stats.</p>
      ) : null}
      <div className="analysis__card-grid">
        {winrate !== undefined && (
          <div className="analysis__stat-card">
            <span className="analysis__stat-label">Winrate</span>
            <span className="analysis__stat-value">
              {typeof winrate === "number" ? `${Math.round(winrate <= 1 ? winrate * 100 : winrate)}%` : String(winrate)}
            </span>
          </div>
        )}
        {totalMatches !== undefined && (
          <div className="analysis__stat-card">
            <span className="analysis__stat-label">Matches</span>
            <span className="analysis__stat-value">{String(totalMatches)}</span>
          </div>
        )}
        {rankEntries.map(([key, value]) => (
          <div className="analysis__stat-card" key={key}>
            <span className="analysis__stat-label">{key.replace(/_/g, " ")}</span>
            <span className="analysis__stat-value">{renderRankValue(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
