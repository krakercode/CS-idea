import { delay, hashSeed, mulberry32 } from "../../shared/mock";
import type { NewsArticle, NewsProvider } from "./types";

const MOCK_SOURCES = ["HLTV", "Reuters", "The Verge", "AP News", "Bloomberg"];
const MOCK_HEADLINES = [
  "here's what's happening with {topic} today",
  "{topic}: what analysts are watching this week",
  "a closer look at the latest {topic} developments",
  "breaking: major update in the {topic} space",
  "opinion: why {topic} matters more than ever",
];

/**
 * Placeholder provider - generates believable-looking fake articles per
 * topic so the widget can be built and used before any real news source is
 * wired up. Swap this for a RealNewsProvider (RSS, NewsAPI, etc.) that
 * implements the same NewsProvider interface and nothing else changes.
 */
class MockNewsProvider implements NewsProvider {
  async fetchNews(topics: string[]): Promise<NewsArticle[]> {
    await delay(250);

    const articles: NewsArticle[] = [];
    for (const topic of topics) {
      const rand = mulberry32(hashSeed(topic));
      const perTopic = 3;
      for (let i = 0; i < perTopic; i++) {
        const headlineTemplate = MOCK_HEADLINES[Math.floor(rand() * MOCK_HEADLINES.length)];
        const hoursAgo = Math.floor(rand() * 36) + i;
        articles.push({
          id: `${topic}-${i}`,
          title: headlineTemplate.replace("{topic}", topic),
          source: MOCK_SOURCES[Math.floor(rand() * MOCK_SOURCES.length)],
          url: "#",
          topic,
          publishedAt: new Date(Date.now() - hoursAgo * 3600_000).toISOString(),
        });
      }
    }

    return articles.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  }
}

let provider: NewsProvider = new MockNewsProvider();

export function getNewsProvider(): NewsProvider {
  return provider;
}

/** Lets a real provider be swapped in later (e.g. at app startup) without
 * touching the widget component. */
export function setNewsProvider(next: NewsProvider): void {
  provider = next;
}
