// Field names are snake_case to match the JSON serde emits from
// src-tauri/src/stocks.rs verbatim - no transformation layer needed.
export interface Quote {
  symbol: string;
  price: number;
  change: number;
  change_percent: number;
  currency: string;
  updated_at: string; // RFC3339
  /** Closing prices over the lookback window, oldest first - empty if
   * unavailable. See stocks.rs for the window/interval used. */
  history: number[];
}
