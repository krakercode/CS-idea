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
// TheSportsDB's own numeric ids; a handful of well-known leagues are
// hard-coded below rather than user-configurable for now.
const SPORTSDB_API_KEY: &str = "3";
const SPORTSDB_LEAGUES: &[(&str, &str)] = &[
    ("4328", "English Premier League"), // englist Premier League
    ("4387", "NBA"),
];

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

async fn fetch_sportsdb_league(client: &reqwest::Client, league_id: &str, league_label: &str) -> Vec<CalendarEvent> {
    let url = format!(
        "https://www.thesportsdb.com/api/v1/json/{SPORTSDB_API_KEY}/eventsnextleague.php?id={league_id}"
    );
    let Ok(response) = client.get(&url).send().await else {
        return Vec::new();
    };
    let Ok(body) = response.text().await else {
        return Vec::new();
    };
    parse_sportsdb_response(&body, league_label)
}

async fn fetch_sportsdb(client: &reqwest::Client) -> Vec<CalendarEvent> {
    let fetches = SPORTSDB_LEAGUES.iter().map(|(id, label)| fetch_sportsdb_league(client, id, label));
    futures::future::join_all(fetches).await.into_iter().flatten().collect()
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
pub async fn fetch_all(client: &reqwest::Client, pandascore_api_key: Option<&str>) -> Vec<CalendarEvent> {
    let pandascore = async {
        match pandascore_api_key {
            Some(key) if !key.is_empty() => crate::pandascore::fetch(client, key).await,
            _ => Vec::new(),
        }
    };
    let (sportsdb, pandascore) = tokio::join!(fetch_sportsdb(client), pandascore);
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
