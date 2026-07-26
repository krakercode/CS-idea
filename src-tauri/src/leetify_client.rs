use serde_json::Value;
use thiserror::Error;

const BASE_URL: &str = "https://api-public.cs-prod.leetify.com";
const API_KEY_HEADER: &str = "_leetify_key";

#[derive(Debug, Error)]
pub enum LeetifyError {
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("player not found")]
    NotFound,
    #[error("rate limited, please wait before retrying")]
    RateLimited,
    #[error("leetify returned an error: {status} {body}")]
    Api { status: u16, body: String },
}

pub struct LeetifyClient {
    http: reqwest::Client,
}

impl LeetifyClient {
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("failed to build reqwest client"),
        }
    }

    fn request(&self, path: &str, api_key: Option<&str>) -> reqwest::RequestBuilder {
        let mut req = self.http.get(format!("{BASE_URL}{path}"));
        if let Some(key) = api_key {
            if !key.is_empty() {
                req = req.header(API_KEY_HEADER, key);
            }
        }
        req
    }

    async fn get_json(&self, path: &str, api_key: Option<&str>) -> Result<Value, LeetifyError> {
        let resp = self.request(path, api_key).send().await?;
        let status = resp.status();
        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(LeetifyError::RateLimited);
        }
        if status == reqwest::StatusCode::NOT_FOUND {
            return Err(LeetifyError::NotFound);
        }
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(LeetifyError::Api {
                status: status.as_u16(),
                body,
            });
        }
        Ok(resp.json::<Value>().await?)
    }

    /// `player_id` may be a Steam64 ID or a Leetify profile UUID.
    pub async fn get_player_profile(
        &self,
        player_id: &str,
        api_key: Option<&str>,
    ) -> Result<Value, LeetifyError> {
        let path = format!("/v3/profile?steam64_id={}", urlencoding(player_id));
        self.get_json(&path, api_key).await
    }

    pub async fn get_player_match_history(
        &self,
        player_id: &str,
        api_key: Option<&str>,
    ) -> Result<Value, LeetifyError> {
        let path = format!("/v3/profile/matches?steam64_id={}", urlencoding(player_id));
        self.get_json(&path, api_key).await
    }

    pub async fn validate_api_key(&self, api_key: &str) -> Result<bool, LeetifyError> {
        match self.get_json("/api-key/validate", Some(api_key)).await {
            Ok(_) => Ok(true),
            Err(LeetifyError::Api { status, .. }) if status == 401 || status == 403 => Ok(false),
            Err(e) => Err(e),
        }
    }
}

fn urlencoding(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{:02X}", byte)),
        }
    }
    out
}
