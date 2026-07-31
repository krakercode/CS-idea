import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";

/**
 * Wraps @tauri-apps/plugin-updater. Update artifacts are only produced (and
 * signed) by the release workflow (.github/workflows/release.yml) - see
 * README's "Releasing & auto-updates" section for how the signing key and
 * GitHub Releases endpoint fit together.
 *
 * `checkForUpdate` deliberately does NOT swallow errors the way the other
 * *Service modules do - a failed check (network error, private-repo 404,
 * bad signature, whatever) needs to reach UpdateSettings as a distinct
 * "couldn't check" state, not get flattened into the same `null` result as
 * a genuine "you're already up to date". Only version display is soft-failed
 * (falls back to "dev"), since that's just a label, not a decision.
 */

export async function getCurrentVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return "dev";
  }
}

export async function checkForUpdate(): Promise<Update | null> {
  return check();
}

/** Downloads and installs the given update, then restarts the app to apply
 * it. `onProgress` reports 0-100 based on bytes downloaded, when the update
 * server provides a content length (not all do). */
export async function installUpdate(update: Update, onProgress?: (percent: number) => void): Promise<void> {
  let downloaded = 0;
  let total = 0;

  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? 0;
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      if (total > 0) onProgress?.(Math.min(100, Math.round((downloaded / total) * 100)));
    }
  });

  await relaunch();
}
