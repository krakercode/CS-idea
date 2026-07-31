use crate::calendar::CalendarEvent;
use serde::Deserialize;

// PandaScore (pandascore.co) is a real esports data API - CS2 matches live
// under the "csgo" videogame slug (kept for API stability across the
// CS:GO -> CS2 rename rather than introducing a breaking rename of their
// own). Auth is a per-account Bearer token, unlike Spotify's public client
// ID - so unlike that one, this key is never baked into the app; it's
// user-supplied (see pandascoreKeyStore.ts) and just omitted from requests
// entirely when not configured, at which point this source contributes no
// events rather than erroring.
//
// This module's response shape has NOT been verified against a live call
// from this sandboxed dev environment (outbound requests to pandascore.co
// are blocked here) - field names are built from PandaScore's documented
// API shape as of when this was written. Every field is read defensively
// (Option<>, graceful fallbacks) so a shape mismatch just yields fewer
// fields per match (or drops a match that's missing something essential),
// never a panic. If matches come back with a wrong title/time/link once
// this is actually run against a live key, check the real response shape
// and adjust the structs below - the rest of the pipeline doesn't change.
const PANDASCORE_UPCOMING_URL: &str = "https://api.pandascore.co/csgo/matches/upcoming";

#[derive(Debug, Deserialize)]
struct PandaScoreMatch {
    id: u64,
    name: Option<String>,
    begin_at: Option<String>,
    scheduled_at: Option<String>,
    league: Option<NamedEntity>,
    serie: Option<SerieEntity>,
    #[serde(default)]
    opponents: Vec<OpponentWrapper>,
    #[serde(default)]
    streams_list: Vec<StreamEntry>,
}

#[derive(Debug, Deserialize)]
struct NamedEntity {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SerieExtra {
    full_name: Option<String>,
    name: Option<String>,
}

// `serie` is sometimes just a name, sometimes has a separate `full_name` -
// try full_name first, fall back to name, without assuming either exists.
type SerieEntity = SerieExtra;

#[derive(Debug, Deserialize)]
struct OpponentWrapper {
    opponent: Option<NamedEntity>,
}

#[derive(Debug, Deserialize)]
struct StreamEntry {
    raw_url: Option<String>,
    official: Option<bool>,
    main: Option<bool>,
}

/// Picks the best available stream link: an official main stream first, any
/// official stream next, then gives up rather than linking to an unofficial
/// (and possibly unauthorized-rebroadcast) stream - same "don't guess a
/// link" caution as the rest of this app's source links.
fn pick_stream_url(streams: &[StreamEntry]) -> Option<String> {
    streams
        .iter()
        .filter(|s| s.official == Some(true))
        .max_by_key(|s| s.main == Some(true))
        .and_then(|s| s.raw_url.clone())
}

fn parse_pandascore_response(body: &str) -> Vec<CalendarEvent> {
    let Ok(matches) = serde_json::from_str::<Vec<PandaScoreMatch>>(body) else {
        return Vec::new();
    };

    matches
        .into_iter()
        .filter_map(|m| {
            let start_time = m.begin_at.or(m.scheduled_at)?;

            let teams: Vec<String> = m
                .opponents
                .into_iter()
                .filter_map(|o| o.opponent?.name)
                .collect();

            let title = m
                .name
                .filter(|n| !n.is_empty())
                .unwrap_or_else(|| if teams.len() == 2 { teams.join(" vs ") } else { "CS2 Match".to_string() });

            let competition = m
                .league
                .and_then(|l| l.name)
                .or_else(|| m.serie.and_then(|s| s.full_name.or(s.name)))
                .unwrap_or_else(|| "PandaScore Match".to_string());

            let search_query = format!("{title} live stream");
            let link_url = pick_stream_url(&m.streams_list)
                .or_else(|| Some(format!("https://www.google.com/search?q={}", crate::calendar::urlencoding(&search_query))));

            Some(CalendarEvent {
                id: format!("pandascore-{}", m.id),
                title,
                competition,
                category: "esports".to_string(),
                start_time,
                teams: if teams.len() == 2 { Some(teams) } else { None },
                link_url,
            })
        })
        .collect()
}

pub async fn fetch(client: &reqwest::Client, api_key: &str) -> Vec<CalendarEvent> {
    let Ok(response) = client.get(PANDASCORE_UPCOMING_URL).bearer_auth(api_key).send().await else {
        return Vec::new();
    };
    if !response.status().is_success() {
        return Vec::new();
    }
    let Ok(body) = response.text().await else {
        return Vec::new();
    };
    parse_pandascore_response(&body)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"[
        {
            "id": 987654,
            "name": "NAVI vs Spirit",
            "begin_at": "2026-08-05T18:00:00Z",
            "scheduled_at": "2026-08-05T18:00:00Z",
            "league": { "name": "BLAST Premier" },
            "serie": { "full_name": "BLAST Premier Fall Groups 2026", "name": "Fall Groups" },
            "opponents": [
                { "opponent": { "name": "Natus Vincere" } },
                { "opponent": { "name": "Team Spirit" } }
            ],
            "streams_list": [
                { "raw_url": "https://www.twitch.tv/unofficial_mirror", "official": false, "main": true },
                { "raw_url": "https://www.youtube.com/blastpremier", "official": true, "main": true },
                { "raw_url": "https://www.twitch.tv/blastpremier", "official": true, "main": false }
            ]
        },
        {
            "id": 987655,
            "name": null,
            "begin_at": null,
            "scheduled_at": null,
            "league": null,
            "serie": null,
            "opponents": [],
            "streams_list": []
        }
    ]"#;

    #[test]
    fn parses_matches_and_drops_ones_without_a_start_time() {
        let events = parse_pandascore_response(SAMPLE);
        assert_eq!(events.len(), 1);
        let event = &events[0];
        assert_eq!(event.id, "pandascore-987654");
        assert_eq!(event.title, "NAVI vs Spirit");
        assert_eq!(event.competition, "BLAST Premier");
        assert_eq!(event.category, "esports");
        assert_eq!(event.start_time, "2026-08-05T18:00:00Z");
        assert_eq!(event.teams, Some(vec!["Natus Vincere".to_string(), "Team Spirit".to_string()]));
        // Prefers the official + main stream over an unofficial one and a
        // non-main official one.
        assert_eq!(event.link_url.as_deref(), Some("https://www.youtube.com/blastpremier"));
    }

    #[test]
    fn falls_back_to_serie_name_when_league_is_missing() {
        let sample = r#"[{
            "id": 1,
            "name": "A vs B",
            "begin_at": "2026-08-05T18:00:00Z",
            "league": null,
            "serie": { "full_name": null, "name": "Fall Groups" },
            "opponents": [],
            "streams_list": []
        }]"#;
        let events = parse_pandascore_response(sample);
        assert_eq!(events[0].competition, "Fall Groups");
        // No official stream - falls back to a search link, same as other
        // sources in this app.
        assert!(events[0].link_url.as_deref().unwrap().starts_with("https://www.google.com/search?q="));
    }

    #[test]
    fn malformed_json_yields_empty_not_panic() {
        assert!(parse_pandascore_response("not json").is_empty());
        assert!(parse_pandascore_response("{}").is_empty());
    }
}
