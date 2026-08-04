import { useCallback, useEffect, useRef, useState } from "react";
import { usePolling } from "../../shared/hooks/usePolling";
import {
  getNowPlaying,
  pausePlayback,
  resumePlayback,
  seekTo,
  setPlaybackVolume,
  skipToNext,
  skipToPrevious,
  type NowPlaying,
} from "./spotifyService";

const POLL_INTERVAL_MS = 5_000;

export interface UseNowPlayingResult {
  state: NowPlaying | null;
  /** Set when the background poll itself fails (e.g. a missing scope). */
  error: string | null;
  /** Set when a transport action (play/pause/skip/seek/volume) fails -
   * kept separate from `error` since it means something different: the
   * poll succeeding but the last button press didn't. */
  controlError: string | null;
  loading: boolean;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (ms: number) => void;
  setVolume: (percent: number) => void;
}

/**
 * Polls `/me/player` for whatever's currently playing on the user's active
 * Spotify device (phone, desktop app, browser tab - never this app itself,
 * see spotifyService.ts's `NoActiveDeviceError` doc comment for why) and
 * exposes remote-control actions. Every control action re-triggers an
 * immediate poll afterwards so the UI reflects the change without waiting
 * out the full interval.
 */
export function useNowPlaying(enabled: boolean): UseNowPlayingResult {
  const { data, error, loading, refresh } = usePolling(
    useCallback(() => (enabled ? getNowPlaying() : Promise.resolve(null)), [enabled]),
    POLL_INTERVAL_MS,
  );
  const [controlError, setControlError] = useState<string | null>(null);

  // usePolling's very first fetch fires synchronously on mount - before
  // `enabled` (driven by SpotifyWidget's async isConnected() check one
  // level up) has had a chance to flip from false to true. That first
  // fetch sees `enabled === false`, resolves to null immediately, and
  // nothing re-fetches until the next scheduled tick - so the widget shows
  // "Nothing playing" for up to a full POLL_INTERVAL_MS after Spotify
  // actually connects, every time (confirmed via a headless-browser
  // timing test, not assumed). Explicitly refreshing right when `enabled`
  // transitions to true closes that gap without touching usePolling's
  // shared mount/interval logic at all - other widgets using it are
  // unaffected.
  const wasEnabled = useRef(enabled);
  useEffect(() => {
    if (enabled && !wasEnabled.current) refresh();
    wasEnabled.current = enabled;
  }, [enabled, refresh]);

  function runAndRefresh(action: () => Promise<void>) {
    setControlError(null);
    action()
      .then(refresh)
      .catch((err: unknown) => setControlError(err instanceof Error ? err.message : "Couldn't do that."));
  }

  return {
    state: data,
    error,
    controlError,
    loading,
    togglePlay: () => runAndRefresh(data?.paused === false ? pausePlayback : resumePlayback),
    next: () => runAndRefresh(skipToNext),
    previous: () => runAndRefresh(skipToPrevious),
    seek: (ms: number) => runAndRefresh(() => seekTo(ms)),
    setVolume: (percent: number) => runAndRefresh(() => setPlaybackVolume(percent)),
  };
}
