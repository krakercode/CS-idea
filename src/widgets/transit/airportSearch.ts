import { AIRPORTS } from "./airportsData";
import type { Airport } from "./types";

// Bundled, not fetched live: see airportsData.ts for the source. Search is
// instant and needs no network call or API key, unlike the live Transitland
// stop search.
const MAX_RESULTS = 15;

export function searchAirports(query: string): Airport[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const results: Airport[] = [];
  for (const airport of AIRPORTS) {
    const haystack = `${airport.name} ${airport.city ?? ""} ${airport.iata ?? ""} ${airport.icao}`.toLowerCase();
    if (haystack.includes(trimmed)) {
      results.push(airport);
      if (results.length >= MAX_RESULTS) break;
    }
  }
  return results;
}
