import type { Candle, Timeframe } from "@/lib/binance/types";

function toYahooParams(tf: Timeframe): { interval: string; range: string } {
  const map: Record<Timeframe, { interval: string; range: string }> = {
    "1m":  { interval: "1m",  range: "1d" },
    "3m":  { interval: "2m",  range: "5d" },
    "5m":  { interval: "5m",  range: "60d" },
    "15m": { interval: "15m", range: "60d" },
    "30m": { interval: "30m", range: "60d" },
    "1h":  { interval: "60m", range: "730d" },
    "2h":  { interval: "60m", range: "730d" },
    "4h":  { interval: "60m", range: "730d" },
    "6h":  { interval: "60m", range: "730d" },
    "8h":  { interval: "60m", range: "730d" },
    "12h": { interval: "60m", range: "730d" },
    "1d":  { interval: "1d",  range: "5y" },
    "3d":  { interval: "1d",  range: "5y" },
    "1w":  { interval: "1wk", range: "max" },
    "1M":  { interval: "1mo", range: "max" },
  };
  return map[tf] ?? { interval: "1d", range: "5y" };
}

export async function fetchStockKlines(
  symbol: string,
  timeframe: Timeframe,
): Promise<Candle[]> {
  const { interval, range } = toYahooParams(timeframe);
  const res = await fetch(
    `/api/stocks/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`stocks/chart ${res.status}`);
  return res.json();
}

export interface StockQuote {
  symbol: string;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  longName: string;
}

export async function fetchStockQuote(symbol: string, timeframe?: string): Promise<StockQuote> {
  const quotes = await fetchStockQuotes([symbol], timeframe);
  if (!quotes[0]) throw new Error("no quote data");
  return quotes[0];
}

export async function fetchStockQuotes(symbols: string[], timeframe?: string): Promise<StockQuote[]> {
  if (symbols.length === 0) return [];
  const tf = timeframe ?? "1d";
  const res = await fetch(
    `/api/stocks/quote?symbols=${encodeURIComponent(symbols.join(","))}&tf=${encodeURIComponent(tf)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`stocks/quote ${res.status}`);
  return res.json();
}

export interface StockSearchResult {
  symbol: string;
  shortName: string;
  longName: string;
  exchange: string;
  quoteType: string;
}

export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(
    `/api/stocks/search?q=${encodeURIComponent(query.trim())}`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  return res.json();
}
