import { delay, hashSeed, mulberry32 } from "../../shared/mock";
import type { Quote, StockProvider } from "./types";

const BASE_PRICES: Record<string, number> = {
  AAPL: 195,
  MSFT: 420,
  NVDA: 135,
  SPY: 560,
};
const FALLBACK_BASE_PRICE = 100;

/**
 * Placeholder provider - walks each symbol's price a small random amount on
 * every call so the widget has something to visibly refresh. Swap this for
 * a RealStockProvider (a market data API) implementing the same interface.
 */
class MockStockProvider implements StockProvider {
  private lastPrice = new Map<string, number>();

  async fetchQuotes(symbols: string[]): Promise<Quote[]> {
    await delay(200);

    return symbols.map((symbol) => {
      const previous = this.lastPrice.get(symbol) ?? BASE_PRICES[symbol] ?? FALLBACK_BASE_PRICE;
      const rand = mulberry32(hashSeed(symbol + Date.now().toString()));
      const percentMove = (rand() - 0.5) * 0.6; // +/- 0.3% per tick
      const price = Math.max(0.01, previous * (1 + percentMove / 100));
      this.lastPrice.set(symbol, price);

      const dayOpen = BASE_PRICES[symbol] ?? FALLBACK_BASE_PRICE;
      const change = price - dayOpen;

      return {
        symbol,
        price,
        change,
        changePercent: (change / dayOpen) * 100,
        currency: "USD",
        updatedAt: new Date().toISOString(),
      };
    });
  }
}

let provider: StockProvider = new MockStockProvider();

export function getStockProvider(): StockProvider {
  return provider;
}

export function setStockProvider(next: StockProvider): void {
  provider = next;
}
