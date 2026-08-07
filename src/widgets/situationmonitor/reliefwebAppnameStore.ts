const STORAGE_KEY = "situation-monitor-reliefweb-appname";

/**
 * ReliefWeb's "appname" isn't a secret credential (their own docs: it
 * "allows ReliefWeb to monitor API usage," not authentication) - unlike
 * PandaScore/Spotify's real per-account secrets, so plain localStorage is
 * fine here rather than the Tauri store plugin those use.
 */
export function getReliefWebAppname(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setReliefWebAppname(appname: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, appname.trim());
  } catch {
    // Best-effort - e.g. localStorage disabled/full.
  }
}
