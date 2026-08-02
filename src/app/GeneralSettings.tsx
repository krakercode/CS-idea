import { useEffect, useState } from "react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import "./GeneralSettings.css";

/** App-wide toggles that don't belong to any one widget. Applies
 * immediately, same as ThemeSettings - no save button. Currently just
 * run-on-startup; sound settings will land here too once audio exists. */
export function GeneralSettings() {
  const [autostart, setAutostart] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    isEnabled()
      .then(setAutostart)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggleAutostart() {
    const next = !autostart;
    setAutostart(next);
    try {
      if (next) await enable();
      else await disable();
    } catch {
      // Revert on failure - e.g. a blocked registry write.
      setAutostart(!next);
    }
  }

  return (
    <div className="general-settings">
      <label className="general-settings__toggle">
        <input type="checkbox" checked={autostart} disabled={loading} onChange={toggleAutostart} />
        Launch JESSPR-EAST when Windows starts
      </label>
    </div>
  );
}
