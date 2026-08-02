use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::Datelike;
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_store::StoreExt;

/// Serializes token refresh so concurrent callers (multiple widgets polling
/// around the same expiry - routine, not hypothetical, since `useNowPlaying`
/// polls every 5s while the user might also be browsing the library) don't
/// all race to exchange the same refresh token at once. Spotify sometimes
/// rotates the refresh token on exchange, so a losing concurrent exchange
/// using the now-stale token would fail with `invalid_grant`.
pub struct SpotifyState {
    refresh_lock: tokio::sync::Mutex<()>,
}

impl SpotifyState {
    pub fn new() -> Self {
        Self {
            refresh_lock: tokio::sync::Mutex::new(()),
        }
    }
}

/// Not a secret - Spotify's Authorization Code + PKCE flow (the right fit
/// for a desktop app, since there's no way to keep a client secret safe in
/// a distributed binary) never sends a client secret at all. Anyone can see
/// this value; PKCE's `code_verifier`/`code_challenge` pair is what actually
/// proves this login attempt belongs to this app instance.
const CLIENT_ID: &str = "a82c0039f3024cbb88ecb595f381ff4e";

/// Must exactly match a Redirect URI registered on the Spotify Developer
/// dashboard for this Client ID - Spotify rejects any redirect that isn't an
/// exact string match, so the loopback server below is pinned to this same
/// port rather than letting the OS pick a free one.
const REDIRECT_PORT: u16 = 14700;
const REDIRECT_URI: &str = "http://127.0.0.1:14700/callback";
// `streaming` + `user-read-email` + `user-read-private` are what Spotify's
// Web Playback SDK docs require to initialize a player (the SDK registers
// this app as a real Spotify Connect device). `user-modify-playback-state`
// is what actually lets that device be controlled - play/pause/skip/seek/
// volume and the transfer-playback call all 403 without it. The rest are
// for browsing the library UI: `user-library-read` (saved tracks/albums),
// `playlist-read-private` + `playlist-read-collaborative` (the user's own
// and collaborative playlists - public ones would show without these, but
// most of a real library isn't public), `user-follow-read` (followed
// artists). Existing connections won't have any of these until reconnected
// - Spotify requires a fresh consent grant to add scopes to a token,
// there's no way to upgrade one in place.
const SCOPES: &str = "user-read-currently-playing user-read-playback-state user-modify-playback-state user-top-read user-read-email user-read-private user-library-read playlist-read-private playlist-read-collaborative user-follow-read";

/// Tokens are stored on disk via tauri-plugin-store (a JSON file in the
/// app's data dir), the same mechanism already used for the Leetify API
/// key. That's plaintext-on-disk, not an OS keychain - good enough for a
/// single-user desktop dashboard, but worth knowing if that matters to you.
const STORE_FILE: &str = "spotify-auth.json";

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SongOfDay {
    pub track_name: String,
    pub artist: String,
    pub album_art_url: Option<String>,
    pub external_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: u64,
}

// Same track-object shape Spotify returns from search and top-tracks alike -
// one struct covers both call sites.
#[derive(Debug, Deserialize, Clone)]
struct TrackItem {
    name: String,
    artists: Vec<ArtistItem>,
    album: AlbumItem,
    #[serde(default)]
    external_urls: Option<ExternalUrls>,
}

#[derive(Debug, Deserialize, Clone)]
struct ArtistItem {
    name: String,
}

#[derive(Debug, Deserialize, Clone)]
struct AlbumItem {
    #[serde(default)]
    images: Vec<AlbumImage>,
}

#[derive(Debug, Deserialize, Clone)]
struct AlbumImage {
    url: String,
}

#[derive(Debug, Deserialize, Clone)]
struct ExternalUrls {
    spotify: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SearchResponse {
    tracks: Option<TracksPage>,
}

#[derive(Debug, Deserialize)]
struct TracksPage {
    #[serde(default)]
    items: Vec<TrackItem>,
}

#[derive(Debug, Deserialize)]
struct TopTracksResponse {
    #[serde(default)]
    items: Vec<TrackItem>,
}

fn random_url_safe_string(byte_len: usize) -> String {
    let mut bytes = vec![0u8; byte_len];
    rand::rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

/// PKCE `code_challenge` = `base64url(sha256(code_verifier))` - proves to
/// Spotify that whoever redeems the authorization code is the same party
/// that started this login (the `code_verifier` never leaves this process
/// until the token exchange, unlike the code itself which briefly appears
/// in a URL).
fn code_challenge(verifier: &str) -> String {
    let hash = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hash)
}

fn now_unix() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

fn save_tokens(app: &AppHandle, tokens: &TokenResponse) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set("access_token", tokens.access_token.clone());
    // Spotify doesn't always send a new refresh_token back (it's only
    // rotated sometimes) - don't clobber the existing one with nothing.
    if let Some(refresh) = &tokens.refresh_token {
        store.set("refresh_token", refresh.clone());
    }
    store.set("expires_at", now_unix() + tokens.expires_in);
    store.save().map_err(|e| e.to_string())
}

