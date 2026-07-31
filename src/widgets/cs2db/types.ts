export type Cs2Map = "Mirage" | "Inferno" | "Nuke" | "Ancient" | "Anubis" | "Dust2" | "Train" | "Vertigo";

export type GrenadeType = "smoke" | "flash" | "molotov" | "he";

export type ThrowTechnique = "standing" | "running" | "jumping" | "left-click" | "right-click";

export type Side = "T" | "CT";

/** A named CT holding spot on a map (e.g. Mirage's "Jungle" or "Stairs").
 * T side doesn't get positions the same way - T utility is organized around
 * executes on a site, not a single spot a player holds all round. */
export interface MapPosition {
  id: string;
  map: Cs2Map;
  label: string;
}

export interface NadeLineup {
  id: string;
  map: Cs2Map;
  grenadeType: GrenadeType;
  name: string;
  from: string;
  to: string;
  /** Optional because it's not always something we actually know - a
   * sourced entry's `from`/`to` can be read straight off a real page's URL
   * (map/grenade-type/slug), but the throw technique itself needs the
   * page's actual content, which isn't always reachable. Guessing it would
   * be exactly the kind of unverified-but-confident-sounding detail this
   * field is trying to get away from. */
  technique?: ThrowTechnique;
  description: string;
  side: Side;
  /** CT-side lineups only: which MapPosition id(s) this is relevant to. */
  positions?: string[];
  /** A specific page (csnades.gg, a YouTube guide, etc.) showing this exact
   * lineup - set this once you've found/verified one. We link out to
   * sources like this rather than downloading and rehosting their images,
   * since those aren't ours to redistribute. Falls back to a search query
   * (see LineupList) when unset, so every card still has somewhere to go
   * look for a visual reference. */
  sourceUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
}

export interface ProPlay {
  id: string;
  map: Cs2Map;
  player: string;
  team: string;
  event: string;
  date: string; // ISO date
  description: string;
  tags: string[];
  videoUrl?: string;
}

export interface LineupFilter {
  map?: Cs2Map;
  grenadeType?: GrenadeType;
  side?: Side;
  /** MapPosition id - only lineups relevant to this CT position. */
  positionId?: string;
  search?: string;
}

export interface ProPlayFilter {
  map?: Cs2Map;
  search?: string;
}

export interface Cs2Repository {
  listMaps(): Cs2Map[];
  listPositions(map: Cs2Map): MapPosition[];
  fetchLineups(filter: LineupFilter): Promise<NadeLineup[]>;
  fetchProPlays(filter: ProPlayFilter): Promise<ProPlay[]>;
}
