import { NextRequest, NextResponse } from "next/server";
import type { Candle } from "@/lib/binance/types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "application/json",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const interval = req.nextUrl.searchParams.get("interval") ?? "1d";
  const range = req.nextUrl.searchParams.get("range") ?? "5y";

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${interval}&range=${range}&includePrePost=false`;

  const upstream = await fetch(url, { headers: HEADERS });
  if (!upstream.ok) {
    return NextResponse.json([], { status: 200 });
  }

  const data = await upstream.json();
  const result = data?.chart?.result?.[0];
  if (!result) return NextResponse.json([]);

  const timestamps: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0];
  if (!q || timestamps.length === 0) return NextResponse.json([]);

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = q.open?.[i] as number | null;
    const h = q.high?.[i] as number | null;
    const l = q.low?.[i] as number | null;
    const c = q.close?.[i] as number | null;
    const v = q.volume?.[i] as number | null;
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({
      time: timestamps[i],
      open: o,
      high: h,
      low: l,
      close: c,
      volume: v ?? 0,
      isFinal: true,
    });
  }

  return NextResponse.json(candles);
}
