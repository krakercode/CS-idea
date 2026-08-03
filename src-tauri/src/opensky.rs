use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};

// OpenSky Network (opensky-network.org) - free, keyless flight-tracking API
// built from real ADS-B receiver data, not a scheduled-flights source. That
// distinction matters a lot here: there's no gate info, no delay status, and
// (per OpenSky's own docs) the *arrivals* endpoint is only updated by a
// nightly batch process, so it only ever has data from the previous UTC day
// or earlier - it can't show a flight that hasn't happened yet. This module
// surfaces "recent logged activity", not a live schedule board; the frontend
// labels it that way rather than implying real-time gate/schedule info.
// *Departures* aren't batch-delayed the same way, so that query uses a
// short, recent window instead of "yesterday".
//
// Anonymous (keyless) requests are rate-limited via a daily credit budget
// (400 credits/day for the `/flights/*` bucket, confirmed against OpenSky's
// published credit table) rather than outright blocked, so no API key is
// needed at all - fitting given this is the "no key needed" flight option.
// Every request here stays inside a single UTC-day partition (the cheapest,
// 4-credit tier) except the once-per-view arrivals lookup, which spans
// exactly one day boundary (~30 credits) - still nowhere near the daily
// budget for a feature that's fetched on demand rather than auto-polled.
//
// The flight-object response schema (callsign/firstSeen/lastSeen/
// estDepartureAirport/estArrivalAirport) is OpenSky's long-standing public
// schema, not re-confirmed live this session (this doc page's response
// tables didn't render any content when fetched - an apparent gap on
// OpenSky's end, not something this comment is guessing around). Read
// defensively either way, same convention as this app's other external-data
// modules: a shape mismatch drops a field or a flight, never panics.
const BASE_URL: &str = "https://opensky-network.org/api";

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FlightMovement {
    pub callsign: Option<String>,
    pub other_airport: Option<String>,
    pub time_unix: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawFlight {
    #[serde(default)]
    callsign: Option<String>,
    #[serde(default)]
    first_seen: Option<i64>,
    #[serde(default)]
    last_seen: Option<i64>,
    #[serde(default)]
    est_departure_airport: Option<String>,
    #[serde(default)]
    est_arrival_airport: Option<String>,
}

fn clean_callsign(raw: Option<String>) -> Option<String> {
    raw.map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

/// Caps the list so one very busy hub airport can't dump hundreds of rows
/// into a departure-board widget, and sorts most-recent-first - the natural
/// reading order for "what's happened lately".
const MAX_MOVEMENTS: usize = 30;

fn sort_and_cap(mut movements: Vec<FlightMovement>) -> Vec<FlightMovement> {
    movements.sort_by(|a, b| b.time_unix.cmp(&a.time_unix));
    movements.truncate(MAX_MOVEMENTS);
    movements
}

async fn fetch_flights(client: &reqwest::Client, direction: &str, icao: &str, begin: i64, end: i64) -> Vec<RawFlight> {
    let url = format!("{BASE_URL}/flights/{direction}?airport={icao}&begin={begin}&end={end}");
    let Ok(response) = client.get(&url).send().await else {
        return Vec::new();
    };
    // OpenSky returns 404 with an empty body when nothing matches the
    // window, which is "no results" here, not an error - is_success() being
    // false covers that the same way it covers a real failure.
    if !response.status().is_success() {
        return Vec::new();
    }
    let Ok(body) = response.text().await else {
        return Vec::new();
    };
    serde_json::from_str(&body).unwrap_or_default()
}

fn yesterday_utc_window() -> (i64, i64) {
    let today_midnight = Utc::now().date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();
    let yesterday_midnight = today_midnight - Duration::days(1);
    (yesterday_midnight.timestamp(), today_midnight.timestamp())
}

fn recent_window(hours: i64) -> (i64, i64) {
    let now = Utc::now();
    ((now - Duration::hours(hours)).timestamp(), now.timestamp())
}

/// Recent arrivals at an airport. Reflects OpenSky's nightly batch update,
/// so this is effectively "yesterday's arrivals (UTC)", not "just landed".
pub async fn get_arrivals(client: &reqwest::Client, icao: &str) -> Vec<FlightMovement> {
    let (begin, end) = yesterday_utc_window();
    let raws = fetch_flights(client, "arrival", icao, begin, end).await;
    let movements = raws
        .into_iter()
        .filter_map(|r| {
            Some(FlightMovement {
                callsign: clean_callsign(r.callsign),
                other_airport: r.est_departure_airport,
                time_unix: r.last_seen?,
            })
        })
        .collect();
    sort_and_cap(movements)
}

/// Recent departures from an airport, over a short trailing window - not
/// batch-delayed the way arrivals are, so this can reasonably read as
/// "lately", not "yesterday".
pub async fn get_departures(client: &reqwest::Client, icao: &str) -> Vec<FlightMovement> {
    let (begin, end) = recent_window(4);
    let raws = fetch_flights(client, "departure", icao, begin, end).await;
    let movements = raws
        .into_iter()
        .filter_map(|r| {
            Some(FlightMovement {
                callsign: clean_callsign(r.callsign),
                other_airport: r.est_arrival_airport,
                time_unix: r.first_seen?,
            })
        })
        .collect();
    sort_and_cap(movements)
}

#[cfg(test)]
mod tests {
    use super::*;

    const ARRIVALS_SAMPLE: &str = r#"[
        {
            "icao24": "3c6444",
            "firstSeen": 1517225214,
            "estDepartureAirport": "EDDM",
            "lastSeen": 1517230832,
            "estArrivalAirport": "EDDF",
            "callsign": "DLH1FR  ",
            "estDepartureAirportHorizDistance": 1000,
            "estDepartureAirportVertDistance": 100,
            "estArrivalAirportHorizDistance": 500,
            "estArrivalAirportVertDistance": 50,
            "departureAirportCandidatesCount": 1,
            "arrivalAirportCandidatesCount": 1
        },
        {
            "icao24": "unknown",
            "firstSeen": 1517225000,
            "estDepartureAirport": null,
            "lastSeen": null,
            "estArrivalAirport": "EDDF",
            "callsign": null
        }
    ]"#;

    #[test]
    fn parses_arrival_shape_selecting_departure_side_and_last_seen() {
        let raws: Vec<RawFlight> = serde_json::from_str(ARRIVALS_SAMPLE).unwrap();
        let movements: Vec<FlightMovement> = raws
            .into_iter()
            .filter_map(|r| {
                Some(FlightMovement {
                    callsign: clean_callsign(r.callsign),
                    other_airport: r.est_departure_airport,
                    time_unix: r.last_seen?,
                })
            })
            .collect();
        // Second record has no lastSeen - dropped rather than faked.
        assert_eq!(movements.len(), 1);
        assert_eq!(movements[0].callsign.as_deref(), Some("DLH1FR"));
        assert_eq!(movements[0].other_airport.as_deref(), Some("EDDM"));
        assert_eq!(movements[0].time_unix, 1517230832);
    }

    #[test]
    fn sort_and_cap_orders_most_recent_first_and_caps() {
        let movements: Vec<FlightMovement> = (0..(MAX_MOVEMENTS + 10))
            .map(|i| FlightMovement { callsign: None, other_airport: None, time_unix: i as i64 })
            .collect();
        let result = sort_and_cap(movements);
        assert_eq!(result.len(), MAX_MOVEMENTS);
        assert_eq!(result[0].time_unix, (MAX_MOVEMENTS + 9) as i64);
        assert!(result[0].time_unix > result[1].time_unix);
    }

    #[test]
    fn clean_callsign_trims_padding_and_drops_empty() {
        assert_eq!(clean_callsign(Some("DLH1FR  ".to_string())).as_deref(), Some("DLH1FR"));
        assert_eq!(clean_callsign(Some("   ".to_string())), None);
        assert_eq!(clean_callsign(None), None);
    }

    #[test]
    fn malformed_json_yields_no_flights_not_panic() {
        let raws: Result<Vec<RawFlight>, _> = serde_json::from_str("not json");
        assert!(raws.is_err());
    }
}
