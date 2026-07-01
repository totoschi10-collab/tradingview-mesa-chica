"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Timeframe } from "@/lib/binance/types";

export type IndicatorKey =
  | "ema20" | "ema50" | "ema200" | "rsi" | "macd" | "volume";

export type DrawingTool =
  | "cursor" | "hline" | "trendline" | "fibonacci" | "measure" | "eraser";

export type SymbolType = "crypto" | "stock";
export type DashStyle = "solid" | "dashed" | "dotted";
export type LineMode = "segment" | "ray" | "extended";
export type FibMode = "retracement" | "extension";
export type TrendLinePaneKey = "main" | "rsi" | "macd";

export type PatternKey = "sr" | "trendlines" | "channels" | "flags" | "fib";
export type PatternToggles = Record<PatternKey, boolean>;

export interface PriceLine {
  id: string;
  symbol: string;
  price: number;
}

export interface TrendLine {
  id: string;
  symbol: string;
  timeframe: string;
  aTime: number;
  aPrice: number;
  bTime: number;
  bPrice: number;
  color: string;
  width: number;
  dash: DashStyle;
  lineMode?: LineMode;          // undefined → "segment"
  pane?: TrendLinePaneKey;      // undefined → "main"
}

export interface FibDrawing {
  id: string;
  symbol: string;
  timeframe: string;
  aTime: number;
  aPrice: number;
  bTime: number;
  bPrice: number;
  fibType?: "retracement" | "extension";   // undefined → "retracement"
}

export interface Strategy {
  id: string;
  name: string;
  symbol: string;
  createdAt: number;
  // New format: full drawing data (symbol/id stripped)
  trendLineData?: Omit<TrendLine, "id" | "symbol">[];
  priceLineData?: Omit<PriceLine, "id" | "symbol">[];
  fibDrawingData?: Omit<FibDrawing, "id" | "symbol">[];
  // Old format backwards-compat
  trendLineIds?: string[];
  priceLineIds?: string[];
  fibDrawingIds?: string[];
}

export interface IndicatorLevel {
  id: string;
  indicatorKey: "rsi" | "macd";
  price: number;
  color: string;
  label: string;
}

export interface IndicatorConfig {
  ema20: number; ema50: number; ema200: number;
  rsi: number; macdFast: number; macdSlow: number; macdSignal: number;
}

export const DEFAULT_CONFIG: IndicatorConfig = {
  ema20: 20, ema50: 50, ema200: 200,
  rsi: 14, macdFast: 12, macdSlow: 26, macdSignal: 9,
};

export const INDICATOR_COLORS: Record<IndicatorKey, string> = {
  ema20: "#ffb74d", ema50: "#2962ff", ema200: "#ab47bc",
  rsi: "#ab47bc", macd: "#2962ff", volume: "#787b86",
};

export const DEFAULT_WATCHLIST = [
  "BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT",
  "DOGEUSDT","ADAUSDT","AVAXUSDT","LINKUSDT","MATICUSDT",
];

export const DEFAULT_STOCK_WATCHLIST = [
  "AAPL","MSFT","GOOGL","AMZN","NVDA","TSLA","META","JPM","SPY","QQQ",
];

export const DEFAULT_INDICATOR_LEVELS: IndicatorLevel[] = [
  { id: "rsi-30", indicatorKey: "rsi", price: 30, color: "#787b86", label: "30" },
  { id: "rsi-70", indicatorKey: "rsi", price: 70, color: "#787b86", label: "70" },
];

function genId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

interface ChartState {
  symbol: string; symbolType: SymbolType; timeframe: Timeframe;
  indicators: Record<IndicatorKey, boolean>;
  hidden: Record<IndicatorKey, boolean>;
  config: IndicatorConfig;
  indicatorColors: Partial<Record<IndicatorKey, string>>;
  indicatorLevels: IndicatorLevel[];
  watchlist: string[]; stockWatchlist: string[]; watchlistVisible: boolean;
  priceLines: PriceLine[]; trendLines: TrendLine[]; fibDrawings: FibDrawing[];
  strategies: Strategy[];
  tool: DrawingTool;
  trendLineModePreference: LineMode;
  fibModePreference: FibMode;
  patternToggles: PatternToggles;
  symbolDialogOpen: boolean; settingsTarget: IndicatorKey | null;
  strategyDialogOpen: boolean;

