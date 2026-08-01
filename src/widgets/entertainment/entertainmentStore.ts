import { createItemListStore } from "../../shared/itemListStore";
import type { EntertainmentShortcut } from "./types";

const STORAGE_KEY = "entertainment-shortcuts";
export const MAX_SHORTCUTS = 24;

function isShortcut(value: unknown): value is EntertainmentShortcut {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.name === "string" && typeof v.path === "string" && typeof v.args === "string";
}

const store = createItemListStore<EntertainmentShortcut>(STORAGE_KEY, MAX_SHORTCUTS, isShortcut);

export function getShortcuts(): EntertainmentShortcut[] {
  return store.get();
}

/** Rejects a blank name/path; skips adding a path that's already saved
 * (case-insensitive) rather than creating a duplicate entry. */
export function addShortcut(name: string, path: string, args: string): EntertainmentShortcut[] {
  const trimmedName = name.trim();
  const trimmedPath = path.trim();
  const current = store.get();
  if (!trimmedName || !trimmedPath) return current;
  if (current.some((s) => s.path.toLowerCase() === trimmedPath.toLowerCase())) return current;

  return store.add({ id: crypto.randomUUID(), name: trimmedName, path: trimmedPath, args: args.trim() });
}

export function removeShortcut(id: string): EntertainmentShortcut[] {
  return store.remove(id);
}
