import { delay } from "../../shared/mock";
import { CS2_MAPS } from "./data/maps";
import { MAP_POSITIONS } from "./data/positions";
import { SAMPLE_LINEUPS } from "./data/lineups";
import { SAMPLE_PRO_PLAYS } from "./data/proPlays";
import type { Cs2Map, Cs2Repository, LineupFilter, MapPosition, NadeLineup, ProPlay, ProPlayFilter } from "./types";

function matchesSearch(haystack: string[], search: string | undefined): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  return haystack.some((s) => s.toLowerCase().includes(needle));
}

/**
 * Reads from the static sample arrays under data/. The interface is async
 * on purpose: a real implementation backed by a local SQLite file (via the
 * Tauri SQL plugin), a bundled JSON dataset, or a community API can replace
 * this class without the widget knowing the difference.
 */
class LocalCs2Repository implements Cs2Repository {
  listMaps(): Cs2Map[] {
    return CS2_MAPS;
  }

  listPositions(map: Cs2Map): MapPosition[] {
    return MAP_POSITIONS.filter((p) => p.map === map);
  }

  async fetchLineups(filter: LineupFilter): Promise<NadeLineup[]> {
    await delay(100);
    return SAMPLE_LINEUPS.filter(
      (lineup) =>
        (!filter.map || lineup.map === filter.map) &&
        (!filter.grenadeType || lineup.grenadeType === filter.grenadeType) &&
        (!filter.side || lineup.side === filter.side) &&
        (!filter.positionId || (lineup.positions?.includes(filter.positionId) ?? false)) &&
        matchesSearch([lineup.name, lineup.map, lineup.from, lineup.to, lineup.description], filter.search),
    );
  }

  async fetchProPlays(filter: ProPlayFilter): Promise<ProPlay[]> {
    await delay(100);
    return SAMPLE_PRO_PLAYS.filter(
      (play) =>
        (!filter.map || play.map === filter.map) &&
        matchesSearch([play.player, play.team, play.map, play.event, play.description, ...play.tags], filter.search),
    );
  }
}

let repository: Cs2Repository = new LocalCs2Repository();

export function getCs2Repository(): Cs2Repository {
  return repository;
}

export function setCs2Repository(next: Cs2Repository): void {
  repository = next;
}
