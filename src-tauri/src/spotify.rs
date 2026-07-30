use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_store::StoreExt;

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
const SCOPES: &str = "user-read-currently-playing user-read-playback-state";

/// Tokens are stored on disk via tauri-plugin-store (a JSON file in the
/// app's data dir), the same mechanism already used for the Leetify API
/// key. That's plaintext-on-disk, not an OS keychain - good enough for a
/// single-user desktop dashboard, but worth knowing if that matters to you.
const STORE_FILE: &str = "spotify-auth.json";

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NowPlaying {
    pub track_name: String,
    pub artist: String,
    pub album_name: String,
    pub is_playing: bool,
    pub progress_ms: u64,
    pub duration_ms: u64,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: u64,
}

#[derive(Debug, Deserialize)]
struct CurrentlyPlayingResponse {
    is_playing: bool,
    progress_ms: Option<u64>,
    item: Option<TrackItem>,
}

#[derive(Debug, Deserialize)]
struct TrackItem {
    name: String,
    duration_ms: u64,
    artists: Vec<ArtistItem>,
    album: AlbumItem,
}

#[derive(Debug, Deserialize)]
struct ArtistItem {
    name: String,
}

#[derive(Debug, Deserialize)]
struct AlbumItem {
    name: String,
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

    let redirected_url = tokio::time::timeout(Duration::from_secs(300), rx)
        .await
        .map_err(|_| "Spotify login timed out - please try again.".to_string())?
        .map_err(|_| "Spotify login was cancelled.".to_string())?;

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

    let Some(refresh_token) = store.get("refresh_token").and_then(|v| v.as_str().map(str::to_string)) else {
        return Ok(None);
    };

    let expires_at = store.get("expires_at").and_then(|v| v.as_u64()).unwrap_or(0);
    let cached_access_token = store.get("access_token").and_then(|v| v.as_str().map(str::to_string));

    let needs_refresh = cached_access_token.is_none() || now_unix() + 60 >= expires_at;
    if !needs_refresh {
        return Ok(cached_access_token);
    }

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

/// `Ok(None)` covers both "not connected" and "connected but nothing is
/// currently playing" - the widget doesn't need to tell those apart, it
/// just shows the disconnected/idle state either way.
pub async fn now_playing(app: &AppHandle, client: &reqwest::Client) -> Result<Option<NowPlaying>, String> {
    let Some(access_token) = ensure_fresh_token(app, client).await? else {
        return Ok(None);
    };

    let response = client
        .get("https://api.spotify.com/v1/me/player/currently-playing")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status() == reqwest::StatusCode::NO_CONTENT || !response.status().is_success() {
        return Ok(None);
    }

    let body: CurrentlyPlayingResponse = response.json().await.map_err(|e| e.to_string())?;
    let Some(item) = body.item else {
        return Ok(None);
    };

    Ok(Some(NowPlaying {
        track_name: item.name,
        artist: item.artists.into_iter().map(|a| a.name).collect::<Vec<_>>().join(", "),
        album_name: item.album.name,
        is_playing: body.is_playing,
        progress_ms: body.progress_ms.unwrap_or(0),
        duration_ms: item.duration_ms,
    }))
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
}
