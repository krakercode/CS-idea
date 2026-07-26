import { Suggestion } from "../lib/leetify";

export function SuggestionsPanel({ suggestions }: { suggestions: Suggestion[] }) {
  if (suggestions.length === 0) {
    return (
      <p className="muted">
        Look up a profile to get training suggestions based on its rating breakdown.
      </p>
    );
  }

  return (
    <div className="suggestions">
      {suggestions.map((s) => (
        <div className="suggestion-card" key={s.dimension}>
          <div className="suggestion-header">
            <span className="suggestion-title">{s.title}</span>
            <span className="suggestion-score">{s.dimension}: {s.score.toFixed(1)}</span>
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
