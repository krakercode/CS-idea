import type { GameState, UpgradeDef, UpgradeId } from "./types";
import { CURRENT_SCHEMA_VERSION } from "./types";

export const UPGRADES: UpgradeDef[] = [
  {
    id: "upgrade1",
    name: "Upgrade 1",
    blurb: "A cheap early producer.",
    costResource: "resource",
    baseCost: 15,
    costGrowth: 1.15,
    outputResource: "resource",
    outputPerUnit: 0.1,
  },
  {
    id: "upgrade2",
    name: "Upgrade 2",
    blurb: "A stronger producer.",
    costResource: "resource",
    baseCost: 100,
    costGrowth: 1.15,
    outputResource: "resource",
    outputPerUnit: 1,
  },
  {
    id: "upgrade3",
    name: "Upgrade 3",
    blurb: "The top Resource-producing tier.",
    costResource: "resource",
    baseCost: 1_100,
    costGrowth: 1.15,
    outputResource: "resource",
    outputPerUnit: 8,
  },
  {
    id: "upgrade4",
    name: "Upgrade 4",
    blurb: "Converts Resource into Resource 2.",
    costResource: "resource",
    baseCost: 500,
    costGrowth: 1.18,
    outputResource: "resource2",
    outputPerUnit: 0.5,
    consumesPerUnit: { resource: "resource", amount: 2 },
  },
  {
    id: "upgrade5",
    name: "Upgrade 5",
    blurb: "Self-sustaining Resource 2 production.",
    costResource: "resource2",
    baseCost: 25,
    costGrowth: 1.2,
    outputResource: "resource2",
    outputPerUnit: 3,
  },
];

export const PRESTIGE_MULT_PER_POINT = 0.02;
/** Safety cap on offline catch-up - guards against a corrupted timestamp or
 * clock skew producing a runaway or negative advance. */
export const MAX_OFFLINE_MS = 1000 * 60 * 60 * 24 * 14;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function newGameState(now: number = Date.now()): GameState {
  const upgradeCounts = {} as Record<UpgradeId, number>;
  for (const def of UPGRADES) upgradeCounts[def.id] = 0;
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    resource: 0,
    resource2: 0,
    prestigePoints: 0,
    upgradeCounts,
    lifetimeResource: 0,
    lifetimeResource2: 0,
    totalPrestiges: 0,
    lastTickAt: now,
    createdAt: now,
  };
}

export function upgradeCost(def: UpgradeDef, owned: number): number {
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, owned));
}

export function resourceMultiplier(state: GameState): number {
  return 1 + state.prestigePoints * PRESTIGE_MULT_PER_POINT;
}

export function clickPower(state: GameState): number {
  return 1 * resourceMultiplier(state);
}

export function canAfford(state: GameState, def: UpgradeDef): boolean {
  return state[def.costResource] >= upgradeCost(def, state.upgradeCounts[def.id] ?? 0);
}

export function buyUpgrade(state: GameState, id: UpgradeId): GameState {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def || !canAfford(state, def)) return state;
  const owned = state.upgradeCounts[id] ?? 0;
  const cost = upgradeCost(def, owned);
  return {
    ...state,
    [def.costResource]: state[def.costResource] - cost,
    upgradeCounts: { ...state.upgradeCounts, [id]: owned + 1 },
  };
}

export function applyClick(state: GameState): GameState {
  const gain = clickPower(state);
  return { ...state, resource: state.resource + gain, lifetimeResource: state.lifetimeResource + gain };
}

/** Shared by advance() and computeRates() so the displayed "/s" numbers are
 * always exactly what the tick math will actually produce, rather than two
 * divergent implementations. */
