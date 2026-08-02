/**
 * Generic version of the capped, localStorage-persisted list pattern
 * already used piecemeal across the app (news keywords, favorite artists,
 * CS2 profiles) - for id-keyed object items rather than bare strings.
 * `isItem` is a runtime type guard so a corrupted/foreign value in
 * localStorage can't leak an invalid shape into the widget; `defaults` only
 * applies the very first time (no stored key at all), never overriding a
 * deliberately emptied list.
 */
export interface ItemListStore<T> {
  get(): T[];
  add(item: T): T[];
  remove(id: string): T[];
  update(id: string, updater: (item: T) => T): T[];
}

export function createItemListStore<T extends { id: string }>(
  storageKey: string,
  maxItems: number,
  isItem: (value: unknown) => value is T,
  defaults: T[] = [],
): ItemListStore<T> {
  function get(): T[] {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return [...defaults];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter(isItem) : [...defaults];
    } catch {
      return [...defaults];
    }
  }

  function save(items: T[]): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Best-effort - e.g. localStorage disabled/full. Keeps working for
      // the current session, it just won't persist.
    }
  }

  function add(item: T): T[] {
    const current = get();
    if (current.length >= maxItems) return current;
    const next = [...current, item];
    save(next);
    return next;
  }

  function remove(id: string): T[] {
    const next = get().filter((item) => item.id !== id);
    save(next);
    return next;
  }

  function update(id: string, updater: (item: T) => T): T[] {
    const next = get().map((item) => (item.id === id ? updater(item) : item));
    save(next);
    return next;
  }

  return { get, add, remove, update };
}
