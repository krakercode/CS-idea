import { STOCK_WATCHLIST } from "./watchlist";

const STORAGE_KEY = "stocks-watchlist";
const MAX_SYMBOLS = 12;

/** User-editable version of the ticker list the Stocks widget tracks -
 * STOCK_WATCHLIST in watchlist.ts is just the first-run default. Persisted
 * to localStorage, same pattern as newsKeywordsStore. */
export function getWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...STOCK_WATCHLIST];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [...STOCK_WATCHLIST];
  } catch {
    return [...STOCK_WATCHLIST];
  }
}

function saveWatchlist(symbols: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  } catch {
    // Best-effort - e.g. localStorage disabled/full. Keeps working for the
    // current session, it just won't persist.
  }
}

/** Adds a ticker (trimmed, uppercased, de-duplicated, capped at
 * MAX_SYMBOLS so the widget can't be configured into a watchlist so large
 * it hammers Yahoo's endpoint or the widget itself becomes unreadable).
 * Returns the updated list; a no-op for a blank, already-present, or
 * over-the-cap symbol. */
export function addSymbol(symbol: string): string[] {
  const normalized = symbol.trim().toUpperCase();
  const current = getWatchlist();
  if (!normalized || current.length >= MAX_SYMBOLS || current.includes(normalized)) return current;

  const next = [...current, normalized];
  saveWatchlist(next);
  return next;
}

export function removeSymbol(symbol: string): string[] {
  const next = getWatchlist().filter((s) => s !== symbol);
  saveWatchlist(next);
  return next;
}

export { MAX_SYMBOLS };
