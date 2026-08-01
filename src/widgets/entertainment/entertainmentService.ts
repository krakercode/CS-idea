import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { EntertainmentShortcut } from "./types";

/** Spawns the shortcut's executable via the Rust `launch_shortcut` command
 * (plain std::process::Command, fire-and-forget - see main.rs's doc
 * comment on why this isn't going through tauri-plugin-shell). `args` is
 * free text split on whitespace, e.g. a ROM path with no spaces in it. */
export async function launchShortcut(shortcut: EntertainmentShortcut): Promise<void> {
  const args = shortcut.args.trim().length > 0 ? shortcut.args.trim().split(/\s+/) : [];
  await invoke<void>("launch_shortcut", { path: shortcut.path, args });
}

/** Native "Browse..." file picker so a shortcut's path doesn't have to be
 * hand-typed - returns null if the user cancels. */
export async function pickExecutable(): Promise<string | null> {
  const selected = await open({ multiple: false, directory: false, title: "Choose an executable" });
  return typeof selected === "string" ? selected : null;
}
