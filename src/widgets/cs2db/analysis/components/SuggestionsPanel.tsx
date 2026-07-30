import type { Suggestion } from "../types";

export function SuggestionsPanel({ suggestions }: { suggestions: Suggestion[] }) {
  if (suggestions.length === 0) {
    return <p className="analysis__muted">Look up a profile to get training suggestions based on its rating breakdown.</p>;
  }

  return (
    <div className="analysis__suggestions">
      {suggestions.map((s) => (
        <div className="analysis__suggestion-card" key={s.dimension}>
          <div className="analysis__suggestion-header">
            <span className="analysis__suggestion-title">{s.title}</span>
            <span className="analysis__suggestion-score">
              {s.dimension}: {s.score.toFixed(1)}
            </span>
          </div>
          <p>{s.tip}</p>
          <ul>
            {s.drills.map((drill) => (
              <li key={drill}>{drill}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
