import type { NadeLineup } from "./types";

interface Props {
  lineups: NadeLineup[];
  emptyMessage?: string;
}

/** Where to send someone looking for a visual reference for this lineup.
 * We never scrape or rehost images from lineup sites - only link out to
 * them - so an unverified entry falls back to a search query instead of a
 * dead or fabricated link. */
function referenceUrl(lineup: NadeLineup): string {
  if (lineup.sourceUrl) return lineup.sourceUrl;
  const query = `${lineup.name} ${lineup.map} csnades lineup`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/** Shared lineup card list - used by the Lineups view and by Profiles
 * (which shows two of these side by side: your position + T-side). */
export function LineupList({ lineups, emptyMessage = "No lineups match." }: Props) {
  if (lineups.length === 0) {
    return <p className="cs2-widget__empty">{emptyMessage}</p>;
  }

  return (
    <ul className="cs2-widget__list">
      {lineups.map((lineup) => (
        <li key={lineup.id} className="cs2-widget__card">
          <div className="cs2-widget__card-header">
            <span className="cs2-widget__card-title">{lineup.name}</span>
            <span className={`cs2-widget__badge cs2-widget__badge--${lineup.grenadeType}`}>{lineup.grenadeType}</span>
          </div>
          <div className="cs2-widget__card-meta">
            {lineup.map} · {lineup.from} → {lineup.to} · {lineup.technique}
          </div>
          <p className="cs2-widget__card-description">{lineup.description}</p>
          <a href={referenceUrl(lineup)} className="cs2-widget__card-source" target="_blank" rel="noreferrer">
            {lineup.sourceUrl ? "View lineup ↗" : "Find a visual reference ↗"}
          </a>
        </li>
      ))}
    </ul>
  );
}
