export interface SavedTrack {
  uri: string;
  trackName: string;
  artist: string;
  albumArtUrl?: string;
}

export interface PlaylistSummary {
  id: string;
  uri: string;
  name: string;
  imageUrl?: string;
  owner: string;
  trackCount: number;
}

export interface AlbumSummary {
  id: string;
  uri: string;
  name: string;
  artist: string;
  imageUrl?: string;
}

export interface ArtistSummary {
  id: string;
  uri: string;
  name: string;
  imageUrl?: string;
}

export interface SearchResults {
  tracks: SavedTrack[];
  albums: AlbumSummary[];
  artists: ArtistSummary[];
  playlists: PlaylistSummary[];
}

export interface SpotifyProvider {
  isConnected(): Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