async fn exchange_token(client: &reqwest::Client, params: &[(&str, &str)]) -> Result<TokenResponse, String> {
    client
        .post("https://accounts.spotify.com/api/token")
        .form(params)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())
}

/// Runs the full Authorization Code + PKCE flow: opens Spotify's login page
/// in the system browser, catches the redirect on a one-shot local server,
/// exchanges the code for tokens, and stores them. Resolves once the tokens
/// are saved; the frontend's "Connect Spotify" button just awaits this.
pub async fn login(app: &AppHandle, client: &reqwest::Client) -> Result<(), String> {
    let verifier = random_url_safe_string(32);
    let challenge = code_challenge(&verifier);
    let csrf_state = random_url_safe_string(16);

    let (tx, rx) = tokio::sync::oneshot::channel::<String>();
    let tx = std::sync::Mutex::new(Some(tx));

    let oauth_config = tauri_plugin_oauth::OauthConfig {
        ports: Some(vec![REDIRECT_PORT]),
        response: Some(
            "<html><body>Signed in - you can close this window and go back to JESSPR-EAST.</body></html>".into(),
        ),
        ..Default::default()
    };

    tauri_plugin_oauth::start_with_config(oauth_config, move |url| {
        if let Some(sender) = tx.lock().expect("oauth callback mutex poisoned").take() {
            let _ = sender.send(url);
        }
    })
    .map_err(|e| e.to_string())?;

    let mut authorize_url =
        reqwest::Url::parse("https://accounts.spotify.com/authorize").expect("static URL is valid");
    authorize_url
        .query_pairs_mut()
        .append_pair("client_id", CLIENT_ID)
        .append_pair("response_type", "code")
        .append_pair("redirect_uri", REDIRECT_URI)
        .append_pair("code_challenge_method", "S256")
        .append_pair("code_challenge", &challenge)
        .append_pair("scope", SCOPES)
        .append_pair("state", &csrf_state);

    app.opener()
        .open_url(authorize_url.to_string(), None::<&str>)
        .map_err(|e| e.to_string())?;

    let redirected_url = match tokio::time::timeout(Duration::from_secs(300), rx).await {
        Ok(result) => result.map_err(|_| "Spotify login was cancelled.".to_string())?,
        Err(_) => {
            // Nothing arrived within the timeout, so the background listener
            // thread is still blocked waiting for a connection (e.g. the
            // browser tab was closed before completing the redirect) -
            // explicitly cancel it, or the port stays bound for the rest of
            // the process's life and every later login attempt fails to
            // bind it.
            let _ = tauri_plugin_oauth::cancel(REDIRECT_PORT);
            return Err("Spotify login timed out - please try again.".to_string());
        }
    };

    let parsed = reqwest::Url::parse(&redirected_url).map_err(|e| e.to_string())?;
    let params: HashMap<String, String> = parsed.query_pairs().into_owned().collect();

    if params.get("state").map(String::as_str) != Some(csrf_state.as_str()) {
        return Err("Spotify login response failed a security check (state mismatch) - please try again.".to_string());
    }

    let code = params.get("code").ok_or_else(|| {
        params
            .get("error")
            .cloned()
            .unwrap_or_else(|| "Spotify did not return an authorization code.".to_string())
    })?;

    let tokens = exchange_token(
        client,
        &[
            ("grant_type", "authorization_code"),
            ("code", code.as_str()),
            ("redirect_uri", REDIRECT_URI),
            ("client_id", CLIENT_ID),
            ("code_verifier", &verifier),
        ],
    )
    .await?;

    save_tokens(app, &tokens)
}

pub fn logout(app: &AppHandle) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.delete("access_token");
    store.delete("refresh_token");
    store.delete("expires_at");
    store.save().map_err(|e| e.to_string())
}

