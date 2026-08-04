import type { ComponentType } from "react";
import { OneMoreSeasonGame } from "./games/onemoreseason/OneMoreSeasonGame";

export interface GameEntry {
  id: string;
  title: string;
  tagline: string;
  blurb: string;
  /** Every cartridge takes the same one prop - a callback to leave the game
   * and return to the GAELJANK SOFTWORKS menu - so adding a new game here
   * is just adding an entry, no changes needed to the widget itself. */
  Component: ComponentType<{ onExit: () => void }>;
}

/** The GAELJANK SOFTWORKS catalog - add a new game here as its own module
 * under games/<name>/, same shape as onemoreseason/. */
export const GAMES: GameEntry[] = [
  {
    id: "onemoreseason",
    title: "One More Season",
    tagline: "Career mode",
    blurb: "Sunday league to the very top, if you're good enough - pick an ambition, live with every choice, retire at 38.",
    Component: OneMoreSeasonGame,
  },
];
