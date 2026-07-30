import { useState } from "react";
import { THEME_COLOR_FIELDS, THEME_PRESETS } from "../styles/themes";
import { getThemeState, setCustomColor, setPreset, type ThemeState } from "./themeStore";
import "./ThemeSettings.css";

/** Preset picker + (when "Custom" is selected) a per-color editor. Changes
 * apply immediately via themeStore's applyTheme - no save button. */
export function ThemeSettings() {
  const [theme, setTheme] = useState<ThemeState>(() => getThemeState());

  return (
    <div className="theme-settings">
      <div className="theme-settings__presets">
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`theme-settings__preset ${theme.presetId === preset.id ? "theme-settings__preset--active" : ""}`}
            onClick={() => setTheme(setPreset(preset.id))}
          >
            <span className="theme-settings__swatch" style={{ background: preset.colors.bg, borderColor: preset.colors.border }}>
              <span className="theme-settings__swatch-accent" style={{ background: preset.colors.accent }} />
            </span>
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          className={`theme-settings__preset ${theme.presetId === "custom" ? "theme-settings__preset--active" : ""}`}
          onClick={() => setTheme(setPreset("custom"))}
        >
          <span className="theme-settings__swatch theme-settings__swatch--custom" />
          Custom
        </button>
      </div>

      {theme.presetId === "custom" && (
        <div className="theme-settings__colors">
          {THEME_COLOR_FIELDS.map((field) => (
            <label key={field.key} className="theme-settings__color-field">
              <input
                type="color"
                value={theme.customColors[field.key]}
                onChange={(e) => setTheme(setCustomColor(field.key, e.target.value))}
              />
              {field.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
