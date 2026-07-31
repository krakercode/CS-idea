use chrono::Datelike;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FeaturedArticle {
    pub title: String,
    pub extract: String,
    pub thumbnail_url: Option<String>,
    pub page_url: String,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PictureOfDay {
    pub title: String,
    pub image_url: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FeedResponse {
    tfa: Option<TfaResponse>,
    image: Option<ImageResponse>,
}

#[derive(Debug, Deserialize)]
struct TfaResponse {
    titles: Option<Titles>,
    // Plain-text summary - deliberately using `extract`, not `extract_html`,
    // so this never has to sanitize/render arbitrary HTML from the response.
    extract: Option<String>,
    thumbnail: Option<ImageSource>,
    content_urls: Option<ContentUrls>,
}

#[derive(Debug, Deserialize)]
struct Titles {
    normalized: String,
}

#[derive(Debug, Deserialize)]
struct ImageSource {
    source: String,
}

#[derive(Debug, Deserialize)]
struct ContentUrls {
    desktop: DesktopUrl,
}

#[derive(Debug, Deserialize)]
struct DesktopUrl {
    page: String,
}

#[derive(Debug, Deserialize)]
struct ImageResponse {
    title: Option<String>,
    image: Option<ImageSource>,
    // Same plain-text-only reasoning as TfaResponse::extract.
    description: Option<DescriptionText>,
}

#[derive(Debug, Deserialize)]
struct DescriptionText {
    text: Option<String>,
}

/// Wikimedia's "Feed" REST API bundles today's featured article and picture
/// of the day (among other things we don't use) into one response - no API
/// key needed. Split from the network call so it's unit-testable against a
/// fixture.
fn parse_feed_response(body: &str) -> (Option<FeaturedArticle>, Option<PictureOfDay>) {
    let Ok(parsed) = serde_json::from_str::<FeedResponse>(body) else {
        return (None, None);
    };

    let article = parsed.tfa.and_then(|tfa| {
        Some(FeaturedArticle {
            title: tfa.titles?.normalized,
            extract: tfa.extract.unwrap_or_default(),
            thumbnail_url: tfa.thumbnail.map(|t| t.source),
            page_url: tfa.content_urls?.desktop.page,
        })
    });

    let picture = parsed.image.and_then(|image| {
        Some(PictureOfDay {
            title: image.title.unwrap_or_else(|| "Picture of the day".to_string()),
            image_url: image.image?.source,
            description: image.description.and_then(|d| d.text),
        })
    });

    (article, picture)
}

pub async fn fetch(client: &reqwest::Client) -> (Option<FeaturedArticle>, Option<PictureOfDay>) {
    let today = chrono::Utc::now().date_naive();
    let url = format!(
        "https://en.wikipedia.org/api/rest_v1/feed/featured/{:04}/{:02}/{:02}",
        today.year(),
        today.month(),
        today.day()
    );

    let Ok(response) = client.get(&url).send().await else {
        return (None, None);
    };
    let Ok(body) = response.text().await else {
        return (None, None);
    };
    parse_feed_response(&body)
}

#[cfg(test)]
mod tests {
    use super::*;

    const FEED_SAMPLE: &str = r#"{
        "tfa": {
            "titles": { "normalized": "Rust (programming language)" },
            "extract": "Rust is a multi-paradigm programming language.",
            "thumbnail": { "source": "https://example.com/thumb.jpg" },
            "content_urls": { "desktop": { "page": "https://en.wikipedia.org/wiki/Rust" } }
        },
        "image": {
            "title": "File:Example.jpg",
            "image": { "source": "https://example.com/potd.jpg" },
            "description": { "text": "An example picture." }
        }
    }"#;

    #[test]
    fn parses_article_and_picture_from_feed() {
        let (article, picture) = parse_feed_response(FEED_SAMPLE);

        let article = article.expect("article should parse");
        assert_eq!(article.title, "Rust (programming language)");
        assert_eq!(article.extract, "Rust is a multi-paradigm programming language.");
        assert_eq!(article.thumbnail_url.as_deref(), Some("https://example.com/thumb.jpg"));
        assert_eq!(article.page_url, "https://en.wikipedia.org/wiki/Rust");

        let picture = picture.expect("picture should parse");
        assert_eq!(picture.title, "File:Example.jpg");
        assert_eq!(picture.image_url, "https://example.com/potd.jpg");
        assert_eq!(picture.description.as_deref(), Some("An example picture."));
    }

    #[test]
    fn missing_sections_yield_none_not_panic() {
        let (article, picture) = parse_feed_response(r#"{}"#);
        assert!(article.is_none());
        assert!(picture.is_none());
    }

    #[test]
    fn malformed_json_yields_none_not_panic() {
        let (article, picture) = parse_feed_response("not json");
        assert!(article.is_none());
        assert!(picture.is_none());
    }
}
