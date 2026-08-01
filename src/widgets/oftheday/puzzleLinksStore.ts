import { createItemListStore } from "../../shared/itemListStore";
import { normalizeUrl } from "../../shared/normalizeUrl";

export interface PuzzleLink {
  id: string;
  name: string;
  url: string;
}

const STORAGE_KEY = "of-the-day-puzzle-links";
export const MAX_PUZZLE_LINKS = 16;

// A sensible starting set - not "the" daily puzzles, just well-known ones -
// the user can add/remove freely from here.
const DEFAULT_PUZZLE_LINKS: PuzzleLink[] = [
  { id: "wordle", name: "Wordle", url: "https://www.nytimes.com/games/wordle/index.html" },
  { id: "worldle", name: "Worldle", url: "https://worldle.teuteuf.fr/" },
  { id: "timeguessr", name: "TimeGuessr", url: "https://timeguessr.com/" },
  { id: "pokedoku", name: "Pokedoku", url: "https://www.pokedoku.com/" },
  { id: "connections", name: "Connections", url: "https://www.nytimes.com/games/connections" },
  { id: "nerdle", name: "Nerdle", url: "https://nerdlegame.com/" },
];

function isPuzzleLink(value: unknown): value is PuzzleLink {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.name === "string" && typeof v.url === "string";
}

const store = createItemListStore<PuzzleLink>(STORAGE_KEY, MAX_PUZZLE_LINKS, isPuzzleLink, DEFAULT_PUZZLE_LINKS);

export function getPuzzleLinks(): PuzzleLink[] {
  return store.get();
}

export function addPuzzleLink(name: string, url: string): PuzzleLink[] {
  const trimmedName = name.trim();
  const trimmedUrl = url.trim();
  const current = store.get();
  if (!trimmedName || !trimmedUrl) return current;

  const normalized = normalizeUrl(trimmedUrl);
  if (current.some((p) => p.url.toLowerCase() === normalized.toLowerCase())) return current;

  return store.add({ id: crypto.randomUUID(), name: trimmedName, url: normalized });
}

export function removePuzzleLink(id: string): PuzzleLink[] {
  return store.remove(id);
}