pub fn is_connected(app: &AppHandle) -> Result<bool, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    Ok(store.get("refresh_token").is_some())
}

/// Returns a valid access token, refreshing it first if it's missing or
/// close to expiry. `Ok(None)` means there's no stored login at all (never
/// connected, or logged out) - distinct from a network/refresh failure,
/// which is a hard error.
async fn ensure_fresh_token(app: &AppHandle, client: &reqwest::Client) -> Result<Option<String>, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;

    if store.get("refresh_token").and_then(|v| v.as_str().map(str::to_string)).is_none() {
        return Ok(None);
    }

    let expires_at = store.get("expires_at").and_then(|v| v.as_u64()).unwrap_or(0);
    let cached_access_token = store.get("access_token").and_then(|v| v.as_str().map(str::to_string));

    let needs_refresh = cached_access_token.is_none() || now_unix() + 60 >= expires_at;
    if !needs_refresh {
        return Ok(cached_access_token);
    }

    // Concurrent callers can all observe `needs_refresh` at once near an
    // expiry - serialize the actual refresh so only one request hits
    // Spotify's token endpoint (see `SpotifyState`'s doc comment).
    let spotify_state = app.state::<SpotifyState>();
    let _guard = spotify_state.refresh_lock.lock().await;

    // Re-check now that we hold the lock - another caller may have already
    // refreshed while this one was waiting for it.
    let expires_at = store.get("expires_at").and_then(|v| v.as_u64()).unwrap_or(0);
    let cached_access_token = store.get("access_token").and_then(|v| v.as_str().map(str::to_string));
    if cached_access_token.is_some() && now_unix() + 60 < expires_at {
        return Ok(cached_access_token);
    }

    let refresh_token = store
        .get("refresh_token")
        .and_then(|v| v.as_str().map(str::to_string))
        .ok_or_else(|| "Spotify session was logged out while refreshing.".to_string())?;

    let tokens = exchange_token(
        client,
        &[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token.as_str()),
            ("client_id", CLIENT_ID),
        ],
    )
    .await?;

    let access_token = tokens.access_token.clone();
    save_tokens(app, &tokens)?;
    Ok(Some(access_token))
}

/// Hands a valid, freshly-refreshed access token to the frontend. This is a
/// deliberate, narrow exception to every other function in this module
/// keeping tokens Rust-side only: browsing (playlists/albums/artists/
/// search) and remote-control (play/pause/skip/seek/volume - see
/// spotifyService.ts) call Spotify's Web API directly from the browser
/// context via plain `fetch()` rather than growing a one-to-one Rust
/// command per endpoint. The token is still short-lived and scoped to what
/// the user already granted.
pub async fn get_access_token(app: &AppHandle, client: &reqwest::Client) -> Result<Option<String>, String> {
    ensure_fresh_token(app, client).await
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SavedTrack {
    pub uri: String,
    pub track_name: String,
    pub artist: String,
    pub album_art_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SavedTracksResponse {
    #[serde(default)]
    items: Vec<SavedTrackItem>,
}

#[derive(Debug, Deserialize)]
struct SavedTrackItem {
    track: Option<UriTrackItem>,
}

// Same shape as TrackItem plus the `uri` field the player needs to actually
// queue/play a specific saved track (not returned by the endpoints
// TrackItem is otherwise used for, so kept separate rather than bolted on).
#[derive(Debug, Deserialize)]
struct UriTrackItem {
    uri: String,
    name: String,
    artists: Vec<ArtistItem>,
    album: AlbumItem,
}

fn parse_saved_tracks_response(body: &str) -> Vec<SavedTrack> {
    let Ok(parsed) = serde_json::from_str::<SavedTracksResponse>(body) else {
        return Vec::new();
    };

    parsed
        .items
        .into_iter()
        .filter_map(|item| {
            let track = item.track?;
            Some(SavedTrack {
                uri: track.uri,
                track_name: track.name,
                artist: track.artists.into_iter().map(|a| a.name).collect::<Vec<_>>().join(", "),
                album_art_url: track.album.images.first().map(|i| i.url.clone()),
            })
        })
        .collect()
}

/// The user's saved ("Liked Songs") tracks, most-recently-saved first
/// (Spotify's own default order for this endpoint). `Ok(None)` covers "not
/// connected" the same way as `now_playing`/`song_of_day`.
pub async fn saved_tracks(
    app: &AppHandle,
    client: &reqwest::Client,
    limit: u32,
    offset: u32,
) -> Result<Option<Vec<SavedTrack>>, String> {
    let Some(access_token) = ensure_fresh_token(app, client).await? else {
        return Ok(None);
    };

    let url = format!("https://api.spotify.com/v1/me/tracks?limit={limit}&offset={offset}");
    let response = client.get(&url).bearer_auth(access_token).send().await.map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Ok(Some(Vec::new()));
    }
    let body = response.text().await.map_err(|e| e.to_string())?;
    Ok(Some(parse_saved_tracks_response(&body)))
}

fn urlencoding(input: &str) -> String {
    use std::fmt::Write as _;

    let mut out = String::with_capacity(input.len());
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            _ => {
                let _ = write!(out, "%{byte:02X}");
            }
        }
    }
    out
}

