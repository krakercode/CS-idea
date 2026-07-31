import { invoke } from "@tauri-apps/api/core";
import { getFavoriteArtists } from "./favoriteArtistsStore";
import type { OfTheDay } from "./types";

/**
 * Real data - Wikipedia's featured article + picture of the day
 * (src-tauri/src/of_the_day.rs, keyless), plus a Spotify "song of the day"
 * (spotify.rs::song_of_day) picked from the user's favorite artists if any
 * are configured, otherwise their own top tracks. `song` is null whenever
 * Spotify isn't connected - same "empty state, not error" as the Spotify
 * widget itself.
 */
export async function fetchOfTheDay(): Promise<OfTheDay> {
  return invoke<OfTheDay>("fetch_of_the_day", { favoriteArtists: getFavoriteArtists() });
}
