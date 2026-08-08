import { newGameState } from "./gameLogic";
import { CURRENT_SCHEMA_VERSION, type GameState } from "./types";

const STORAGE_KEY = "idle-game-state";

export function loadGameState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return newGameState();
    const parsed = JSON.parse(raw) as Partial<GameState>;
    // No migration path yet for a schema mismatch - just start fresh. If the
    // shape changes again later (a new upgrade/resource), replace this
    // branch with real field-by-field migrations keyed by schemaVersion.
    if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) return newGameState();
    const base = newGameState();
    return { ...base, ...parsed, upgradeCounts: { ...base.upgradeCounts, ...parsed.upgradeCounts } };
  } catch {
    return newGameState();
  }
}

export function saveGameState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best-effort, same as themeStore.ts - still playable this session,
    // just doesn't persist.
  }
}
