// Prevents an additional console window from appearing on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod calendar;
mod db;
mod leetify_client;
mod news;
mod of_the_day;
mod opensky;
mod pandascore;
mod pokemon_tcg;
mod recipe_of_the_day;
mod spotify;
mod stocks;
mod suggestions;
mod system_health;
mod transit;

use db::Db;
use leetify_client::{LeetifyClient, LeetifyError};
use serde::Serialize;
use serde_json::Value;
use tauri::Manager;

#[derive(Serialize)]
struct ErrorPayload {
    kind: String,
    message: String,
}

impl From<LeetifyError> for ErrorPayload {
    fn from(err: LeetifyError) -> Self {
        let kind = match &err {
            LeetifyError::NotFound => "not_found",
            LeetifyError::RateLimited => "rate_limited",
            LeetifyError::Network(_) => "network",
            LeetifyError::Api { .. } => "api_error",
        };
        Self {
            kind: kind.to_string(),
            message: err.to_string(),
        }
    }
}

impl From<rusqlite::Error> for ErrorPayload {
    fn from(err: rusqlite::Error) -> Self {
        Self {
            kind: "storage".to_string(),
            message: err.to_string(),
        }
    }
}

/// CS2 analysis (Leetify) state - the one part of this app that talks to a
/// real external API and keeps a local database, alongside everything
/// else's mock data. See src/widgets/cs2db/analysis/ on the frontend side.
/// `db` is `Arc`-wrapped so `fetch_profile` can clone a `'static` handle
/// into `spawn_blocking` for the synchronous SQLite write.
struct AnalysisState {
    leetify: LeetifyClient,
    db: std::sync::Arc<Db>,
}

fn extract_ranks_and_rating(profile: &Value) -> (Value, Value) {
    (
        profile.get("ranks").cloned().unwrap_or(Value::Null),
        profile.get("rating").cloned().unwrap_or(Value::Null),
    )
}

#[tauri::command]
async fn fetch_profile(
    state: tauri::State<'_, AnalysisState>,
    player_id: String,
    api_key: Option<String>,
) -> Result<Value, ErrorPayload> {
    let profile = state
        .leetify
        .get_player_profile(&player_id, api_key.as_deref())
        .await?;

    let (ranks, rating) = extract_ranks_and_rating(&profile);
    if !rating.is_null() || !ranks.is_null() {
        // Synchronous SQLite write (mutex lock + disk I/O) moved off the
        // async runtime's worker thread - a stalled disk (AV scan, network
        // drive, memory pressure) would otherwise tie up a thread shared
        // with every other concurrent command (news/stocks/calendar
        // fetches, Spotify polling, etc.).
        let db = state.db.clone();
        tokio::task::spawn_blocking(move || db::insert_snapshot(&db, &player_id, &rating, &ranks))
            .await
            .map_err(|e| ErrorPayload {
                kind: "internal".to_string(),
                message: e.to_string(),
            })??;
    }

    Ok(profile)
}

#[tauri::command]
async fn fetch_match_history(
    state: tauri::State<'_, AnalysisState>,
    player_id: String,
    api_key: Option<String>,
) -> Result<Value, ErrorPayload> {
    let history = state
        .leetify
        .get_player_match_history(&player_id, api_key.as_deref())
        .await?;
    Ok(history)
}

#[tauri::command]
async fn get_trend(
    state: tauri::State<'_, AnalysisState>,
    player_id: String,
) -> Result<Vec<db::Snapshot>, ErrorPayload> {
    // Same reasoning as fetch_profile's write: a synchronous Mutex lock +
    // SQLite read shouldn't run inline on whatever thread services IPC -
    // Tauri doesn't hop sync commands to a blocking thread automatically.
    let db = state.db.clone();
    Ok(tokio::task::spawn_blocking(move || db::get_trend(&db, &player_id))
        .await
        .map_err(|e| ErrorPayload { kind: "internal".to_string(), message: e.to_string() })??)
}

