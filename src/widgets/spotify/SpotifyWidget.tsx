import { usePolling } from "../../shared/hooks/usePolling";
import { WidgetShell } from "../../shared/WidgetShell";
import { getSpotifyProvider } from "./spotifyService";
import type { NowPlaying } from "./types";
import "./SpotifyWidget.css";

const REFRESH_INTERVAL_MS = 3_000;

interface SpotifyState {
  connected: boolean;
  nowPlaying: NowPlaying | null;
}

async function fetchSpotifyState(): Promise<SpotifyState> {
  const provider = getSpotifyProvider();
  const connected = await provider.isConnected();
  const nowPlaying = connected ? await provider.getNowPlaying() : null;
  return { connected, nowPlaying };
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function SpotifyWidget() {
  const { data, loading, error, refresh } = usePolling(fetchSpotifyState, REFRESH_INTERVAL_MS);

  const handleConnect = async () => {
    await getSpotifyProvider().connect();
    refresh();
  };

  const handleDisconnect = async () => {
    await getSpotifyProvider().disconnect();
    refresh();
  };

  return (
    <WidgetShell title="Spotify" loading={loading} error={error} onRefresh={refresh}>
      {data && !data.connected && (
        <div className="spotify-widget__disconnected">
          <p>Not connected.</p>
          <button type="button" className="spotify-widget__connect" onClick={handleConnect}>
            Connect Spotify
          </button>
        </div>
      )}

      {data?.connected && data.nowPlaying && (
        <div className="spotify-widget__now-playing">
          <div className="spotify-widget__track">{data.nowPlaying.trackName}</div>
          <div className="spotify-widget__artist">
            {data.nowPlaying.artist} · {data.nowPlaying.albumName}
          </div>
          <div className="spotify-widget__progress-bar">
            <div
              className="spotify-widget__progress-fill"
              style={{ width: `${(data.nowPlaying.progressMs / data.nowPlaying.durationMs) * 100}%` }}
            />
          </div>
          <div className="spotify-widget__times">
            <span>{formatMs(data.nowPlaying.progressMs)}</span>
            <span>{formatMs(data.nowPlaying.durationMs)}</span>
          </div>
          <button type="button" className="spotify-widget__disconnect" onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      )}
    </WidgetShell>
  );
}
