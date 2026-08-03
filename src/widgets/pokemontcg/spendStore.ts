import type { PullEntry, SpendEntry } from "./types";

const STORAGE_KEY = "pokemon-spend-log";
// A backstop against runaway growth, same reasoning as the habits log's
// 30-day retention - not a realistic ceiling for how many purchases anyone
// actually logs.
const MAX_ENTRIES = 300;

function isPullEntry(value: unknown): value is PullEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.cardName === "string" && typeof v.value === "number";
}

function isSpendEntry(value: unknown): value is SpendEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.date === "string" &&
    typeof v.product === "string" &&
    typeof v.cost === "number" &&
    Array.isArray(v.pulls) &&
    v.pulls.every(isPullEntry)
  );
}

// Local calendar date, not UTC - same reasoning as habitsStore.ts's
// todayIso: `toISOString()` would roll "today" over at UTC midnight
// instead of the user's actual midnight.
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readAll(): SpendEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isSpendEntry) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: SpendEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Best-effort - e.g. localStorage disabled/full.
  }
}

export function getEntries(): SpendEntry[] {
  return readAll();
}

export function addEntry(product: string, cost: number): SpendEntry[] {
  const trimmed = product.trim();
  if (!trimmed) return readAll();
  const current = readAll();
  if (current.length >= MAX_ENTRIES) return current;
  const next: SpendEntry[] = [
    ...current,
    { id: crypto.randomUUID(), date: todayIso(), product: trimmed, cost: Number.isFinite(cost) ? cost : 0, pulls: [] },
  ];
  writeAll(next);
  return next;
}

export function removeEntry(id: string): SpendEntry[] {
  const next = readAll().filter((e) => e.id !== id);
  writeAll(next);
  return next;
}

export function addPull(entryId: string, cardName: string, value: number, cardId?: string): SpendEntry[] {
  const trimmed = cardName.trim();
  if (!trimmed) return readAll();
  const pull: PullEntry = {
    id: crypto.randomUUID(),
    cardName: trimmed,
    value: Number.isFinite(value) ? value : 0,
    ...(cardId ? { cardId } : {}),
  };
  const next = readAll().map((e) => (e.id === entryId ? { ...e, pulls: [...e.pulls, pull] } : e));
  writeAll(next);
  return next;
}

export function removePull(entryId: string, pullId: string): SpendEntry[] {
  const next = readAll().map((e) => (e.id === entryId ? { ...e, pulls: e.pulls.filter((p) => p.id !== pullId) } : e));
  writeAll(next);
  return next;
}

export function getTotalSpent(entries: SpendEntry[]): number {
  return entries.reduce((sum, e) => sum + e.cost, 0);
}

export function getTotalPulledValue(entries: SpendEntry[]): number {
  return entries.reduce((sum, e) => sum + e.pulls.reduce((pSum, p) => pSum + p.value, 0), 0);
}

export function getNetGainLoss(entries: SpendEntry[]): number {
  return getTotalPulledValue(entries) - getTotalSpent(entries);
}
