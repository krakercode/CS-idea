import type { ProPlay } from "../types";

/**
 * Placeholder pro-play entries with generic names/dates - these are NOT
 * real match records, just fixtures shaped like the real thing so the UI
 * and schema can be built and tested now. Replace with a real dataset
 * (e.g. hand-curated clips, or a community API/database) later; the
 * ProPlay type and cs2Service interface are what real data needs to match.
 */
export const SAMPLE_PRO_PLAYS: ProPlay[] = [
  {
    id: "sample-1",
    map: "Mirage",
    player: "Player One",
    team: "Team Alpha",
    event: "Sample Regional Major",
    date: "2026-03-14",
    description: "1v3 clutch on A site using window and connector smokes to isolate duels.",
    tags: ["clutch", "awp"],
  },
  {
    id: "sample-2",
    map: "Inferno",
    player: "Player Two",
    team: "Team Bravo",
    event: "Sample Regional Major",
    date: "2026-03-15",
    description: "Opening pick through banana off a teammate's flash, converting the man advantage into the round.",
    tags: ["entry", "rifle"],
  },
  {
    id: "sample-3",
    map: "Nuke",
    player: "Player Three",
    team: "Team Charlie",
    event: "Sample Invitational",
    date: "2026-04-02",
    description: "Ace on outside/secret using a molotov to flush a stack before rotating on the last player.",
    tags: ["ace", "rifle"],
  },
  {
    id: "sample-4",
    map: "Ancient",
    player: "Player Four",
    team: "Team Delta",
    event: "Sample Invitational",
    date: "2026-04-03",
    description: "Retake of A site using a donut smoke to split the defenders' crossfire.",
    tags: ["retake", "utility"],
  },
];
