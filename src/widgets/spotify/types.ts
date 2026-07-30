export interface NowPlaying {
  trackName: string;
  artist: string;
  albumName: string;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
}

export interface SpotifyProvider {
  isConnected(): Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getNowPlaying(): Promise<NowPlaying | null>;
}
