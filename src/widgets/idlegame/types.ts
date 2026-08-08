export const CURRENT_SCHEMA_VERSION = 1;

export type ResourceId = "resource" | "resource2";
export type UpgradeId = "upgrade1" | "upgrade2" | "upgrade3" | "upgrade4" | "upgrade5";

/** Static catalog entry - never persisted, lives in gameLogic.ts. */
export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  blurb: string;
  costResource: ResourceId;
  baseCost: number;
  /** cost(owned) = baseCost * costGrowth^owned */
  costGrowth: number;
  outputResource: ResourceId;
  /** output resource/sec per owned unit. */
  outputPerUnit: number;
  /** Present only for conversion upgrades (Upgrade 4): resource burned per
   * owned unit per second to produce its output - the dependency between
   * Resource and Resource 2. */
  consumesPerUnit?: { resource: "resource"; amount: number };
}

/** The one JSON blob persisted to localStorage. */
export interface GameState {
  schemaVersion: number;
  resource: number;
  resource2: number;
  prestigePoints: number;
  upgradeCounts: Record<UpgradeId, number>;
  /** Ever-produced totals, never decrease on spend - used for the
   * prestige formula so spending doesn't reduce a reset's payout. */
  lifetimeResource: number;
  lifetimeResource2: number;
  totalPrestiges: number;
  /** Epoch ms of the last resource-math advance - drives both the live
   * tick and offline catch-up. */
  lastTickAt: number;
  createdAt: number;
}
