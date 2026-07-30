import { delay } from "../../shared/mock";
import type { NowPlaying, SpotifyProvider } from "./types";

const MOCK_TRACK: Omit<NowPlaying, "progressMs" | "isPlaying"> = {
  trackName: "Sample Track",
  artist: "Sample Artist",
  albumName: "Sample Album",
  durationMs: 210_000,
};

/**
 * Placeholder provider - "connect" just flips a local flag instead of doing
 * real OAuth, and playback progress is simulated from a timestamp.
 *
 * Real integration later: Spotify's Authorization Code + PKCE flow is the
 * right fit for a desktop app (no client secret to embed). The rough shape:
 *   1. Open the system browser to Spotify's /authorize URL
 *      (via the Tauri opener plugin), with a PKCE code_challenge.
 *   2. Catch the redirect - either a loopback HTTP server on localhost, or
 *      a registered custom URL scheme deep link back into the app.
 *   3. Exchange the code for an access/refresh token and implement this
 *      same SpotifyProvider interface against the Web API
 *      (GET /me/player/currently-playing, etc).
 * The widget only depends on this interface, so none of it changes.
 */
class MockSpotifyProvider implements SpotifyProvider {
  private connected = false;
  private connectedAt = 0;

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  async connect(): Promise<void> {
    await delay(300);
    this.connected = true;
    this.connectedAt = Date.now();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getNowPlaying(): Promise<NowPlaying | null> {
    if (!this.connected) return null;
    const elapsed = Date.now() - this.connectedAt;
    const progressMs = elapsed % MOCK_TRACK.durationMs;
    return { ...MOCK_TRACK, isPlaying: true, progressMs };
  }
}

let provider: SpotifyProvider = new MockSpotifyProvider();

export function getSpotifyProvider(): SpotifyProvider {
  return provider;
}

export function setSpotifyProvider(next: SpotifyProvider): void {
  provider = next;
}
