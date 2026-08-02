import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
import { FreeWidgetCell } from "./FreeWidgetCell";
import "./Dashboard.css";

const FREE_CELL_BASE_Z_INDEX = 15;

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Which free-mode widget is on top - a plain incrementing counter, one
  // widget id's z-index at a time bumped above the rest whenever it's
  // clicked/dragged. Doesn't need to persist across reloads.
  const [freeZIndices, setFreeZIndices] = useState<Record<string, number>>({});
  const freeZCounter = useRef(FREE_CELL_BASE_Z_INDEX);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), RECHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    getCurrentWindow()
      .isFullscreen()
      .then(setIsFullscreen)
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "F11") {
        e.preventDefault();
        void toggleFullscreen();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /** Queries the window's live fullscreen state rather than trusting
   * `isFullscreen` React state, since the OS/window manager can also toggle
   * it outside our control (e.g. a native Escape-from-fullscreen shortcut). */
  async function toggleFullscreen() {
    const win = getCurrentWindow();
    const currentlyFullscreen = await win.isFullscreen();
    await win.setFullscreen(!currentlyFullscreen);
    setIsFullscreen(!currentlyFullscreen);
  }

  const byId = useMemo(() => new Map(WIDGETS.map((w) => [w.id, w] as const)), []);
  const orderedWidgets = order.map((id) => byId.get(id)).filter((w): w is WidgetDefinition => !!w);
  const visibleWidgets = orderedWidgets.filter((w) => isWidgetVisibleNow(settings[w.id], now));
  const gridWidgets = visibleWidgets.filter((w) => settings[w.id].sizeMode !== "free");
  const freeWidgets = visibleWidgets.filter((w) => settings[w.id].sizeMode === "free");

  function handleResize(widgetId: string, colSpan: 1 | 2 | 3, rowSpan: 1 | 2) {
    setSettings(updateWidgetSettings(widgetId, { colSpan, rowSpan }, defaults));
  }

  function handleFreeMove(widgetId: string, freeX: number, freeY: number) {
    setSettings(updateWidgetSettings(widgetId, { freeX, freeY }, defaults));
  }

  function handleFreeResize(widgetId: string, freeWidth: number, freeHeight: number) {
    setSettings(updateWidgetSettings(widgetId, { freeWidth, freeHeight }, defaults));
  }

  function bringFreeWidgetToFront(widgetId: string) {
    freeZCounter.current += 1;
    setFreeZIndices((current) => ({ ...current, [widgetId]: freeZCounter.current }));
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
        className="dashboard__settings-button dashboard__fullscreen-button"
        onClick={() => void toggleFullscreen()}
        title={isFullscreen ? "Exit fullscreen (F11)" : "Fullscreen (F11)"}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {isFullscreen ? "🗗" : "⛶"}
      </button>
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
        {gridWidgets.map((widget) => (
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

        {/* Free-mode widgets are still children of `.dashboard` (so they
            scroll with the grid content), but CSS Grid ignores
            absolutely-positioned children entirely - they don't take a
            grid slot or affect grid-mode widgets' layout at all. */}
        {freeWidgets.map((widget) => (
          <FreeWidgetCell
            key={widget.id}
            widget={widget}
            x={settings[widget.id].freeX}
            y={settings[widget.id].freeY}
            width={settings[widget.id].freeWidth}
            height={settings[widget.id].freeHeight}
            zIndex={freeZIndices[widget.id] ?? FREE_CELL_BASE_Z_INDEX}
            onMove={(freeX, freeY) => handleFreeMove(widget.id, freeX, freeY)}
            onResize={(freeWidth, freeHeight) => handleFreeResize(widget.id, freeWidth, freeHeight)}
            onBringToFront={() => bringFreeWidgetToFront(widget.id)}
          />
        ))}
      </div>

      {settingsOpen && (
        <DashboardSettings settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
