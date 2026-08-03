import { createItemListStore } from "../../shared/itemListStore";
import type { TransitStop } from "./types";

const STORAGE_KEY = "transit-tracked-stops";
export const MAX_TRACKED_STOPS = 10;

function isTrackedStop(value: unknown): value is TransitStop {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.name === "string" && Array.isArray(v.modes) && Array.isArray(v.agencies);
}

const store = createItemListStore<TransitStop>(STORAGE_KEY, MAX_TRACKED_STOPS, isTrackedStop);

export function getTrackedStops(): TransitStop[] {
  return store.get();
}

/** No-op (rather than a duplicate entry) if this stop is already tracked. */
export function addTrackedStop(stop: TransitStop): TransitStop[] {
  const current = store.get();
  if (current.some((s) => s.id === stop.id)) return current;
  return store.add(stop);
}

export function removeTrackedStop(id: string): TransitStop[] {
  return store.remove(id);
}
