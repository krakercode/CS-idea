use serde::{Deserialize, Serialize};

/// A news source from the frontend's perspective is either a plain
/// keyword/ticker to search for, or (for anyone who already knows what an
/// RSS/Atom feed is and wants a specific one) a direct feed URL. Both
/// resolve to a URL and go through the exact same fetch+parse path.
#[derive(Debug, Deserialize, Clone)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum NewsSourceRequest {
    Keyword { topic: String, query: String },
    Feed { topic: String, url: String },
}

impl NewsSourceRequest {
    fn topic(&self) -> &str {
        match self {
            NewsSourceRequest::Keyword { topic, .. } => topic,
            NewsSourceRequest::Feed { topic, .. } => topic,
        }
    }

    /// Resolves this source to the feed URL to fetch. Keyword searches go
    /// through Google News' search RSS endpoint - undocumented but stable
    /// and widely relied on (e.g. by several open-source news aggregators),
    /// and keyless, which matters more here than official support does.
    fn resolve_url(&self) -> String {
        match self {
            NewsSourceRequest::Keyword { query, .. } => {
                let mut url = reqwest::Url::parse("https://news.google.com/rss/search").expect("static URL is valid");
                url.query_pairs_mut()
                    .append_pair("q", query)
                    .append_pair("hl", "en-US")
                    .append_pair("gl", "US")
                    .append_pair("ceid", "US:en");
                url.into()
            }
            NewsSourceRequest::Feed { url, .. } => url.clone(),
        }
    }
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct NewsArticle {
    pub id: String,
    pub title: String,
    pub source: String,
    pub url: String,
    pub topic: String,
    pub published_at: String, // RFC3339
}

const MAX_ARTICLES_PER_FEED: usize = 5;

/// Parses a raw RSS/Atom feed body into articles for one topic. Kept
/// separate from the network fetch so it can be unit-tested against a
/// fixture without a live connection (this sandbox's network policy blocks
/// arbitrary outbound hosts, so the HTTP path itself isn't testable here -
/// see README).
fn parse_feed(topic: &str, bytes: &[u8]) -> Vec<NewsArticle> {
    let feed = match feed_rs::parser::parse(bytes) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };

    let source = feed
        .title
        .map(|t| t.content)
        .unwrap_or_else(|| topic.to_string());

    feed.entries
        .into_iter()
        .take(MAX_ARTICLES_PER_FEED)
        .filter_map(|entry| {
            let title = entry.title?.content;
            let url = entry.links.first()?.href.clone();
            let published_at = entry
                .published
                .or(entry.updated)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
            let id = if entry.id.is_empty() { url.clone() } else { entry.id };

            Some(NewsArticle {
                id,
                title,
                source: source.clone(),
                url,
                topic: topic.to_string(),
                published_at,
            })
        })
        .collect()
}

async fn fetch_one(client: &reqwest::Client, request: &NewsSourceRequest) -> Vec<NewsArticle> {
    let bytes = match client.get(request.resolve_url()).send().await {
        Ok(resp) => match resp.bytes().await {
            Ok(b) => b,
            Err(_) => return Vec::new(),
        },
        Err(_) => return Vec::new(),
    };
    parse_feed(request.topic(), &bytes)
}

/// Fetches every configured source concurrently. A source that's
/// unreachable or fails to parse is silently dropped rather than failing
/// the whole batch - partial news is more useful than none because one
/// source hiccuped.
pub async fn fetch_all(client: &reqwest::Client, sources: &[NewsSourceRequest]) -> Vec<NewsArticle> {
    let fetches = sources.iter().map(|s| fetch_one(client, s));
    let mut articles: Vec<NewsArticle> = futures::future::join_all(fetches).await.into_iter().flatten().collect();
    articles.sort_by(|a, b| b.published_at.cmp(&a.published_at));
    articles
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_RSS: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Sample Feed</title>
    <link>https://example.com</link>
    <description>A sample feed for tests</description>
    <item>
      <title>First headline</title>
      <link>https://example.com/first</link>
      <guid>https://example.com/first</guid>
      <pubDate>Thu, 30 Jul 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second headline</title>
      <link>https://example.com/second</link>
      <guid>https://example.com/second</guid>
      <pubDate>Wed, 29 Jul 2026 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>"#;

    #[test]
    fn parses_rss_into_articles() {
        let articles = parse_feed("Technology", SAMPLE_RSS.as_bytes());
        assert_eq!(articles.len(), 2);
        assert_eq!(articles[0].title, "First headline");
        assert_eq!(articles[0].url, "https://example.com/first");
        assert_eq!(articles[0].source, "Sample Feed");
        assert_eq!(articles[0].topic, "Technology");
        assert!(articles[0].published_at.starts_with("2026-07-30"));
    }

    #[test]
    fn malformed_feed_yields_empty_not_panic() {
        let articles = parse_feed("Technology", b"not a feed at all");
        assert!(articles.is_empty());
    }

    #[test]
    fn caps_articles_per_feed() {
        let mut items = String::new();
        for i in 0..10 {
            items.push_str(&format!(
                "<item><title>Item {i}</title><link>https://example.com/{i}</link><guid>https://example.com/{i}</guid></item>"
            ));
        }
        let rss = format!(
            r#"<rss version="2.0"><channel><title>Many</title><link>https://example.com</link><description>d</description>{items}</channel></rss>"#
        );
        let articles = parse_feed("Technology", rss.as_bytes());
        assert_eq!(articles.len(), MAX_ARTICLES_PER_FEED);
    }

    #[test]
    fn keyword_source_resolves_to_google_news_search() {
        let source = NewsSourceRequest::Keyword {
            topic: "AAPL".to_string(),
            query: "AAPL stock".to_string(),
        };
        let url = source.resolve_url();
        assert!(url.starts_with("https://news.google.com/rss/search?"));
        assert!(url.contains("q=AAPL+stock") || url.contains("q=AAPL%20stock"));
        assert_eq!(source.topic(), "AAPL");
    }

    #[test]
    fn keyword_query_is_url_encoded() {
        let source = NewsSourceRequest::Keyword {
            topic: "C&C".to_string(),
            query: "C&C: tiberian sun".to_string(),
        };
        let url = source.resolve_url();
        // A raw unencoded '&' would be parsed as a second query param and
        // break the request - confirm it went through the encoder.
        assert!(!url.contains("&C:"), "query should be percent-encoded, got: {url}");
    }

    #[test]
    fn feed_source_uses_url_verbatim() {
        let source = NewsSourceRequest::Feed {
            topic: "Custom".to_string(),
            url: "https://example.com/feed.xml".to_string(),
        };
        assert_eq!(source.resolve_url(), "https://example.com/feed.xml");
        assert_eq!(source.topic(), "Custom");
    }
}