function simulateDelta(
  state: GameState,
  elapsedSec: number,
): { resourceGain: number; resourceConsumed: number; resource2Gain: number } {
  const mult = resourceMultiplier(state);
  let resourceGain = 0;
  let resourceDemand = 0;
  let resource2Direct = 0;
  for (const def of UPGRADES) {
    const owned = state.upgradeCounts[def.id] ?? 0;
    if (!owned) continue;
    if (def.outputResource === "resource") {
      resourceGain += owned * def.outputPerUnit * mult * elapsedSec;
    } else if (!def.consumesPerUnit) {
      resource2Direct += owned * def.outputPerUnit * elapsedSec; // e.g. upgrade5
    } else {
      resourceDemand += owned * def.consumesPerUnit.amount * elapsedSec; // e.g. upgrade4's appetite
    }
  }
  // A conversion upgrade can't manufacture Resource 2 out of thin air: its
  // conversion is throttled to whatever Resource is actually available
  // this tick (existing stock + what's being produced in the same instant).
  const available = state.resource + resourceGain;
  const ratio = resourceDemand > 0 ? Math.min(1, available / resourceDemand) : 1;
  let resource2FromConversion = 0;
  let resourceConsumed = 0;
  for (const def of UPGRADES) {
    if (!def.consumesPerUnit) continue;
    const owned = state.upgradeCounts[def.id] ?? 0;
    if (!owned) continue;
    resourceConsumed += owned * def.consumesPerUnit.amount * elapsedSec * ratio;
    resource2FromConversion += owned * def.outputPerUnit * elapsedSec * ratio;
  }
  return { resourceGain, resourceConsumed, resource2Gain: resource2Direct + resource2FromConversion };
}

/** Pure resource-math advance for `elapsedMs` of simulated time. Deliberately
 * does NOT touch lastTickAt - callers (the tick effect, catchUpOffline) own
 * that bookkeeping, since one is wall-clock-driven and the other is a
 * one-shot bulk catch-up. */
export function advance(state: GameState, elapsedMs: number): GameState {
  const elapsedSec = elapsedMs / 1000;
  if (elapsedSec <= 0) return state;
  const { resourceGain, resourceConsumed, resource2Gain } = simulateDelta(state, elapsedSec);
  return {
    ...state,
    resource: Math.max(0, state.resource + resourceGain - resourceConsumed),
    resource2: state.resource2 + resource2Gain,
    lifetimeResource: state.lifetimeResource + resourceGain,
    lifetimeResource2: state.lifetimeResource2 + resource2Gain,
  };
}

/** Instantaneous "/s" numbers for display - exact, not just a theoretical
 * max, since it reuses the same throttled simulateDelta as advance(). */
export function computeRates(state: GameState): { resourcePerSec: number; resource2PerSec: number } {
  const { resourceGain, resourceConsumed, resource2Gain } = simulateDelta(state, 1);
  return { resourcePerSec: resourceGain - resourceConsumed, resource2PerSec: resource2Gain };
}

export function pointsOnPrestige(state: GameState): number {
  return Math.floor(Math.sqrt(state.lifetimeResource2 / 1000));
}

export function canPrestige(state: GameState): boolean {
  return pointsOnPrestige(state) > 0;
}

export function prestige(state: GameState, now: number = Date.now()): GameState {
  const gained = pointsOnPrestige(state);
  if (gained <= 0) return state;
  return {
    ...newGameState(now),
    prestigePoints: state.prestigePoints + gained,
    totalPrestiges: state.totalPrestiges + 1,
    createdAt: state.createdAt,
  };
}

/** How far state.lifetimeResource2 is toward the *next* prestige point, as
 * 0-100 - for the collapsed widget's progress bar. */
export function prestigeProgressPct(state: GameState): number {
  const cur = state.prestigePoints;
  const next = cur + 1;
  const curThreshold = cur * cur * 1000;
  const nextThreshold = next * next * 1000;
  return clamp(((state.lifetimeResource2 - curThreshold) / (nextThreshold - curThreshold)) * 100, 0, 100);
}

/** One-shot bulk fast-forward on load - covers both a normal reload and a
 * long offline/backgrounded gap (including the whole app being closed and
 * reopened later), capped so a corrupted timestamp or clock skew can't
 * produce a runaway or negative advance. */
export function catchUpOffline(state: GameState, now: number = Date.now()): GameState {
  const elapsedMs = clamp(now - state.lastTickAt, 0, MAX_OFFLINE_MS);
  return { ...advance(state, elapsedMs), lastTickAt: now };
}
