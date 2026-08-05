use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    pub competition: String,
    pub category: String, // "esports" | "sports"
    pub start_time: String, // RFC3339
    pub teams: Option<Vec<String>>,
    /// Where "click this match" goes - a real match/official-stream link
    /// when the source provides one, otherwise a search query. General
    /// sports don't have a reliable single-source equivalent, so that's
    /// always a search query (same can't-verify-a-specific-link-so-don't
    /// -guess-one approach as the CS2 lineup source links).
    pub link_url: Option<String>,
}

// TheSportsDB - a free, community-run sports database. "3" is their
// long-documented shared test/free API key (see thesportsdb.com/free_sports_api) -
// works for hobby-scale traffic like this, no signup needed. League IDs are
// TheSportsDB's own numeric ids.
//
// The shared key's `all_leagues.php` (browse-everything) endpoint only
// returns a 5-league demo subset - but `eventsnextleague.php?id=<id>` (what
// this module actually calls) works for a much wider set of ids on the same
// key, confirmed live one by one rather than assumed. This catalog is that
// confirmed set: every id below was checked against the real API and
// returned real upcoming fixtures under the label listed. Not
// "all sports TheSportsDB has" - just a curated, verified-working set for
// the league picker (see `list_sportsdb_leagues`/`fetch_calendar`).
pub const SPORTSDB_LEAGUE_CATALOG: &[(&str, &str, &str)] = &[
    ("4328", "English Premier League", "Soccer"),
    ("4335", "Spanish La Liga", "Soccer"),
    ("4331", "German Bundesliga", "Soccer"),
    ("4332", "Italian Serie A", "Soccer"),
    ("4334", "French Ligue 1", "Soccer"),
    ("4344", "Portuguese Primeira Liga", "Soccer"),
    ("4346", "Major League Soccer", "Soccer"),
    ("4480", "UEFA Champions League", "Soccer"),
    ("4481", "UEFA Europa League", "Soccer"),
    ("4387", "NBA", "Basketball"),
    ("4391", "NFL", "American Football"),
    ("4380", "NHL", "Ice Hockey"),
    ("4424", "MLB", "Baseball"),
    ("4370", "Formula 1", "Motorsport"),
    ("4443", "UFC", "MMA"),
    ("4425", "PGA Tour", "Golf"),
    ("4414", "English Premiership Rugby", "Rugby"),
];

// Preserves pre-existing behavior for anyone who hasn't touched the new
// league picker yet - same two leagues this app always defaulted to.
pub const DEFAULT_SPORTSDB_LEAGUE_IDS: &[&str] = &["4328", "4387"];

const SPORTSDB_API_KEY: &str = "3";

fn league_label(league_id: &str) -> &str {
    SPORTSDB_LEAGUE_CATALOG
        .iter()
        .find(|(id, _, _)| *id == league_id)
        .map(|(_, label, _)| *label)
        .unwrap_or("League")
}

#[derive(Debug, Deserialize)]
struct SportsDbResponse {
    events: Option<Vec<SportsDbEvent>>,
}

#[derive(Debug, Deserialize)]
struct SportsDbEvent {
    #[serde(rename = "idEvent")]
    id_event: String,
    #[serde(rename = "strEvent")]
    str_event: Option<String>,
    #[serde(rename = "strLeague")]
    str_league: Option<String>,
    #[serde(rename = "strHomeTeam")]
    str_home_team: Option<String>,
    #[serde(rename = "strAwayTeam")]
    str_away_team: Option<String>,
    #[serde(rename = "dateEvent")]
    date_event: Option<String>,
    #[serde(rename = "strTime")]
    str_time: Option<String>,
}

/// Parses one TheSportsDB `eventsnextleague.php` response into calendar
/// events. Split from the network call so it's unit-testable against a
/// fixture. `league_label` is our own display name (TheSportsDB's
/// `strLeague` is usually the same, but we already know it from the
/// request rather than trusting the response to always include it).
fn parse_sportsdb_response(body: &str, league_label: &str) -> Vec<CalendarEvent> {
    let Ok(parsed) = serde_json::from_str::<SportsDbResponse>(body) else {
        return Vec::new();
    };

    parsed
        .events
        .unwrap_or_default()
        .into_iter()
        .filter_map(|event| {
            let date = event.date_event?;
            // TheSportsDB times are documented as UTC for most sports;
            // treated as such here. Falls back to midnight if strTime is
            // missing (some events are date-only, e.g. all-day fixtures).
            let time = event.str_time.unwrap_or_else(|| "00:00:00".to_string());
            let start_time = format!("{date}T{time}Z");

            let teams = match (event.str_home_team, event.str_away_team) {
                (Some(home), Some(away)) => Some(vec![home, away]),
                _ => None,
            };

            let title = event.str_event.unwrap_or_else(|| "Match".to_string());
            let search_query = format!("{title} live stream");

            Some(CalendarEvent {
                id: format!("sportsdb-{}", event.id_event),
                title,
                competition: event.str_league.unwrap_or_else(|| league_label.to_string()),
                category: "sports".to_string(),
                start_time,
                teams,
                link_url: Some(format!(
                    "https://www.google.com/search?q={}",
                    urlencoding(&search_query)
                )),
            })
        })
        .collect()
}

