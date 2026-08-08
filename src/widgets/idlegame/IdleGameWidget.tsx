import { useEffect, useRef, useState } from "react";
import { WidgetShell } from "../../shared/WidgetShell";
import { Overlay } from "../../shared/Overlay";
import {
  advance,
  applyClick,
  buyUpgrade,
  catchUpOffline,
  computeRates,
  pointsOnPrestige,
  prestige,
  prestigeProgressPct,
} from "./gameLogic";
import { loadGameState, saveGameState } from "./idleGameStore";
import { formatCompactNumber } from "./format";
import { IdleGamePlaySurface } from "./IdleGamePlaySurface";
import type { GameState, UpgradeId } from "./types";
import "./IdleGameWidget.css";

const TICK_INTERVAL_MS = 1000;
// ~5s autosave cadence during passive play - buy/prestige save immediately
// on their own, so this only covers ticked-but-unclicked progress.
const AUTOSAVE_EVERY_N_TICKS = 5;

/** Small standalone dashboard widget: the collapsed tile is a glanceable
 * progress summary, "PLAY" opens a full interactive surface in its own
 * Overlay - same structural pattern as GaeljankSoftworksWidget (a local
 * boolean driving a second Overlay, independent of WidgetShell's own
 * expand/fullscreen chrome, since WidgetShell doesn't expose its view mode
 * to children). */
export function IdleGameWidget() {
  const [state, setState] = useState<GameState>(() => catchUpOffline(loadGameState()));
  const [isPlaying, setIsPlaying] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const tickCountRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => {
        const now = Date.now();
        const next = { ...advance(prev, now - prev.lastTickAt), lastTickAt: now };
        tickCountRef.current += 1;
        if (tickCountRef.current % AUTOSAVE_EVERY_N_TICKS === 0) saveGameState(next);
        return next;
      });
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Final flush on unmount (schedule-hidden, navigated away, etc.) so the
  // periodic autosave window never loses more than a few seconds.
  useEffect(() => {
    return () => saveGameState(stateRef.current);
  }, []);

  function handleClick() {
    // Rides the periodic autosave rather than saving here - rapid clicking
    // would otherwise hammer localStorage.setItem every frame.
    setState((s) => applyClick(s));
  }

  function handleBuy(id: UpgradeId) {
    setState((s) => {
      const next = buyUpgrade(s, id);
      saveGameState(next);
      return next;
    });
  }

  function handlePrestige() {
    setState((s) => {
      const next = prestige(s);
      saveGameState(next);
      return next;
    });
  }

  const { resourcePerSec, resource2PerSec } = computeRates(state);
  const readyPoints = pointsOnPrestige(state);

  return (
    <WidgetShell title="Incremental Game" loading={false} error={null}>
      <div className="idle-game-widget__summary">
        <div className="idle-game-widget__stat">
          <span className="idle-game-widget__stat-label">Resource</span>
          <span className="idle-game-widget__stat-value">{formatCompactNumber(state.resource)}</span>
          <span className="idle-game-widget__stat-rate">+{formatCompactNumber(resourcePerSec)}/s</span>
        </div>
        <div className="idle-game-widget__stat">
          <span className="idle-game-widget__stat-label">Resource 2</span>
          <span className="idle-game-widget__stat-value">{formatCompactNumber(state.resource2)}</span>
          <span className="idle-game-widget__stat-rate">+{formatCompactNumber(resource2PerSec)}/s</span>
        </div>
        <div className="idle-game-widget__stat">
          <span className="idle-game-widget__stat-label">Prestige Points</span>
          <span className="idle-game-widget__stat-value">{state.prestigePoints}</span>
          {readyPoints > 0 && (
            <span className="idle-game-widget__stat-rate idle-game-widget__stat-rate--ready">
              +{readyPoints} ready
            </span>
          )}
        </div>
        <div className="idle-game-widget__progress" title="Progress to next Prestige Point">
          <div className="idle-game-widget__progress-bar" style={{ width: `${prestigeProgressPct(state)}%` }} />
        </div>
      </div>

      <button type="button" className="idle-game-widget__play" onClick={() => setIsPlaying(true)}>
        PLAY
      </button>

      {isPlaying && (
        <Overlay onClose={() => setIsPlaying(false)} fullBleed panelClassName="idle-game-widget__overlay-panel">
          <IdleGamePlaySurface
            state={state}
            onClick={handleClick}
            onBuy={handleBuy}
            onPrestige={handlePrestige}
            onExit={() => setIsPlaying(false)}
          />
        </Overlay>
      )}
    </WidgetShell>
  );
}
