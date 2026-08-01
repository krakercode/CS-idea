import { createItemListStore } from "../../shared/itemListStore";
import { normalizeUrl } from "../../shared/normalizeUrl";
import type { Shortcut } from "./types";

const STORAGE_KEY = "shortcuts";
export const MAX_SHORTCUTS = 24;

function isShortcut(value: unknown): value is Shortcut {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.name === "string" && typeof v.url === "string";
}

const store = createItemListStore<Shortcut>(STORAGE_KEY, MAX_SHORTCUTS, isShortcut);

export function getShortcuts(): Shortcut[] {
  return store.get();
}

/** Trims both fields, rejects a blank name/URL, and skips adding a URL
 * that's already saved (case-insensitive) rather than creating a duplicate
 * entry. */
export function addShortcut(name: string, url: string): Shortcut[] {
  const trimmedName = name.trim();
  const trimmedUrl = url.trim();
  const current = store.get();
  if (!trimmedName || !trimmedUrl) return current;

  const normalized = normalizeUrl(trimmedUrl);
  if (current.some((s) => s.url.toLowerCase() === normalized.toLowerCase())) return current;

  return store.add({ id: crypto.randomUUID(), name: trimmedName, url: normalized });
}

export function removeShortcut(id: string): Shortcut[] {
  return store.remove(id);
}
