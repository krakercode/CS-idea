import { usePolling } from "../../shared/hooks/usePolling";
import { WidgetShell } from "../../shared/WidgetShell";
import { formatRelativeTime } from "../../shared/format";
import { getNewsProvider } from "./newsService";
import { NEWS_INTERESTS } from "./userInterests";
import "./NewsWidget.css";

const REFRESH_INTERVAL_MS = 10 * 60_000;

export function NewsWidget() {
  const { data, loading, error, refresh } = usePolling(
    () => getNewsProvider().fetchNews(NEWS_INTERESTS),
    REFRESH_INTERVAL_MS,
  );

  return (
    <WidgetShell title="News" loading={loading} error={error} onRefresh={refresh}>
      {data && data.length === 0 && <p className="news-widget__empty">No articles yet.</p>}
      <ul className="news-widget__list">
        {data?.map((article) => (
          <li key={article.id} className="news-widget__item">
            <a href={article.url} className="news-widget__title" target="_blank" rel="noreferrer">
              {article.title}
            </a>
            <div className="news-widget__meta">
              <span className="news-widget__topic">{article.topic}</span>
              <span>{article.source}</span>
              <span>{formatRelativeTime(article.publishedAt)}</span>
            </div>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}
