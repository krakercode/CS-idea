import jetpackBundleUrl from "./bundles/jetpack.jsdos?url";
import strykerBundleUrl from "./bundles/stryker.jsdos?url";
import blocksBundleUrl from "./bundles/blocks.jsdos?url";
import diggerBundleUrl from "./bundles/digger.jsdos?url";

export interface DosGameEntry {
  id: string;
  title: string;
  year: number;
  tagline: string;
  blurb: string;
  /** URL to a .jsdos bundle (a zip containing the game + .jsdos/dosbox.conf) -
   * see README's "GAELJANK SOFTWORKS" section for how each one was sourced
   * and confirmed freeware. */
  bundleUrl: string;
}

/** Curated freeware/public-domain DOS titles, each verified freeware
 * straight from the original rights holder (not just an aggregator site's
 * say-so) before being added here - see README for the paper trail on
 * each one. Add more the same way: a confirmed-freeware .jsdos bundle
 * under bundles/, plus an entry here. */
export const DOS_GAMES: DosGameEntry[] = [
  {
    id: "jetpack",
    title: "Jetpack",
    year: 1993,
    tagline: "Platformer",
    blurb:
      "Adept Software's classic - jet around 100 levels collecting emeralds while dodging hazards. Released as freeware " +
      "by the author on adeptsoftware.com; this bundle ships the original, unmodified game files.",
    bundleUrl: jetpackBundleUrl,
  },
  {
    id: "stryker",
    title: "Major Stryker",
    year: 1993,
    tagline: "Shoot 'em up",
    blurb:
      "Apogee's vertical-scrolling shooter, all 3 episodes unlocked. Deleted from Apogee's product line and " +
      "re-released as freeware in 2006, with a note from the studio's own tech support confirming it.",
    bundleUrl: strykerBundleUrl,
  },
  {
    id: "blocks",
    title: "Blocks from Hell",
    year: 1990,
    tagline: "Falling-block puzzle",
    blurb: "A tight, no-frills falling-block puzzler in the Tetris mold. Its own bundled docs say it plainly: \"this game is free.\"",
    bundleUrl: blocksBundleUrl,
  },
  {
    id: "digger",
    title: "Digger",
    year: 1983,
    tagline: "Arcade / maze",
    blurb:
      "Windmill Software's Dig Dug-style classic - tunnel for gems, dodge (or squash) the nobbins and hobbins chasing you. " +
      "This is the developer's own public-domain sample release.",
    bundleUrl: diggerBundleUrl,
  },
];
