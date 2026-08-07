import worldCountries from "world-countries";

export interface CountryInfo {
  name: string;
  officialName?: string;
  capital?: string;
  region?: string;
  subregion?: string;
  flagEmoji?: string;
  unMember?: boolean;
  independent?: boolean;
  wikipediaTitle: string;
}

/**
 * world-countries (mledoze/countries, ODbL - see README) doesn't carry
 * entries for territories that aren't its own recognized-or-not "country"
 * row at all: contested/unrecognized entities Natural Earth still draws
 * as their own polygon (Kosovo, Northern Cyprus, Somaliland) and one
 * uninhabited disputed military zone (Siachen Glacier) that isn't a
 * country by any definition. Filled in by hand here, keyed by the exact
 * topojson `properties.name` the same way disputedTerritories.ts is.
 */
const MANUAL_OVERRIDES: Record<string, CountryInfo> = {
  Kosovo: {
    name: "Kosovo",
    capital: "Pristina",
    region: "Europe",
    subregion: "Southeastern Europe",
    flagEmoji: "🇽🇰",
    unMember: false,
    independent: true,
    wikipediaTitle: "Kosovo",
  },
  "N. Cyprus": {
    name: "Northern Cyprus",
    capital: "North Nicosia",
    region: "Europe",
    subregion: "Southern Europe",
    unMember: false,
    independent: true,
    wikipediaTitle: "Northern_Cyprus",
  },
  Somaliland: {
    name: "Somaliland",
    capital: "Hargeisa",
    region: "Africa",
    subregion: "Eastern Africa",
    unMember: false,
    independent: true,
    wikipediaTitle: "Somaliland",
  },
  "Siachen Glacier": {
    name: "Siachen Glacier",
    region: "Asia",
    subregion: "Southern Asia",
    unMember: false,
    independent: false,
    wikipediaTitle: "Siachen_Glacier",
  },
  "Indian Ocean Ter.": {
    name: "Chagos Archipelago",
    capital: "Diego Garcia (military base)",
    region: "Africa",
    subregion: "Eastern Africa",
    unMember: false,
    independent: false,
    wikipediaTitle: "Chagos_Archipelago",
  },
};

const byCcn3 = new Map(worldCountries.map((c) => [c.ccn3, c] as const));

/** Looks up a topojson feature's real-world info: by numeric ISO code
 * first (covers ~235 of 241 features), falling back to the manual table
 * above by name, falling back to just the topojson's own short label for
 * the handful of small territories neither source tracks individually
 * (e.g. Ashmore and Cartier Is.) - still shows something clickable rather
 * than nothing. */
export function getCountryInfo(topoId: string | undefined, topoName: string): CountryInfo {
  const match = topoId ? byCcn3.get(topoId) : undefined;
  if (match) {
    return {
      name: match.name.common,
      officialName: match.name.official,
      capital: match.capital?.[0],
      region: match.region,
      subregion: match.subregion,
      flagEmoji: match.flag,
      unMember: match.unMember,
      independent: match.independent,
      wikipediaTitle: match.name.common.replace(/ /g, "_"),
    };
  }

  if (MANUAL_OVERRIDES[topoName]) return MANUAL_OVERRIDES[topoName];

  return { name: topoName, wikipediaTitle: topoName.replace(/ /g, "_") };
}
