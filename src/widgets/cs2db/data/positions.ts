import type { MapPosition } from "../types";

/**
 * Named CT holding spots per map, for the Profiles view ("what do I play?").
 * Starter set covering the maps that already have sample lineup data -
 * extend freely as more maps/lineups get added.
 */
export const MAP_POSITIONS: MapPosition[] = [
  { id: "mirage-jungle", map: "Mirage", label: "Jungle (A)" },
  { id: "mirage-stairs", map: "Mirage", label: "Stairs / Connector" },
  { id: "mirage-apps", map: "Mirage", label: "Apps / Firebox (B)" },

  { id: "inferno-banana", map: "Inferno", label: "Banana" },
  { id: "inferno-library", map: "Inferno", label: "Library / Second Mid" },
  { id: "inferno-arch", map: "Inferno", label: "Arch / Pit (A)" },

  { id: "nuke-outside", map: "Nuke", label: "Outside / Secret" },
  { id: "nuke-hut", map: "Nuke", label: "Hut" },

  { id: "ancient-donut", map: "Ancient", label: "Donut (A)" },
  { id: "ancient-mid", map: "Ancient", label: "Mid" },

  { id: "anubis-heaven", map: "Anubis", label: "Heaven (A)" },
  { id: "anubis-connector", map: "Anubis", label: "Connector" },
];
