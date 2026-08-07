import { useEffect, useState } from "react";
import { ExternalLink } from "../../../../shared/ExternalLink";
import { fetchDailyPuzzle, type DailyPuzzle } from "./lichessService";
import "./LichessGame.css";

type Tab = "puzzle" | "tv";

// Both are Lichess's own purpose-built embed endpoints (no auth, no key,
// and - unlike the rest of lichess.org - not blocked from being framed) -
// see lichessService.ts for why this is the shape of the integration.
const PUZZLE_FRAME_URL = "https://lichess.org/training/frame?bg=dark";
const TV_FRAME_URL = "https://lichess.org/tv/frame?bg=dark";

function formatTheme(theme: string): string {
  return theme
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

/** GAELJANK SOFTWORKS cartridge for Lichess - there's no API for embedding
 * an actual playable game (that needs an account and Lichess's own
 * websocket client), so this leans on what Lichess does offer for free,
 * keyless embedding: today's puzzle and a live Lichess TV feed, both via
 * their own iframe endpoints, plus a straight link out to actually play. */
export function LichessGame({ onExit }: { onExit: () => void }) {
  const [tab, setTab] = useState<Tab>("puzzle");
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [puzzleError, setPuzzleError] = useState<string | null>(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [frameSlow, setFrameSlow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchDailyPuzzle()
      .then((p) => {
        if (!cancelled) setPuzzle(p);
      })
      .catch((err: unknown) => {
        if (!cancelled) setPuzzleError(err instanceof Error ? err.message : "Failed to load today's puzzle.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A restrictive network (firewall, ad/tracker blocker, offline) can leave
  // the iframe stuck blank with nothing in our own control to detect that
  // directly - only surface the "open it directly instead" fallback after
  // giving it a real chance to load, so it doesn't flash on a normal
  // connection.
  useEffect(() => {
    setFrameLoaded(false);
    setFrameSlow(false);
    const timer = setTimeout(() => setFrameSlow(true), 6000);
    return () => clearTimeout(timer);
  }, [tab]);

  return (
    <div className="lichess-game__root">
      <div className="lichess-game__topbar">
        <div className="lichess-game__tabs">
          <button
            type="button"
            className={`lichess-game__tab ${tab === "puzzle" ? "lichess-game__tab--active" : ""}`}
            onClick={() => setTab("puzzle")}
          >
            Daily Puzzle
          </button>
          <button
            type="button"
            className={`lichess-game__tab ${tab === "tv" ? "lichess-game__tab--active" : ""}`}
            onClick={() => setTab("tv")}
          >
            Lichess TV
          </button>
        </div>
        <div className="lichess-game__topbar-actions">
          <ExternalLink href="https://lichess.org" className="lichess-game__play-link">
            Play on Lichess ↗
          </ExternalLink>
          <button type="button" className="lichess-game__quit" onClick={onExit}>
            ✕ QUIT TO GAELJANK MENU
          </button>
        </div>
      </div>

      {tab === "puzzle" && (
        <div className="lichess-game__meta">
          {puzzle && (
            <span>
              Today's puzzle · rated {puzzle.rating}
              {puzzle.themes.length > 0 && <> · {puzzle.themes.slice(0, 3).map(formatTheme).join(", ")}</>}
            </span>
          )}
          {puzzleError && <span className="lichess-game__meta-error">{puzzleError}</span>}
        </div>
      )}

      <div className="lichess-game__frame-wrap">
        <iframe
          key={tab}
          className="lichess-game__frame"
          src={tab === "puzzle" ? PUZZLE_FRAME_URL : TV_FRAME_URL}
          title={tab === "puzzle" ? "Lichess daily puzzle" : "Lichess TV"}
          allow="fullscreen"
          onLoad={() => setFrameLoaded(true)}
        />
        {!frameLoaded && frameSlow && (
          <div className="lichess-game__frame-fallback">
            <p>This is taking a while - your network may be blocking lichess.org.</p>
            <ExternalLink href={tab === "puzzle" ? "https://lichess.org/training/daily" : "https://lichess.org/tv"}>
              Open {tab === "puzzle" ? "today's puzzle" : "Lichess TV"} in your browser ↗
            </ExternalLink>
          </div>
        )}
      </div>
    </div>
  );
}
