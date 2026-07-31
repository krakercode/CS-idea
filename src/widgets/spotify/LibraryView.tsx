import { useEffect, useState } from "react";
import { getSavedTracks, playTrackHere } from "./spotifyService";
import type { SavedTrack } from "./types";

const PAGE_SIZE = 50;

interface Props {
  /** Play button is disabled until the Web Playback SDK device is ready -
   * there's nowhere to route playback to until then. */
  deviceId: string | null;
  /** Called synchronously on the play button's click, before the async
   * playback request - see usePlayer.ts's activateElement doc comment. */
  onActivate: () => void;
}

export function LibraryView({ deviceId, onActivate }: Props) {
  const [tracks, setTracks] = useState<SavedTrack[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSavedTracks(PAGE_SIZE, 0).then((result) => {
      if (cancelled) return;
      setTracks(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePlay(uri: string) {
    if (!deviceId) return;
    onActivate();
    setPlayingUri(uri);
    setPlayError(null);
    try {
      await playTrackHere(deviceId, uri);
    } catch (err) {
      setPlayError(err instanceof Error ? err.message : "Couldn't start playback.");
    } finally {
      setPlayingUri(null);
    }
  }

  if (loading) return <p className="spotify-widget__empty">Loading your saved tracks…</p>;
  if (!tracks || tracks.length === 0) {
    return <p className="spotify-widget__empty">No saved tracks found.</p>;
  }

  return (
    <div>
      {playError && <p className="spotify-widget__error">{playError}</p>}
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
              onClick={() => handlePlay(t.uri)}
              disabled={!deviceId || playingUri === t.uri}
              title={deviceId ? "Play here" : "Player isn't ready yet"}
              aria-label={`Play ${t.trackName}`}
            >
              {playingUri === t.uri ? "…" : "▶"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
