import { type FormEvent, useState } from "react";

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
    <div className="analysis__search">
      <form onSubmit={submit} className="analysis__search-row">
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
        <div className="analysis__recent">
          <span>Recent:</span>
          {recentPlayers.map((id) => (
            <button
              key={id}
              type="button"
              className="analysis__chip"
              disabled={loading}
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
