"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchExchangeSymbols } from "@/lib/binance/rest";
import { searchStocks } from "@/lib/yahoo/rest";
import type { StockSearchResult } from "@/lib/yahoo/rest";
import { useChartStore } from "@/lib/store/chart-store";
import { cn } from "@/lib/utils";
import type { SymbolInfo } from "@/lib/binance/types";

export function SymbolSelector() {
  const symbol = useChartStore((s) => s.symbol);
  const symbolType = useChartStore((s) => s.symbolType);
  const setSymbolWithType = useChartStore((s) => s.setSymbolWithType);
  const addToWatchlist = useChartStore((s) => s.addToWatchlist);
  const addToStockWatchlist = useChartStore((s) => s.addToStockWatchlist);
  const open = useChartStore((s) => s.symbolDialogOpen);
  const setOpen = useChartStore((s) => s.setSymbolDialogOpen);

  const [query, setQuery] = useState("");
  const [allCryptos, setAllCryptos] = useState<SymbolInfo[]>([]);
  const [stockResults, setStockResults] = useState<StockSearchResult[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  // Cargar lista de criptos al abrir
  useEffect(() => {
    if (open && allCryptos.length === 0) {
      fetchExchangeSymbols().then(setAllCryptos).catch(console.error);
    }
  }, [open, allCryptos.length]);

  // Buscar acciones con debounce
  useEffect(() => {
    if (!query.trim()) {
      setStockResults([]);
      return;
    }
    setStockLoading(true);
    const timer = setTimeout(() => {
      searchStocks(query)
        .then(setStockResults)
        .catch(() => setStockResults([]))
        .finally(() => setStockLoading(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const filteredCryptos = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return allCryptos.slice(0, 100);
    return allCryptos
      .filter(
        (s) =>
          s.symbol.includes(q) ||
          s.baseAsset.includes(q) ||
          s.quoteAsset.includes(q),
      )
      .slice(0, 100);
  }, [query, allCryptos]);

  const displayLabel =
    symbolType === "stock" ? symbol : symbol;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQuery("");
      }}
    >
      <DialogTrigger className="group flex items-center gap-2 rounded px-3 py-1.5 text-sm font-semibold hover:bg-tv-panel-hover">
        <Search className="h-3.5 w-3.5 text-tv-text-muted group-hover:text-tv-text" />
        <span className="tabular-nums">{displayLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 text-tv-text-muted" />
      </DialogTrigger>

      <DialogContent className="max-w-md gap-0 bg-tv-panel p-0">
        <DialogHeader className="border-b border-tv-border px-4 py-3">
          <DialogTitle className="text-sm font-medium">Buscar símbolo</DialogTitle>
        </DialogHeader>

        <div className="border-b border-tv-border p-3">
          <Input
            autoFocus
            placeholder="BTC, AAPL, SPY…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-tv-bg"
          />
        </div>

        <Tabs defaultValue="crypto">
          <TabsList className="w-full rounded-none border-b border-tv-border bg-transparent px-4">
            <TabsTrigger value="crypto" className="text-xs">
              Cripto (Binance)
            </TabsTrigger>
            <TabsTrigger value="stocks" className="text-xs">
              Acciones (NYSE / NASDAQ)
            </TabsTrigger>
          </TabsList>

          {/* ─ Tab Cripto ─ */}
          <TabsContent value="crypto" className="m-0">
            <ScrollArea className="h-[340px]">
              <div className="flex flex-col">
                {filteredCryptos.length === 0 && (
                  <div className="p-4 text-center text-xs text-tv-text-muted">
                    Sin resultados
                  </div>
                )}
                {filteredCryptos.map((s) => (
                  <button
                    key={s.symbol}
                    onClick={() => {
                      setSymbolWithType(s.symbol, "crypto");
                      addToWatchlist(s.symbol);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex items-center justify-between border-b border-tv-border px-4 py-2 text-left text-xs hover:bg-tv-panel-hover",
                      s.symbol === symbol && symbolType === "crypto" && "bg-tv-panel-hover",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-tv-text">{s.baseAsset}</span>
                      <span className="text-tv-text-muted">/ {s.quoteAsset}</span>
                    </div>
                    <span className="text-tv-text-muted">{s.symbol}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ─ Tab Acciones ─ */}
          <TabsContent value="stocks" className="m-0">
            <ScrollArea className="h-[340px]">
              <div className="flex flex-col">
                {stockLoading && (
                  <div className="p-4 text-center text-xs text-tv-text-muted">
                    Buscando…
                  </div>
                )}
                {!stockLoading && query.trim() && stockResults.length === 0 && (
                  <div className="p-4 text-center text-xs text-tv-text-muted">
                    Sin resultados
                  </div>
                )}
                {!stockLoading && !query.trim() && (
                  <div className="p-4 text-center text-xs text-tv-text-muted">
                    Escribí para buscar acciones, ETFs o índices
                  </div>
                )}
                {stockResults.map((s) => (
                  <button
                    key={s.symbol}
                    onClick={() => {
                      setSymbolWithType(s.symbol, "stock");
                      addToStockWatchlist(s.symbol);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex items-center justify-between border-b border-tv-border px-4 py-2 text-left text-xs hover:bg-tv-panel-hover",
                      s.symbol === symbol && symbolType === "stock" && "bg-tv-panel-hover",
                    )}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-tv-text">{s.symbol}</span>
                      <span className="text-[10px] text-tv-text-muted">{s.shortName}</span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[10px] text-tv-text-muted">{s.exchange}</span>
                      <span className="text-[10px] text-tv-text-dim">{s.quoteType}</span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
