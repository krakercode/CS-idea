// Prevents an additional console window from appearing on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod leetify_client;
mod news;
mod stocks;
mod suggestions;
mod system_health;

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
struct AnalysisState {
    leetify: LeetifyClient,
    db: Db,
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
        db::insert_snapshot(&state.db, &player_id, &rating, &ranks)?;
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
fn get_trend(
    state: tauri::State<'_, AnalysisState>,
    player_id: String,
) -> Result<Vec<db::Snapshot>, ErrorPayload> {
    Ok(db::get_trend(&state.db, &player_id)?)
}

#[tauri::command]
fn get_suggestions(
    state: tauri::State<'_, AnalysisState>,
    player_id: String,
    limit: Option<usize>,
) -> Result<Vec<suggestions::Suggestion>, ErrorPayload> {
    let latest = db::get_latest(&state.db, &player_id)?;
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
async fn fetch_news(state: tauri::State<'_, HttpState>, feeds: Vec<news::FeedRequest>) -> Result<Vec<news::NewsArticle>, ()> {
    Ok(news::fetch_all(&state.client, &feeds).await)
}

#[tauri::command]
async fn fetch_quotes(state: tauri::State<'_, HttpState>, symbols: Vec<String>) -> Result<Vec<stocks::Quote>, ()> {
    Ok(stocks::fetch_all(&state.client, &symbols).await)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            let db = db::open(&data_dir).expect("failed to open local stats db");
            app.manage(AnalysisState {
                leetify: LeetifyClient::new(),
                db,
            });
            app.manage(system_health::SystemHealthState::new());
            app.manage(HttpState::new());
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
            fetch_quotes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
