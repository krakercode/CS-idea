import type { SavedTrack } from "./types";

interface Props {
  tracks: SavedTrack[];
  deviceId: string | null;
  playingUri: string | null;
  onPlay: (uri: string) => void;
}

/** Shared track-row renderer - Liked Songs, a playlist/album/artist's
 * tracks once drilled into, and search's track results all look the same. */
export function TrackList({ tracks, deviceId, playingUri, onPlay }: Props) {
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
            disabled={!deviceId || playingUri === t.uri}
            title={deviceId ? "Play here" : "Player isn't ready yet"}
            aria-label={`Play ${t.trackName}`}
          >
            {playingUri === t.uri ? "…" : "▶"}
          </button>
        </li>
      ))}
    </ul>
  );
}
