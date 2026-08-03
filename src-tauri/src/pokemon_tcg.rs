use crate::calendar::urlencoding;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// api.pokemontcg.io (v2) - free, no key required for basic use (confirmed
// live), an optional user-supplied key just raises the rate limit (see
// PandaScore for the shape of "user-supplied, optional" key handling -
// unlike that one, this source works fully without a key at all). Every
// card response embeds both TCGPlayer (US) and Cardmarket (EU) price data
// in one payload, which is what "Prices" compares side by side.
//
// Two different response envelopes: the search endpoint wraps results in
// `{"data": [...]}`, the single-card lookup wraps in `{"data": {...}}` (an
// object, not a list) - confirmed against the live API, not assumed.
const BASE_URL: &str = "https://api.pokemontcg.io/v2";

// Preference order for which TCGPlayer variant's price represents "the"
// price for a card - a card can have several (normal print, holofoil,
// reverse holofoil, 1st edition, etc.) with no single "correct" one, so
// this just picks the most common/standard variant that's actually present
// rather than averaging or guessing.
const TCGPLAYER_VARIANT_PREFERENCE: &[&str] =
    &["normal", "holofoil", "reverseHolofoil", "1stEditionHolofoil", "unlimitedHolofoil"];

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PokemonCard {
    pub id: String,
    pub name: String,
    pub set_name: String,
    pub number: String,
    pub rarity: Option<String>,
    pub image_small: Option<String>,
    pub image_large: Option<String>,
    pub tcgplayer_price: Option<f64>,
    pub tcgplayer_variant: Option<String>,
    pub tcgplayer_url: Option<String>,
    pub cardmarket_price: Option<f64>,
    pub cardmarket_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SearchResponse {
    #[serde(default)]
    data: Vec<RawCard>,
}

#[derive(Debug, Deserialize)]
struct LookupResponse {
    data: RawCard,
}

#[derive(Debug, Deserialize)]
struct RawCard {
    id: String,
    name: String,
    number: String,
    #[serde(default)]
    rarity: Option<String>,
    set: RawSet,
    #[serde(default)]
    images: Option<RawImages>,
    #[serde(default)]
    tcgplayer: Option<RawTcgPlayer>,
    #[serde(default)]
    cardmarket: Option<RawCardMarket>,
}

#[derive(Debug, Deserialize)]
struct RawSet {
    name: String,
}

#[derive(Debug, Deserialize)]
struct RawImages {
    #[serde(default)]
    small: Option<String>,
    #[serde(default)]
    large: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawTcgPlayer {
    #[serde(default)]
    url: Option<String>,
    // Absent entirely on some very new cards that haven't had prices
    // populated yet - confirmed live, not hypothetical.
    #[serde(default)]
    prices: HashMap<String, RawVariantPrices>,
}

#[derive(Debug, Deserialize)]
struct RawVariantPrices {
    #[serde(default)]
    market: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct RawCardMarket {
    #[serde(default)]
    url: Option<String>,
    prices: RawCardMarketPrices,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawCardMarketPrices {
    #[serde(default)]
    trend_price: Option<f64>,
    #[serde(default)]
    average_sell_price: Option<f64>,
}

/// Picks one (variant name, market price) pair out of the price-per-variant
/// map, via `TCGPLAYER_VARIANT_PREFERENCE` - falls back to whatever variant
/// happens to be present (in map iteration order, which is unspecified but
/// deterministic enough for "just show something") if none of the preferred
/// names match, and `None` if the map is empty or every entry lacks a
/// market price.
fn pick_tcgplayer_price(prices: &HashMap<String, RawVariantPrices>) -> Option<(String, f64)> {
    for &variant in TCGPLAYER_VARIANT_PREFERENCE {
        if let Some(price) = prices.get(variant).and_then(|p| p.market) {
            return Some((variant.to_string(), price));
        }
    }
    prices.iter().find_map(|(name, p)| p.market.map(|market| (name.clone(), market)))
}

fn to_pokemon_card(raw: RawCard) -> PokemonCard {
    let (tcgplayer_price, tcgplayer_variant) = raw
        .tcgplayer
        .as_ref()
        .and_then(|t| pick_tcgplayer_price(&t.prices))
        .map(|(variant, price)| (Some(price), Some(variant)))
        .unwrap_or((None, None));

    // Cardmarket's `trendPrice` (a rolling market trend) is preferred over
    // `averageSellPrice` (a simple average of recent listings, more
    // sensitive to outliers) when both are present.
    let cardmarket_price = raw
        .cardmarket
        .as_ref()
        .and_then(|c| c.prices.trend_price.or(c.prices.average_sell_price));

    PokemonCard {
        id: raw.id,
        name: raw.name,
        set_name: raw.set.name,
        number: raw.number,
        rarity: raw.rarity,
        image_small: raw.images.as_ref().and_then(|i| i.small.clone()),
        image_large: raw.images.as_ref().and_then(|i| i.large.clone()),
        tcgplayer_price,
        tcgplayer_variant,
        tcgplayer_url: raw.tcgplayer.as_ref().and_then(|t| t.url.clone()),
        cardmarket_price,
        cardmarket_url: raw.cardmarket.as_ref().and_then(|c| c.url.clone()),
    }
}

fn parse_search_response(body: &str) -> Vec<PokemonCard> {
    serde_json::from_str::<SearchResponse>(body)
        .map(|r| r.data.into_iter().map(to_pokemon_card).collect())
        .unwrap_or_default()
}

fn parse_lookup_response(body: &str) -> Option<PokemonCard> {
    serde_json::from_str::<LookupResponse>(body).ok().map(|r| to_pokemon_card(r.data))
}

fn with_api_key(builder: reqwest::RequestBuilder, api_key: Option<&str>) -> reqwest::RequestBuilder {
    match api_key {
        Some(key) if !key.is_empty() => builder.header("X-Api-Key", key),
        _ => builder,
    }
}

/// Free-text card name search, newest-set-first. Any failure (network,
/// non-200, unexpected shape) yields an empty list rather than an error -
/// occasional transient 500s were observed from this API even on valid
/// requests, so "no results right now" is treated the same as "no matches",
/// same as every other external-data module in this app.
pub async fn search_cards(client: &reqwest::Client, query: &str, api_key: Option<&str>) -> Vec<PokemonCard> {
    // Double quotes would break the `name:"..."` query syntax below - strip
    // rather than escape, since a literal quote in a card-name search isn't
    // meaningful anyway.
    let cleaned = query.replace('"', "");
    let q = format!("name:\"{cleaned}*\"");
    let url = format!("{BASE_URL}/cards?q={}&pageSize=20&orderBy=-set.releaseDate", urlencoding(&q));

    let request = with_api_key(client.get(&url), api_key);
    let Ok(response) = request.send().await else {
        return Vec::new();
    };
    if !response.status().is_success() {
        return Vec::new();
    }
    let Ok(body) = response.text().await else {
        return Vec::new();
    };
    parse_search_response(&body)
}

/// Looks up a single card by id - used to refresh a Collection entry's
/// price snapshot. `None` covers both "not found" and any fetch/parse
/// failure, same "fail soft" reasoning as `search_cards`.
pub async fn get_card(client: &reqwest::Client, card_id: &str, api_key: Option<&str>) -> Option<PokemonCard> {
    let url = format!("{BASE_URL}/cards/{}", urlencoding(card_id));
    let request = with_api_key(client.get(&url), api_key);
    let response = request.send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }
    let body = response.text().await.ok()?;
    parse_lookup_response(&body)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Trimmed from a real live response (fetched during development, not
    // synthesized) - has two TCGPlayer variants (1stEditionHolofoil comes
    // first in the source map but isn't in the preference list ahead of
    // unlimitedHolofoil... both are non-preferred, so this exercises the
    // "fall back to whatever's present" branch) plus a full Cardmarket block.
    const LOOKUP_SAMPLE: &str = r#"{
        "data": {
            "id": "gym2-2",
            "name": "Blaine's Charizard",
            "number": "2",
            "rarity": "Rare Holo",
            "set": { "name": "Gym Challenge" },
            "images": {
                "small": "https://images.pokemontcg.io/gym2/2.png",
                "large": "https://images.pokemontcg.io/gym2/2_hires.png"
            },
            "tcgplayer": {
                "url": "https://prices.pokemontcg.io/tcgplayer/gym2-2",
                "prices": {
                    "1stEditionHolofoil": { "low": 696.69, "mid": 2000.0, "high": 2099.99, "market": 699.99 },
                    "unlimitedHolofoil": { "low": 437.99, "mid": 734.12, "high": 1499.99, "market": 594.19 }
                }
            },
            "cardmarket": {
                "url": "https://prices.pokemontcg.io/cardmarket/gym2-2",
                "prices": { "averageSellPrice": 643.27, "lowPrice": 70.0, "trendPrice": 630.65 }
            }
        }
    }"#;

    // Trimmed from a real live search response - the second card has a
    // `tcgplayer` block with a `url` but no `prices` key at all (a very new
    // card without price data populated yet, confirmed live) and no
    // `cardmarket` block at all.
    const SEARCH_SAMPLE: &str = r#"{
        "data": [
            {
                "id": "me2-130",
                "name": "Mega Charizard X ex",
                "number": "130",
                "rarity": "Mega Hyper Rare",
                "set": { "name": "Phantasmal Flames" },
                "images": {
                    "small": "https://images.pokemontcg.io/me2/130.png",
                    "large": "https://images.pokemontcg.io/me2/130_hires.png"
                },
                "tcgplayer": {
                    "url": "https://prices.pokemontcg.io/tcgplayer/me2-130",
                    "prices": { "holofoil": { "low": 289.99, "mid": 348.72, "high": 2908.17, "market": 323.13 } }
                }
            },
            {
                "id": "me2pt5-294",
                "name": "Mega Charizard Y ex",
                "number": "294",
                "rarity": "Mega Hyper Rare",
                "set": { "name": "Ascended Heroes" },
                "images": {
                    "small": "https://images.scrydex.com/pokemon/me2pt5-294/small",
                    "large": "https://images.scrydex.com/pokemon/me2pt5-294/large"
                },
                "tcgplayer": { "url": "https://prices.pokemontcg.io/tcgplayer/me2pt5-294" }
            }
        ],
        "page": 1,
        "pageSize": 20,
        "count": 2,
        "totalCount": 2
    }"#;

    #[test]
    fn parses_lookup_response_with_both_price_sources() {
        let card = parse_lookup_response(LOOKUP_SAMPLE).expect("should parse");
        assert_eq!(card.id, "gym2-2");
        assert_eq!(card.name, "Blaine's Charizard");
        assert_eq!(card.set_name, "Gym Challenge");
        assert_eq!(card.rarity.as_deref(), Some("Rare Holo"));
        // Neither variant is in the preference list, so this exercises the
        // "fall back to whatever's present" branch - either is a valid pick.
        assert!(card.tcgplayer_price.is_some());
        assert!(["1stEditionHolofoil", "unlimitedHolofoil"].contains(&card.tcgplayer_variant.as_deref().unwrap()));
        // trendPrice preferred over averageSellPrice.
        assert_eq!(card.cardmarket_price, Some(630.65));
        assert_eq!(card.cardmarket_url.as_deref(), Some("https://prices.pokemontcg.io/cardmarket/gym2-2"));
    }

    #[test]
    fn parses_search_response_and_picks_preferred_variant() {
        let cards = parse_search_response(SEARCH_SAMPLE);
        assert_eq!(cards.len(), 2);
        assert_eq!(cards[0].tcgplayer_price, Some(323.13));
        assert_eq!(cards[0].tcgplayer_variant.as_deref(), Some("holofoil"));
    }

    #[test]
    fn missing_prices_yields_none_fields_not_panic() {
        let cards = parse_search_response(SEARCH_SAMPLE);
        let no_price_card = &cards[1];
        assert_eq!(no_price_card.id, "me2pt5-294");
        assert_eq!(no_price_card.tcgplayer_price, None);
        assert_eq!(no_price_card.tcgplayer_variant, None);
        assert_eq!(no_price_card.cardmarket_price, None);
        assert_eq!(no_price_card.cardmarket_url, None);
        assert_eq!(no_price_card.tcgplayer_url.as_deref(), Some("https://prices.pokemontcg.io/tcgplayer/me2pt5-294"));
    }

    #[test]
    fn malformed_json_yields_empty_not_panic() {
        assert!(parse_search_response("not json").is_empty());
        assert!(parse_lookup_response("not json").is_none());
    }

    #[test]
    fn empty_data_yields_empty_not_panic() {
        assert!(parse_search_response(r#"{"data":[]}"#).is_empty());
        assert!(parse_search_response(r#"{}"#).is_empty());
    }
}
