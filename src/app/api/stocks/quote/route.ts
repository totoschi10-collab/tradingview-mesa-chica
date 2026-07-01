import { NextRequest, NextResponse } from "next/server";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "application/json",
};

function toYahooParams(tf: string): { interval: string; range: string } {
  const map: Record<string, { interval: string; range: string }> = {
    "1m":  { interval: "1m",  range: "1d" },
    "3m":  { interval: "2m",  range: "5d" },
    "5m":  { interval: "5m",  range: "5d" },
    "15m": { interval: "15m", range: "5d" },
    "30m": { interval: "30m", range: "10d" },
    "1h":  { interval: "60m", range: "30d" },
    "2h":  { interval: "60m", range: "30d" },
    "4h":  { interval: "60m", range: "60d" },
    "6h":  { interval: "60m", range: "60d" },
    "8h":  { interval: "60m", range: "60d" },
    "12h": { interval: "60m", range: "60d" },
    "1d":  { interval: "1d",  range: "5d" },
    "3d":  { interval: "1d",  range: "10d" },
    "1w":  { interval: "1wk", range: "3mo" },
    "1M":  { interval: "1mo", range: "1y" },
  };
  return map[tf] ?? { interval: "1d", range: "5d" };
}

async function fetchQuoteFromChart(symbol: string, tf = "1d") {
  const { interval, range } = toYahooParams(tf);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${interval}&range=${range}&includePrePost=false`;

  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return null;

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const meta = result?.meta as Record<string, unknown> | undefined;
  if (!meta) return null;

  const price = (meta.regularMarketPrice as number) ?? 0;

  // Compute % from last 2 closing prices in the OHLCV data (timeframe-aware)
  let prevClose: number;
  const closes = result?.indicators?.quote?.[0]?.close as (number | null)[] | undefined;
  if (closes && closes.length >= 2) {
    const valid = closes.filter((c): c is number => c !== null && c !== undefined && isFinite(c));
    prevClose = valid.length >= 2 ? valid[valid.length - 2] : valid[valid.length - 1] ?? price;
  } else {
    prevClose = (meta.chartPreviousClose as number) ?? (meta.previousClose as number) ?? price;
  }

  const change = price - prevClose;
  const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol: (meta.symbol as string) ?? symbol.toUpperCase(),
    lastPrice: price,
    priceChange: change,
    priceChangePercent: changePct,
    highPrice: (meta.regularMarketDayHigh as number) ?? price,
    lowPrice: (meta.regularMarketDayLow as number) ?? price,
    volume: (meta.regularMarketVolume as number) ?? 0,
    quoteVolume: price * ((meta.regularMarketVolume as number) ?? 0),
    longName:
      (meta.longName as string) ?? (meta.shortName as string) ?? symbol.toUpperCase(),
  };
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "";
  const tf = req.nextUrl.searchParams.get("tf") ?? "1d";
  if (!symbolsParam.trim()) return NextResponse.json([]);

  const list = symbolsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const settled = await Promise.allSettled(list.map((s) => fetchQuoteFromChart(s, tf)));

  const quotes = settled
    .filter(
      (r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof fetchQuoteFromChart>>>> =>
        r.status === "fulfilled" && r.value !== null,
    )
    .map((r) => r.value);

  return NextResponse.json(quotes);
}
