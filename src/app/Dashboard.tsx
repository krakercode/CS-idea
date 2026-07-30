import { Suspense, useEffect, useMemo, useState } from "react";
import { WIDGETS, getDefaultSettings } from "./widgets.config";
import { getAllSettings, isWidgetVisibleNow, type DashboardSettings as SettingsMap } from "./dashboardSettingsStore";
import { DashboardSettings } from "./DashboardSettings";
import "./Dashboard.css";

// How often to re-check schedules against the clock, so a "scheduled"
// widget appears/disappears on its own without needing a page reload.
const RECHECK_INTERVAL_MS = 60_000;

export function Dashboard() {
  const defaults = useMemo(() => getDefaultSettings(), []);
  const [settings, setSettings] = useState<SettingsMap>(() => getAllSettings(defaults));
  const [now, setNow] = useState(() => new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), RECHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="dashboard-root">
      <button
        type="button"
        className="dashboard__settings-button"
        onClick={() => setSettingsOpen(true)}
        title="Dashboard settings"
        aria-label="Dashboard settings"
      >
        ⚙
      </button>

      <div className="dashboard">
        {WIDGETS.filter((w) => isWidgetVisibleNow(settings[w.id], now)).map(({ id, Component }) => {
          const widgetSettings = settings[id];
          return (
            <div
              key={id}
              className="dashboard__cell"
              style={{ gridColumn: `span ${widgetSettings.colSpan}`, gridRow: `span ${widgetSettings.rowSpan}` }}
            >
              <Suspense fallback={<div className="dashboard__widget-fallback" />}>
                <Component />
              </Suspense>
            </div>
          );
        })}
      </div>

      {settingsOpen && (
        <DashboardSettings settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
