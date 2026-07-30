import { invoke } from "@tauri-apps/api/core";
import type { ErrorPayload, JsonValue, Snapshot, Suggestion } from "./types";

/**
 * Talks to the Rust side (src-tauri/src/leetify_client.rs, db.rs,
 * suggestions.rs) via Tauri commands. Unlike the rest of the dashboard's
 * widgets, this one is real, working integration rather than mock data -
 * see the README for notes on the Leetify API and local snapshot storage.
 */

export function isErrorPayload(err: unknown): err is ErrorPayload {
  return typeof err === "object" && err !== null && "kind" in err && "message" in err;
}

export function friendlyError(err: unknown): string {
  if (isErrorPayload(err)) {
    switch (err.kind) {
      case "not_found":
        return "No Leetify profile found for that ID.";
      case "rate_limited":
        return "Leetify is rate-limiting requests — wait a moment and try again.";
      case "network":
        return "Couldn't reach Leetify. Check your connection and try again.";
      default:
        return err.message || "Something went wrong talking to Leetify.";
    }
  }
  return String(err);
}

export async function fetchProfile(playerId: string, apiKey: string | null): Promise<JsonValue> {
  return invoke<JsonValue>("fetch_profile", { playerId, apiKey: apiKey || null });
}

export async function fetchMatchHistory(playerId: string, apiKey: string | null): Promise<JsonValue> {
  return invoke<JsonValue>("fetch_match_history", { playerId, apiKey: apiKey || null });
}

export async function getTrend(playerId: string): Promise<Snapshot[]> {
  return invoke<Snapshot[]>("get_trend", { playerId });
}

export async function getSuggestions(playerId: string, limit = 3): Promise<Suggestion[]> {
  return invoke<Suggestion[]>("get_suggestions", { playerId, limit });
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  return invoke<boolean>("validate_api_key", { apiKey });
}

/** Best-effort extraction: several possible field names, first defined wins. */
export function pick(obj: JsonValue | null | undefined, keys: string[]): any {
  if (!obj) return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

export function asMatchList(history: JsonValue | null): JsonValue[] {
  if (!history) return [];
  if (Array.isArray(history)) return history;
  const candidate = pick(history, ["matches", "recent_matches", "items"]);
  return Array.isArray(candidate) ? candidate : [];
}

export function renderRankValue(value: any): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number" || typeof value === "string") return String(value);
  if (typeof value === "object") {
    const label = pick(value, ["name", "rank", "value", "tier"]);
    if (label !== undefined) return String(label);
    return JSON.stringify(value);
  }
  return String(value);
}
