import { invoke } from "@tauri-apps/api/core";
import { NEWS_FEEDS } from "./newsFeeds";
import type { NewsArticle } from "./types";

/**
 * Real data - fetches and parses the configured RSS/Atom feeds on the Rust
 * side (src-tauri/src/news.rs). A feed that's unreachable or fails to parse
 * is dropped rather than failing the whole request, so this always resolves
 * (possibly with an empty list) instead of rejecting.
 */
export async function fetchNews(): Promise<NewsArticle[]> {
  return invoke<NewsArticle[]>("fetch_news", { feeds: NEWS_FEEDS });
}
