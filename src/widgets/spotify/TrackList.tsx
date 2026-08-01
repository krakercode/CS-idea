import type { SavedTrack } from "./types";

interface Props {
  tracks: SavedTrack[];
  playingUri: string | null;
  /** True while a different playback action (e.g. "Play all") is already
   * in flight - disables every row's button rather than just the one
   * matching `playingUri`, since only one playback-control request can be
   * in flight at a time (see spotifyService.ts's controlPlayback). */
  busy?: boolean;
  onPlay: (uri: string) => void;
}

/** Shared track-row renderer - Liked Songs, a playlist/album/artist's
 * tracks once drilled into, and search's track results all look the same. */
export function TrackList({ tracks, playingUri, busy, onPlay }: Props) {
  return (
    <ul className="spotify-widget__library-list">
      {tracks.map((t) => (
        <li key={t.uri} className="spotify-widget__library-row">
          {t.albumArtUrl && <img src={t.albumArtUrl} alt="" className="spotify-widget__library-art" />}
          <div className="spotify-widget__library-info">
            <span className="spotify-widget__library-title">{t.trackName}</span>
            <span className="spotify-widget__library-artist">{t.artist}</span>
          </div>
          <button
            type="button"
            className="spotify-widget__library-play"
            onClick={() => onPlay(t.uri)}
            disabled={busy || playingUri === t.uri}
            title="Play here"
            aria-label={`Play ${t.trackName}`}
          >
            {playingUri === t.uri ? "…" : "▶"}
          </button>
        </li>
      ))}
    </ul>
  );
}
