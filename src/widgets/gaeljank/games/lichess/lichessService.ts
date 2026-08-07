export interface DailyPuzzle {
  id: string;
  rating: number;
  themes: string[];
}

/**
 * Lichess has no endpoint for "start a live game embedded in a third-party
 * page" - actual play needs an account and Lichess's own client (websocket
 * board state, move validation, clocks, etc.), which is out of scope to
 * rebuild here. What it does offer with zero auth and open CORS
 * (access-control-allow-origin: *) is this daily puzzle metadata, plus two
 * purpose-built iframe endpoints (see LichessGame.tsx) meant for embedding -
 * that combination is the "alternative solution" this cartridge is built on.
 */
export async function fetchDailyPuzzle(): Promise<DailyPuzzle> {
  const res = await fetch("https://lichess.org/api/puzzle/daily");
  if (!res.ok) throw new Error(`Lichess puzzle request failed (${res.status}).`);
  const data = (await res.json()) as { puzzle: { id: string; rating: number; themes: string[] } };
  return { id: data.puzzle.id, rating: data.puzzle.rating, themes: data.puzzle.themes };
}
