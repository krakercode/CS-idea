/** Retrocade's supported systems - keep in sync with the extension map in
 * src-tauri/src/roms.rs (SYSTEM_FOR_EXTENSION), which is what actually
 * decides which ROMs in the folder show up here at all.
 *
 * Only libretro cores under an OSI-style copyleft/permissive license are
 * listed - see scripts/setup-nostalgist-assets.mjs for why e.g. SNES
 * (Snes9x, non-commercial-only) isn't offered here. */
export interface SystemInfo {
  label: string;
  extensions: string;
  core: string;
  coreLabel: string;
  license: string;
}

export const SYSTEMS: Record<string, SystemInfo> = {
  nes: { label: "NES", extensions: ".nes", core: "fceumm", coreLabel: "FCEUmm", license: "GPL-2.0" },
  gb: { label: "Game Boy / Color", extensions: ".gb, .gbc", core: "gambatte", coreLabel: "Gambatte", license: "GPL-2.0" },
  gba: { label: "Game Boy Advance", extensions: ".gba", core: "mgba", coreLabel: "mGBA", license: "MPL-2.0" },
  genesis: {
    label: "Genesis / Mega Drive",
    extensions: ".md, .gen, .smd",
    core: "genesis_plus_gx",
    coreLabel: "Genesis Plus GX",
    license: "GPL-2.0/3.0",
  },
};
