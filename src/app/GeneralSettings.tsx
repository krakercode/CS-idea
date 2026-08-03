import { useEffect, useState, type ChangeEvent } from "react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { getSoundSettings, setSoundEnabled, setSoundVolume } from "../shared/sound";
import "./GeneralSettings.css";

/** App-wide toggles that don't belong to any one widget. Applies
 * immediately, same as ThemeSettings - no save button. */
export function GeneralSettings() {
  const [autostart, setAutostart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState(() => getSoundSettings());

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

  function toggleSoundEnabled() {
    setSound(setSoundEnabled(!sound.enabled));
  }

  function handleVolumeChange(e: ChangeEvent<HTMLInputElement>) {
    setSound(setSoundVolume(Number(e.target.value) / 100));
  }

  return (
    <div className="general-settings">
      <label className="general-settings__toggle">
        <input type="checkbox" checked={autostart} disabled={loading} onChange={toggleAutostart} />
        Launch JESSPR-EAST when Windows starts
      </label>

      <label className="general-settings__toggle">
        <input type="checkbox" checked={sound.enabled} onChange={toggleSoundEnabled} />
        Enable sounds (UI clicks + theme ambience)
      </label>
      <label className="general-settings__volume">
        Volume
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(sound.volume * 100)}
          disabled={!sound.enabled}
          onChange={handleVolumeChange}
        />
      </label>
    </div>
  );
}
