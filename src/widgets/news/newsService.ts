import { invoke } from "@tauri-apps/api/core";
import { NEWS_KEYWORDS, NEWS_FEEDS } from "./newsSources";
import type { NewsArticle } from "./types";

// Mirrors src-tauri/src/news.rs's NewsSourceRequest (serde tag = "kind").
type NewsSourceRequest =
  | { kind: "keyword"; topic: string; query: string }
  | { kind: "feed"; topic: string; url: string };

function buildSources(): NewsSourceRequest[] {
  return [
    ...NEWS_KEYWORDS.map((keyword): NewsSourceRequest => ({ kind: "keyword", topic: keyword, query: keyword })),
    ...NEWS_FEEDS.map((feed): NewsSourceRequest => ({ kind: "feed", topic: feed.topic, url: feed.url })),
  ];
}

/**
 * Real data - resolves each configured keyword/feed to an RSS/Atom URL and
 * fetches+parses it on the Rust side (src-tauri/src/news.rs). A source
 * that's unreachable or fails to parse is dropped rather than failing the
 * whole request, so this always resolves (possibly with an empty list).
 */
export async function fetchNews(): Promise<NewsArticle[]> {
  return invoke<NewsArticle[]>("fetch_news", { sources: buildSources() });
}
