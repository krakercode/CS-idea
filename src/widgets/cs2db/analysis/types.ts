// The Rust side passes through Leetify's raw JSON responses, so these types are
// best-effort shapes rather than a guaranteed contract - access fields defensively.
export type JsonValue = Record<string, any>;

export interface ErrorPayload {
  kind: "not_found" | "rate_limited" | "network" | "api_error" | "storage" | string;
  message: string;
}

export interface Snapshot {
  fetched_at: string;
  rating: JsonValue | null;
  ranks: JsonValue | null;
}

export interface Suggestion {
  dimension: string;
  score: number;
  title: string;
  tip: string;
  drills: string[];
}

export const RATING_DIMENSIONS: { key: string; label: string }[] = [
  { key: "aim", label: "Aim" },
  { key: "positioning", label: "Positioning" },
  { key: "utility", label: "Utility" },
  { key: "clutch", label: "Clutch" },
  { key: "opening", label: "Opening" },
  { key: "ct_leetify", label: "CT side" },
  { key: "t_leetify", label: "T side" },
];
