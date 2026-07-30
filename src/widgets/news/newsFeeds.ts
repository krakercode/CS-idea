export interface NewsFeedConfig {
  /** Label shown in the widget; doesn't need to match the feed's own title. */
  topic: string;
  /** Any RSS or Atom feed URL. */
  url: string;
}

/**
 * The feeds the news widget pulls from. Edit this list to change what it
 * follows - no component code needs to change. Add any RSS/Atom feed URL
 * (most news sites and HLTV publish one).
 */
export const NEWS_FEEDS: NewsFeedConfig[] = [
  { topic: "Counter-Strike 2", url: "https://www.hltv.org/rss/news" },
  { topic: "Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
  { topic: "World News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
];
