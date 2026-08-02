export type VisibilityMode = "always" | "scheduled" | "hidden";

export interface WidgetSchedule {
  /** 0 = Sunday .. 6 = Saturday. */
  days: number[];
  startTime: string; // "HH:MM", 24h
  endTime: string; // "HH:MM", 24h - if before startTime, the window wraps past midnight
}

export type SizeMode = "grid" | "free";

export interface WidgetUserSettings {
  visibility: VisibilityMode;
  schedule: WidgetSchedule;
  colSpan: 1 | 2 | 3;
  rowSpan: 1 | 2;
  /** "grid" (default) keeps the widget snapped into the CSS Grid, sized in
   * col/row spans, reordered by dragging - existing behavior, untouched.
   * "free" takes it out of grid flow entirely and floats it at an
   * arbitrary pixel position/size instead, resized and repositioned by
   * direct pointer-drag rather than snapping. */
  sizeMode: SizeMode;
  freeX: number;
  freeY: number;
  freeWidth: number;
  freeHeight: number;
}

export type DashboardSettings = Record<string, WidgetUserSettings>;

const STORAGE_KEY = "dashboard-widget-settings";

export const DEFAULT_SCHEDULE: WidgetSchedule = {
  days: [0, 1, 2, 3, 4, 5, 6],
  startTime: "09:00",
  endTime: "17:00",
};

function readStored(): Partial<DashboardSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<DashboardSettings>) : {};
  } catch {
    return {};
  }
}

function writeStored(settings: DashboardSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Best-effort - e.g. localStorage disabled/full.
  }
}

/** Merges each widget's built-in default (from widgets.config.ts) with
 * whatever the user has changed and saved locally. */
export function getAllSettings(defaults: Record<string, WidgetUserSettings>): DashboardSettings {
  const stored = readStored();
  const merged: DashboardSettings = {};
  for (const id of Object.keys(defaults)) {
    merged[id] = { ...defaults[id], ...stored[id], schedule: { ...defaults[id].schedule, ...stored[id]?.schedule } };
  }
  return merged;
}

export function updateWidgetSettings(
  id: string,
  patch: Partial<WidgetUserSettings>,
  defaults: Record<string, WidgetUserSettings>,
): DashboardSettings {
  const current = getAllSettings(defaults);
  const next: DashboardSettings = { ...current, [id]: { ...current[id], ...patch } };
  writeStored(next);
  return next;
}

const ORDER_STORAGE_KEY = "dashboard-widget-order";

/** Position on the grid is drag-to-reorder now rather than a setting, so it
 * lives separately from WidgetUserSettings - just a persisted ordering of
 * widget ids. `allIds` is widgets.config.ts's current WIDGETS list, used to
 * drop ids for widgets that no longer exist and append ones added since the
 * order was last saved (or on first run, when nothing's saved yet). */
export function getWidgetOrder(allIds: string[]): string[] {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as unknown) : [];
    const storedIds = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
    const known = storedIds.filter((id) => allIds.includes(id));
    const missing = allIds.filter((id) => !known.includes(id));
    return [...known, ...missing];
  } catch {
    return allIds;
  }
}

export function saveWidgetOrder(order: string[]): void {
  try {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {
    // Best-effort - e.g. localStorage disabled/full.
  }
}

/** Whether a widget should be on screen right now, given its visibility
 * mode and (if scheduled) its day/time window. Overnight windows (e.g.
 * 22:00-02:00) are supported; the day-of-week check always looks at
 * today's weekday, which is a deliberate simplification. */
export function isWidgetVisibleNow(settings: WidgetUserSettings, now: Date = new Date()): boolean {
  if (settings.visibility === "hidden") return false;
  if (settings.visibility === "always") return true;

  const { days, startTime, endTime } = settings.schedule;
  if (!days.includes(now.getDay())) return false;

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);

  if (startMinutes <= endMinutes) {
    return minutesNow >= startMinutes && minutesNow < endMinutes;
  }
  return minutesNow >= startMinutes || minutesNow < endMinutes;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