  setSymbol: (s: string) => void;
  setSymbolWithType: (s: string, type: SymbolType) => void;
  setTimeframe: (t: Timeframe) => void;
  toggleIndicator: (key: IndicatorKey) => void;
  removeIndicator: (key: IndicatorKey) => void;
  toggleHidden: (key: IndicatorKey) => void;
  setConfig: (patch: Partial<IndicatorConfig>) => void;
  setIndicatorColor: (key: IndicatorKey, color: string) => void;
  resetIndicatorColor: (key: IndicatorKey) => void;
  addIndicatorLevel: (level: Omit<IndicatorLevel, "id">) => void;
  removeIndicatorLevel: (id: string) => void;
  addToWatchlist: (s: string) => void; removeFromWatchlist: (s: string) => void;
  addToStockWatchlist: (s: string) => void; removeFromStockWatchlist: (s: string) => void;
  toggleWatchlist: () => void;
  setTool: (t: DrawingTool) => void;
  setTrendLineModePreference: (m: LineMode) => void;
  setFibModePreference: (m: FibMode) => void;
  togglePattern: (key: PatternKey) => void;
  addPriceLine: (price: number, symbol: string) => void;
  removePriceLine: (id: string) => void;
  updatePriceLine: (id: string, price: number) => void;
  addTrendLine: (line: Omit<TrendLine, "id">) => void;
  removeTrendLine: (id: string) => void;
  updateTrendLine: (id: string, patch: Partial<Pick<TrendLine, "color" | "width" | "dash" | "lineMode" | "aTime" | "aPrice" | "bTime" | "bPrice">>) => void;
  addFibDrawing: (d: Omit<FibDrawing, "id">) => void;
  removeFibDrawing: (id: string) => void;
  clearAllDrawings: (symbol: string) => void;
  saveStrategy: (name: string, symbol: string) => string;
  loadStrategy: (id: string, targetSymbol?: string) => void;
  deleteStrategy: (id: string) => void;
  renameStrategy: (id: string, name: string) => void;
  setSymbolDialogOpen: (v: boolean) => void;
  setSettingsTarget: (k: IndicatorKey | null) => void;
  setStrategyDialogOpen: (v: boolean) => void;
}

