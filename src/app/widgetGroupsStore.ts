export interface WidgetGroup {
  id: string;
  name: string;
  /** Built-in groups ship with the app and are always present - they can be
   * renamed but not deleted, since every widget needs to resolve to some
   * group and built-ins are the guaranteed fallback for that. User-created
   * groups can be freely renamed and deleted. */
  builtin: boolean;
}

/** First-run groups, matching each widget's defaultGroupId in
 * widgets.config.ts. Order here is the order groups render in the settings
 * panel and is itself user-editable (see reorderGroups). */
export const BUILTIN_GROUPS: WidgetGroup[] = [
  { id: "info", name: "Info", builtin: true },
  { id: "games", name: "Games", builtin: true },
  { id: "media", name: "Media", builtin: true },
  { id: "system", name: "System", builtin: true },
];

/** Pseudo-group a widget falls into if its assigned group was deleted -
 * not stored, not orderable, always rendered last. */
export const UNGROUPED_ID = "ungrouped";

const GROUPS_KEY = "dashboard-widget-groups";
const ASSIGNMENTS_KEY = "dashboard-widget-group-assignments";
const ORDER_KEY = "dashboard-widget-group-order";

interface StoredGroup {
  id: string;
  name: string;
}

function isStoredGroup(value: unknown): value is StoredGroup {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.name === "string";
}

function readCustomGroups(): StoredGroup[] {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isStoredGroup) : [];
  } catch {
    return [];
  }
}

function writeCustomGroups(groups: StoredGroup[]): void {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  } catch {
    // Best-effort - e.g. localStorage disabled/full.
  }
}

/** Renamed built-ins are stored as name overrides keyed by id, kept
 * separate from custom groups so a rename never turns a built-in
 * undeletable-but-renamable group into a deletable one. */
const BUILTIN_NAMES_KEY = "dashboard-widget-group-builtin-names";

function readBuiltinNameOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(BUILTIN_NAMES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeBuiltinNameOverrides(overrides: Record<string, string>): void {
  try {
    localStorage.setItem(BUILTIN_NAMES_KEY, JSON.stringify(overrides));
  } catch {
    // Best-effort, same as writeCustomGroups above.
  }
}

function readOrder(): string[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeOrder(order: string[]): void {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  } catch {
    // Best-effort, same as writeCustomGroups above.
  }
}

/** All groups (built-in, with any saved rename applied, followed by
 * custom ones), in the user's saved order - new groups (a fresh built-in
 * added by an app update, or one just created) are appended rather than
 * dropped when they're missing from a saved order. */
export function getGroups(): WidgetGroup[] {
  const nameOverrides = readBuiltinNameOverrides();
  const builtins: WidgetGroup[] = BUILTIN_GROUPS.map((g) => ({
    ...g,
    name: nameOverrides[g.id] ?? g.name,
  }));
  const custom: WidgetGroup[] = readCustomGroups().map((g) => ({ ...g, builtin: false }));
  const all = [...builtins, ...custom];

  const order = readOrder();
  const known = order.filter((id) => all.some((g) => g.id === id));
  const missing = all.filter((g) => !known.includes(g.id)).map((g) => g.id);
  const finalOrder = [...known, ...missing];

  const byId = new Map(all.map((g) => [g.id, g] as const));
  return finalOrder.map((id) => byId.get(id)).filter((g): g is WidgetGroup => !!g);
}

export function reorderGroups(order: string[]): void {
  writeOrder(order);
}

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "group";
}

/** Appends a new custom group, disambiguating its id against every existing
 * group (built-in or custom) so a name that collides with (or repeats) an
 * existing one doesn't silently merge into it. Returns the new group. */
export function createGroup(name: string): WidgetGroup {
  const trimmed = name.trim() || "New group";
  const existingIds = new Set(getGroups().map((g) => g.id));
  let id = slugify(trimmed);
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${slugify(trimmed)}-${suffix}`;
    suffix += 1;
  }
  const group: StoredGroup = { id, name: trimmed };
  // No need to touch ORDER_KEY here - getGroups() already appends any group
  // id missing from the saved order, which a brand new one always is.
  writeCustomGroups([...readCustomGroups(), group]);
  return { ...group, builtin: false };
}

export function renameGroup(id: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;

  if (BUILTIN_GROUPS.some((g) => g.id === id)) {
    const overrides = readBuiltinNameOverrides();
    overrides[id] = trimmed;
    writeBuiltinNameOverrides(overrides);
    return;
  }

  const custom = readCustomGroups();
  writeCustomGroups(custom.map((g) => (g.id === id ? { ...g, name: trimmed } : g)));
}

/** Deletes a custom group (built-ins are guarded, not silently ignored, so
 * a caller bug can't quietly no-op) and clears its widgets' assignment
 * overrides, same as any other settings reset - each one falls back to its
 * built-in default group (getAssignments' defaultGroupId) rather than
 * pointing at a group that no longer exists. UNGROUPED_ID is only ever
 * reached by a deliberate "Ungrouped" choice, not by deletion. */
export function deleteGroup(id: string): void {
  if (BUILTIN_GROUPS.some((g) => g.id === id)) {
    throw new Error("Built-in groups can't be deleted.");
  }
  writeCustomGroups(readCustomGroups().filter((g) => g.id !== id));
  writeOrder(readOrder().filter((existingId) => existingId !== id));

  const assignments = readAssignments();
  const next: Record<string, string> = {};
  for (const [widgetId, groupId] of Object.entries(assignments)) {
    if (groupId !== id) next[widgetId] = groupId;
  }
  writeAssignments(next);
}

function readAssignments(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeAssignments(assignments: Record<string, string>): void {
  try {
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
  } catch {
    // Best-effort, same as writeCustomGroups above.
  }
}

/** Resolves each widget's current group: a saved override if its target
 * group still exists, else the widget's built-in default, else
 * UNGROUPED_ID if even that's been deleted. `defaultGroupIds` is
 * widgets.config.ts's WIDGETS list reduced to id -> defaultGroupId. */
export function getAssignments(defaultGroupIds: Record<string, string>): Record<string, string> {
  const stored = readAssignments();
  // UNGROUPED_ID is a valid explicit target (a user deliberately parking a
  // widget outside any real group) even though it's never in getGroups() -
  // that list is real, persisted groups only.
  const validGroupIds = new Set([...getGroups().map((g) => g.id), UNGROUPED_ID]);
  const result: Record<string, string> = {};
  for (const [widgetId, defaultGroupId] of Object.entries(defaultGroupIds)) {
    const override = stored[widgetId];
    if (override && validGroupIds.has(override)) {
      result[widgetId] = override;
    } else if (validGroupIds.has(defaultGroupId)) {
      result[widgetId] = defaultGroupId;
    } else {
      result[widgetId] = UNGROUPED_ID;
    }
  }
  return result;
}

export function setWidgetGroup(widgetId: string, groupId: string): void {
  const assignments = readAssignments();
  assignments[widgetId] = groupId;
  writeAssignments(assignments);
}
