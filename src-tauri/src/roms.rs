//! The "bring your own ROM" folder for GAELJANK SOFTWORKS' Retrocade
//! cartridge (see src/widgets/gaeljank/games/retrocade/ on the frontend
//! side). Unlike DOS Arcade's bundled freeware games, Retrocade only ships
//! the emulator cores - the games themselves live in a plain folder under
//! this app's own data directory, which the user populates however they
//! like (their own legally-obtained dumps, homebrew, etc.). Nothing here
//! ever reaches out to the network; it only reads what's already on disk.

use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize)]
pub struct RomEntry {
    filename: String,
    /// One of Retrocade's supported systems - see SYSTEM_FOR_EXTENSION and
    /// its matching core map on the frontend (retroCores.ts).
    system: String,
}

/// Extensions Retrocade knows how to run, each mapped to the libretro core
/// that plays it - see scripts/setup-nostalgist-assets.mjs for why these
/// four cores specifically (all GPL/MPL, all confirmed redistributable,
/// unlike e.g. Snes9x's non-commercial-only license).
const SYSTEM_FOR_EXTENSION: &[(&str, &str)] = &[
    ("nes", "nes"),
    ("gb", "gb"),
    ("gbc", "gb"),
    ("gba", "gba"),
    ("md", "genesis"),
    ("gen", "genesis"),
    ("smd", "genesis"),
];

fn system_for_extension(ext: &str) -> Option<&'static str> {
    let ext = ext.to_ascii_lowercase();
    SYSTEM_FOR_EXTENSION
        .iter()
        .find(|(candidate, _)| *candidate == ext)
        .map(|(_, system)| *system)
}

fn roms_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("roms"))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_roms(app: tauri::AppHandle) -> Result<Vec<RomEntry>, String> {
    let dir = roms_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let mut roms = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(filename) = path.file_name().and_then(|f| f.to_str()) else {
            continue;
        };
        let Some(system) = path.extension().and_then(|e| e.to_str()).and_then(system_for_extension) else {
            continue;
        };
        roms.push(RomEntry {
            filename: filename.to_string(),
            system: system.to_string(),
        });
    }
    roms.sort_by(|a, b| a.filename.to_lowercase().cmp(&b.filename.to_lowercase()));
    Ok(roms)
}

#[tauri::command]
pub fn read_rom(app: tauri::AppHandle, filename: String) -> Result<tauri::ipc::Response, String> {
    // filename comes from the frontend, which only ever forwards names this
    // same list_roms call handed it - but treat it as untrusted anyway:
    // reject anything that isn't a bare filename before it touches the
    // filesystem, then double-check the canonicalized result really did
    // resolve inside the roms dir (belt-and-suspenders against path
    // traversal via "..", symlinks, or platform path-separator quirks).
    if filename.is_empty() || filename.contains('/') || filename.contains('\\') {
        return Err("invalid ROM filename".to_string());
    }

    let dir = roms_dir(&app)?;
    let canonical_dir = fs::canonicalize(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(&filename);
    let canonical_path = fs::canonicalize(&path).map_err(|_| format!("ROM \"{filename}\" not found"))?;
    if !canonical_path.starts_with(&canonical_dir) {
        return Err("invalid ROM filename".to_string());
    }

    // Returned as a raw IPC response (not JSON) - GBA ROMs run to 32MB, and
    // JSON-encoding that as a number array would be an order of magnitude
    // more bytes over the wire for no benefit. The frontend's `invoke()`
    // resolves this straight to an ArrayBuffer.
    let bytes = fs::read(&canonical_path).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub fn open_roms_folder(app: tauri::AppHandle) -> Result<(), String> {
    let dir = roms_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}
