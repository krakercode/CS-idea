import { invoke } from "@tauri-apps/api/core";

export interface RomEntry {
  filename: string;
  /** Key into retroSystems.ts's SYSTEMS - Rust already filtered out
   * anything with an extension it doesn't recognize. */
  system: string;
}

export function listRoms(): Promise<RomEntry[]> {
  return invoke("list_roms");
}

/** Reads a ROM already reported by listRoms() and wraps it as a File, ready
 * to pass straight into Nostalgist's `rom` option. read_rom returns a raw
 * IPC response rather than JSON (see roms.rs) - invoke() resolves that
 * directly to an ArrayBuffer. */
export async function readRom(filename: string): Promise<File> {
  const buffer = await invoke<ArrayBuffer>("read_rom", { filename });
  return new File([buffer], filename);
}

export function openRomsFolder(): Promise<void> {
  return invoke("open_roms_folder");
}
