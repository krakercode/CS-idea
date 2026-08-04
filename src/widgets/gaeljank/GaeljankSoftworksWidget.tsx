import { useState } from "react";
import { WidgetShell } from "../../shared/WidgetShell";
import { Overlay } from "../../shared/Overlay";
import { GAMES } from "./gamesCatalog";
import "./GaeljankSoftworksWidget.css";

/** GAELJANK SOFTWORKS - an in-house "game label" widget: a small launcher
 * card per game, and a fullscreen overlay for actually playing one. Not a
 * live-data widget like the rest of the dashboard - everything here is a
 * self-contained, client-side game, so there's no fetch/poll/error state to
 * wire up, just "which cartridge is loaded right now." */
export function GaeljankSoftworksWidget() {
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const activeGame = GAMES.find((g) => g.id === activeGameId) ?? null;

  return (
    <WidgetShell title="GAELJANK SOFTWORKS" loading={false} error={null}>
      <div className="gaeljank-widget__tagline">indie label · est. 2026 · more cartridges coming</div>
      <ul className="gaeljank-widget__list">
        {GAMES.map((game) => (
          <li key={game.id} className="gaeljank-widget__game">
            <div className="gaeljank-widget__game-info">
              <div className="gaeljank-widget__game-title">
                {game.title} <span className="gaeljank-widget__game-tagline">{game.tagline}</span>
              </div>
              <p className="gaeljank-widget__game-blurb">{game.blurb}</p>
            </div>
            <button type="button" className="gaeljank-widget__play" onClick={() => setActiveGameId(game.id)}>
              PLAY
            </button>
          </li>
        ))}
      </ul>

      {activeGame && (
        <Overlay onClose={() => setActiveGameId(null)} fullBleed panelClassName="gaeljank-widget__overlay-panel">
          <activeGame.Component onExit={() => setActiveGameId(null)} />
        </Overlay>
      )}
    </WidgetShell>
  );
}