fn track_to_song(track: TrackItem) -> SongOfDay {
    SongOfDay {
        track_name: track.name,
        artist: track.artists.into_iter().map(|a| a.name).collect::<Vec<_>>().join(", "),
        album_art_url: track.album.images.first().map(|i| i.url.clone()),
        external_url: track.external_urls.and_then(|u| u.spotify),
    }
}

/// A stable-for-the-whole-day, changes-tomorrow index into a list of length
/// `len` - the same seed always picks the same item on a given date, so
/// "song of the day" doesn't flicker between app restarts or widget
/// refreshes within the same day.
fn pick_index(len: usize, seed: i32) -> Option<usize> {
    if len == 0 {
        return None;
    }
    Some(seed.rem_euclid(len as i32) as usize)
}

fn today_seed() -> i32 {
    chrono::Utc::now().date_naive().num_days_from_ce()
}

fn parse_search_response(body: &str) -> Vec<TrackItem> {
    serde_json::from_str::<SearchResponse>(body)
        .ok()
        .and_then(|r| r.tracks)
        .map(|t| t.items)
        .unwrap_or_default()
}

fn parse_top_tracks_response(body: &str) -> Vec<TrackItem> {
    serde_json::from_str::<TopTracksResponse>(body).map(|r| r.items).unwrap_or_default()
}

async fn search_track_by_artist(
    client: &reqwest::Client,
    access_token: &str,
    artist: &str,
    seed: i32,
) -> Option<TrackItem> {
    let query = format!("artist:\"{artist}\"");
    let url = format!("https://api.spotify.com/v1/search?type=track&limit=50&q={}", urlencoding(&query));

    let response = client.get(&url).bearer_auth(access_token).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }
    let body = response.text().await.ok()?;
    let items = parse_search_response(&body);
    let index = pick_index(items.len(), seed)?;
    items.into_iter().nth(index)
}

async fn top_track(client: &reqwest::Client, access_token: &str, seed: i32) -> Option<TrackItem> {
    let response = client
        .get("https://api.spotify.com/v1/me/top/tracks?time_range=medium_term&limit=50")
        .bearer_auth(access_token)
        .send()
        .await
        .ok()?;
    // A 403 here just means the "user-top-read" scope hasn't been granted
    // yet (e.g. connected before that scope was added) - treated the same
    // as "no top tracks available" rather than a hard error.
    if !response.status().is_success() {
        return None;
    }
    let body = response.text().await.ok()?;
    let items = parse_top_tracks_response(&body);
    let index = pick_index(items.len(), seed)?;
    items.into_iter().nth(index)
}

