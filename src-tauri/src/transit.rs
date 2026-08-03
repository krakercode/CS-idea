use crate::calendar::urlencoding;
use serde::{Deserialize, Serialize};

// Transitland v2 (transit.land, run by Interline) aggregates GTFS +
// GTFS-realtime feeds from thousands of transit agencies worldwide - trains,
// subways, buses, and ferries all through one API, which is what makes it a
// reasonable single source for a multi-mode departure board instead of
// juggling one integration per transit agency. Requires a free API key
// (user signs up at transit.land - a per-account secret, so it's
// user-supplied like PandaScore's, never baked in).
//
// This module's response shape has NOT been verified against a live call -
// getting a real key requires an interactive signup this environment can't
// complete, and the API returns a bare `{"error":"Unauthorized"}` without
// one (confirmed live: that part works). Field names below follow
// Transitland's documented REST API + the underlying GTFS spec's field
// names. Every field is read defensively (Option<>, `#[serde(default)]`,
// graceful fallbacks) so a shape mismatch just yields fewer fields per stop
// or departure, never a panic - same approach as pandascore.rs. If a field
// comes back missing or misnamed once tested against a live key, check the
// real response shape and adjust the structs here; the rest of the pipeline
// doesn't change.
const BASE_URL: &str = "https://api.transit.land/api/v2/rest";

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TransitStop {
    pub id: String,
    pub name: String,
    pub modes: Vec<String>,
    pub agencies: Vec<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TransitDeparture {
    pub route_name: String,
    pub headsign: Option<String>,
    pub agency: Option<String>,
    pub mode: String,
    pub scheduled_time: Option<String>,
    pub estimated_time: Option<String>,
    pub delay_seconds: Option<i64>,
}

/// GTFS `route_type` (extended) -> a human label. Values per the GTFS
/// reference spec, independent of any one agency's naming.
fn mode_label(route_type: Option<i64>) -> String {
    match route_type {
        Some(0) => "Tram",
        Some(1) => "Metro",
        Some(2) => "Train",
        Some(3) => "Bus",
        Some(4) => "Ferry",
        Some(5) => "Cable Tram",
        Some(6) => "Aerial Lift",
        Some(7) => "Funicular",
        Some(11) => "Trolleybus",
        Some(12) => "Monorail",
        _ => "Transit",
    }
    .to_string()
}

#[derive(Debug, Deserialize)]
struct RawAgency {
    #[serde(default)]
    agency_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawRoute {
    #[serde(default)]
    route_short_name: Option<String>,
    #[serde(default)]
    route_long_name: Option<String>,
    #[serde(default)]
    route_type: Option<i64>,
    #[serde(default)]
    agency: Option<RawAgency>,
}

impl RawRoute {
    fn display_name(&self) -> String {
        self.route_short_name
            .clone()
            .filter(|n| !n.is_empty())
            .or_else(|| self.route_long_name.clone())
            .unwrap_or_else(|| "Route".to_string())
    }
}

#[derive(Debug, Deserialize, Default)]
struct RawRouteStop {
    #[serde(default)]
    route: Option<RawRoute>,
}

#[derive(Debug, Deserialize)]
struct StopsResponse {
    #[serde(default)]
    stops: Vec<RawStop>,
}

#[derive(Debug, Deserialize)]
struct RawStop {
    #[serde(default)]
    onestop_id: Option<String>,
    #[serde(default)]
    stop_id: Option<String>,
    #[serde(default)]
    stop_name: Option<String>,
    #[serde(default)]
    route_stops: Vec<RawRouteStop>,
}

fn to_transit_stop(raw: RawStop) -> Option<TransitStop> {
    let id = raw.onestop_id.or(raw.stop_id)?;
    let name = raw.stop_name.filter(|n| !n.is_empty())?;

    let mut modes: Vec<String> = Vec::new();
    let mut agencies: Vec<String> = Vec::new();
    for rs in &raw.route_stops {
        let Some(route) = &rs.route else { continue };
        let mode = mode_label(route.route_type);
        if !modes.contains(&mode) {
            modes.push(mode);
        }
        if let Some(agency_name) = route.agency.as_ref().and_then(|a| a.agency_name.clone()) {
            if !agencies.contains(&agency_name) {
                agencies.push(agency_name);
            }
        }
    }

    Some(TransitStop { id, name, modes, agencies })
}

fn parse_stops_response(body: &str) -> Vec<TransitStop> {
    serde_json::from_str::<StopsResponse>(body)
        .map(|r| r.stops.into_iter().filter_map(to_transit_stop).collect())
        .unwrap_or_default()
}

#[derive(Debug, Deserialize)]
struct DeparturesResponse {
    #[serde(default)]
    stops: Vec<RawDepartureStop>,
}

#[derive(Debug, Deserialize)]
struct RawDepartureStop {
    #[serde(default)]
    departures: Vec<RawDeparture>,
}

#[derive(Debug, Deserialize)]
struct RawDeparture {
    #[serde(default)]
    departure: Option<RawTimePoint>,
    #[serde(default)]
    arrival: Option<RawTimePoint>,
    #[serde(default)]
    trip: Option<RawTrip>,
}

#[derive(Debug, Deserialize)]
struct RawTimePoint {
    #[serde(default)]
    scheduled: Option<String>,
    #[serde(default)]
    estimated: Option<String>,
    #[serde(default)]
    delay: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct RawTrip {
    #[serde(default)]
    trip_headsign: Option<String>,
    #[serde(default)]
    route: Option<RawRoute>,
}

fn to_transit_departure(raw: RawDeparture) -> Option<TransitDeparture> {
    // Prefer the departure time point (when this stop is a boarding point);
    // fall back to arrival for a stop that's the end of the line.
    let time_point = raw.departure.as_ref().or(raw.arrival.as_ref())?;
    let route = raw.trip.as_ref().and_then(|t| t.route.as_ref());

    Some(TransitDeparture {
        route_name: route.map(RawRoute::display_name).unwrap_or_else(|| "Route".to_string()),
        headsign: raw.trip.as_ref().and_then(|t| t.trip_headsign.clone()),
        agency: route.and_then(|r| r.agency.as_ref()).and_then(|a| a.agency_name.clone()),
        mode: mode_label(route.and_then(|r| r.route_type)),
        scheduled_time: time_point.scheduled.clone(),
        estimated_time: time_point.estimated.clone(),
        delay_seconds: time_point.delay,
    })
}

fn parse_departures_response(body: &str) -> Vec<TransitDeparture> {
    serde_json::from_str::<DeparturesResponse>(body)
        .map(|r| {
            r.stops
                .into_iter()
                .flat_map(|s| s.departures)
                .filter_map(to_transit_departure)
                .collect()
        })
        .unwrap_or_default()
}

/// Free-text stop-name search, worldwide. Empty on any failure (network,
/// non-200 - including a missing/invalid key, which reads as an
/// `{"error":...}` 401 body - or unexpected shape), same "no results right
/// now reads as no matches" convention as every other external-data module
/// in this app.
pub async fn search_stops(client: &reqwest::Client, api_key: &str, query: &str) -> Vec<TransitStop> {
    if api_key.is_empty() {
        return Vec::new();
    }
    let url = format!("{BASE_URL}/stops?search={}&limit=15&apikey={}", urlencoding(query), urlencoding(api_key));
    let Ok(response) = client.get(&url).send().await else {
        return Vec::new();
    };
    if !response.status().is_success() {
        return Vec::new();
    }
    let Ok(body) = response.text().await else {
        return Vec::new();
    };
    parse_stops_response(&body)
}

/// Upcoming departures (scheduled + real-time where the feed provides it)
/// for a single stop, keyed by its Transitland `onestop_id`.
pub async fn get_departures(client: &reqwest::Client, api_key: &str, stop_id: &str) -> Vec<TransitDeparture> {
    if api_key.is_empty() {
        return Vec::new();
    }
    let url = format!(
        "{BASE_URL}/stops/{}/departures?apikey={}",
        urlencoding(stop_id),
        urlencoding(api_key)
    );
    let Ok(response) = client.get(&url).send().await else {
        return Vec::new();
    };
    if !response.status().is_success() {
        return Vec::new();
    }
    let Ok(body) = response.text().await else {
        return Vec::new();
    };
    parse_departures_response(&body)
}

#[cfg(test)]
mod tests {
    use super::*;

    const STOPS_SAMPLE: &str = r#"{
        "stops": [
            {
                "onestop_id": "s-gcpsteqvpb-caltrainstation",
                "stop_id": "caltrain-22nd",
                "stop_name": "22nd Street Caltrain Station",
                "route_stops": [
                    { "route": { "route_short_name": "L", "route_long_name": "Local", "route_type": 2, "agency": { "agency_name": "Caltrain" } } },
                    { "route": { "route_short_name": "", "route_long_name": "Baby Bullet", "route_type": 2, "agency": { "agency_name": "Caltrain" } } }
                ]
            },
            {
                "onestop_id": "s-no-name",
                "stop_name": "",
                "route_stops": []
            }
        ]
    }"#;

    const DEPARTURES_SAMPLE: &str = r#"{
        "stops": [
            {
                "departures": [
                    {
                        "arrival": { "scheduled": "14:32:00", "estimated": "14:35:00", "delay": 180 },
                        "departure": { "scheduled": "14:33:00", "estimated": "14:36:00", "delay": 180 },
                        "trip": {
                            "trip_headsign": "San Francisco",
                            "route": { "route_short_name": "L", "route_long_name": "Local", "route_type": 2, "agency": { "agency_name": "Caltrain" } }
                        }
                    },
                    {
                        "departure": { "scheduled": "14:40:00" },
                        "trip": null
                    }
                ]
            }
        ]
    }"#;

    #[test]
    fn parses_stops_and_dedupes_modes_agencies() {
        let stops = parse_stops_response(STOPS_SAMPLE);
        assert_eq!(stops.len(), 1);
        let stop = &stops[0];
        assert_eq!(stop.id, "s-gcpsteqvpb-caltrainstation");
        assert_eq!(stop.name, "22nd Street Caltrain Station");
        assert_eq!(stop.modes, vec!["Train"]);
        assert_eq!(stop.agencies, vec!["Caltrain"]);
    }

    #[test]
    fn drops_stops_missing_id_or_name() {
        let stops = parse_stops_response(STOPS_SAMPLE);
        assert!(stops.iter().all(|s| s.id != "s-no-name"));
    }

    #[test]
    fn parses_departures_with_route_and_time_fallback() {
        let departures = parse_departures_response(DEPARTURES_SAMPLE);
        assert_eq!(departures.len(), 2);
        assert_eq!(departures[0].route_name, "L");
        assert_eq!(departures[0].headsign.as_deref(), Some("San Francisco"));
        assert_eq!(departures[0].agency.as_deref(), Some("Caltrain"));
        assert_eq!(departures[0].mode, "Train");
        assert_eq!(departures[0].scheduled_time.as_deref(), Some("14:33:00"));
        assert_eq!(departures[0].estimated_time.as_deref(), Some("14:36:00"));
        assert_eq!(departures[0].delay_seconds, Some(180));

        // No trip/route at all - falls back to a generic label rather than
        // dropping the departure, since the time itself is still useful.
        assert_eq!(departures[1].route_name, "Route");
        assert_eq!(departures[1].mode, "Transit");
        assert_eq!(departures[1].scheduled_time.as_deref(), Some("14:40:00"));
    }

    #[test]
    fn malformed_json_yields_empty_not_panic() {
        assert!(parse_stops_response("not json").is_empty());
        assert!(parse_departures_response("not json").is_empty());
    }
}
