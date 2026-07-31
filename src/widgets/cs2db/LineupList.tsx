import { ExternalLink } from "../../shared/ExternalLink";
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
 * (which shows two of these side by side: your position + T-side).
 *
 * `sourceUrl` doubles as the "has this been checked against a real source"
 * signal - an entry without one is exactly the kind of specific-sounding
 * but never-verified starter content that's easy to mistake for a tested
 * lineup, so it's flagged as unverified in the UI itself rather than only
 * in a code comment, and the reference link is the primary way to actually
 * confirm the throw before relying on it. */
export function LineupList({ lineups, emptyMessage = "No lineups match." }: Props) {
  if (lineups.length === 0) {
    return <p className="cs2-widget__empty">{emptyMessage}</p>;
  }

  const anyUnverified = lineups.some((l) => !l.sourceUrl);

  return (
    <>
      {anyUnverified && (
        <p className="cs2-widget__unverified-notice">
          Lineups marked <strong>unverified</strong> are starter placeholders, not tested throws - use the link on
          each card to confirm before relying on it in a match.
        </p>
      )}
      <ul className="cs2-widget__list">
        {lineups.map((lineup) => (
          <li key={lineup.id} className="cs2-widget__card">
            <div className="cs2-widget__card-header">
              <span className="cs2-widget__card-title">{lineup.name}</span>
              <div className="cs2-widget__card-badges">
                {!lineup.sourceUrl && (
                  <span
                    className="cs2-widget__badge cs2-widget__badge--unverified"
                    title="Not checked against a real source - confirm via the link before using it"
                  >
                    unverified
                  </span>
                )}
                <span className={`cs2-widget__badge cs2-widget__badge--${lineup.grenadeType}`}>{lineup.grenadeType}</span>
              </div>
            </div>
            <div className="cs2-widget__card-meta">
              {lineup.map} · {lineup.from} → {lineup.to}
              {lineup.technique ? ` · ${lineup.technique}` : ""}
            </div>
            <p className="cs2-widget__card-description">{lineup.description}</p>
            <ExternalLink href={referenceUrl(lineup)} className="cs2-widget__card-source">
              {lineup.sourceUrl ? "View lineup ↗" : "Find the real lineup ↗"}
            </ExternalLink>
          </li>
        ))}
      </ul>
    </>
  );
}
