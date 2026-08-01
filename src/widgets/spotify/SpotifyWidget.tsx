import { type MouseEvent, useEffect, useState } from "react";
import { WidgetShell } from "../../shared/WidgetShell";
import { ViewSwitcher } from "../../shared/ViewSwitcher";
import { useWidgetViews } from "../../shared/useWidgetViews";
import { getSpotifyProvider } from "./spotifyService";
import { useNowPlaying } from "./useNowPlaying";
import { LibraryView } from "./LibraryView";
import "./SpotifyWidget.css";

const VIEWS = [
  { id: "player", label: "Player" },
  { id: "library", label: "Library" },
];

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function SpotifyWidget() {
  const [connected, setConnected] = useState<boolean | null>(null); // null = still checking
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const { activeId, setActiveId, next: nextView, prev: prevView } = useWidgetViews(VIEWS);
  const player = useNowPlaying(connected === true);
  // Ticks once a second so the progress bar advances between polls, which
  // only happen every few seconds (see useNowPlaying.ts).
  const [, setTick] = useState(0);

  useEffect(() => {
    getSpotifyProvider().isConnected().then(setConnected);
  }, []);

  useEffect(() => {
    if (!player.state || player.state.paused) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [player.state === null, player.state?.paused]);

  async function handleConnect() {
    setConnecting(true);
    setConnectError(null);
    try {
      await getSpotifyProvider().connect();
      setConnected(true);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Couldn't connect to Spotify.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    await getSpotifyProvider().disconnect();
    setConnected(false);
  }

  function handleSeekClick(e: MouseEvent<HTMLDivElement>) {
    if (!player.state) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    player.seek(Math.round(ratio * player.state.durationMs));
  }

  const displayedPositionMs = player.state
    ? Math.min(
        player.state.durationMs,
        player.state.positionMs + (player.state.paused ? 0 : Date.now() - player.state.timestamp),
      )
    : 0;

  const headerActions = connected ? (
    <ViewSwitcher views={VIEWS} activeId={activeId} onSelect={setActiveId} onNext={nextView} onPrev={prevView} />
  ) : undefined;

  return (
    <WidgetShell title="Spotify" loading={connected === null} error={null} headerActions={headerActions}>
      {connected === false && (
        <div className="spotify-widget__disconnected">
          <p>Not connected.</p>
          <button type="button" className="spotify-widget__connect" onClick={handleConnect} disabled={connecting}>
            {connecting ? "Waiting for approval in your browser…" : "Connect Spotify"}
          </button>
          {connectError && <p className="spotify-widget__error">{connectError}</p>}
        </div>
      )}

      {connected && activeId === "player" && (
        <div className="spotify-widget__player">
          {player.error && <p className="spotify-widget__error">{player.error}</p>}
          {player.controlError && <p className="spotify-widget__error">{player.controlError}</p>}

          {!player.error && player.loading && <p className="spotify-widget__empty">Checking what's playing…</p>}

          {!player.error && !player.loading && !player.state?.track && (
            <p className="spotify-widget__empty">
              Nothing playing - open Spotify on your phone, computer, or spotify.com, then control it from here.
            </p>
          )}

          {player.state?.track && (
            <div className="spotify-widget__now-playing">
              {player.state.track.albumArtUrl && (
                <img src={player.state.track.albumArtUrl} alt="" className="spotify-widget__art" />
              )}
              <div className="spotify-widget__track">{player.state.track.name}</div>
              <div className="spotify-widget__artist">{player.state.track.artist}</div>
              <div className="spotify-widget__device">Playing on {player.state.deviceName}</div>

              <div className="spotify-widget__progress-bar" onClick={handleSeekClick}>
                <div
                  className="spotify-widget__progress-fill"
                  style={{ width: `${Math.min(100, (displayedPositionMs / (player.state.durationMs || 1)) * 100)}%` }}
                />
              </div>
              <div className="spotify-widget__times">
                <span>{formatMs(displayedPositionMs)}</span>
                <span>{formatMs(player.state.durationMs)}</span>
              </div>

              <div className="spotify-widget__transport">
                <button type="button" onClick={player.previous} aria-label="Previous track">
                  ⏮
                </button>
                <button type="button" onClick={player.togglePlay} aria-label={player.state.paused ? "Play" : "Pause"}>
                  {player.state.paused ? "▶" : "⏸"}
                </button>
                <button type="button" onClick={player.next} aria-label="Next track">
                  ⏭
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={player.state.volumePercent ?? 50}
                  className="spotify-widget__volume"
                  onChange={(e) => player.setVolume(Number(e.target.value))}
                  aria-label="Volume"
                />
              </div>
            </div>
          )}

          <button type="button" className="spotify-widget__disconnect" onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      )}

      {connected && activeId === "library" && <LibraryView />}
    </WidgetShell>
  );
}