export const useChartStore = create<ChartState>()(
  persist(
    (set) => ({
      symbol: "BTCUSDT", symbolType: "crypto", timeframe: "15m" as Timeframe,
      indicators: { ema20: true, ema50: true, ema200: false, rsi: true, macd: false, volume: true },
      hidden: { ema20: false, ema50: false, ema200: false, rsi: false, macd: false, volume: false },
      config: { ...DEFAULT_CONFIG },
      indicatorColors: {},
      indicatorLevels: DEFAULT_INDICATOR_LEVELS,
      watchlist: DEFAULT_WATCHLIST, stockWatchlist: DEFAULT_STOCK_WATCHLIST, watchlistVisible: true,
      priceLines: [], trendLines: [], fibDrawings: [],
      strategies: [],
      tool: "cursor",
      trendLineModePreference: "segment" as LineMode,
      fibModePreference: "retracement" as FibMode,
      patternToggles: { sr: false, trendlines: false, channels: false, flags: false, fib: false },
      symbolDialogOpen: false, settingsTarget: null, strategyDialogOpen: false,

      setSymbol: (symbol) => set({ symbol }),
      setSymbolWithType: (symbol, symbolType) => set({ symbol, symbolType }),
      setTimeframe: (timeframe) => set({ timeframe }),
      toggleIndicator: (key) => set((s) => ({
        indicators: { ...s.indicators, [key]: !s.indicators[key] },
        hidden: !s.indicators[key] ? { ...s.hidden, [key]: false } : s.hidden,
      })),
      removeIndicator: (key) => set((s) => ({
        indicators: { ...s.indicators, [key]: false },
        hidden: { ...s.hidden, [key]: false },
      })),
      toggleHidden: (key) => set((s) => ({ hidden: { ...s.hidden, [key]: !s.hidden[key] } })),
      setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      setIndicatorColor: (key, color) => set((s) => ({ indicatorColors: { ...s.indicatorColors, [key]: color } })),
      resetIndicatorColor: (key) => set((s) => {
        const next = { ...s.indicatorColors }; delete next[key]; return { indicatorColors: next };
      }),
      addIndicatorLevel: (level) => set((s) => ({
        indicatorLevels: [...s.indicatorLevels, { id: genId(), ...level }],
      })),
      removeIndicatorLevel: (id) => set((s) => ({
        indicatorLevels: s.indicatorLevels.filter((l) => l.id !== id),
      })),
      addToWatchlist: (s) => set((st) => ({
        watchlist: st.watchlist.includes(s) ? st.watchlist : [...st.watchlist, s],
      })),
      removeFromWatchlist: (s) => set((st) => ({ watchlist: st.watchlist.filter((x) => x !== s) })),
      addToStockWatchlist: (s) => set((st) => ({
        stockWatchlist: st.stockWatchlist.includes(s) ? st.stockWatchlist : [...st.stockWatchlist, s],
      })),
      removeFromStockWatchlist: (s) => set((st) => ({ stockWatchlist: st.stockWatchlist.filter((x) => x !== s) })),
      toggleWatchlist: () => set((s) => ({ watchlistVisible: !s.watchlistVisible })),
      setTool: (tool) => set({ tool }),
      setTrendLineModePreference: (trendLineModePreference) => set({ trendLineModePreference }),
      setFibModePreference: (fibModePreference) => set({ fibModePreference }),
      togglePattern: (key) => set((s) => ({
        patternToggles: { ...s.patternToggles, [key]: !s.patternToggles[key] },
      })),
      addPriceLine: (price, symbol) => set((s) => ({
        priceLines: [...s.priceLines, { id: genId(), symbol, price }],
      })),
      removePriceLine: (id) => set((s) => ({ priceLines: s.priceLines.filter((p) => p.id !== id) })),
      updatePriceLine: (id, price) => set((s) => ({
        priceLines: s.priceLines.map((p) => p.id === id ? { ...p, price } : p),
      })),
      addTrendLine: (line) => set((s) => ({
        trendLines: [...s.trendLines, { id: genId(), ...line }],
      })),
      removeTrendLine: (id) => set((s) => ({ trendLines: s.trendLines.filter((l) => l.id !== id) })),
      updateTrendLine: (id, patch) => set((s) => ({
        trendLines: s.trendLines.map((l) => l.id === id ? { ...l, ...patch } : l),
      })),
      addFibDrawing: (d) => set((s) => ({
        fibDrawings: [...s.fibDrawings, { id: genId(), ...d }],
      })),
      removeFibDrawing: (id) => set((s) => ({ fibDrawings: s.fibDrawings.filter((f) => f.id !== id) })),
      clearAllDrawings: (symbol) => set((s) => ({
        priceLines: s.priceLines.filter((p) => p.symbol !== symbol),
        trendLines: s.trendLines.filter((t) => t.symbol !== symbol),
        fibDrawings: s.fibDrawings.filter((f) => f.symbol !== symbol),
      })),
      saveStrategy: (name, symbol) => {
        const id = genId();
        set((s) => ({
          strategies: [
            ...s.strategies,
            {
              id,
              name,
              symbol,
              createdAt: Date.now(),
              // New format: embed full drawing data (without id/symbol)
              trendLineData: s.trendLines
                .filter((l) => l.symbol === symbol)
                .map(({ id: _id, symbol: _sym, ...rest }) => rest),
              priceLineData: s.priceLines
                .filter((p) => p.symbol === symbol)
                .map(({ id: _id, symbol: _sym, ...rest }) => rest),
              fibDrawingData: s.fibDrawings
                .filter((f) => f.symbol === symbol)
                .map(({ id: _id, symbol: _sym, ...rest }) => rest),
            },
          ],
        }));
        return id;
      },
      loadStrategy: (id, targetSymbol) => set((s) => {
        const strategy = s.strategies.find((st) => st.id === id);
        if (!strategy) return {};

        const applyTo = targetSymbol ?? strategy.symbol;

        // New format: restore from embedded data with fresh IDs
        if (strategy.trendLineData !== undefined) {
          const newTL = strategy.trendLineData.map((d) => ({ ...d, id: genId(), symbol: applyTo }));
          const newPL = (strategy.priceLineData ?? []).map((d) => ({ ...d, id: genId(), symbol: applyTo }));
          const newFD = (strategy.fibDrawingData ?? []).map((d) => ({ ...d, id: genId(), symbol: applyTo }));
          return {
            trendLines: [...s.trendLines.filter((l) => l.symbol !== applyTo), ...newTL],
            priceLines: [...s.priceLines.filter((p) => p.symbol !== applyTo), ...newPL],
            fibDrawings: [...s.fibDrawings.filter((f) => f.symbol !== applyTo), ...newFD],
          };
        }

        // Old format backwards-compat (IDs only)
        const activeIds = new Set([
          ...(strategy.trendLineIds ?? []),
          ...(strategy.priceLineIds ?? []),
          ...(strategy.fibDrawingIds ?? []),
        ]);
        if (applyTo === strategy.symbol) {
          return {
            trendLines: s.trendLines.filter((l) => l.symbol !== strategy.symbol || activeIds.has(l.id)),
            priceLines: s.priceLines.filter((p) => p.symbol !== strategy.symbol || activeIds.has(p.id)),
            fibDrawings: s.fibDrawings.filter((f) => f.symbol !== strategy.symbol || activeIds.has(f.id)),
          };
        }
        // Cross-symbol copy for old format
        const copiedTL = s.trendLines.filter((l) => activeIds.has(l.id)).map((l) => ({ ...l, id: genId(), symbol: applyTo }));
        const copiedPL = s.priceLines.filter((p) => activeIds.has(p.id)).map((p) => ({ ...p, id: genId(), symbol: applyTo }));
        const copiedFD = s.fibDrawings.filter((f) => activeIds.has(f.id)).map((f) => ({ ...f, id: genId(), symbol: applyTo }));
        return {
          trendLines: [...s.trendLines.filter((l) => l.symbol !== applyTo), ...copiedTL],
          priceLines: [...s.priceLines.filter((p) => p.symbol !== applyTo), ...copiedPL],
          fibDrawings: [...s.fibDrawings.filter((f) => f.symbol !== applyTo), ...copiedFD],
        };
      }),
      deleteStrategy: (id) => set((s) => ({
        strategies: s.strategies.filter((st) => st.id !== id),
      })),
      renameStrategy: (id, name) => set((s) => ({
        strategies: s.strategies.map((st) => st.id === id ? { ...st, name } : st),
      })),
      setSymbolDialogOpen: (symbolDialogOpen) => set({ symbolDialogOpen }),
      setSettingsTarget: (settingsTarget) => set({ settingsTarget }),
      setStrategyDialogOpen: (strategyDialogOpen) => set({ strategyDialogOpen }),
    }),
    {
      name: "tv-gratis-chart-state-v2",
      partialize: (s) => ({
        symbol: s.symbol, symbolType: s.symbolType, timeframe: s.timeframe,
        indicators: s.indicators, hidden: s.hidden, config: s.config,
        indicatorColors: s.indicatorColors, indicatorLevels: s.indicatorLevels,
        watchlist: s.watchlist, stockWatchlist: s.stockWatchlist, watchlistVisible: s.watchlistVisible,
        trendLineModePreference: s.trendLineModePreference,
        fibModePreference: s.fibModePreference,
        patternToggles: s.patternToggles,
        priceLines: s.priceLines, trendLines: s.trendLines, fibDrawings: s.fibDrawings,
        strategies: s.strategies,
      }),
    },
  ),
);
