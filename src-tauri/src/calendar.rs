use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    pub competition: String,
    pub category: String, // "esports" | "sports"
    pub start_time: String, // RFC3339
    pub teams: Option<Vec<String>>,
    /// Where "click this match" goes. For HLTV matches this is the match's
    /// own HLTV page (which shows the official stream once live) - not a
    /// scraped/rehosted stream link, just a normal hyperlink to HLTV's own
    /// page about that match. General sports don't have a reliable
    /// equivalent source, so this is a search query instead (same
    /// can't-verify-a-specific-link-so-don't-guess-one approach as the CS2
    /// lineup source links).
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

// HLTV has no official API. This scrapes the public matches listing page,
// which is about as fragile as it sounds: HLTV can (and does, periodically)
// change their markup without notice, which would silently break this until
// someone notices matches stopped showing up and updates the selectors
// below. Genuinely not verifiable against the live site from this
// environment's sandboxed network - the parsing logic is unit-tested
// against a hand-built fixture matching HLTV's structure as of when this
// was written, not the live page. If this breaks, check hltv.org/matches
// in a browser, compare its current markup to the selectors here, and
// update them - the rest of the pipeline (fetch, parse, merge, sort)
// doesn't need to change.
const HLTV_MATCHES_URL: &str = "https://www.hltv.org/matches";

fn parse_hltv_html(html: &str) -> Vec<CalendarEvent> {
    let document = Html::parse_document(html);

    // Each match is (assumed to be) a single <a class="match" href="/matches/...">
    // wrapping everything else, rather than a bare div - `.select()` only
    // searches descendants, so the match link has to be the top-level
    // selector here, not something looked up from inside a nested div.
    //
    // Selectors are declared with .expect() rather than propagated as
    // errors - they're static strings we control, so a parse failure here
    // would be a typo in this file, not bad input from the network.
    let match_selector = Selector::parse("a.match").expect("static selector is valid");
    let team_selector = Selector::parse(".matchTeamName").expect("static selector is valid");
    let event_selector = Selector::parse(".matchEventName").expect("static selector is valid");
    let time_selector = Selector::parse("[data-unix]").expect("static selector is valid");

    document
        .select(&match_selector)
        .filter_map(|match_el| {
            let teams: Vec<String> = match_el
                .select(&team_selector)
                .map(|el| el.text().collect::<Vec<_>>().join(" ").trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            if teams.len() != 2 {
                return None;
            }

            let unix_ms: i64 = match_el.select(&time_selector).next()?.value().attr("data-unix")?.parse().ok()?;
            let start_time = chrono::DateTime::from_timestamp_millis(unix_ms)?.to_rfc3339();

            let event_name = match_el
                .select(&event_selector)
                .next()
                .map(|el| el.text().collect::<Vec<_>>().join(" ").trim().to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| "HLTV Match".to_string());

            let link_url = match_el
                .value()
                .attr("href")
                .map(|href| format!("https://www.hltv.org{href}"))
                .unwrap_or_else(|| HLTV_MATCHES_URL.to_string());

            let id = link_url
                .split("/matches/")
                .nth(1)
                .and_then(|rest| rest.split('/').next())
                .map(|id| format!("hltv-{id}"))
                .unwrap_or_else(|| format!("hltv-{unix_ms}"));

            Some(CalendarEvent {
                id,
                title: teams.join(" vs "),
                competition: event_name,
                category: "esports".to_string(),
                start_time,
                teams: Some(teams),
                link_url: Some(link_url),
            })
        })
        .collect()
}

async fn fetch_hltv(client: &reqwest::Client) -> Vec<CalendarEvent> {
    let Ok(response) = client.get(HLTV_MATCHES_URL).send().await else {
        return Vec::new();
    };
    let Ok(body) = response.text().await else {
        return Vec::new();
    };
    parse_hltv_html(&body)
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

/// Fetches both sources concurrently and merges them, oldest-first. Each
/// source degrading independently (a bad HLTV markup change doesn't take
/// down sports scores, and vice versa) matters more here than usual, since
/// one of these two is explicitly unofficial and expected to break
/// eventually.
pub async fn fetch_all(client: &reqwest::Client) -> Vec<CalendarEvent> {
    let (sportsdb, hltv) = tokio::join!(fetch_sportsdb(client), fetch_hltv(client));
    let mut events: Vec<CalendarEvent> = sportsdb.into_iter().chain(hltv).collect();
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

    // Hand-built to match this file's assumed HLTV markup (see the caveat
    // above parse_hltv_html) - passing here confirms the parsing logic is
    // internally correct, not that it matches the live site today.
    const HLTV_SAMPLE: &str = r#"<!DOCTYPE html>
<html><body>
<div class="upcomingMatchesSection">
  <a class="match" href="/matches/2378421/navi-vs-spirit-blast-premier">
    <div class="upcomingMatch">
      <div class="matchTeam"><div class="matchTeamName">NAVI</div></div>
      <div class="matchTeam"><div class="matchTeamName">Spirit</div></div>
      <div class="matchEvent"><span class="matchEventName">BLAST Premier</span></div>
      <div class="matchTime" data-unix="1785440400000">18:00</div>
    </div>
  </a>
  <div class="upcomingMatch">
    <div class="matchTeamName">TBD</div>
  </div>
</div>
</body></html>"#;

    #[test]
    fn parses_hltv_matches_and_skips_incomplete_ones() {
        let events = parse_hltv_html(HLTV_SAMPLE);
        assert_eq!(events.len(), 1);
        let event = &events[0];
        assert_eq!(event.title, "NAVI vs Spirit");
        assert_eq!(event.competition, "BLAST Premier");
        assert_eq!(event.category, "esports");
        assert_eq!(event.id, "hltv-2378421");
        assert_eq!(event.link_url.as_deref(), Some("https://www.hltv.org/matches/2378421/navi-vs-spirit-blast-premier"));
    }

    #[test]
    fn hltv_malformed_html_yields_empty_not_panic() {
        assert!(parse_hltv_html("<not><valid html").is_empty());
        assert!(parse_hltv_html("").is_empty());
    }
}
