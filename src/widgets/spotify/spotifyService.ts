import { invoke } from "@tauri-apps/api/core";
import type { AlbumSummary, ArtistSummary, PlaylistSummary, SavedTrack, SearchResults, SpotifyProvider } from "./types";

/**
 * Real integration - Spotify's Authorization Code + PKCE flow, run entirely
 * on the Rust side (src-tauri/src/spotify.rs) so tokens never sit in
 * localStorage. `connect()` opens the system browser to Spotify's login
 * page and resolves once the redirect's been caught and tokens saved.
 *
 * Everything below `getAccessToken` is NOT part of the SpotifyProvider
 * abstraction - it's plain fetch() calls against Spotify's Web API,
 * straight from here rather than one-to-one Rust command wrappers
 * (`saved_tracks` stayed in Rust from before this was the pattern, but
 * there's no reason to keep growing the Rust side for read-only browsing
 * and remote-control calls that need a browser-side token anyway - see
 * spotify.rs::get_access_token's doc comment for why exposing one is a
 * deliberate, narrow exception). Playback here always remote-controls
 * whatever Spotify device is already active (phone, desktop app, a browser
 * tab) rather than this app hosting its own - see `NoActiveDeviceError`'s
 * doc comment for why.
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

// No timeout at all on a fetch() call means a slow/unresponsive Spotify API
// response just hangs indefinitely - and every hung request from a user
// impatiently re-clicking "Play" stacks up as another open connection.
// Bounding every request here keeps failures fast and bounded instead.
const FETCH_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** Thrown when a playback-control call 404s because Spotify has no active
 * device at all (`NO_ACTIVE_DEVICE`) - this app doesn't host its own
 * playback device (see the README's Spotify section for why: the Web
 * Playback SDK needs Widevine DRM to actually decode audio, which Tauri's
 * webview doesn't support), so every control call here remote-controls
 * whatever's already active - your phone, a desktop app, spotify.com in a
 * browser tab. If nothing's active, Spotify has nowhere to route it. */
export class NoActiveDeviceError extends Error {
  constructor() {
    super("Nothing's active on Spotify right now - open Spotify on your phone, computer, or spotify.com, then try again.");
    this.name = "NoActiveDeviceError";
  }
}

// Prevents overlapping playback-control requests - a user re-clicking a
// slow-to-respond "Play"/"Play all" button out of frustration used to fire
// a fresh request on every click with nothing stopping them from piling up
// concurrently. One control action at a time, full stop.
let playbackActionInFlight = false;

async function controlPlayback(path: string, init: RequestInit): Promise<void> {
  if (playbackActionInFlight) {
    throw new Error("Still working on the last playback request - give it a moment.");
  }
  playbackActionInFlight = true;
  try {
    const token = await getAccessToken();
    if (!token) throw new Error("Not connected to Spotify.");

    const response = await fetchWithTimeout(`${SPOTIFY_API}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) throw new NoActiveDeviceError();
    if (!response.ok && response.status !== 204) {
      throw new Error(`Spotify couldn't do that (status ${response.status}).`);
    }
  } finally {
    playbackActionInFlight = false;
  }
}

/** Plays a single track by URI on whatever Spotify device is currently
 * active - used for "Liked Songs" and search-result tracks, which aren't
 * part of any browsable context. */
export async function playTrackHere(uri: string): Promise<void> {
  await controlPlayback("/me/player/play", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uris: [uri] }),
  });
}

/** Plays a playlist/album/artist as a context on the active device,
 * optionally starting from a specific track within it (`offsetUri`) -
 * unlike `playTrackHere`, this lets Spotify continue naturally into the
 * rest of the playlist/album afterwards instead of stopping after one
 * track. */
export async function playContextHere(contextUri: string, offsetUri?: string): Promise<void> {
  await controlPlayback("/me/player/play", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(offsetUri ? { context_uri: contextUri, offset: { uri: offsetUri } } : { context_uri: contextUri }),
  });
}

export async function pausePlayback(): Promise<void> {
  await controlPlayback("/me/player/pause", { method: "PUT" });
}

export async function resumePlayback(): Promise<void> {
  await controlPlayback("/me/player/play", { method: "PUT" });
}

