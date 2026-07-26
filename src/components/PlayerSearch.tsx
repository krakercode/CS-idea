import { FormEvent, useState } from "react";

interface Props {
  recentPlayers: string[];
  loading: boolean;
  onSearch: (playerId: string) => void;
}

export function PlayerSearch({ recentPlayers, loading, onSearch }: Props) {
  const [value, setValue] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSearch(trimmed);
  }

  return (
    <div className="player-search">
      <form onSubmit={submit} className="row">
        <input
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          placeholder="Steam64 ID or Leetify profile ID"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Loading…" : "Look up"}
        </button>
      </form>
      {recentPlayers.length > 0 && (
        <div className="recent-players">
          <span>Recent:</span>
          {recentPlayers.map((id) => (
            <button
              key={id}
              className="chip"
              onClick={() => {
                setValue(id);
                onSearch(id);
              }}
            >
              {id}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
