"use client";

import { useEffect, useState } from "react";
import { useChartStore } from "@/lib/store/chart-store";
import { fetchTicker24h } from "@/lib/binance/rest";
import { fetchStockQuote } from "@/lib/yahoo/rest";
import type { Ticker24h } from "@/lib/binance/types";
import { formatPrice, formatPct, formatVolume } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DisplayStats {
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
}

export function BottomPanel() {
  const symbol = useChartStore((s) => s.symbol);
  const symbolType = useChartStore((s) => s.symbolType);
  const [t, setT] = useState<DisplayStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    setT(null);

    const load = async () => {
      try {
        if (symbolType === "stock") {
          const q = await fetchStockQuote(symbol);
          if (!cancelled) {
            setT({
              priceChangePercent: q.priceChangePercent,
              highPrice: q.highPrice,
              lowPrice: q.lowPrice,
              volume: q.volume,
              quoteVolume: q.quoteVolume,
            });
          }
        } else {
          const x: Ticker24h = await fetchTicker24h(symbol);
          if (!cancelled) setT(x);
        }
      } catch {
        // silencioso
      }
    };

    load();
    const interval = symbolType === "stock" ? 30_000 : 5_000;
    const id = setInterval(load, interval);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol, symbolType]);

  const upClass = (n: number) => (n >= 0 ? "text-tv-green" : "text-tv-red");

  return (
    <div className="flex h-9 items-center gap-0 border-t border-tv-border bg-tv-panel px-3 text-xs">
      <Stat label="Símbolo" value={symbol} />
      <Stat
        label={symbolType === "stock" ? "Día" : "24h Cambio"}
        value={t ? formatPct(t.priceChangePercent) : "—"}
        valueClass={t ? upClass(t.priceChangePercent) : ""}
      />
      <Stat
        label={symbolType === "stock" ? "Máx. día" : "24h Alto"}
        value={t ? formatPrice(t.highPrice) : "—"}
        valueClass="text-tv-green"
      />
      <Stat
        label={symbolType === "stock" ? "Mín. día" : "24h Bajo"}
        value={t ? formatPrice(t.lowPrice) : "—"}
        valueClass="text-tv-red"
      />
      <Stat label="Volumen" value={t ? formatVolume(t.volume) : "—"} />
      <Stat
        label={symbolType === "stock" ? "Vol. (USD)" : "Vol. (USDT)"}
        value={t ? formatVolume(t.quoteVolume) : "—"}
      />

      <div className="ml-auto flex items-center gap-2 text-[10px] text-tv-text-dim">
        {symbolType === "stock" ? (
          <>
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-tv-blue opacity-80" />
            <span>Yahoo Finance · ~30s</span>
          </>
        ) : (
          <>
            <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-tv-green" />
            <span>Binance · Live</span>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 border-r border-tv-border px-3">
      <span className="text-tv-text-dim">{label}</span>
      <span className={cn("font-medium tabular-nums", valueClass ?? "text-tv-text")}>
        {value}
      </span>
    </div>
  );
}