/// `favorite_artists` (user-entered, see the "Of the Day" widget) takes
/// priority when present - a deterministic pick from that day's chosen
/// artist's tracks via Spotify's public Search endpoint. Falls back to the
/// user's own top tracks (needs the `user-top-read` scope) when no
/// favorite artists are configured. `Ok(None)` covers "not connected" and
/// "nothing to pick from" alike, same as `now_playing`.
pub async fn song_of_day(
    app: &AppHandle,
    client: &reqwest::Client,
    favorite_artists: &[String],
) -> Result<Option<SongOfDay>, String> {
    let Some(access_token) = ensure_fresh_token(app, client).await? else {
        return Ok(None);
    };

    let seed = today_seed();

    let track = if let Some(index) = pick_index(favorite_artists.len(), seed) {
        search_track_by_artist(client, &access_token, &favorite_artists[index], seed).await
    } else {
        top_track(client, &access_token, seed).await
    };

    Ok(track.map(track_to_song))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn code_challenge_matches_rfc7636_test_vector() {
        // The example verifier/challenge pair from RFC 7636 Appendix B.
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let challenge = code_challenge(verifier);
        assert_eq!(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    }

    #[test]
    fn random_url_safe_string_uses_pkce_safe_alphabet() {
        let s = random_url_safe_string(32);
        assert!(!s.is_empty());
        assert!(
            s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'),
            "PKCE code_verifier must only contain unreserved characters, got: {s}"
        );
    }

    #[test]
    fn random_url_safe_string_is_actually_random() {
        assert_ne!(random_url_safe_string(16), random_url_safe_string(16));
    }

    const SEARCH_SAMPLE: &str = r#"{
        "tracks": {
            "items": [
                {
                    "name": "Track One",
                    "duration_ms": 200000,
                    "artists": [{ "name": "Artist A" }],
                    "album": { "name": "Album A", "images": [{ "url": "https://example.com/a.jpg" }] },
                    "external_urls": { "spotify": "https://open.spotify.com/track/1" }
                },
                {
                    "name": "Track Two",
                    "duration_ms": 210000,
                    "artists": [{ "name": "Artist A" }, { "name": "Artist B" }],
                    "album": { "name": "Album B", "images": [] },
                    "external_urls": { "spotify": "https://open.spotify.com/track/2" }
                }
            ]
        }
    }"#;

    #[test]
    fn parses_search_response_tracks() {
        let items = parse_search_response(SEARCH_SAMPLE);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].name, "Track One");
        assert_eq!(items[1].artists.len(), 2);
    }

    #[test]
    fn search_response_missing_tracks_yields_empty_not_panic() {
        assert!(parse_search_response(r#"{}"#).is_empty());
        assert!(parse_search_response("not json").is_empty());
    }

    const TOP_TRACKS_SAMPLE: &str = r#"{
        "items": [
            {
                "name": "Top Track",
                "duration_ms": 180000,
                "artists": [{ "name": "Artist C" }],
                "album": { "name": "Album C", "images": [{ "url": "https://example.com/c.jpg" }] },
                "external_urls": { "spotify": "https://open.spotify.com/track/3" }
            }
        ]
    }"#;

    #[test]
    fn parses_top_tracks_response() {
        let items = parse_top_tracks_response(TOP_TRACKS_SAMPLE);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "Top Track");
    }

    #[test]
    fn top_tracks_malformed_json_yields_empty_not_panic() {
        assert!(parse_top_tracks_response("not json").is_empty());
    }

    #[test]
    fn pick_index_wraps_within_bounds_and_is_deterministic() {
        assert_eq!(pick_index(0, 42), None);
        assert_eq!(pick_index(5, 0), Some(0));
        assert_eq!(pick_index(5, 7), Some(2));
        // Negative seeds still land in-bounds (rem_euclid, not rem).
        assert_eq!(pick_index(5, -1), Some(4));
    }

    #[test]
    fn track_to_song_prefers_first_album_image_and_joins_artists() {
        let items = parse_search_response(SEARCH_SAMPLE);
        let song = track_to_song(items[1].clone());
        assert_eq!(song.track_name, "Track Two");
        assert_eq!(song.artist, "Artist A, Artist B");
        assert_eq!(song.album_art_url, None); // empty images array
        assert_eq!(song.external_url.as_deref(), Some("https://open.spotify.com/track/2"));
    }

    const SAVED_TRACKS_SAMPLE: &str = r#"{
        "items": [
            {
                "track": {
                    "uri": "spotify:track:abc123",
                    "name": "Saved One",
                    "artists": [{ "name": "Artist D" }],
                    "album": { "name": "Album D", "images": [{ "url": "https://example.com/d.jpg" }] }
                }
            },
            { "track": null }
        ]
    }"#;

    #[test]
    fn parses_saved_tracks_and_drops_null_ones() {
        let tracks = parse_saved_tracks_response(SAVED_TRACKS_SAMPLE);
        assert_eq!(tracks.len(), 1);
        assert_eq!(tracks[0].uri, "spotify:track:abc123");
        assert_eq!(tracks[0].track_name, "Saved One");
        assert_eq!(tracks[0].artist, "Artist D");
        assert_eq!(tracks[0].album_art_url.as_deref(), Some("https://example.com/d.jpg"));
    }

    #[test]
    fn saved_tracks_malformed_json_yields_empty_not_panic() {
        assert!(parse_saved_tracks_response("not json").is_empty());
    }
}