#[tauri::command]
async fn get_suggestions(
    state: tauri::State<'_, AnalysisState>,
    player_id: String,
    limit: Option<usize>,
) -> Result<Vec<suggestions::Suggestion>, ErrorPayload> {
    let db = state.db.clone();
    let latest = tokio::task::spawn_blocking(move || db::get_latest(&db, &player_id))
        .await
        .map_err(|e| ErrorPayload { kind: "internal".to_string(), message: e.to_string() })??;
    match latest {
        Some(snapshot) => Ok(suggestions::suggest(&snapshot.rating, limit.unwrap_or(3))),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
async fn validate_api_key(
    state: tauri::State<'_, AnalysisState>,
    api_key: String,
) -> Result<bool, ErrorPayload> {
    Ok(state.leetify.validate_api_key(&api_key).await?)
}

#[tauri::command]
fn get_system_health(state: tauri::State<'_, system_health::SystemHealthState>) -> system_health::SystemHealth {
    system_health::collect(&state)
}

/// Shared HTTP client for the widgets that fetch real, unauthenticated
/// third-party data (news feeds, stock quotes) - reused across requests for
/// connection pooling, with a browser-like User-Agent since some of these
/// unofficial endpoints reject the default reqwest one.
struct HttpState {
    client: reqwest::Client,
}

impl HttpState {
    fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36")
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .expect("failed to build shared http client");
        Self { client }
    }
}

#[tauri::command]
async fn fetch_news(
    state: tauri::State<'_, HttpState>,
    sources: Vec<news::NewsSourceRequest>,
) -> Result<Vec<news::NewsArticle>, ()> {
    Ok(news::fetch_all(&state.client, &sources).await)
}

#[tauri::command]
async fn fetch_quotes(state: tauri::State<'_, HttpState>, symbols: Vec<String>) -> Result<Vec<stocks::Quote>, ()> {
    Ok(stocks::fetch_all(&state.client, &symbols).await)
}

#[tauri::command]
async fn fetch_calendar(
    state: tauri::State<'_, HttpState>,
    pandascore_api_key: Option<String>,
    sportsdb_league_ids: Vec<String>,
) -> Result<Vec<calendar::CalendarEvent>, ()> {
    Ok(calendar::fetch_all(&state.client, pandascore_api_key.as_deref(), &sportsdb_league_ids).await)
}

#[tauri::command]
fn list_sportsdb_leagues() -> Vec<calendar::LeagueOption> {
    calendar::list_leagues()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OfTheDayResponse {
    article: Option<of_the_day::FeaturedArticle>,
    picture: Option<of_the_day::PictureOfDay>,
    song: Option<spotify::SongOfDay>,
    // `song_of_day`'s `Err` (a genuine failure - network, or Spotify session
    // lost mid-refresh) used to be collapsed into the same `None` as "never
    // connected" via `.unwrap_or(None)`, silently erasing a distinction
    // `ensure_fresh_token`'s own doc comment calls out as meaningful.
    // Additive field (frontend that ignores it still works exactly as
    // before) so the UI can now tell "not connected" from "something broke".
    song_error: Option<String>,
    recipe: Option<recipe_of_the_day::RecipeOfDay>,
}

#[tauri::command]
async fn fetch_of_the_day(
    app: tauri::AppHandle,
    state: tauri::State<'_, HttpState>,
    favorite_artists: Vec<String>,
    vegan: bool,
) -> Result<OfTheDayResponse, ()> {
    let (wiki, song, recipe) = tokio::join!(
        of_the_day::fetch(&state.client),
        spotify::song_of_day(&app, &state.client, &favorite_artists),
        recipe_of_the_day::fetch(&state.client, vegan)
    );
    let (article, picture) = wiki;
    let (song, song_error) = match song {
        Ok(song) => (song, None),
        Err(err) => (None, Some(err)),
    };
    Ok(OfTheDayResponse { article, picture, song, song_error, recipe })
}

#[tauri::command]
async fn spotify_login(app: tauri::AppHandle, state: tauri::State<'_, HttpState>) -> Result<(), String> {
    spotify::login(&app, &state.client).await
}

#[tauri::command]
async fn spotify_logout(app: tauri::AppHandle) -> Result<(), String> {
    spotify::logout(&app).await
}

#[tauri::command]
fn spotify_is_connected(app: tauri::AppHandle) -> Result<bool, String> {
    spotify::is_connected(&app)
}

#[tauri::command]
async fn spotify_get_access_token(
    app: tauri::AppHandle,
    state: tauri::State<'_, HttpState>,
) -> Result<Option<String>, String> {
    spotify::get_access_token(&app, &state.client).await
}

#[tauri::command]
async fn spotify_saved_tracks(
    app: tauri::AppHandle,
    state: tauri::State<'_, HttpState>,
    limit: u32,
    offset: u32,
) -> Result<Option<Vec<spotify::SavedTrack>>, String> {
    spotify::saved_tracks(&app, &state.client, limit, offset).await
}

#[tauri::command]
async fn search_pokemon_cards(
    state: tauri::State<'_, HttpState>,
    query: String,
    api_key: Option<String>,
) -> Result<Vec<pokemon_tcg::PokemonCard>, ()> {
    Ok(pokemon_tcg::search_cards(&state.client, &query, api_key.as_deref()).await)
}

#[tauri::command]
async fn get_pokemon_card(
    state: tauri::State<'_, HttpState>,
    card_id: String,
    api_key: Option<String>,
) -> Result<Option<pokemon_tcg::PokemonCard>, ()> {
    Ok(pokemon_tcg::get_card(&state.client, &card_id, api_key.as_deref()).await)
}

#[tauri::command]
async fn search_transit_stops(
    state: tauri::State<'_, HttpState>,
    api_key: String,
    query: String,
) -> Result<Vec<transit::TransitStop>, ()> {
    Ok(transit::search_stops(&state.client, &api_key, &query).await)
}

#[tauri::command]
async fn get_transit_departures(
    state: tauri::State<'_, HttpState>,
    api_key: String,
    stop_id: String,
) -> Result<Vec<transit::TransitDeparture>, ()> {
    Ok(transit::get_departures(&state.client, &api_key, &stop_id).await)
}

#[tauri::command]
async fn get_airport_arrivals(
    state: tauri::State<'_, HttpState>,
    icao: String,
) -> Result<Vec<opensky::FlightMovement>, ()> {
    Ok(opensky::get_arrivals(&state.client, &icao).await)
}

#[tauri::command]
async fn get_airport_departures(
    state: tauri::State<'_, HttpState>,
    icao: String,
) -> Result<Vec<opensky::FlightMovement>, ()> {
    Ok(opensky::get_departures(&state.client, &icao).await)
}

/// Entertainment Centre's "Launch" button - spawns a user-configured local
/// executable (an emulator, a game, anything) with optional arguments (e.g.
/// a ROM/save path), fire-and-forget. Deliberately not going through
/// `tauri-plugin-shell`'s scoped `Command` API: that plugin is meant for a
/// fixed, developer-declared allowlist of binaries the *app itself* wants
/// to run, whereas this needs to run whatever the *user* points it at -
/// `std::process::Command` directly is the right tool here, and (being a
/// plain app command, not a plugin-provided one) needs no capability grant.
#[tauri::command]
fn launch_shortcut(path: String, args: Vec<String>) -> Result<(), String> {
    std::process::Command::new(&path)
        .args(&args)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Couldn't launch \"{path}\": {e}"))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            let db = db::open(&data_dir).expect("failed to open local stats db");
            app.manage(AnalysisState {
                leetify: LeetifyClient::new(),
                db: std::sync::Arc::new(db),
            });
            app.manage(system_health::SystemHealthState::new());
            app.manage(HttpState::new());
            app.manage(spotify::SpotifyState::new());
            Ok(())
        })
        // Register new #[tauri::command] functions here as native features get added.
        .invoke_handler(tauri::generate_handler![
            fetch_profile,
            fetch_match_history,
            get_trend,
            get_suggestions,
            validate_api_key,
            get_system_health,
            fetch_news,
            fetch_quotes,
            fetch_calendar,
            list_sportsdb_leagues,
            fetch_of_the_day,
            spotify_login,
            spotify_logout,
            spotify_is_connected,
            spotify_get_access_token,
            spotify_saved_tracks,
            search_pokemon_cards,
            get_pokemon_card,
            search_transit_stops,
            get_transit_departures,
            get_airport_arrivals,
            get_airport_departures,
            launch_shortcut
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
