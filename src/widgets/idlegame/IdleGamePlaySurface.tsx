import { useState } from "react";
import { UPGRADES, canAfford, canPrestige, pointsOnPrestige, resourceMultiplier, upgradeCost } from "./gameLogic";
import { formatCompactNumber } from "./format";
import type { GameState, UpgradeId } from "./types";
import "./IdleGamePlaySurface.css";

interface Props {
  state: GameState;
  onClick: () => void;
  onBuy: (id: UpgradeId) => void;
  onPrestige: () => void;
  onExit: () => void;
}

export function IdleGamePlaySurface({ state, onClick, onBuy, onPrestige, onExit }: Props) {
  const [confirmingPrestige, setConfirmingPrestige] = useState(false);
  const readyPoints = pointsOnPrestige(state);

  function handlePrestigeClick() {
    if (!confirmingPrestige) {
      setConfirmingPrestige(true);
      return;
    }
    onPrestige();
    setConfirmingPrestige(false);
  }

  return (
    <div className="idle-game-play">
      <div className="idle-game-play__bar">
        <span className="idle-game-play__title">Incremental Game</span>
        <button type="button" className="idle-game-play__back" onClick={onExit}>
          ← Back
        </button>
      </div>

      <div className="idle-game-play__readouts">
        <div className="idle-game-play__readout">
          <span className="idle-game-play__readout-label">Resource</span>
          <span className="idle-game-play__readout-value">{formatCompactNumber(state.resource)}</span>
        </div>
        <div className="idle-game-play__readout">
          <span className="idle-game-play__readout-label">Resource 2</span>
          <span className="idle-game-play__readout-value">{formatCompactNumber(state.resource2)}</span>
        </div>
        <div className="idle-game-play__readout">
          <span className="idle-game-play__readout-label">Prestige Points</span>
          <span className="idle-game-play__readout-value">{state.prestigePoints}</span>
        </div>
        <div className="idle-game-play__mult-badge">×{resourceMultiplier(state).toFixed(2)} Resource</div>
      </div>

      <button type="button" className="idle-game-play__click" onClick={onClick}>
        CLICK
      </button>

      <ul className="idle-game-play__upgrades">
        {UPGRADES.map((def) => {
          const owned = state.upgradeCounts[def.id] ?? 0;
          const cost = upgradeCost(def, owned);
          const affordable = canAfford(state, def);
          return (
            <li key={def.id} className="idle-game-play__upgrade">
              <div className="idle-game-play__upgrade-info">
                <div className="idle-game-play__upgrade-title">
                  {def.name} <span className="idle-game-play__upgrade-owned">×{owned}</span>
                </div>
                <p className="idle-game-play__upgrade-blurb">{def.blurb}</p>
                <p className="idle-game-play__upgrade-rate">
                  {def.outputPerUnit}/s {def.outputResource === "resource" ? "Resource" : "Resource 2"} each
                  {def.consumesPerUnit && ` (burns ${def.consumesPerUnit.amount}/s Resource each)`}
                </p>
              </div>
              <button
                type="button"
                className={`idle-game-play__buy ${affordable ? "" : "idle-game-play__buy--disabled"}`}
                disabled={!affordable}
                onClick={() => onBuy(def.id)}
              >
                Buy
                <br />
                {formatCompactNumber(cost)}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="idle-game-play__prestige">
        <p className="idle-game-play__prestige-info">
          {readyPoints > 0
            ? `Reset for +${readyPoints} Prestige Points (permanent +${(readyPoints * 2).toFixed(0)}% Resource output).`
            : "Keep producing Resource 2 to earn Prestige Points on reset."}
        </p>
        <button
          type="button"
          className="idle-game-play__prestige-button"
          disabled={!canPrestige(state)}
          onClick={handlePrestigeClick}
          onBlur={() => setConfirmingPrestige(false)}
        >
          {confirmingPrestige ? "Resets Resource & Resource 2 - confirm?" : "PRESTIGE"}
        </button>
      </div>
    </div>
  );
}
