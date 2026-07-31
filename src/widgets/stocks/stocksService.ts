import { invoke } from "@tauri-apps/api/core";
import { getWatchlist } from "./watchlistStore";
import type { Quote } from "./types";

/**
 * Real data - fetches quotes from Yahoo Finance's unofficial chart endpoint
 * on the Rust side (src-tauri/src/stocks.rs; no API key). A symbol that
 * fails to resolve is dropped rather than failing the whole watchlist.
 */
export async function fetchQuotes(): Promise<Quote[]> {
  return invoke<Quote[]>("fetch_quotes", { symbols: getWatchlist() });
}
