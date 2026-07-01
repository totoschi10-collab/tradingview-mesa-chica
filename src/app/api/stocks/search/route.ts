import { NextRequest, NextResponse } from "next/server";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "application/json",
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json([]);

  const url =
    `https://query2.finance.yahoo.com/v1/finance/search` +
    `?q=${encodeURIComponent(q)}&quotesCount=20&newsCount=0&listsCount=0`;

  const upstream = await fetch(url, { headers: HEADERS });
  if (!upstream.ok) return NextResponse.json([]);

  const data = await upstream.json();
  const quotes: Record<string, unknown>[] = data?.quotes ?? [];

  const results = quotes
    .filter(
      (item) =>
        item.quoteType === "EQUITY" ||
        item.quoteType === "ETF" ||
        item.quoteType === "INDEX",
    )
    .map((item) => ({
      symbol: item.symbol,
      shortName: item.shortName ?? "",
      longName: item.longName ?? item.shortName ?? "",
      exchange: item.exchDisp ?? item.exchange ?? "",
      quoteType: item.quoteType ?? "",
    }));

  return NextResponse.json(results);
}
