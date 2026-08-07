import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import countriesTopology from "world-atlas/countries-50m.json";
import { DISPUTED_TERRITORIES } from "./disputedTerritories";

/**
 * countries-50m.json (world-atlas, ISC - see README) is TopoJSON derived
 * from Natural Earth's public-domain Admin-0 country boundaries at 1:50m
 * scale - deliberately not the smaller 110m file (108KB vs 756KB): 110m
 * drops 4 of the small disputed/contested territories this widget calls
 * out specifically (Siachen Glacier, the Chagos Archipelago/British
 * Indian Ocean Territory, South Georgia), and completeness there mattered
 * more than the extra ~650KB in a lazily-loaded, opt-in widget chunk (this
 * app already ships far larger single assets, e.g. the DOS Arcade
 * cartridge's Tyrian bundle at 4.7MB). Not the 10m file either (3.7MB) -
 * its extra coastline detail doesn't resolve into anything visible at the
 * size this widget is actually viewed at. Projected once at module
 * load with a fixed 960x500 viewBox using d3-geo's Natural Earth
 * projection (a good general-purpose "whole world at once" look - less
 * pole distortion than Mercator, less awkward than Equirectangular)
 * fitted to that exact box, so every path's `d` string is baked in
 * relative to a fixed coordinate system. The SVG element that renders
 * these paths uses that same viewBox with `width: 100%` in CSS, which is
 * what actually keeps this scaling losslessly - vector coordinates,
 * rescaled by the browser, not raster pixels.
 */
export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 500;

export interface CountryFeature {
  id: string;
  name: string;
  path: string;
  disputed: boolean;
}

const topology = countriesTopology as unknown as Topology<{ countries: GeometryCollection }>;
const countries = feature(topology, topology.objects.countries);

const projection = geoNaturalEarth1().fitSize([MAP_WIDTH, MAP_HEIGHT], countries);
const pathGenerator = geoPath(projection);

export const COUNTRY_FEATURES: CountryFeature[] = countries.features
  .map((f) => {
    const d = pathGenerator(f);
    const name = (f.properties as { name?: string } | null)?.name ?? "Unknown";
    return d ? { id: String(f.id ?? name), name, path: d, disputed: name in DISPUTED_TERRITORIES } : null;
  })
  .filter((f): f is CountryFeature => f !== null);
