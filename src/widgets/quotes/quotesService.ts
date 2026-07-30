import { QUOTES } from "./data/quotes";
import type { Quote } from "./types";

export function listSpeakers(): string[] {
  return Array.from(new Set(QUOTES.map((q) => q.speaker)));
}

/** Picks a random quote from the given speakers (falls back to the full
 * list if the filter matches nothing, e.g. transiently while state updates). */
export async function getRandomQuote(speakers: string[]): Promise<Quote> {
  const pool = QUOTES.filter((q) => speakers.includes(q.speaker));
  const candidates = pool.length > 0 ? pool : QUOTES;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
