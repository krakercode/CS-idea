export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  updatedAt: string; // ISO timestamp
}

export interface StockProvider {
  fetchQuotes(symbols: string[]): Promise<Quote[]>;
}
