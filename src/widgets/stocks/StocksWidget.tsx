import { usePolling } from "../../shared/hooks/usePolling";
import { WidgetShell } from "../../shared/WidgetShell";
import { formatCurrency, formatSignedPercent } from "../../shared/format";
import { fetchQuotes } from "./stocksService";
import "./StocksWidget.css";

// Yahoo's chart endpoint is unofficial/unauthenticated - keep polling
// conservative so it doesn't look like abuse over a long always-on session.
const REFRESH_INTERVAL_MS = 60_000;

export function StocksWidget() {
  const { data, loading, error, refresh } = usePolling(fetchQuotes, REFRESH_INTERVAL_MS);

  return (
    <WidgetShell title="Stocks" loading={loading} error={error} onRefresh={refresh}>
      <ul className="stocks-widget__list">
        {data?.map((quote) => {
          const isUp = quote.change >= 0;
          return (
            <li key={quote.symbol} className="stocks-widget__row">
              <span className="stocks-widget__symbol">{quote.symbol}</span>
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
