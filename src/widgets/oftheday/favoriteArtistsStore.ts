const STORAGE_KEY = "of-the-day-favorite-artists";
const MAX_ARTISTS = 10;

/**
 * User-entered favorite artists/interests, used to personalize the "Song
 * of the Day" pick (see src-tauri/src/spotify.rs::song_of_day) - when this
 * list is non-empty, a deterministic-per-day artist from it is searched on
 * Spotify instead of falling back to the user's top tracks. Same
 * localStorage tag-chip pattern as News' keywords / Stocks' watchlist.
 */
export function getFavoriteArtists(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((a): a is string => typeof a === "string") : [];
  } catch {
    return [];
  }
}

function saveArtists(artists: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(artists));
  } catch {
    // Best-effort - e.g. localStorage disabled/full. Keeps working for the
    // current session, it just won't persist.
  }
}

export function addFavoriteArtist(artist: string): string[] {
  const trimmed = artist.trim();
  const current = getFavoriteArtists();
  if (!trimmed || current.length >= MAX_ARTISTS) return current;
  if (current.some((a) => a.toLowerCase() === trimmed.toLowerCase())) return current;

  const next = [...current, trimmed];
  saveArtists(next);
  return next;
}

export function removeFavoriteArtist(artist: string): string[] {
  const next = getFavoriteArtists().filter((a) => a !== artist);
  saveArtists(next);
  return next;
}

export { MAX_ARTISTS };
