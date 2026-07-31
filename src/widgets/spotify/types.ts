export interface SavedTrack {
  uri: string;
  trackName: string;
  artist: string;
  albumArtUrl?: string;
}

export interface SpotifyProvider {
  isConnected(): Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
