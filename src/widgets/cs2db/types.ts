export type Cs2Map = "Mirage" | "Inferno" | "Nuke" | "Ancient" | "Anubis" | "Dust2" | "Train" | "Vertigo";

export type GrenadeType = "smoke" | "flash" | "molotov" | "he";

export type ThrowTechnique = "standing" | "running" | "jumping" | "left-click" | "right-click";

export interface NadeLineup {
  id: string;
  map: Cs2Map;
  grenadeType: GrenadeType;
  name: string;
  from: string;
  to: string;
  technique: ThrowTechnique;
  description: string;
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
  search?: string;
}

export interface ProPlayFilter {
  map?: Cs2Map;
  search?: string;
}

export interface Cs2Repository {
  listMaps(): Cs2Map[];
  fetchLineups(filter: LineupFilter): Promise<NadeLineup[]>;
  fetchProPlays(filter: ProPlayFilter): Promise<ProPlay[]>;
}
