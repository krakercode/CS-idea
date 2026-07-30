// Field names are snake_case to match the JSON serde emits from
// src-tauri/src/news.rs verbatim - no transformation layer needed.
export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  topic: string;
  published_at: string; // RFC3339
}
