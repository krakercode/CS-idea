// Field names are camelCase to match the JSON serde emits from
// src-tauri/src/of_the_day.rs and spotify.rs's SongOfDay verbatim.

export interface FeaturedArticle {
  title: string;
  extract: string;
  thumbnailUrl?: string;
  pageUrl: string;
}

export interface PictureOfDay {
  title: string;
  imageUrl: string;
  description?: string;
}

export interface SongOfDay {
  trackName: string;
  artist: string;
  albumArtUrl?: string;
  externalUrl?: string;
}

export interface OfTheDay {
  article: FeaturedArticle | null;
  picture: PictureOfDay | null;
  song: SongOfDay | null;
}
