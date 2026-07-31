const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";

let loadPromise: Promise<void> | null = null;

/**
 * Loads Spotify's Web Playback SDK script once (idempotent across repeated
 * calls/hook remounts) and resolves once `window.Spotify` is actually
 * populated - the script itself only calls `onSpotifyWebPlaybackSDKReady`
 * asynchronously after it finishes initializing, not on script `load`.
 */
export function loadSpotifySdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    document.body.appendChild(script);
  });
  return loadPromise;
}
