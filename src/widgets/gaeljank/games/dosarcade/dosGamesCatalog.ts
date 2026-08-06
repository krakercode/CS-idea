import jetpackBundleUrl from "./bundles/jetpack.jsdos?url";

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
];
