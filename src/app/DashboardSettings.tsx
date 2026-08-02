import { Overlay } from "../shared/Overlay";
import { WIDGETS, getDefaultSettings } from "./widgets.config";
import {
  updateWidgetSettings,
  type DashboardSettings as SettingsMap,
  type SizeMode,
  type VisibilityMode,
  type WidgetUserSettings,
} from "./dashboardSettingsStore";
import { ThemeSettings } from "./ThemeSettings";
import { UpdateSettings } from "./UpdateSettings";
import { GeneralSettings } from "./GeneralSettings";
import "./DashboardSettings.css";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

interface Props {
  settings: SettingsMap;
  onChange: (next: SettingsMap) => void;
  onClose: () => void;
}

/** Per-widget visibility (always / scheduled / hidden), schedule, and size
 * mode - the runtime counterpart to widgets.config.ts's static defaults.
 * The actual size/position values are drag-driven on the dashboard itself
 * (see WidgetCell.tsx / FreeWidgetCell.tsx) - this panel only picks which
 * of the two drag interactions a widget uses. */
export function DashboardSettings({ settings, onChange, onClose }: Props) {
  const defaults = getDefaultSettings();

  function patch(id: string, p: Partial<WidgetUserSettings>) {
    onChange(updateWidgetSettings(id, p, defaults));
  }

  function toggleDay(id: string, day: number) {
    const current = settings[id].schedule.days;
    const days = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
    patch(id, { schedule: { ...settings[id].schedule, days } });
  }

  return (
    <Overlay onClose={onClose} panelClassName="dashboard-settings-overlay">
      <section className="dashboard-settings">
        <header className="dashboard-settings__header">
          <h2 className="dashboard-settings__title">Dashboard settings</h2>
          <button type="button" className="dashboard-settings__close" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </header>

        <div className="dashboard-settings__body">
          <div className="dashboard-settings__row">
            <div className="dashboard-settings__widget-name">Appearance</div>
            <ThemeSettings />
          </div>

          <div className="dashboard-settings__row">
            <div className="dashboard-settings__widget-name">Software update</div>
            <UpdateSettings />
          </div>

          <div className="dashboard-settings__row">
            <div className="dashboard-settings__widget-name">General</div>
            <GeneralSettings />
          </div>

          {WIDGETS.map((widget) => {
            const s = settings[widget.id];
            if (!s) return null;

            return (
              <div key={widget.id} className="dashboard-settings__row">
                <div className="dashboard-settings__widget-name">{widget.label}</div>

                <div className="dashboard-settings__controls">
                  <label className="dashboard-settings__field">
                    Visibility
                    <select
                      value={s.visibility}
                      onChange={(e) => patch(widget.id, { visibility: e.target.value as VisibilityMode })}
                    >
                      <option value="always">Always shown</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </label>

                  <label className="dashboard-settings__field">
                    Size
                    <select
                      value={s.sizeMode}
                      onChange={(e) => patch(widget.id, { sizeMode: e.target.value as SizeMode })}
                    >
                      <option value="grid">Snap to grid</option>
                      <option value="free">Free size</option>
                    </select>
                  </label>
                </div>

                {s.visibility === "scheduled" && (
                  <div className="dashboard-settings__schedule">
                    <div className="dashboard-settings__days">
                      {DAY_LABELS.map((label, day) => (
                        <button
                          key={day}
                          type="button"
                          className={`dashboard-settings__day ${
                            s.schedule.days.includes(day) ? "dashboard-settings__day--active" : ""
                          }`}
                          onClick={() => toggleDay(widget.id, day)}
                          aria-label={
                            ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="dashboard-settings__times">
                      <input
                        type="time"
                        value={s.schedule.startTime}
                        onChange={(e) => patch(widget.id, { schedule: { ...s.schedule, startTime: e.target.value } })}
                      />
                      <span>to</span>
                      <input
                        type="time"
                        value={s.schedule.endTime}
                        onChange={(e) => patch(widget.id, { schedule: { ...s.schedule, endTime: e.target.value } })}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </Overlay>
  );
}
