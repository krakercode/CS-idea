use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct Quote {
    pub symbol: String,
    pub price: f64,
    pub change: f64,
    pub change_percent: f64,
    pub currency: String,
    pub updated_at: String, // RFC3339
    /// Closing prices over the lookback window (oldest first), for a
    /// sparkline - gaps (non-trading days, missing data points) are just
    /// dropped rather than interpolated, since this only needs to look
    /// like a trend, not be analytically precise.
    pub history: Vec<f64>,
}

// Yahoo Finance's unofficial chart endpoint - no API key, widely used
// (e.g. by the yfinance Python library), stable for years, but undocumented
// and could change without notice.
#[derive(Debug, Deserialize)]
struct ChartResponse {
    chart: Chart,
}

#[derive(Debug, Deserialize)]
struct Chart {
    result: Option<Vec<ChartResult>>,
}

#[derive(Debug, Deserialize)]
struct ChartResult {
    meta: ChartMeta,
    indicators: Option<Indicators>,
}

#[derive(Debug, Deserialize)]
struct ChartMeta {
    symbol: String,
    currency: Option<String>,
    #[serde(rename = "regularMarketPrice")]
    regular_market_price: Option<f64>,
    #[serde(rename = "previousClose")]
    previous_close: Option<f64>,
    #[serde(rename = "chartPreviousClose")]
    chart_previous_close: Option<f64>,
    #[serde(rename = "regularMarketTime")]
    regular_market_time: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct Indicators {
    quote: Vec<IndicatorQuote>,
}

#[derive(Debug, Deserialize)]
struct IndicatorQuote {
    close: Vec<Option<f64>>,
}

/// Turns one parsed chart response into a Quote. Split out from the network
/// call so it's unit-testable against a fixture (see module tests) without
/// needing a live connection.
fn quote_from_response(body: &str) -> Option<Quote> {
    let parsed: ChartResponse = serde_json::from_str(body).ok()?;
    let result = parsed.chart.result?.into_iter().next()?;
    let meta = result.meta;
    let price = meta.regular_market_price?;
    let previous_close = meta.previous_close.or(meta.chart_previous_close).unwrap_or(price);
    let change = price - previous_close;
    // Exact-zero guard against division by zero, not a general float
    // equality check - an epsilon comparison would be wrong here.
    #[allow(clippy::float_cmp)]
    let change_percent = if previous_close == 0.0 { 0.0 } else { (change / previous_close) * 100.0 };
    let updated_at = meta
        .regular_market_time
        .and_then(|t| chrono::DateTime::from_timestamp(t, 0))
        .map_or_else(|| chrono::Utc::now().to_rfc3339(), |dt| dt.to_rfc3339());

    let history = result
        .indicators
        .and_then(|i| i.quote.into_iter().next())
        .map(|q| q.close.into_iter().flatten().collect())
        .unwrap_or_default();

    Some(Quote {
        symbol: meta.symbol,
        price,
        change,
        change_percent,
        currency: meta.currency.unwrap_or_else(|| "USD".to_string()),
        updated_at,
        history,
    })
}

async fn fetch_one(client: &reqwest::Client, symbol: &str) -> Option<Quote> {
    // range/interval are explicit rather than relying on Yahoo's default -
    // a month of daily closes is enough for a sparkline without a heavy
    // payload.
    let url = format!("https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=1mo&interval=1d");
    let body = client.get(&url).send().await.ok()?.text().await.ok()?;
    quote_from_response(&body)
}

/// Fetches every symbol concurrently. A symbol that fails (bad ticker,
/// network hiccup, endpoint shape change) is silently dropped rather than
/// failing the whole watchlist.
pub async fn fetch_all(client: &reqwest::Client, symbols: &[String]) -> Vec<Quote> {
    let fetches = symbols.iter().map(|s| fetch_one(client, s));
    futures::future::join_all(fetches).await.into_iter().flatten().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_RESPONSE: &str = r#"{
        "chart": {
            "result": [{
                "meta": {
                    "symbol": "AAPL",
                    "currency": "USD",
                    "regularMarketPrice": 195.12,
                    "previousClose": 194.50,
                    "regularMarketTime": 1690000000
                }
            }],
            "error": null
        }
    }"#;

    const SAMPLE_RESPONSE_WITH_HISTORY: &str = r#"{
        "chart": {
            "result": [{
                "meta": {
                    "symbol": "AAPL",
                    "currency": "USD",
                    "regularMarketPrice": 195.12,
                    "previousClose": 194.50,
                    "regularMarketTime": 1690000000
                },
                "indicators": {
                    "quote": [{
                        "close": [190.0, null, 192.5, 195.12]
                    }]
                }
            }],
            "error": null
        }
    }"#;

    #[test]
    fn parses_quote_from_response() {
        let quote = quote_from_response(SAMPLE_RESPONSE).expect("should parse");
        assert_eq!(quote.symbol, "AAPL");
        assert_eq!(quote.price, 195.12);
        assert!((quote.change - 0.62).abs() < 0.001);
        assert!((quote.change_percent - 0.3187_f64).abs() < 0.001);
        assert_eq!(quote.currency, "USD");
        assert!(quote.history.is_empty(), "no indicators block should mean no history");
    }

    #[test]
    fn parses_history_and_drops_null_points() {
        let quote = quote_from_response(SAMPLE_RESPONSE_WITH_HISTORY).expect("should parse");
        assert_eq!(quote.history, vec![190.0, 192.5, 195.12]);
    }

    #[test]
    fn missing_price_yields_none_not_panic() {
        let body = r#"{"chart":{"result":[{"meta":{"symbol":"BAD","currency":"USD"}}],"error":null}}"#;
        assert!(quote_from_response(body).is_none());
    }

    #[test]
    fn malformed_json_yields_none_not_panic() {
        assert!(quote_from_response("not json").is_none());
    }

    #[test]
    fn empty_result_yields_none() {
        let body = r#"{"chart":{"result":[],"error":null}}"#;
        assert!(quote_from_response(body).is_none());
    }
}
