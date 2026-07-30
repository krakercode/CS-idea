export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  topic: string;
  publishedAt: string; // ISO timestamp
}

export interface NewsProvider {
  fetchNews(topics: string[]): Promise<NewsArticle[]>;
}
