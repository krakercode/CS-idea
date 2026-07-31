import { type FormEvent, useState } from "react";
import { usePolling } from "../../shared/hooks/usePolling";
import { WidgetShell } from "../../shared/WidgetShell";
import { ExternalLink } from "../../shared/ExternalLink";
import { formatRelativeTime } from "../../shared/format";
import { fetchNews } from "./newsService";
import { addKeyword, getKeywords, MAX_KEYWORDS, removeKeyword } from "./newsKeywordsStore";
import "./NewsWidget.css";

const REFRESH_INTERVAL_MS = 10 * 60_000;

export function NewsWidget() {
  const { data, loading, error, refresh } = usePolling(fetchNews, REFRESH_INTERVAL_MS);
  const [keywords, setKeywords] = useState<string[]>(() => getKeywords());
  const [draft, setDraft] = useState("");

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    setKeywords(addKeyword(draft));
    setDraft("");
    refresh();
  }

  function handleRemove(keyword: string) {
    setKeywords(removeKeyword(keyword));
    refresh();
  }

  return (
    <WidgetShell title="News" loading={loading} error={error} onRefresh={refresh}>
      <div className="news-widget__tags">
        {keywords.map((keyword) => (
          <span key={keyword} className="news-widget__tag">
            {keyword}
            <button
              type="button"
              className="news-widget__tag-remove"
              onClick={() => handleRemove(keyword)}
              aria-label={`Stop following ${keyword}`}
            >
              ×
            </button>
          </span>
        ))}
        {keywords.length < MAX_KEYWORDS && (
          <form className="news-widget__tag-form" onSubmit={handleAdd}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a topic…"
              className="news-widget__tag-input"
            />
          </form>
        )}
      </div>

      {data && data.length === 0 && <p className="news-widget__empty">No articles yet.</p>}
      <ul className="news-widget__list">
        {data?.map((article) => (
          <li key={article.id} className="news-widget__item">
            <ExternalLink href={article.url} className="news-widget__title">
              {article.title}
            </ExternalLink>
            <div className="news-widget__meta">
              <span className="news-widget__topic">{article.topic}</span>
              <span>{article.source}</span>
              <span>{formatRelativeTime(article.published_at)}</span>
            </div>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}