export async function skipToNext(): Promise<void> {
  await controlPlayback("/me/player/next", { method: "POST" });
}

export async function skipToPrevious(): Promise<void> {
  await controlPlayback("/me/player/previous", { method: "POST" });
}

export async function seekTo(positionMs: number): Promise<void> {
  await controlPlayback(`/me/player/seek?position_ms=${Math.round(positionMs)}`, { method: "PUT" });
}

export async function setPlaybackVolume(volumePercent: number): Promise<void> {
  await controlPlayback(`/me/player/volume?volume_percent=${Math.round(volumePercent)}`, { method: "PUT" });
}

export interface NowPlaying {
  paused: boolean;
  positionMs: number;
  durationMs: number;
  volumePercent: number | null;
  deviceName: string;
  track: { name: string; artist: string; albumArtUrl?: string } | null;
  /** Client timestamp (ms) this snapshot was fetched at - `positionMs` only
   * reflects the moment of the poll, so the UI ticks position forward
   * locally between polls using this. */
  timestamp: number;
}

/** The user's current playback state, remote-controlled device and all -
 * a plain GET against `/me/player`, polled from `useNowPlaying`. Spotify
 * returns 204 with no body when nothing's active anywhere, which reads
 * fine as `null` here rather than an error. */
export async function getNowPlaying(): Promise<NowPlaying | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const response = await fetchWithTimeout(`${SPOTIFY_API}/me/player`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401 || response.status === 403) throw new SpotifyAuthError();
  if (response.status === 204 || !response.ok) return null;
  const data = (await response.json()) as {
    is_playing: boolean;
    progress_ms: number | null;
    device: { name: string; volume_percent: number | null };
    item: RawTrack | null;
  };
  return {
    paused: !data.is_playing,
    positionMs: data.progress_ms ?? 0,
    durationMs: data.item?.duration_ms ?? 0,
    volumePercent: data.device.volume_percent,
    deviceName: data.device.name,
    track: data.item ? { name: data.item.name, artist: data.item.artists.map((a) => a.name).join(", "), albumArtUrl: data.item.album?.images[0]?.url } : null,
    timestamp: Date.now(),
  };
}

/** Thrown by `getSpotify` on 401/403 - specifically means the current token
 * doesn't have permission for this call (most commonly: it was granted
 * before a scope this endpoint needs was added, and needs a reconnect to
 * pick it up), as opposed to a transient failure. Kept distinguishable so
 * callers can show "reconnect Spotify" instead of a misleading "nothing
 * here" for what's actually a permissions problem. */
export class SpotifyAuthError extends Error {
  constructor() {
    super("Spotify says this isn't authorized - try disconnecting and reconnecting Spotify to pick up the latest permissions.");
    this.name = "SpotifyAuthError";
  }
}

