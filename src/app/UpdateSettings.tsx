import { useEffect, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { checkForUpdate, getCurrentVersion, installUpdate } from "./updateService";
import "./UpdateSettings.css";

type Status = "idle" | "checking" | "up-to-date" | "available" | "installing" | "error";

/** Manual "check for updates" control plus current version display. Actual
 * update artifacts only exist once a version has gone through the release
 * workflow (see README) - in dev, or if the update endpoint is unreachable,
 * checking just fails soft back to "idle". */
export function UpdateSettings() {
  const [version, setVersion] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    getCurrentVersion().then(setVersion);
  }, []);

  async function handleCheck() {
    setStatus("checking");
    try {
      const found = await checkForUpdate();
      setUpdate(found);
      setStatus(found ? "available" : "up-to-date");
    } catch {
      setStatus("error");
    }
  }

  async function handleInstall() {
    if (!update) return;
    setStatus("installing");
    setProgress(0);
    try {
      await installUpdate(update, setProgress);
      // installUpdate relaunches the app on success - nothing left to do here.
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="update-settings">
      <div className="update-settings__version">Version {version || "…"}</div>

      {status !== "available" && status !== "installing" && (
        <button type="button" onClick={handleCheck} disabled={status === "checking"}>
          {status === "checking" ? "Checking…" : "Check for updates"}
        </button>
      )}

      {status === "up-to-date" && <p className="update-settings__status">You're up to date.</p>}
      {status === "error" && <p className="update-settings__status update-settings__status--error">Couldn't check for updates right now.</p>}

      {status === "available" && update && (
        <div className="update-settings__available">
          <p className="update-settings__status">
            Version {update.version} is available{update.date ? ` (${update.date})` : ""}.
          </p>
          {update.body && <p className="update-settings__notes">{update.body}</p>}
          <button type="button" onClick={handleInstall}>
            Download &amp; install
          </button>
        </div>
      )}

      {status === "installing" && (
        <p className="update-settings__status">
          Installing… {progress > 0 ? `${progress}%` : ""} The app will restart automatically once done.
        </p>
      )}
    </div>
  );
}
