/**
 * What the news widget follows. Two ways to configure it - use either or
 * both:
 *
 * 1. Keywords - the simple option, editable right from the widget (the tag
 *    chips in its header): just type a topic, company, ticker, team name,
 *    whatever you want news about (e.g. "Counter-Strike 2", "AAPL",
 *    "Bitcoin"). Under the hood this searches Google News, so you never
 *    have to know or find an actual feed URL. NEWS_KEYWORDS below is only
 *    the first-run default - the live, user-editable list is persisted by
 *    newsKeywordsStore.ts.
 * 2. NEWS_FEEDS - the advanced option, for a specific RSS/Atom feed you
 *    already know the URL of and want to follow directly instead of a
 *    keyword search. Empty by default, and not editable from the UI (edit
 *    this file directly); most people can ignore this.
 */
export const NEWS_KEYWORDS: string[] = ["Counter-Strike 2", "Technology", "World News"];

export interface NewsFeedConfig {
  /** Label shown in the widget; doesn't need to match the feed's own title. */
  topic: string;
  url: string;
}

export const NEWS_FEEDS: NewsFeedConfig[] = [];
