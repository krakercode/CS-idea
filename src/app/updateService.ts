import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";

/**
 * Wraps @tauri-apps/plugin-updater. Update artifacts are only produced (and
 * signed) by the release workflow (.github/workflows/release.yml) - see
 * README's "Releasing & auto-updates" section for how the signing key and
 * GitHub Releases endpoint fit together.
 *
 * Like the other *Service modules, this fails soft rather than throwing when
 * there's no real Tauri runtime to talk to (e.g. `vite dev` in a plain
 * browser tab), so it's safe to call from anywhere without special-casing
 * dev mode.
 */

export async function getCurrentVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return "dev";
  }
}

export async function checkForUpdate(): Promise<Update | null> {
  try {
    return await check();
  } catch {
    return null;
  }
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
