import { createItemListStore } from "../../shared/itemListStore";
import type { Airport, TrackedAirport } from "./types";

const STORAGE_KEY = "transit-tracked-airports";
export const MAX_TRACKED_AIRPORTS = 10;

function isTrackedAirport(value: unknown): value is TrackedAirport {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.icao === "string" && typeof v.name === "string";
}

const store = createItemListStore<TrackedAirport>(STORAGE_KEY, MAX_TRACKED_AIRPORTS, isTrackedAirport);

export function getTrackedAirports(): TrackedAirport[] {
  return store.get();
}

/** No-op (rather than a duplicate entry) if this airport is already tracked. */
export function addTrackedAirport(airport: Airport): TrackedAirport[] {
  const current = store.get();
  if (current.some((a) => a.icao === airport.icao)) return current;
  return store.add({ ...airport, id: airport.icao });
}

export function removeTrackedAirport(icao: string): TrackedAirport[] {
  return store.remove(icao);
}
