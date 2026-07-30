export type VisibilityMode = "always" | "scheduled" | "hidden";

export interface WidgetSchedule {
  /** 0 = Sunday .. 6 = Saturday. */
  days: number[];
  startTime: string; // "HH:MM", 24h
  endTime: string; // "HH:MM", 24h - if before startTime, the window wraps past midnight
}

export interface WidgetUserSettings {
  visibility: VisibilityMode;
  schedule: WidgetSchedule;
  colSpan: 1 | 2 | 3;
  rowSpan: 1 | 2;
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
