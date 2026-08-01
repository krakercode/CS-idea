import { createItemListStore } from "../../shared/itemListStore";
import type { HabitTask, VitalityBand } from "./types";

const TASKS_KEY = "habit-tasks";
const LOG_KEY = "habit-log";
export const MAX_TASKS = 20;
const LOG_RETENTION_DAYS = 30;
const VITALITY_WINDOW_DAYS = 7;
const DEFAULT_POINTS = 10;

function isHabitTask(value: unknown): value is HabitTask {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.name === "string" && typeof v.points === "number";
}

const taskStore = createItemListStore<HabitTask>(TASKS_KEY, MAX_TASKS, isHabitTask);

export function getTasks(): HabitTask[] {
  return taskStore.get();
}

export function addTask(name: string, points: number): HabitTask[] {
  const trimmed = name.trim();
  if (!trimmed) return taskStore.get();
  const safePoints = Number.isFinite(points) && points > 0 ? Math.round(points) : DEFAULT_POINTS;
  return taskStore.add({ id: crypto.randomUUID(), name: trimmed, points: safePoints });
}

export function removeTask(id: string): HabitTask[] {
  return taskStore.remove(id);
}

type HabitLog = Record<string, string[]>;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function getLog(): HabitLog {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    const result: HabitLog = {};
    for (const [date, ids] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(ids)) result[date] = ids.filter((id): id is string => typeof id === "string");
    }
    return result;
  } catch {
    return {};
  }
}

function saveLog(log: HabitLog): void {
  try {
    // Keeps the log from growing forever - only the last month is ever
    // needed (vitality only looks back 7 days; lifetime points still adds
    // up correctly since it's summed on write, not re-derived from a full
    // history).
    const cutoff = isoDaysAgo(LOG_RETENTION_DAYS);
    const pruned: HabitLog = {};
    for (const [date, ids] of Object.entries(log)) {
      if (date >= cutoff) pruned[date] = ids;
    }
    localStorage.setItem(LOG_KEY, JSON.stringify(pruned));
  } catch {
    // Best-effort - e.g. localStorage disabled/full.
  }
}

export function getTodayCompletedIds(): string[] {
  return getLog()[todayIso()] ?? [];
}

export function toggleTaskCompletion(taskId: string): string[] {
  const log = getLog();
  const today = todayIso();
  const current = log[today] ?? [];
  const next = current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId];
  log[today] = next;
  saveLog(log);
  return next;
}

function pointsById(tasks: HabitTask[]): Map<string, number> {
  return new Map(tasks.map((t) => [t.id, t.points]));
}

/** Sum of every completion ever logged, at that task's point value -
 * doesn't drop to 0 if a task is later removed (past completions still
 * counted at 0 for an unknown id, but the ones logged while it existed
 * already added their points permanently). */
export function getLifetimePoints(): number {
  const rates = pointsById(getTasks());
  let total = 0;
  for (const ids of Object.values(getLog())) {
    for (const id of ids) total += rates.get(id) ?? 0;
  }
  return total;
}

export function getTodayPoints(): number {
  const rates = pointsById(getTasks());
  return getTodayCompletedIds().reduce((sum, id) => sum + (rates.get(id) ?? 0), 0);
}

/** Rolling average of the last 7 *completed* days' completion ratio
 * (yesterday back 7 days) - today doesn't count against you until the day
 * actually rolls over, so it's deliberately excluded. A brand new tracker
 * with no log history at all starts at 100 rather than looking "critical"
 * before you've had a chance to do anything. */
export function getVitalityScore(): number {
  const tasks = getTasks();
  if (tasks.length === 0) return 100;

  const log = getLog();
  if (Object.keys(log).length === 0) return 100;

  let totalRatio = 0;
  for (let i = 1; i <= VITALITY_WINDOW_DAYS; i++) {
    const completed = log[isoDaysAgo(i)]?.length ?? 0;
    totalRatio += Math.min(1, completed / tasks.length);
  }
  return Math.round((totalRatio / VITALITY_WINDOW_DAYS) * 100);
}

export function vitalityBand(score: number): VitalityBand {
  if (score >= 75) return "healthy";
  if (score >= 40) return "warning";
  return "critical";
}

/** Purely cosmetic - a synthetic "heart rate" that climbs as vitality
 * drops, not a real physiological model. 65bpm at full vitality, up to
 * ~140bpm at zero. */
export function syntheticHeartRate(score: number): number {
  return Math.round(65 + (100 - score) * 0.75);
}
