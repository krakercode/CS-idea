use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Clone)]
pub struct FeedRequest {
    pub topic: String,
    pub url: String,
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

async fn fetch_one(client: &reqwest::Client, request: &FeedRequest) -> Vec<NewsArticle> {
    let bytes = match client.get(&request.url).send().await {
        Ok(resp) => match resp.bytes().await {
            Ok(b) => b,
            Err(_) => return Vec::new(),
        },
        Err(_) => return Vec::new(),
    };
    parse_feed(&request.topic, &bytes)
}

/// Fetches every configured feed concurrently. A feed that's unreachable or
/// fails to parse is silently dropped rather than failing the whole batch -
/// partial news is more useful than none because one source hiccuped.
pub async fn fetch_all(client: &reqwest::Client, feeds: &[FeedRequest]) -> Vec<NewsArticle> {
    let fetches = feeds.iter().map(|f| fetch_one(client, f));
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
}
