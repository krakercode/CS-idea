import { JsonValue, pick } from "../lib/leetify";

export function MatchHistoryTable({ matches }: { matches: JsonValue[] }) {
  if (matches.length === 0) {
    return <p className="muted">No recent matches found.</p>;
  }

  return (
    <table className="match-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Map</th>
          <th>Result</th>
          <th>K/D/A</th>
          <th>Rating</th>
        </tr>
      </thead>
      <tbody>
        {matches.map((match, i) => {
          const date = pick(match, ["played_at", "date", "created_at"]);
          const map = pick(match, ["map_name", "map"]) ?? "—";
          const result = pick(match, ["result", "outcome"]) ?? matchResultFromScores(match);
          const kills = pick(match, ["kills"]) ?? "—";
          const deaths = pick(match, ["deaths"]) ?? "—";
          const assists = pick(match, ["assists"]) ?? "—";
          const rating = pick(match, ["rating", "leetify_rating"]);
          const gameId = pick(match, ["game_id", "id"]) ?? i;

          return (
            <tr key={String(gameId)}>
              <td>{date ? new Date(date).toLocaleDateString() : "—"}</td>
              <td>{map}</td>
              <td className={resultClass(result)}>{result ?? "—"}</td>
              <td>
                {kills}/{deaths}/{assists}
              </td>
              <td>{typeof rating === "number" ? rating.toFixed(2) : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function matchResultFromScores(match: JsonValue): string | undefined {
  const won = pick(match, ["won", "is_win"]);
  if (won === true) return "Win";
  if (won === false) return "Loss";
  return undefined;
}

function resultClass(result: string | undefined): string {
  if (!result) return "";
  const normalized = String(result).toLowerCase();
  if (normalized.includes("win")) return "result-win";
  if (normalized.includes("loss") || normalized.includes("lose")) return "result-loss";
  return "";
}