async function getSpotify<T>(path: string): Promise<T | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const response = await fetchWithTimeout(`${SPOTIFY_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401 || response.status === 403) throw new SpotifyAuthError();
  if (!response.ok) return null;
  return (await response.json()) as T;
}

interface RawImage {
  url: string;
}
interface RawArtist {
  name: string;
}
interface RawAlbum {
  name: string;
  images: RawImage[];
  artists: RawArtist[];
}
interface RawTrack {
  uri: string;
  name: string;
  duration_ms: number;
  artists: RawArtist[];
  album: RawAlbum;
}
interface RawOwnedCollection {
  id: string;
  uri: string;
  name: string;
  images: RawImage[];
  owner: { display_name: string };
  tracks: { total: number };
}
interface RawAlbumSummary {
  id: string;
  uri: string;
  name: string;
  images: RawImage[];
  artists: RawArtist[];
}
interface RawArtistSummary {
  id: string;
  uri: string;
  name: string;
  images: RawImage[];
}

function trackFromRaw(t: RawTrack, albumArtUrlOverride?: string): SavedTrack {
  return {
    uri: t.uri,
    trackName: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    albumArtUrl: albumArtUrlOverride ?? t.album?.images[0]?.url,
  };
}

function playlistFromRaw(p: RawOwnedCollection): PlaylistSummary {
  return { id: p.id, uri: p.uri, name: p.name, imageUrl: p.images[0]?.url, owner: p.owner.display_name, trackCount: p.tracks.total };
}

function albumFromRaw(a: RawAlbumSummary): AlbumSummary {
  return { id: a.id, uri: a.uri, name: a.name, artist: a.artists.map((x) => x.name).join(", "), imageUrl: a.images[0]?.url };
}

function artistFromRaw(a: RawArtistSummary): ArtistSummary {
  return { id: a.id, uri: a.uri, name: a.name, imageUrl: a.images[0]?.url };
}

/** The user's own + followed playlists. */
export async function getPlaylists(limit = 50): Promise<PlaylistSummary[]> {
  const data = await getSpotify<{ items: (RawOwnedCollection | null)[] }>(`/me/playlists?limit=${limit}`);
  return (data?.items ?? []).filter((p): p is RawOwnedCollection => p !== null).map(playlistFromRaw);
}

export async function getPlaylistTracks(playlistId: string, limit = 100): Promise<SavedTrack[]> {
  const data = await getSpotify<{ items: { track: RawTrack | null }[] }>(
    `/playlists/${encodeURIComponent(playlistId)}/tracks?limit=${limit}`,
  );
  return (data?.items ?? []).filter((i): i is { track: RawTrack } => i.track !== null).map((i) => trackFromRaw(i.track));
}

/** The user's saved albums. */
export async function getSavedAlbums(limit = 50): Promise<AlbumSummary[]> {
  const data = await getSpotify<{ items: { album: RawAlbumSummary }[] }>(`/me/albums?limit=${limit}`);
  return (data?.items ?? []).map((i) => albumFromRaw(i.album));
}

// The album-tracks endpoint's track objects don't carry `album` (it's
// already known context), so the cover art has to come from the caller.
export async function getAlbumTracks(albumId: string, albumArtUrl: string | undefined, limit = 50): Promise<SavedTrack[]> {
  const data = await getSpotify<{ items: Omit<RawTrack, "album">[] }>(`/albums/${encodeURIComponent(albumId)}/tracks?limit=${limit}`);
  return (data?.items ?? []).map((t) => ({
    uri: t.uri,
    trackName: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    albumArtUrl,
  }));
}

/** The artists the user follows. */
export async function getFollowedArtists(limit = 50): Promise<ArtistSummary[]> {
  const data = await getSpotify<{ artists: { items: RawArtistSummary[] } }>(`/me/following?type=artist&limit=${limit}`);
  return (data?.artists.items ?? []).map(artistFromRaw);
}

// Not part of the API surface Spotify restricted to extended-quota apps in
// late 2024 (that was Recommendations/Related Artists/Audio Features and a
// few others) as far as this was written against - if this ever comes back
// empty for every artist, that's the first thing to check.
export async function getArtistTopTracks(artistId: string): Promise<SavedTrack[]> {
  const data = await getSpotify<{ tracks: RawTrack[] }>(`/artists/${encodeURIComponent(artistId)}/top-tracks?market=from_token`);
  return (data?.tracks ?? []).map((t) => trackFromRaw(t));
}

const EMPTY_SEARCH_RESULTS: SearchResults = { tracks: [], albums: [], artists: [], playlists: [] };

export async function search(query: string): Promise<SearchResults> {
  const trimmed = query.trim();
  if (!trimmed) return EMPTY_SEARCH_RESULTS;

  const data = await getSpotify<{
    tracks?: { items: RawTrack[] };
    albums?: { items: RawAlbumSummary[] };
    artists?: { items: RawArtistSummary[] };
    playlists?: { items: (RawOwnedCollection | null)[] };
  }>(`/search?type=track,album,artist,playlist&limit=8&q=${encodeURIComponent(trimmed)}`);

  if (!data) return EMPTY_SEARCH_RESULTS;

  return {
    tracks: (data.tracks?.items ?? []).map((t) => trackFromRaw(t)),
    albums: (data.albums?.items ?? []).map(albumFromRaw),
    artists: (data.artists?.items ?? []).map(artistFromRaw),
    playlists: (data.playlists?.items ?? []).filter((p): p is RawOwnedCollection => p !== null).map(playlistFromRaw),
  };
}
