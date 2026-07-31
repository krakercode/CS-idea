import { useEffect, useMemo, useState } from "react";
import { WIDGETS, getDefaultSettings, type WidgetDefinition } from "./widgets.config";
import {
  getAllSettings,
  getWidgetOrder,
  isWidgetVisibleNow,
  saveWidgetOrder,
  updateWidgetSettings,
  type DashboardSettings as SettingsMap,
} from "./dashboardSettingsStore";
import { DashboardSettings } from "./DashboardSettings";
import { WidgetCell } from "./WidgetCell";
import "./Dashboard.css";

// How often to re-check schedules against the clock, so a "scheduled"
// widget appears/disappears on its own without needing a page reload.
const RECHECK_INTERVAL_MS = 60_000;

export function Dashboard() {
  const defaults = useMemo(() => getDefaultSettings(), []);
  const allIds = useMemo(() => WIDGETS.map((w) => w.id), []);
  const [settings, setSettings] = useState<SettingsMap>(() => getAllSettings(defaults));
  const [order, setOrder] = useState<string[]>(() => getWidgetOrder(allIds));
  const [now, setNow] = useState(() => new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), RECHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const byId = useMemo(() => new Map(WIDGETS.map((w) => [w.id, w] as const)), []);
  const orderedWidgets = order.map((id) => byId.get(id)).filter((w): w is WidgetDefinition => !!w);
  const visibleWidgets = orderedWidgets.filter((w) => isWidgetVisibleNow(settings[w.id], now));

  function handleResize(widgetId: string, colSpan: 1 | 2 | 3, rowSpan: 1 | 2) {
    setSettings(updateWidgetSettings(widgetId, { colSpan, rowSpan }, defaults));
  }

  function handleDrop(targetId: string) {
    setDragOverId(null);
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    setOrder((current) => {
      const next = current.filter((id) => id !== draggedId);
      const targetIndex = next.indexOf(targetId);
      next.splice(targetIndex, 0, draggedId);
      saveWidgetOrder(next);
      return next;
    });
    setDraggedId(null);
  }

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
        {visibleWidgets.map((widget) => (
          <WidgetCell
            key={widget.id}
            widget={widget}
            colSpan={settings[widget.id].colSpan}
            rowSpan={settings[widget.id].rowSpan}
            isDragOver={dragOverId === widget.id && draggedId !== widget.id}
            onResize={(colSpan, rowSpan) => handleResize(widget.id, colSpan, rowSpan)}
            onDragStart={() => setDraggedId(widget.id)}
            onDragEnd={() => {
              setDraggedId(null);
              setDragOverId(null);
            }}
            onDragOver={() => setDragOverId(widget.id)}
            onDragLeave={() => setDragOverId((current) => (current === widget.id ? null : current))}
            onDrop={() => handleDrop(widget.id)}
          />
        ))}
      </div>

      {settingsOpen && (
        <DashboardSettings settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
