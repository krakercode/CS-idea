import { type FormEvent, useState } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { usePolling } from "../../shared/hooks/usePolling";
import { WidgetShell } from "../../shared/WidgetShell";
import { formatCurrency, formatSignedPercent } from "../../shared/format";
import { fetchQuotes } from "./stocksService";
import { addSymbol, getWatchlist, MAX_SYMBOLS, removeSymbol } from "./watchlistStore";
import "./StocksWidget.css";

// Yahoo's chart endpoint is unofficial/unauthenticated - keep polling
// conservative so it doesn't look like abuse over a long always-on session.
const REFRESH_INTERVAL_MS = 60_000;
const SHOW_CHARTS_KEY = "stocks-show-charts";

function getShowCharts(): boolean {
  return localStorage.getItem(SHOW_CHARTS_KEY) !== "off";
}

function Sparkline({ history, isUp }: { history: number[]; isUp: boolean }) {
  if (history.length < 2) return <div className="stocks-widget__sparkline" />;
  const data = history.map((close) => ({ close }));
  return (
    <div className="stocks-widget__sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="close"
            stroke={isUp ? "var(--color-positive)" : "var(--color-negative)"}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StocksWidget() {
  const { data, loading, error, refresh } = usePolling(fetchQuotes, REFRESH_INTERVAL_MS);
  const [watchlist, setWatchlist] = useState<string[]>(() => getWatchlist());
  const [draft, setDraft] = useState("");
  const [showCharts, setShowCharts] = useState(getShowCharts);

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    setWatchlist(addSymbol(draft));
    setDraft("");
    refresh();
  }

  function handleRemove(symbol: string) {
    setWatchlist(removeSymbol(symbol));
    refresh();
  }

  function toggleCharts() {
    const next = !showCharts;
    setShowCharts(next);
    localStorage.setItem(SHOW_CHARTS_KEY, next ? "on" : "off");
  }

  const headerActions = (
    <button
      type="button"
      className="widget-shell__icon-button"
      onClick={toggleCharts}
      title={showCharts ? "Hide charts" : "Show charts"}
      aria-label={showCharts ? "Hide charts" : "Show charts"}
    >
      {showCharts ? "📈" : "📉"}
    </button>
  );

  return (
    <WidgetShell title="Stocks" loading={loading} error={error} onRefresh={refresh} headerActions={headerActions}>
      <div className="stocks-widget__tags">
        {watchlist.map((symbol) => (
          <span key={symbol} className="stocks-widget__tag">
            {symbol}
            <button
              type="button"
              className="stocks-widget__tag-remove"
              onClick={() => handleRemove(symbol)}
              aria-label={`Stop tracking ${symbol}`}
            >
              ×
            </button>
          </span>
        ))}
        {watchlist.length < MAX_SYMBOLS && (
          <form className="stocks-widget__tag-form" onSubmit={handleAdd}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add ticker…"
              className="stocks-widget__tag-input"
            />
          </form>
        )}
      </div>

      <ul className="stocks-widget__list">
        {data?.map((quote) => {
          const isUp = quote.change >= 0;
          return (
            <li key={quote.symbol} className="stocks-widget__row">
              <span className="stocks-widget__symbol">{quote.symbol}</span>
              {showCharts && <Sparkline history={quote.history} isUp={isUp} />}
              <span className="stocks-widget__price">{formatCurrency(quote.price, quote.currency)}</span>
              <span className={`stocks-widget__change ${isUp ? "stocks-widget__change--up" : "stocks-widget__change--down"}`}>
                {formatSignedPercent(quote.change_percent)}
              </span>
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}
