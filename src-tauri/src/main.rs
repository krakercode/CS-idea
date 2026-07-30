// Prevents an additional console window from appearing on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        // Register new #[tauri::command] functions here as native features
        // (e.g. local file caching, OS notifications) get added.
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
