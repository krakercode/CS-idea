import type { NadeLineup } from "../types";

/**
 * Starter/sample lineup data so the widget has something real to show and
 * the schema has a concrete example to build from. Positions can shift
 * between patches - treat these as a starting point to verify and expand,
 * not a maintained, patch-accurate guide. Replace/extend freely; this array
 * is the entire "database" for now (see cs2Service.ts for where a real
 * store - SQLite via Tauri, a JSON file, a community API - would plug in).
 */
export const SAMPLE_LINEUPS: NadeLineup[] = [
  {
    id: "mirage-window-smoke-t-spawn",
    map: "Mirage",
    grenadeType: "smoke",
    name: "Window smoke from T spawn",
    from: "T spawn",
    to: "Window (mid to A connector)",
    technique: "jumping",
    description:
      "Blocks CT vision through window into mid, letting T's cross mid or push window safely. Classic default-setup smoke.",
  },
  {
    id: "mirage-jungle-smoke-ct",
    map: "Mirage",
    grenadeType: "smoke",
    name: "CT (jungle) smoke from ramp",
    from: "A ramp",
    to: "CT / jungle",
    technique: "standing",
    description: "Cuts off CT rotations and vision onto the A site plant area during an A execute.",
  },
  {
    id: "inferno-banana-smoke-t-spawn",
    map: "Inferno",
    grenadeType: "smoke",
    name: "Banana smoke from T spawn",
    from: "T spawn",
    to: "Banana (mid of the choke)",
    technique: "running",
    description: "Splits banana in half so T's can push without being seen from the far end near CT side.",
  },
  {
    id: "inferno-secondmid-flash-banana",
    map: "Inferno",
    grenadeType: "flash",
    name: "Second mid pop-flash",
    from: "Banana",
    to: "Second mid / library",
    technique: "left-click",
    description: "Blind-pushes second mid for a fast library or mid-to-B rotation read.",
  },
  {
    id: "dust2-xbox-smoke-t-spawn",
    map: "Dust2",
    grenadeType: "smoke",
    name: "CT smoke (Xbox) from T spawn",
    from: "T spawn",
    to: "CT / Xbox",
    technique: "standing",
    description: "Blocks the CT crosshall angle onto long doors during a long A push.",
  },
  {
    id: "nuke-secret-molotov-outside",
    map: "Nuke",
    grenadeType: "molotov",
    name: "Secret molotov from outside",
    from: "Outside T spawn",
    to: "Secret",
    technique: "standing",
    description: "Clears or denies a CT holding secret before a squeaky/hut push.",
  },
  {
    id: "ancient-donut-smoke-mid",
    map: "Ancient",
    grenadeType: "smoke",
    name: "Donut smoke from mid",
    from: "Mid",
    to: "Donut (A site)",
    technique: "standing",
    description: "Blinds the donut angle so mid-to-A pushes and plants aren't contested from range.",
  },
  {
    id: "anubis-heaven-smoke-connector",
    map: "Anubis",
    grenadeType: "smoke",
    name: "Heaven smoke from connector",
    from: "Connector",
    to: "Heaven (A site)",
    technique: "jumping",
    description: "Removes the heaven angle overlooking A site for a safer plant during an A default.",
  },
];
