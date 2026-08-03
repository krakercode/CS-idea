import { invoke } from "@tauri-apps/api/core";
import type { FlightMovement, TransitDeparture, TransitStop } from "./types";

export function searchTransitStops(apiKey: string, query: string): Promise<TransitStop[]> {
  return invoke("search_transit_stops", { apiKey, query });
}

export function getTransitDepartures(apiKey: string, stopId: string): Promise<TransitDeparture[]> {
  return invoke("get_transit_departures", { apiKey, stopId });
}

export function getAirportArrivals(icao: string): Promise<FlightMovement[]> {
  return invoke("get_airport_arrivals", { icao });
}

export function getAirportDepartures(icao: string): Promise<FlightMovement[]> {
  return invoke("get_airport_departures", { icao });
}