async fn fetch_sportsdb_league(client: &reqwest::Client, league_id: &str) -> Vec<CalendarEvent> {
    let url = format!(
        "https://www.thesportsdb.com/api/v1/json/{SPORTSDB_API_KEY}/eventsnextleague.php?id={league_id}"
    );
    let Ok(response) = client.get(&url).send().await else {
        return Vec::new();
    };
    let Ok(body) = response.text().await else {
        return Vec::new();
    };
    parse_sportsdb_response(&body, league_label(league_id))
}

/// Fetches only the leagues the user has selected (see
/// `SPORTSDB_LEAGUE_CATALOG`/`list_sportsdb_leagues`) - falls back to the
/// original default pair if the frontend somehow sends an empty list,
/// rather than silently showing nothing.
async fn fetch_sportsdb(client: &reqwest::Client, league_ids: &[String]) -> Vec<CalendarEvent> {
    let ids: Vec<&str> = if league_ids.is_empty() {
        DEFAULT_SPORTSDB_LEAGUE_IDS.to_vec()
    } else {
        league_ids.iter().map(String::as_str).collect()
    };
    let fetches = ids.iter().map(|id| fetch_sportsdb_league(client, id));
    futures::future::join_all(fetches).await.into_iter().flatten().collect()
}

#[derive(Debug, Clone, Serialize)]
pub struct LeagueOption {
    pub id: String,
    pub label: String,
    pub sport: String,
}

/// The full curated league catalog for the picker UI - static reference
/// data, not a network call.
pub fn list_leagues() -> Vec<LeagueOption> {
    SPORTSDB_LEAGUE_CATALOG
        .iter()
        .map(|(id, label, sport)| LeagueOption { id: id.to_string(), label: label.to_string(), sport: sport.to_string() })
        .collect()
}

pub(crate) fn urlencoding(input: &str) -> String {
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

/// Fetches both sources concurrently and merges them, oldest-first. Sports
/// (TheSportsDB, keyless) always runs; esports (PandaScore) only runs when
/// a key is configured (`pandascore_api_key`), and contributes nothing
/// rather than erroring without one. Each source degrading independently
/// matters here since they're on entirely different upstream services.
pub async fn fetch_all(
    client: &reqwest::Client,
    pandascore_api_key: Option<&str>,
    sportsdb_league_ids: &[String],
) -> Vec<CalendarEvent> {
    let pandascore = async {
        match pandascore_api_key {
            Some(key) if !key.is_empty() => crate::pandascore::fetch(client, key).await,
            _ => Vec::new(),
        }
    };
    let (sportsdb, pandascore) = tokio::join!(fetch_sportsdb(client, sportsdb_league_ids), pandascore);
    let mut events: Vec<CalendarEvent> = sportsdb.into_iter().chain(pandascore).collect();
    events.sort_by(|a, b| a.start_time.cmp(&b.start_time));
    events
}

#[cfg(test)]
mod tests {
    use super::*;

    const SPORTSDB_SAMPLE: &str = r#"{
        "events": [
            {
                "idEvent": "12345",
                "strEvent": "Arsenal vs Chelsea",
                "strLeague": "English Premier League",
                "strHomeTeam": "Arsenal",
                "strAwayTeam": "Chelsea",
                "dateEvent": "2026-08-02",
                "strTime": "15:00:00"
            },
            {
                "idEvent": "12346",
                "strEvent": "Missing date, should be dropped",
                "strHomeTeam": "A",
                "strAwayTeam": "B"
            }
        ]
    }"#;

    #[test]
    fn parses_sportsdb_events_and_drops_dateless_ones() {
        let events = parse_sportsdb_response(SPORTSDB_SAMPLE, "English Premier League");
        assert_eq!(events.len(), 1);
        let event = &events[0];
        assert_eq!(event.id, "sportsdb-12345");
        assert_eq!(event.title, "Arsenal vs Chelsea");
        assert_eq!(event.competition, "English Premier League");
        assert_eq!(event.category, "sports");
        assert_eq!(event.start_time, "2026-08-02T15:00:00Z");
        assert_eq!(event.teams, Some(vec!["Arsenal".to_string(), "Chelsea".to_string()]));
        assert!(event.link_url.as_deref().unwrap().starts_with("https://www.google.com/search?q="));
    }

    #[test]
    fn sportsdb_null_events_yields_empty_not_panic() {
        assert!(parse_sportsdb_response(r#"{"events": null}"#, "League").is_empty());
    }

    #[test]
    fn sportsdb_malformed_json_yields_empty_not_panic() {
        assert!(parse_sportsdb_response("not json", "League").is_empty());
    }
}
