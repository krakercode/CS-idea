import type { CollectionEntry, PokemonCard } from "./types";

const STORAGE_KEY = "pokemon-collection";
// A backstop against runaway growth, not a realistic ceiling - unlike the
// 20-item caps elsewhere in this app (news keywords, shortcuts, etc.), a
// real card collection can legitimately run into the hundreds.
const MAX_ENTRIES = 1000;

function isCollectionEntry(value: unknown): value is CollectionEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.cardId === "string" &&
    typeof v.quantity === "number" &&
    typeof v.addedAt === "string" &&
    typeof v.card === "object" &&
    v.card !== null &&
    typeof (v.card as Record<string, unknown>).id === "string"
  );
}

function readAll(): CollectionEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isCollectionEntry) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: CollectionEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Best-effort - e.g. localStorage disabled/full.
  }
}

export function getCollection(): CollectionEntry[] {
  return readAll();
}

/** Adds a card, or increments its quantity if it's already owned. */
export function addToCollection(card: PokemonCard): CollectionEntry[] {
  const current = readAll();
  const existing = current.find((e) => e.cardId === card.id);
  let next: CollectionEntry[];
  if (existing) {
    next = current.map((e) => (e.cardId === card.id ? { ...e, quantity: e.quantity + 1, card } : e));
  } else {
    if (current.length >= MAX_ENTRIES) return current;
    next = [...current, { cardId: card.id, quantity: 1, card, addedAt: new Date().toISOString() }];
  }
  writeAll(next);
  return next;
}

export function removeFromCollection(cardId: string): CollectionEntry[] {
  const next = readAll().filter((e) => e.cardId !== cardId);
  writeAll(next);
  return next;
}

/** A quantity of 0 or less removes the entry entirely, matching how a
 * decrement-to-zero stepper is expected to behave. */
export function setQuantity(cardId: string, quantity: number): CollectionEntry[] {
  if (quantity <= 0) return removeFromCollection(cardId);
  const next = readAll().map((e) => (e.cardId === cardId ? { ...e, quantity } : e));
  writeAll(next);
  return next;
}

/** Replaces a collection entry's card snapshot (fresh price data) without
 * touching its quantity or addedAt. */
export function refreshSnapshot(cardId: string, card: PokemonCard): CollectionEntry[] {
  const next = readAll().map((e) => (e.cardId === cardId ? { ...e, card } : e));
  writeAll(next);
  return next;
}

/** Best-known unit price for a collection entry - TCGPlayer preferred,
 * Cardmarket as a fallback, `null` if neither source has a price. */
export function bestUnitPrice(entry: CollectionEntry): number | null {
  return entry.card.tcgplayerPrice ?? entry.card.cardmarketPrice ?? null;
}

export function getTotalValue(entries: CollectionEntry[]): number {
  return entries.reduce((sum, e) => sum + (bestUnitPrice(e) ?? 0) * e.quantity, 0);
}

export function getTotalQuantity(entries: CollectionEntry[]): number {
  return entries.reduce((sum, e) => sum + e.quantity, 0);
}
