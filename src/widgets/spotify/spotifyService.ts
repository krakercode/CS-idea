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

/** Makes this app's Web Playback SDK device (`deviceId`, from usePlayer)
 * the active one and starts playing `uri` on it. Called directly against
 * Spotify's Web API with the same token the SDK itself uses - there's no
 * Rust command for this, it's plain browser fetch(), same as the SDK's own
 * examples do it. */
export async function playTrackHere(deviceId: string, uri: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not connected to Spotify.");

  const response = await fetch(`${SPOTIFY_API}/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ uris: [uri] }),
  });
  if (!response.ok) {
    throw new Error(`Spotify couldn't start playback (status ${response.status}).`);
  }
}
