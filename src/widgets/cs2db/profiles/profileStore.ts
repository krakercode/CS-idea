import type { Cs2Map } from "../types";

const STORAGE_KEY = "cs2-player-profile";

export interface PlayerProfile {
  /** The CT position this player usually holds, per map. */
  positions: Partial<Record<Cs2Map, string>>;
}

const EMPTY_PROFILE: PlayerProfile = { positions: {} };

/**
 * A player's usual CT position per map - purely local, per-device
 * preference data, so plain localStorage is enough (no need for the
 * Tauri store plugin the Analysis view uses for its own settings).
 */
export function getProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PROFILE;
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return { positions: parsed.positions ?? {} };
  } catch {
    return EMPTY_PROFILE;
  }
}

export function setPositionForMap(map: Cs2Map, positionId: string | null): PlayerProfile {
  const current = getProfile();
  const positions = { ...current.positions };
  if (positionId) {
    positions[map] = positionId;
  } else {
    delete positions[map];
  }
  const next: PlayerProfile = { positions };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort - e.g. localStorage disabled/full. The in-memory value
    // returned here still lets the current session work.
  }
  return next;
}
