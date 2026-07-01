"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { fetchKlines } from "@/lib/binance/rest";
import { fetchTickers24h } from "@/lib/binance/rest";
import { getBinanceWS } from "@/lib/binance/ws";
import { fetchStockQuotes } from "@/lib/yahoo/rest";
import type { StockQuote } from "@/lib/yahoo/rest";
import { useChartStore } from "@/lib/store/chart-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPrice, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Row {
  symbol: string;
  price: number;
  pct: number;
}

// ─── Tab: Cripto ─────────────────────────────────────────────────────────────

function CryptoWatchlist() {
  const watchlist = useChartStore((s) => s.watchlist);
  const symbol = useChartStore((s) => s.symbol);
  const symbolType = useChartStore((s) => s.symbolType);
  const timeframe = useChartStore((s) => s.timeframe);
  const setSymbolWithType = useChartStore((s) => s.setSymbolWithType);
  const removeFromWatchlist = useChartStore((s) => s.removeFromWatchlist);
  const openSymbolDialog = useChartStore((s) => s.setSymbolDialogOpen);

  const [rows, setRows] = useState<Record<string, Row>>({});
  const [flash, setFlash] = useState<Record<string, "up" | "down" | null>>({});
  // Reference close price per symbol for timeframe-aware % calculation
  const refPricesRef = useRef<Record<string, number>>({});

  // Fetch reference prices (last completed candle close) when timeframe or watchlist changes
  useEffect(() => {
    if (watchlist.length === 0) return;
    let cancelled = false;

    Promise.allSettled(watchlist.map((s) => fetchKlines(s, timeframe, 2)))
      .then((results) => {
        if (cancelled) return;
        const refs: Record<string, number> = {};
        watchlist.forEach((s, i) => {
          const r = results[i];
          if (r.status === "fulfilled" && r.value.length >= 1) {
            const klines = r.value;
            // Use previous candle's close as reference (second-to-last, or first if only one)
            refs[s] = klines.length >= 2
              ? klines[klines.length - 2].close
              : klines[0].open;
          }
        });
        refPricesRef.current = refs;
        // Recompute % for all existing rows using new reference prices
        setRows((prev) => {
          const next: Record<string, Row> = {};
          for (const [sym, row] of Object.entries(prev)) {
            const ref = refs[sym];
            next[sym] = {
              ...row,
              pct: ref && ref > 0 ? ((row.price - ref) / ref) * 100 : row.pct,
            };
          }
          return next;
        });
      })
      .catch(console.error);

    return () => { cancelled = true; };
  }, [watchlist, timeframe]);

  // Initial load + live WebSocket updates
  useEffect(() => {
    if (watchlist.length === 0) return;
    let cancelled = false;

    fetchTickers24h(watchlist)
      .then((tickers) => {
        if (cancelled) return;
        const map: Record<string, Row> = {};
        tickers.forEach((t) => {
          const ref = refPricesRef.current[t.symbol];
          map[t.symbol] = {
            symbol: t.symbol,
            price: t.lastPrice,
            pct: ref && ref > 0
              ? ((t.lastPrice - ref) / ref) * 100
              : t.priceChangePercent,
          };
        });
        setRows(map);
      })
      .catch(console.error);

    const ws = getBinanceWS();
    const unsub = ws.subscribeMiniTickers(watchlist, (tick) => {
      setRows((prev) => {
        const prevRow = prev[tick.symbol];
        if (prevRow) {
          if (tick.close > prevRow.price) {
            setFlash((f) => ({ ...f, [tick.symbol]: "up" }));
            setTimeout(() => setFlash((f) => ({ ...f, [tick.symbol]: null })), 300);
          } else if (tick.close < prevRow.price) {
            setFlash((f) => ({ ...f, [tick.symbol]: "down" }));
            setTimeout(() => setFlash((f) => ({ ...f, [tick.symbol]: null })), 300);
          }
        }
        const ref = refPricesRef.current[tick.symbol];
        return {
          ...prev,
          [tick.symbol]: {
            symbol: tick.symbol,
            price: tick.close,
            pct: ref && ref > 0 ? ((tick.close - ref) / ref) * 100 : tick.pct,
          },
        };
      });
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [watchlist]);

  return (
    <>
      <div className="flex items-center border-b border-tv-border px-3 py-1.5">
        <button
          onClick={() => openSymbolDialog(true)}
          className="ml-auto rounded p-1 text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
          title="Agregar cripto"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-tv-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-tv-text-dim">
        <span>Símbolo</span>
        <span className="text-right">Precio</span>
        <span className="text-right">{timeframe}</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {watchlist.map((s) => {
            const row = rows[s];
            const isActive = s === symbol && symbolType === "crypto";
            const f = flash[s];
            return (
              <div
                key={s}
                onClick={() => setSymbolWithType(s, "crypto")}
                className={cn(
                  "group grid cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-tv-panel-hover",
                  isActive && "bg-tv-panel-hover",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-tv-text">{s.replace("USDT", "")}</span>
                  <span className="text-[10px] text-tv-text-dim">USDT</span>
                </div>
                <span
                  className={cn(
                    "text-right tabular-nums transition-colors",
                    f === "up" && "text-tv-green",
                    f === "down" && "text-tv-red",
                    !f && "text-tv-text",
                  )}
                >
                  {row ? formatPrice(row.price) : "—"}
                </span>
                <div className="flex items-center justify-end gap-1">
                  <span
                    className={cn(
                      "tabular-nums",
                      row
                        ? row.pct >= 0
                          ? "text-tv-green"
                          : "text-tv-red"
                        : "text-tv-text-muted",
                    )}
                  >
                    {row ? formatPct(row.pct) : "—"}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWatchlist(s);
                    }}
                    className="invisible rounded p-0.5 text-tv-text-muted hover:bg-tv-bg hover:text-tv-red group-hover:visible"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
          {watchlist.length === 0 && (
            <div className="p-4 text-center text-xs text-tv-text-muted">
              Tu watchlist está vacío
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}

// ─── Tab: Acciones ───────────────────────────────────────────────────────────

function StockWatchlist() {
  const stockWatchlist = useChartStore((s) => s.stockWatchlist);
  const symbol = useChartStore((s) => s.symbol);
  const symbolType = useChartStore((s) => s.symbolType);
  const timeframe = useChartStore((s) => s.timeframe);
  const setSymbolWithType = useChartStore((s) => s.setSymbolWithType);
  const removeFromStockWatchlist = useChartStore((s) => s.removeFromStockWatchlist);
  const openSymbolDialog = useChartStore((s) => s.setSymbolDialogOpen);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});

  // Reload whenever timeframe or watchlist changes; also poll every 30s
  useEffect(() => {
    if (stockWatchlist.length === 0) return;
    let cancelled = false;

    const load = () => {
      fetchStockQuotes(stockWatchlist, timeframe)
        .then((data) => {
          if (cancelled) return;
          const map: Record<string, StockQuote> = {};
          data.forEach((q) => { map[q.symbol] = q; });
          setQuotes(map);
        })
        .catch(console.error);
    };

    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [stockWatchlist, timeframe]);

  return (
    <>
      <div className="flex items-center border-b border-tv-border px-3 py-1.5">
        <button
          onClick={() => openSymbolDialog(true)}
          className="ml-auto rounded p-1 text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
          title="Agregar acción"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-tv-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-tv-text-dim">
        <span>Símbolo</span>
        <span className="text-right">Precio</span>
        <span className="text-right">{timeframe}</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {stockWatchlist.map((s) => {
            const q = quotes[s];
            const isActive = s === symbol && symbolType === "stock";
            return (
              <div
                key={s}
                onClick={() => setSymbolWithType(s, "stock")}
                className={cn(
                  "group grid cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-tv-panel-hover",
                  isActive && "bg-tv-panel-hover",
                )}
              >
                <div className="flex flex-col">
                  <span className="font-medium text-tv-text">{s}</span>
                  {q?.longName && (
                    <span className="max-w-[80px] truncate text-[10px] text-tv-text-dim">
                      {q.longName}
                    </span>
                  )}
                </div>
                <span className="text-right tabular-nums text-tv-text">
                  {q ? formatPrice(q.lastPrice) : "—"}
                </span>
                <div className="flex items-center justify-end gap-1">
                  <span
                    className={cn(
                      "tabular-nums",
                      q
                        ? q.priceChangePercent >= 0
                          ? "text-tv-green"
                          : "text-tv-red"
                        : "text-tv-text-muted",
                    )}
                  >
                    {q ? formatPct(q.priceChangePercent) : "—"}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromStockWatchlist(s);
                    }}
                    className="invisible rounded p-0.5 text-tv-text-muted hover:bg-tv-bg hover:text-tv-red group-hover:visible"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
          {stockWatchlist.length === 0 && (
            <div className="p-4 text-center text-xs text-tv-text-muted">
              Tu watchlist de acciones está vacío
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}

// ─── Contenedor principal ────────────────────────────────────────────────────

export function Watchlist() {
  return (
    <Tabs defaultValue="crypto" className="flex h-full flex-col">
      <div className="flex items-center border-b border-tv-border px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-tv-text-muted">
          Watchlist
        </h2>
        <TabsList className="ml-auto h-6 gap-0.5 bg-transparent p-0">
          <TabsTrigger
            value="crypto"
            className="h-6 rounded px-2 text-[10px] data-[state=active]:bg-tv-panel-hover data-[state=active]:text-tv-text"
          >
            Cripto
          </TabsTrigger>
          <TabsTrigger
            value="stocks"
            className="h-6 rounded px-2 text-[10px] data-[state=active]:bg-tv-panel-hover data-[state=active]:text-tv-text"
          >
            Acciones
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="crypto" className="m-0 flex min-h-0 flex-1 flex-col">
        <CryptoWatchlist />
      </TabsContent>

      <TabsContent value="stocks" className="m-0 flex min-h-0 flex-1 flex-col">
        <StockWatchlist />
      </TabsContent>
    </Tabs>
  );
}
