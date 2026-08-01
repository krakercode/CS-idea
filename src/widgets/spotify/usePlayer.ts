import { useEffect, useRef, useState } from "react";
import { loadSpotifySdk } from "./webPlaybackSdk";
import { getAccessToken, PLAYER_NAME } from "./spotifyService";

export interface PlayerTrack {
  name: string;
  artist: string;
  albumArtUrl?: string;
}

export interface PlayerSnapshot {
  paused: boolean;
  positionMs: number;
  durationMs: number;
  /** Client timestamp (ms) this snapshot was taken at - `positionMs` only
   * updates on real state transitions, not every second, so the UI ticks
   * position forward locally between snapshots using this. */
  timestamp: number;
  track: PlayerTrack | null;
}

export interface UsePlayerResult {
  /** True once the SDK has registered this app as a Spotify Connect device
   * (`deviceId` is set) - not the same as "something is playing". */
  ready: boolean;
  deviceId: string | null;
  state: PlayerSnapshot | null;
  error: string | null;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (ms: number) => void;
  setVolume: (volume: number) => void;
  /** Spotify's own recommendation: call this in direct response to a user
   * gesture (e.g. a "Play" click) before the first playback attempt, to
   * unlock audio on browser engines with strict autoplay policies. */
  activateElement: () => void;
}

/**
 * Owns the Spotify Web Playback SDK's Player instance for as long as
 * `enabled` is true (i.e. Spotify is connected) - mounts it, tears it down
 * on disconnect/unmount, and turns its event callbacks into React state.
 * Needs Spotify Premium; a non-Premium account surfaces as `account_error`
 * from the SDK, reported here as a plain-English message.
 */
export function usePlayer(enabled: boolean): UsePlayerResult {
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [state, setState] = useState<PlayerSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<Spotify.Player | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    loadSpotifySdk().then(() => {
      if (cancelled) return;

      const player = new window.Spotify.Player({
        name: PLAYER_NAME,
        getOAuthToken: (cb) => {
          getAccessToken().then((token) => {
            if (token) cb(token);
          });
        },
        volume: 0.5,
      });

      player.addListener("ready", ({ device_id }) => {
        if (cancelled) return;
        setDeviceId(device_id);
        setReady(true);
        setError(null);
      });

      player.addListener("not_ready", () => {
        if (cancelled) return;
        setReady(false);
      });

      player.addListener("player_state_changed", (playbackState) => {
        if (cancelled || !playbackState) return;
        const track = playbackState.track_window.current_track;
        setState({
          paused: playbackState.paused,
          positionMs: playbackState.position,
          durationMs: playbackState.duration,
          timestamp: Date.now(),
          track: track
            ? {
                name: track.name,
                artist: track.artists.map((a) => a.name).join(", "),
                albumArtUrl: track.album.images[0]?.url,
              }
            : null,
        });
      });

      player.addListener("initialization_error", ({ message }) => !cancelled && setError(message));
      player.addListener("authentication_error", ({ message }) => !cancelled && setError(message));
      player.addListener(
        "account_error",
        () => !cancelled && setError("This needs Spotify Premium - the Web Playback SDK doesn't work on Free."),
      );
      player.addListener("playback_error", ({ message }) => !cancelled && setError(message));

      player.connect();
      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
      setReady(false);
      setDeviceId(null);
      setState(null);
      setError(null);
    };
  }, [enabled]);

  return {
    ready,
    deviceId,
    state,
    error,
    togglePlay: () => void playerRef.current?.togglePlay(),
    next: () => void playerRef.current?.nextTrack(),
    previous: () => void playerRef.current?.previousTrack(),
    seek: (ms: number) => void playerRef.current?.seek(ms),
    setVolume: (volume: number) => void playerRef.current?.setVolume(volume),
    activateElement: () => void playerRef.current?.activateElement(),
  };
}
