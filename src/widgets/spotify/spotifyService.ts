import { invoke } from "@tauri-apps/api/core";
import type { SavedTrack, SpotifyProvider } from "./types";

/**
 * Real integration - Spotify's Authorization Code + PKCE flow, run entirely
 * on the Rust side (src-tauri/src/spotify.rs) so tokens never sit in
 * localStorage. `connect()` opens the system browser to Spotify's login
 * page and resolves once the redirect's been caught and tokens saved.
 *
 * `getAccessToken`/`getSavedTracks`/`playTrackHere` below are NOT part of
 * the SpotifyProvider abstraction - they're specific to the Web Playback
 * SDK integration (usePlayer.ts, LibraryView.tsx), which needs a real
 * access token in the browser context (see spotify.rs::get_access_token's
 * doc comment for why that's a deliberate, narrow exception).
 */
class RealSpotifyProvider implements SpotifyProvider {
  async isConnected(): Promise<boolean> {
    return invoke<boolean>("spotify_is_connected");
  }

  async connect(): Promise<void> {
    await invoke("spotify_login");
  }

  async disconnect(): Promise<void> {
    await invoke("spotify_logout");
  }
}

let provider: SpotifyProvider = new RealSpotifyProvider();

export function getSpotifyProvider(): SpotifyProvider {
  return provider;
}

export function setSpotifyProvider(next: SpotifyProvider): void {
  provider = next;
}

export async function getAccessToken(): Promise<string | null> {
  return invoke<string | null>("spotify_get_access_token");
}

export async function getSavedTracks(limit: number, offset: number): Promise<SavedTrack[] | null> {
  return invoke<SavedTrack[] | null>("spotify_saved_tracks", { limit, offset });
}

const SPOTIFY_API = "https://api.spotify.com/v1";

// A device that only just registered via the Web Playback SDK's `ready`
// event isn't always immediately targetable by the Web API - Spotify's
// backend can take a moment to catch up, and hitting it too soon returns a
// 404 ("device not found") even though the device is genuinely connected.
// This is a well-documented race in Web Playback SDK integrations, not a
// permanent failure, so a 404 here gets a couple of short retries before
// giving up; any other status fails immediately since a delay won't fix it.
const DEVICE_RETRY_DELAYS_MS = [0, 300, 800];

async function putSpotify(token: string, path: string, body: unknown): Promise<Response> {
  return fetch(`${SPOTIFY_API}${path}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function putWithDeviceRetry(token: string, path: string, body: unknown): Promise<void> {
  let lastStatus = 0;
  for (const delay of DEVICE_RETRY_DELAYS_MS) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    const response = await putSpotify(token, path, body);
    if (response.ok || response.status === 204) return;
    lastStatus = response.status;
    if (response.status !== 404) break;
  }
  throw new Error(`status ${lastStatus}`);
}

/** Makes this app's Web Playback SDK device (`deviceId`, from usePlayer)
 * the active one and starts playing `uri` on it. Called directly against
 * Spotify's Web API with the same token the SDK itself uses - there's no
 * Rust command for this, it's plain browser fetch(), same as the SDK's own
 * examples do it.
 *
 * Explicitly transfers playback to the device first rather than relying on
 * `/me/player/play`'s own `device_id` param to do that implicitly - in
 * practice that's the more reliable order and matches Spotify's own
 * Web Playback SDK examples. */
export async function playTrackHere(deviceId: string, uri: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not connected to Spotify.");

  try {
    await putWithDeviceRetry(token, "/me/player", { device_ids: [deviceId], play: false });
  } catch (err) {
    throw new Error(`Spotify couldn't switch playback here (${err instanceof Error ? err.message : "unknown error"}).`);
  }

  try {
    await putWithDeviceRetry(token, `/me/player/play?device_id=${encodeURIComponent(deviceId)}`, { uris: [uri] });
  } catch (err) {
    throw new Error(`Spotify couldn't start playback (${err instanceof Error ? err.message : "unknown error"}).`);
  }
}
