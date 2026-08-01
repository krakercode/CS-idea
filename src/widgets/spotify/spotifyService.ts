import { invoke } from "@tauri-apps/api/core";
import type { AlbumSummary, ArtistSummary, PlaylistSummary, SavedTrack, SearchResults, SpotifyProvider } from "./types";

/**
 * Real integration - Spotify's Authorization Code + PKCE flow, run entirely
 * on the Rust side (src-tauri/src/spotify.rs) so tokens never sit in
 * localStorage. `connect()` opens the system browser to Spotify's login
 * page and resolves once the redirect's been caught and tokens saved.
 *
 * Everything below `getAccessToken` is NOT part of the SpotifyProvider
 * abstraction - it's specific to the Web Playback SDK integration
 * (usePlayer.ts, LibraryView.tsx), which needs a real access token in the
 * browser context (see spotify.rs::get_access_token's doc comment for why
 * that's a deliberate, narrow exception). Once that exception exists,
 * browsing endpoints (playlists/albums/artists/search) are plain fetch()
 * calls straight from here rather than one-to-one Rust command wrappers -
 * `saved_tracks` stayed in Rust from before this was the pattern, but
 * there's no reason to keep growing the Rust side for read-only browsing
 * that has to end up authenticated in the browser anyway for playback.
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

/** Must match the `name` the SDK is initialized with (usePlayer.ts) -
 * `findLiveDeviceId` below matches on this to find our device in Spotify's
 * live device list. */
export const PLAYER_NAME = "JESSPR-EAST";

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

interface RawDevice {
  id: string;
  name: string;
}

// A device only just registered via the Web Playback SDK's `ready` event
// isn't always immediately visible to the Web API yet (a real, observed
// cause of "couldn't switch playback here" 404s), and separately, a
// `deviceId` cached from that event can go stale later if the SDK's
// connection drops and re-establishes without us noticing - a stale id
// 404s every single request that targets it, no matter how many times
// that request is retried. Looking the live id up fresh right before each
// playback action - by name, not by trusting a cached value - avoids both
// problems at once. Retries the lookup itself (not the play/transfer
// calls) since that's what actually needs time to catch up.
const DEVICE_LOOKUP_RETRY_DELAYS_MS = [0, 400, 900, 1500];

async function findLiveDeviceId(token: string): Promise<string | null> {
  for (const delay of DEVICE_LOOKUP_RETRY_DELAYS_MS) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    const response = await fetchWithTimeout(`${SPOTIFY_API}/me/player/devices`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const data = (await response.json()) as { devices: RawDevice[] };
      const match = data.devices.find((d) => d.name === PLAYER_NAME);
      if (match) return match.id;
    }
  }
  return null;
}

// Prevents overlapping playback requests entirely - a user re-clicking a
// broken "Play"/"Play all" button out of frustration used to fire a fresh
// transfer+play sequence on every click with nothing stopping them from
// piling up concurrently, which is both wasted network traffic and a good
// way to make the underlying problem harder to diagnose (racing transfer
// calls can plausibly cause their own spurious 404s). One playback action
// at a time, full stop.
let playbackActionInFlight = false;

/** Makes this app's Web Playback SDK device the active one and starts
 * playback with the given request body - plain browser fetch() against
 * Spotify's Web API, same as the SDK's own examples do it, no Rust command
 * involved. Explicitly transfers playback to the device first rather than
 * relying on `/me/player/play`'s own `device_id` param to do that
 * implicitly - in practice that's the more reliable order and matches
 * Spotify's own Web Playback SDK examples. */
async function transferAndPlay(body: Record<string, unknown>): Promise<void> {
  if (playbackActionInFlight) {
    throw new Error("Still working on the last playback request - give it a moment.");
  }
  playbackActionInFlight = true;

  try {
    const token = await getAccessToken();
    if (!token) throw new Error("Not connected to Spotify.");

    const liveDeviceId = await findLiveDeviceId(token);
    if (!liveDeviceId) {
      throw new Error("Player isn't showing up as an active Spotify device right now - try reconnecting Spotify.");
    }

    const transferResponse = await fetchWithTimeout(`${SPOTIFY_API}/me/player`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ device_ids: [liveDeviceId], play: false }),
    });
    if (!transferResponse.ok && transferResponse.status !== 204) {
      throw new Error(`Spotify couldn't switch playback here (status ${transferResponse.status}).`);
    }

    const playResponse = await fetchWithTimeout(`${SPOTIFY_API}/me/player/play?device_id=${encodeURIComponent(liveDeviceId)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!playResponse.ok && playResponse.status !== 204) {
      throw new Error(`Spotify couldn't start playback (status ${playResponse.status}).`);
    }
  } finally {
    playbackActionInFlight = false;
  }
}

/** Plays a single track by URI - used for "Liked Songs" and search-result
 * tracks, which aren't part of any browsable context. `deviceId` is only
 * used as a fast client-side check (no point making any network call if
 * the SDK never even reported `ready`) - the actual playback calls always
 * look up a fresh device id themselves, see `transferAndPlay`. */
export async function playTrackHere(deviceId: string | null, uri: string): Promise<void> {
  if (!deviceId) throw new Error("Player isn't ready yet.");
  await transferAndPlay({ uris: [uri] });
}

/** Plays a playlist/album/artist as a context, optionally starting from a
 * specific track within it (`offsetUri`) - unlike `playTrackHere`, this
 * lets Spotify continue naturally into the rest of the playlist/album
 * afterwards instead of stopping after one track. */
export async function playContextHere(deviceId: string | null, contextUri: string, offsetUri?: string): Promise<void> {
  if (!deviceId) throw new Error("Player isn't ready yet.");
  await transferAndPlay(offsetUri ? { context_uri: contextUri, offset: { uri: offsetUri } } : { context_uri: contextUri });
}

async function getSpotify<T>(path: string): Promise<T | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const response = await fetchWithTimeout(`${SPOTIFY_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
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
