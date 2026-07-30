import { invoke } from "@tauri-apps/api/core";
import type { NowPlaying, SpotifyProvider } from "./types";

/**
 * Real integration - Spotify's Authorization Code + PKCE flow, run entirely
 * on the Rust side (src-tauri/src/spotify.rs) so the access/refresh tokens
 * never touch the frontend. `connect()` opens the system browser to
 * Spotify's login page and resolves once the redirect's been caught and
 * tokens saved; `getNowPlaying()` refreshes the access token first if it's
 * close to expiry.
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

  async getNowPlaying(): Promise<NowPlaying | null> {
    return invoke<NowPlaying | null>("spotify_now_playing");
  }
}

let provider: SpotifyProvider = new RealSpotifyProvider();

export function getSpotifyProvider(): SpotifyProvider {
  return provider;
}

export function setSpotifyProvider(next: SpotifyProvider): void {
  provider = next;
}
