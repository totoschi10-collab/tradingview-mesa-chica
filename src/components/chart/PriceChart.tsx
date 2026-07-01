"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from "lightweight-charts";
import { fetchKlines } from "@/lib/binance/rest";
import { getBinanceWS } from "@/lib/binance/ws";
import { fetchStockKlines, fetchStockQuote } from "@/lib/yahoo/rest";
import { ema, rsi, macd } from "@/lib/indicators";
import type { Candle, Timeframe } from "@/lib/binance/types";
import {
  INDICATOR_COLORS,
  useChartStore,
  type IndicatorKey,
  type FibMode,
} from "@/lib/store/chart-store";
import {
  FibOverlay,
  FIB_RETRACEMENT_LEVELS,
  FIB_EXTENSION_LEVELS,
  type ComputedFibDrawing,
} from "./FibOverlay";
import { TrendLineOverlay, type ComputedTrendLine } from "./TrendLineOverlay";
import { DrawingToolbar } from "./DrawingToolbar";
import { formatPrice, formatVolume } from "@/lib/format";
import { IndicatorPill } from "./IndicatorPill";
import { MeasureOverlay } from "./MeasureOverlay";
import {
  PatternOverlay,
  type ComputedSRLevel, type ComputedFlag,
  type ComputedAutoTrendLine, type ComputedChannel,
  type ComputedAutoFib,
} from "./PatternOverlay";
import {
  detectSupportResistance, detectFlags, detectAutoTrendLines, detectChannels, detectAutoFib,
  type SRLevel, type FlagPattern, type AutoTrendLine, type PriceChannel, type AutoFib,
} from "@/lib/patterns";

interface MeasurePoint {
  time: number;
  price: number;
}
interface MeasureState {
  phase: "idle" | "placing" | "done";
  a: MeasurePoint | null;
  b: MeasurePoint | null;
}
const INITIAL_MEASURE: MeasureState = { phase: "idle", a: null, b: null };

interface TwoPointState {
  a: MeasurePoint | null;
  b: MeasurePoint | null;
}
const INITIAL_TWOPOINT: TwoPointState = { a: null, b: null };

function durationLabel(aTime: number, bTime: number): string {
  const diff = Math.abs(bTime - aTime);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

interface Props {
  symbol: string;
  timeframe: Timeframe;
}

const TV_COLORS = {
  bg: "#131722",
  panel: "#1e222d",
  border: "#2a2e39",
  text: "#d1d4dc",
  textMuted: "#787b86",
  green: "#26a69a",
  red: "#ef5350",
  blue: "#2962ff",
  yellow: "#ffb74d",
  purple: "#ab47bc",
  grid: "#1e222d",
};

interface HoverInfo {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  time: number;
  pct: number;
}

interface LastValues {
  ema20?: number;
  ema50?: number;
  ema200?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  volume?: number;
}

interface PaneOffset {
  top: number;
  height: number;
}

export function PriceChart({ symbol, timeframe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const priceLinesMapRef = useRef<Map<string, IPriceLine>>(new Map());
  const indicatorLevelLinesRef = useRef<Map<string, { priceLine: IPriceLine; key: "rsi" | "macd" }>>(new Map());

  const indicators = useChartStore((s) => s.indicators);
  const hidden = useChartStore((s) => s.hidden);
  const config = useChartStore((s) => s.config);
  const indicatorColors = useChartStore((s) => s.indicatorColors);
  const indicatorLevels = useChartStore((s) => s.indicatorLevels);
  const tool = useChartStore((s) => s.tool);
  const patternToggles = useChartStore((s) => s.patternToggles);
  const trendLineModePreference = useChartStore((s) => s.trendLineModePreference);
  const setTrendLineModePreference = useChartStore((s) => s.setTrendLineModePreference);
  const fibModePreference = useChartStore((s) => s.fibModePreference);
  const priceLines = useChartStore((s) => s.priceLines);
  const trendLines = useChartStore((s) => s.trendLines);
  const fibDrawings = useChartStore((s) => s.fibDrawings);
  const symbolType = useChartStore((s) => s.symbolType);
  const addPriceLine = useChartStore((s) => s.addPriceLine);
  const removePriceLine = useChartStore((s) => s.removePriceLine);
  const updatePriceLine = useChartStore((s) => s.updatePriceLine);
  const addTrendLine = useChartStore((s) => s.addTrendLine);
  const removeTrendLine = useChartStore((s) => s.removeTrendLine);
  const updateTrendLine = useChartStore((s) => s.updateTrendLine);
  const addFibDrawing = useChartStore((s) => s.addFibDrawing);
  const removeFibDrawing = useChartStore((s) => s.removeFibDrawing);
  const removeIndicator = useChartStore((s) => s.removeIndicator);
  const toggleHidden = useChartStore((s) => s.toggleHidden);
  const setSettingsTarget = useChartStore((s) => s.setSettingsTarget);

  // Refs para evitar recrear el handler de clicks en cada render
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const trendLineModeRef = useRef(trendLineModePreference);
  trendLineModeRef.current = trendLineModePreference;
  const fibModePreferenceRef = useRef<FibMode>(fibModePreference);
  fibModePreferenceRef.current = fibModePreference;
  const addPriceLineRef = useRef(addPriceLine);
  addPriceLineRef.current = addPriceLine;
  const addTrendLineRef = useRef(addTrendLine);
  addTrendLineRef.current = addTrendLine;
  const addFibDrawingRef = useRef(addFibDrawing);
  addFibDrawingRef.current = addFibDrawing;
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;
  const timeframeRef = useRef(timeframe);
  timeframeRef.current = timeframe;
  const configRef = useRef(config);
  configRef.current = config;
  const paneOffsetsRef = useRef<PaneOffset[]>([]);
  const indicatorsRef = useRef(indicators);
  indicatorsRef.current = indicators;
  const indicatorLevelsRef = useRef(indicatorLevels);
  indicatorLevelsRef.current = indicatorLevels;

  const [activeDrawing, setActiveDrawing] = useState<{
    type: "hline" | "trendline" | "fib";
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const activeDrawingRef = useRef(activeDrawing);
  activeDrawingRef.current = activeDrawing;

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [lastPrice, setLastPrice] = useState<{ value: number; pct: number } | null>(null);
  const [lastValues, setLastValues] = useState<LastValues>({});
  const [paneOffsets, setPaneOffsets] = useState<PaneOffset[]>([]);
  const [measure, setMeasure] = useState<MeasureState>(INITIAL_MEASURE);
  const [trendLinePlacing, setTrendLinePlacing] = useState<TwoPointState>(INITIAL_TWOPOINT);
  const [rsiTrendLinePlacing, setRsiTrendLinePlacing] = useState<TwoPointState>(INITIAL_TWOPOINT);
  const [fibPlacing, setFibPlacing] = useState<TwoPointState>(INITIAL_TWOPOINT);
  const [renderTick, setRenderTick] = useState(0);
  // Reference price for stocks — prev candle close — for timeframe-aware % calculation
  const stockRefPriceRef = useRef<number | null>(null);
  // Detected patterns — updated when candle data loads
  const [srLevels, setSrLevels] = useState<SRLevel[]>([]);
  const [flagPatterns, setFlagPatterns] = useState<FlagPattern[]>([]);
  const [autoTrendLines, setAutoTrendLines] = useState<AutoTrendLine[]>([]);
  const [priceChannels, setPriceChannels] = useState<PriceChannel[]>([]);
  const [autoFib, setAutoFib] = useState<AutoFib | null>(null);

  // ── Drag state ─────────────────────────────────────────────────────────────
  type DragKind = "body" | "handle-a" | "handle-b" | "hline";
  const [dragState, setDragState] = useState<{
    id: string; kind: DragKind;
    pane: "main" | "rsi" | "macd";
    startClientX: number; startClientY: number;
    origATime: number; origAPrice: number;
    origBTime: number; origBPrice: number;
    didMove: boolean;
  } | null>(null);
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;

  // ── RSI exact-value popup ─────────────────────────────────────────────────
  const [rsiValuePopup, setRsiValuePopup] = useState<{
    chartX: number; chartY: number; inputValue: string;
    pendingTime: number; pendingPrice: number;
  } | null>(null);
  const rsiValuePopupRef = useRef(rsiValuePopup);
  rsiValuePopupRef.current = rsiValuePopup;

  const measureRef = useRef(measure);
  measureRef.current = measure;
  const trendLinePlacingRef = useRef(trendLinePlacing);
  trendLinePlacingRef.current = trendLinePlacing;
  const rsiTrendLinePlacingRef = useRef(rsiTrendLinePlacing);
  rsiTrendLinePlacingRef.current = rsiTrendLinePlacing;
  const fibPlacingRef = useRef(fibPlacing);
  fibPlacingRef.current = fibPlacing;

  // Helper — compute pane top offsets from chart layout
  function recomputePaneOffsets() {
    if (!chartRef.current) return;
    const panes = chartRef.current.panes();
    let top = 0;
    const offsets: PaneOffset[] = panes.map((p) => {
      const h = p.getHeight();
      const o = { top, height: h };
      top += h;
      return o;
    });
    paneOffsetsRef.current = offsets;
    setPaneOffsets(offsets);
  }

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: TV_COLORS.bg },
        textColor: TV_COLORS.text,
        fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
        fontSize: 11,
        panes: { separatorColor: TV_COLORS.border, separatorHoverColor: TV_COLORS.border },
      },
      grid: {
        vertLines: { color: TV_COLORS.grid },
        horzLines: { color: TV_COLORS.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: TV_COLORS.textMuted, width: 1, style: 3, labelBackgroundColor: TV_COLORS.panel },
        horzLine: { color: TV_COLORS.textMuted, width: 1, style: 3, labelBackgroundColor: TV_COLORS.panel },
      },
      rightPriceScale: {
        borderColor: TV_COLORS.border,
        textColor: TV_COLORS.textMuted,
      },
      timeScale: {
        borderColor: TV_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 8,
      },
      autoSize: true,
    });

    // PANE 0 — Candles + EMAs
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: TV_COLORS.green,
      downColor: TV_COLORS.red,
      borderUpColor: TV_COLORS.green,
      borderDownColor: TV_COLORS.red,
      wickUpColor: TV_COLORS.green,
      wickDownColor: TV_COLORS.red,
      priceLineColor: TV_COLORS.textMuted,
      priceLineStyle: 2,
    });

    ema20Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema20,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema50Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema50,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema200Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema200,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;

    // Click handler — gestiona todas las herramientas de dibujo
    chart.subscribeClick((param) => {
      if (!param.point || !candleSeriesRef.current) return;

      // Deseleccionar dibujo activo al hacer click en el chart
      if (activeDrawingRef.current) {
        setActiveDrawing(null);
        return;
      }

      // IMPORTANTE: param.point.y es relativo al PANE clickeado, no al chart container.
      // Usamos sourceEvent.clientY + getBoundingClientRect para obtener el Y absoluto
      // dentro del chart container, necesario para coordinateToPrice en panes no-principales.
      const containerRect = containerRef.current?.getBoundingClientRect();
      const chartRelativeY = param.sourceEvent && containerRect
        ? param.sourceEvent.clientY - containerRect.top
        : param.point.y;  // fallback: pane-relative (ok para pane 0)

      const offsets = paneOffsetsRef.current;
      const inds = indicatorsRef.current;

      // Detectar pane usando el Y relativo al chart container
      const rsiPaneOffset = offsets[1];
      const macdPaneIdx2 = inds.rsi ? 2 : 1;
      const macdPaneOffset = offsets[macdPaneIdx2];

      const isInRsiPane = !!(inds.rsi && rsiPaneOffset &&
        chartRelativeY >= rsiPaneOffset.top &&
        chartRelativeY < rsiPaneOffset.top + rsiPaneOffset.height);

      const isInMacdPane = !!(inds.macd && !isInRsiPane && macdPaneOffset &&
        chartRelativeY >= macdPaneOffset.top &&
        chartRelativeY < macdPaneOffset.top + macdPaneOffset.height);

      const isInMainPane = !isInRsiPane && !isInMacdPane;

      // Precio usando el Y correcto del chart container (no pane-relative)
      let price: number | null = null;
      if (isInRsiPane && rsiRef.current) {
        price = rsiRef.current.coordinateToPrice(chartRelativeY);
      } else if (isInMacdPane && macdRef.current) {
        price = macdRef.current.coordinateToPrice(chartRelativeY);
      } else {
        price = candleSeriesRef.current.coordinateToPrice(chartRelativeY);
      }
      if (price === null || !isFinite(price)) return;

      if (toolRef.current === "hline") {
        // hline en pane principal → precio line de chart
        if (isInMainPane) addPriceLineRef.current(price, symbolRef.current);
        // hline en pane RSI → trendline extendida horizontal en RSI
        if (isInRsiPane && param.time) {
          const t = Number(param.time);
          const clX = param.sourceEvent ? param.sourceEvent.clientX - (containerRef.current?.getBoundingClientRect().left ?? 0) : 0;
          setRsiValuePopup({ chartX: clX, chartY: chartRelativeY, inputValue: price.toFixed(2), pendingTime: t, pendingPrice: price });
        }
        return;
      }

      if (toolRef.current === "trendline") {
        if (!param.time) return;
        const time = Number(param.time);

        // ── RSI pane ──────────────────────────────────────────────────────
        if (isInRsiPane) {
          // Modo extended de un solo click → línea extendida horizontal inmediata
          if (trendLineModeRef.current === "extended" && !rsiTrendLinePlacingRef.current.a) {
            const clX = param.sourceEvent ? param.sourceEvent.clientX - (containerRef.current?.getBoundingClientRect().left ?? 0) : 0;
            setRsiValuePopup({ chartX: clX, chartY: chartRelativeY, inputValue: price.toFixed(2), pendingTime: time, pendingPrice: price });
            return;
          }
          const cur = rsiTrendLinePlacingRef.current;
          if (!cur.a) {
            // Mostrar popup de valor exacto antes de confirmar el primer punto
            const clX = param.sourceEvent ? param.sourceEvent.clientX - (containerRef.current?.getBoundingClientRect().left ?? 0) : 0;
            setRsiValuePopup({ chartX: clX, chartY: chartRelativeY, inputValue: price.toFixed(2), pendingTime: time, pendingPrice: price });
            setRsiTrendLinePlacing({ a: { time, price }, b: { time, price } });
          } else {
            addTrendLineRef.current({
              symbol: symbolRef.current,
              timeframe: timeframeRef.current,
              aTime: cur.a.time, aPrice: cur.a.price,
              bTime: time, bPrice: price,
              color: "#ab47bc",
              width: 1,
              dash: "solid",
              lineMode: trendLineModeRef.current,
              pane: "rsi",
            });
            setRsiTrendLinePlacing(INITIAL_TWOPOINT);
            setRsiValuePopup(null);
          }
          return;
        }

        // ── Main pane — modo extended: un solo click crea línea horizontal ─
        if (trendLineModeRef.current === "extended" && !trendLinePlacingRef.current.a) {
          addTrendLineRef.current({
            symbol: symbolRef.current,
            timeframe: timeframeRef.current,
            aTime: time, aPrice: price,
            bTime: time, bPrice: price,
            color: "#2962ff", width: 1, dash: "solid",
            lineMode: "extended", pane: "main",
          });
          return;
        }

        // ── Main pane ─────────────────────────────────────────────────────
        const cur = trendLinePlacingRef.current;
        if (!cur.a) {
          setTrendLinePlacing({ a: { time, price }, b: { time, price } });
        } else {
          addTrendLineRef.current({
            symbol: symbolRef.current,
            timeframe: timeframeRef.current,
            aTime: cur.a.time,
            aPrice: cur.a.price,
            bTime: time,
            bPrice: price,
            color: "#2962ff",
            width: 1,
            dash: "solid",
            lineMode: trendLineModeRef.current,
            pane: "main",
          });
          setTrendLinePlacing(INITIAL_TWOPOINT);
        }
        return;
      }

      if (toolRef.current === "fibonacci") {
        if (!param.time) return;
        const time = Number(param.time);
        const cur = fibPlacingRef.current;
        if (!cur.a) {
          setFibPlacing({ a: { time, price }, b: { time, price } });
        } else {
          addFibDrawingRef.current({
            symbol: symbolRef.current,
            timeframe: timeframeRef.current,
            aTime: cur.a.time,
            aPrice: cur.a.price,
            bTime: time,
            bPrice: price,
            fibType: fibModePreferenceRef.current,
          });
          setFibPlacing(INITIAL_TWOPOINT);
        }
        return;
      }

      if (toolRef.current === "measure") {
        // Use coordinateToTime so the tool works beyond the last candle (future area)
        const xInChart = param.point?.x ?? 0;
        const timeFromCoord = chartRef.current?.timeScale().coordinateToTime(xInChart);
        const time = Number(timeFromCoord ?? param.time);
        if (!time || !isFinite(time)) return;
        const current = measureRef.current;
        if (current.phase === "idle") {
          setMeasure({ phase: "placing", a: { time, price }, b: { time, price } });
        } else if (current.phase === "placing") {
          setMeasure({ phase: "done", a: current.a, b: { time, price } });
        } else {
          setMeasure({ phase: "placing", a: { time, price }, b: { time, price } });
        }
      }
    });

    // Crosshair handler — actualiza previews de dibujos en curso
    chart.subscribeCrosshairMove((param) => {
      // ── Measure preview: works in future area too (param.time is null there) ──
      if (param.point && toolRef.current === "measure" && measureRef.current.phase === "placing" && candleSeriesRef.current) {
        const priceM = candleSeriesRef.current.coordinateToPrice(param.point.y);
        const timeM = chartRef.current?.timeScale().coordinateToTime(param.point.x);
        const tM = Number(timeM ?? param.time);
        if (priceM !== null && isFinite(priceM) && tM && isFinite(tM)) {
          setMeasure((prev) =>
            prev.phase === "placing" ? { ...prev, b: { time: tM, price: priceM } } : prev,
          );
        }
      }

      if (param.point && param.time && candleSeriesRef.current) {
        const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
        const time = Number(param.time);

        if (toolRef.current === "trendline" && trendLinePlacingRef.current.a) {
          if (price !== null && isFinite(price)) {
            setTrendLinePlacing((prev) => prev.a ? { ...prev, b: { time, price } } : prev);
          }
        }

        // Preview RSI trendline — usar Y relativo al chart container, no al pane
        if (toolRef.current === "trendline" && rsiTrendLinePlacingRef.current.a && rsiRef.current) {
          const containerRect2 = containerRef.current?.getBoundingClientRect();
          const chartY2 = param.sourceEvent && containerRect2
            ? param.sourceEvent.clientY - containerRect2.top
            : param.point.y;
          const rsiPrice = rsiRef.current.coordinateToPrice(chartY2);
          if (rsiPrice !== null && isFinite(rsiPrice)) {
            setRsiTrendLinePlacing((prev) => prev.a ? { ...prev, b: { time, price: rsiPrice } } : prev);
          }
        }

        if (toolRef.current === "fibonacci" && fibPlacingRef.current.a) {
          if (price !== null && isFinite(price)) {
            setFibPlacing((prev) => prev.a ? { ...prev, b: { time, price } } : prev);
          }
        }
      }

      if (!param.time || !candleSeriesRef.current) {
        setHover(null);
        return;
      }
      const data = param.seriesData.get(candleSeriesRef.current);
      const vol = volumeSeriesRef.current
        ? param.seriesData.get(volumeSeriesRef.current)
        : null;
      if (data && "open" in data) {
        const o = data.open as number;
        const c = data.close as number;
        setHover({
          o,
          h: data.high as number,
          l: data.low as number,
          c,
          v: vol && "value" in vol ? (vol.value as number) : 0,
          time: Number(param.time),
          pct: o === 0 ? 0 : ((c - o) / o) * 100,
        });
      }
    });

    // Re-render overlays on pan / zoom so pixel coords stay in sync
    const tsRangeHandler = () => setRenderTick((t) => t + 1);
    chart.timeScale().subscribeVisibleTimeRangeChange(tsRangeHandler);
    const logicalRangeHandler = () => setRenderTick((t) => t + 1);
    chart.timeScale().subscribeVisibleLogicalRangeChange(logicalRangeHandler);

    // RIGHT-CLICK — cancela la herramienta de dibujo en curso
    const handleContextMenu = (e: MouseEvent) => {
      const isTool = ["hline", "trendline", "fibonacci", "measure"].includes(
        toolRef.current,
      );
      if (isTool) {
        e.preventDefault();
        setTrendLinePlacing(INITIAL_TWOPOINT);
        setRsiTrendLinePlacing(INITIAL_TWOPOINT);
        setFibPlacing(INITIAL_TWOPOINT);
        setMeasure(INITIAL_MEASURE);
        setActiveDrawing(null);
        setRsiValuePopup(null);
      }
    };
    containerRef.current.addEventListener("contextmenu", handleContextMenu);

    // RUEDA SOBRE EL EJE DE PRECIOS — escala el precio (zoom vertical), como TradingView.
    // Solo actúa cuando el cursor está sobre el eje derecho. Doble click en el eje
    // restaura el autoescalado (axisDoubleClickReset, activo por defecto).
    const handleWheel = (e: WheelEvent) => {
      const container = containerRef.current;
      const chartApi = chartRef.current;
      const series = candleSeriesRef.current;
      if (!container || !chartApi || !series) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const axisW = chartApi.priceScale("right").width();
      if (x < rect.width - axisW) return; // no está sobre el eje de precios
      e.preventDefault();

      const ps = series.priceScale();
      const range = ps.getVisibleRange();
      if (!range) return;
      const center = (range.from + range.to) / 2;
      const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1; // abajo = alejar, arriba = acercar
      const half = ((range.to - range.from) / 2) * factor;
      if (half <= 0) return;
      ps.setAutoScale(false);
      ps.setVisibleRange({ from: center - half, to: center + half });
      setRenderTick((t) => t + 1); // resync overlays a la nueva escala
    };
    containerRef.current.addEventListener("wheel", handleWheel, { passive: false });

    // ResizeObserver — recompute pane offsets when chart container resizes
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => recomputePaneOffsets());
    });
    ro.observe(containerRef.current);
    recomputePaneOffsets();

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(tsRangeHandler);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(logicalRangeHandler);
      containerRef.current?.removeEventListener("contextmenu", handleContextMenu);
      containerRef.current?.removeEventListener("wheel", handleWheel);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLinesMapRef.current.clear();
      indicatorLevelLinesRef.current.clear();
      ema20Ref.current = null;
      ema50Ref.current = null;
      ema200Ref.current = null;
      rsiRef.current = null;
      macdRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
    };
  }, []);

  // Manage volume — overlay at the bottom of the main pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.volume && !volumeSeriesRef.current) {
      const v = chartRef.current.addSeries(
        HistogramSeries,
        {
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
          color: TV_COLORS.textMuted,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        0,
      );
      v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volumeSeriesRef.current = v;
      const data = candlesRef.current.map((k) => ({
        time: k.time as UTCTimestamp,
        value: k.volume,
        color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
      }));
      v.setData(data);
    } else if (!indicators.volume && volumeSeriesRef.current && chartRef.current) {
      chartRef.current.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
  }, [indicators.volume]);

  // RSI pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.rsi && !rsiRef.current) {
      const paneIndex = 1;
      const r = chartRef.current.addSeries(
        LineSeries,
        {
          color: INDICATOR_COLORS.rsi,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      rsiRef.current = r;
      // Sync inmediato de niveles RSI que ya estaban en el store antes de crear la serie
      for (const level of indicatorLevelsRef.current) {
        if (level.indicatorKey === "rsi" && !indicatorLevelLinesRef.current.has(level.id)) {
          try {
            const pl = r.createPriceLine({
              price: level.price,
              color: level.color,
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: level.label,
            });
            indicatorLevelLinesRef.current.set(level.id, { priceLine: pl, key: "rsi" });
          } catch {}
        }
      }
      try {
        chartRef.current.panes()[1]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateRSI();
      // Forzar re-render del overlay SVG para que las líneas RSI del store aparezcan
      setRenderTick((t) => t + 1);
    } else if (!indicators.rsi && rsiRef.current && chartRef.current) {
      // Limpiar price lines de niveles RSI antes de remover la serie
      for (const [id, entry] of indicatorLevelLinesRef.current.entries()) {
        if (entry.key === "rsi") {
          try { rsiRef.current.removePriceLine(entry.priceLine); } catch {}
          indicatorLevelLinesRef.current.delete(id);
        }
      }
      chartRef.current.removeSeries(rsiRef.current);
      rsiRef.current = null;
      setRenderTick((t) => t + 1);
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.rsi]);

  // MACD pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.macd && !macdRef.current) {
      const paneIndex = indicators.rsi ? 2 : 1;
      const m = chartRef.current.addSeries(
        LineSeries,
        {
          color: INDICATOR_COLORS.macd,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const s = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.yellow,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const h = chartRef.current.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: false },
        paneIndex,
      );
      macdRef.current = m;
      macdSignalRef.current = s;
      macdHistRef.current = h;
      try {
        chartRef.current.panes()[paneIndex]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateMACD();
    } else if (!indicators.macd && macdRef.current && chartRef.current) {
      if (macdRef.current) chartRef.current.removeSeries(macdRef.current);
      if (macdSignalRef.current) chartRef.current.removeSeries(macdSignalRef.current);
      if (macdHistRef.current) chartRef.current.removeSeries(macdHistRef.current);
      macdRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.macd, indicators.rsi]);

  // Visibility — eye toggle (hidden state) + enabled state combined
  useEffect(() => {
    const v = (key: IndicatorKey) => indicators[key] && !hidden[key];
    ema20Ref.current?.applyOptions({ visible: v("ema20") });
    ema50Ref.current?.applyOptions({ visible: v("ema50") });
    ema200Ref.current?.applyOptions({ visible: v("ema200") });
    if (rsiRef.current) rsiRef.current.applyOptions({ visible: v("rsi") });
    if (macdRef.current) macdRef.current.applyOptions({ visible: v("macd") });
    if (macdSignalRef.current) macdSignalRef.current.applyOptions({ visible: v("macd") });
    if (macdHistRef.current) macdHistRef.current.applyOptions({ visible: v("macd") });
    if (volumeSeriesRef.current) volumeSeriesRef.current.applyOptions({ visible: v("volume") });
  }, [indicators, hidden]);

  // Recompute indicators when config changes (periods)
  useEffect(() => {
    updateEMAs();
  }, [config.ema20, config.ema50, config.ema200]);

  useEffect(() => {
    updateRSI();
  }, [config.rsi]);

  useEffect(() => {
    updateMACD();
  }, [config.macdFast, config.macdSlow, config.macdSignal]);

  // Sync price lines from store to the candle series
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const map = priceLinesMapRef.current;
    const linesForThisSymbol = priceLines.filter((p) => p.symbol === symbol);
    const activeIds = new Set(linesForThisSymbol.map((p) => p.id));

    for (const [id, apiLine] of map.entries()) {
      if (!activeIds.has(id)) {
        try {
          series.removePriceLine(apiLine);
        } catch {}
        map.delete(id);
      }
    }
    for (const pl of linesForThisSymbol) {
      if (!map.has(pl.id)) {
        const apiLine = series.createPriceLine({
          price: pl.price,
          color: TV_COLORS.blue,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "",
        });
        map.set(pl.id, apiLine);
      } else {
        // Actualizar precio si cambió (drag)
        const apiLine = map.get(pl.id)!;
        if (apiLine.options().price !== pl.price) {
          apiLine.applyOptions({ price: pl.price });
        }
      }
    }
  }, [priceLines, symbol]);

  // Aplicar colores personalizados a las series del chart
  useEffect(() => {
    const c = (key: IndicatorKey) => indicatorColors[key] ?? INDICATOR_COLORS[key];
    ema20Ref.current?.applyOptions({ color: c("ema20") });
    ema50Ref.current?.applyOptions({ color: c("ema50") });
    ema200Ref.current?.applyOptions({ color: c("ema200") });
    if (rsiRef.current) rsiRef.current.applyOptions({ color: c("rsi") });
    if (macdRef.current) macdRef.current.applyOptions({ color: c("macd") });
    // Volumen: re-aplicar colores por barra
    if (volumeSeriesRef.current && candlesRef.current.length > 0) {
      const volColor = c("volume");
      volumeSeriesRef.current.setData(
        candlesRef.current.map((k) => ({
          time: k.time as UTCTimestamp,
          value: k.volume,
          color: k.close >= k.open ? `${volColor}66` : `${volColor}44`,
        })),
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicatorColors]);

  // ── Global drag handlers ──────────────────────────────────────────────────
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const ds = dragStateRef.current;
      if (!ds || !chartRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const ts = chartRef.current.timeScale();

      const deltaX = e.clientX - ds.startClientX;
      const deltaY = e.clientY - ds.startClientY;
      if (!ds.didMove && Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) return;
      if (!ds.didMove) setDragState((prev) => prev ? { ...prev, didMove: true } : null);

      const priceSeries =
        ds.pane === "rsi" ? rsiRef.current :
        ds.pane === "macd" ? macdRef.current :
        candleSeriesRef.current;
      if (!priceSeries) return;

      const startChartX = ds.startClientX - rect.left;
      const currChartX  = e.clientX - rect.left;
      const startChartY = ds.startClientY - rect.top;
      const currChartY  = e.clientY - rect.top;

      const t0 = ts.coordinateToTime(startChartX);
      const t1 = ts.coordinateToTime(currChartX);
      const p0 = priceSeries.coordinateToPrice(startChartY);
      const p1 = priceSeries.coordinateToPrice(currChartY);
      if (!t0 || !t1 || p0 === null || p1 === null) return;

      const dt = Number(t1) - Number(t0);
      const dp = p1 - p0;

      if (ds.kind === "body") {
        updateTrendLine(ds.id, {
          aTime: Math.round(ds.origATime + dt),
          aPrice: ds.origAPrice + dp,
          bTime: Math.round(ds.origBTime + dt),
          bPrice: ds.origBPrice + dp,
        });
      } else if (ds.kind === "handle-a") {
        updateTrendLine(ds.id, {
          aTime: Math.round(ds.origATime + dt),
          aPrice: ds.origAPrice + dp,
        });
      } else if (ds.kind === "handle-b") {
        updateTrendLine(ds.id, {
          bTime: Math.round(ds.origBTime + dt),
          bPrice: ds.origBPrice + dp,
        });
      } else if (ds.kind === "hline") {
        updatePriceLine(ds.id, ds.origAPrice + dp);
      }
      setRenderTick((t) => t + 1);
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync indicator level price lines (RSI/MACD) desde el store
  useEffect(() => {
    const map = indicatorLevelLinesRef.current;
    const rsiSeries = rsiRef.current;
    const macdSeries = macdRef.current;
    const activeIds = new Set(indicatorLevels.map((l) => l.id));

    // Remover price lines ya no presentes en el store
    for (const [id, entry] of map.entries()) {
      if (!activeIds.has(id)) {
        const series = entry.key === "rsi" ? rsiSeries : macdSeries;
        try { series?.removePriceLine(entry.priceLine); } catch {}
        map.delete(id);
      }
    }

    // Agregar nuevos price lines
    for (const level of indicatorLevels) {
      if (map.has(level.id)) continue;
      const series = level.indicatorKey === "rsi" ? rsiSeries : macdSeries;
      if (!series) continue;
      const pl = series.createPriceLine({
        price: level.price,
        color: level.color,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: level.label,
      });
      map.set(level.id, { priceLine: pl, key: level.indicatorKey });
    }
  }, [indicatorLevels, indicators.rsi, indicators.macd]);

  // Cursor style + reset estados de dibujo al cambiar de herramienta
  useEffect(() => {
    if (containerRef.current) {
      const crosshairTools = ["hline", "measure", "trendline", "fibonacci"];
      containerRef.current.style.cursor =
        crosshairTools.includes(tool) ? "crosshair" : "";
    }
    // Cancela el dibujo en curso al cambiar de herramienta (pero la medición PERSISTE)
    if (tool !== "trendline") { setTrendLinePlacing(INITIAL_TWOPOINT); setRsiTrendLinePlacing(INITIAL_TWOPOINT); }
    if (tool !== "fibonacci") setFibPlacing(INITIAL_TWOPOINT);
  }, [tool]);

  function updateEMAs() {
    const c = candlesRef.current;
    if (c.length === 0) return;
    const cfg = configRef.current;
    let last20: number | undefined;
    let last50: number | undefined;
    let last200: number | undefined;

    if (ema20Ref.current) {
      const data = ema(c, cfg.ema20);
      ema20Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last20 = data.at(-1)?.value;
    }
    if (ema50Ref.current) {
      const data = ema(c, cfg.ema50);
      ema50Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last50 = data.at(-1)?.value;
    }
    if (ema200Ref.current) {
      const data = ema(c, cfg.ema200);
      ema200Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last200 = data.at(-1)?.value;
    }
    const lastVol = c.at(-1)?.volume;
    setLastValues((prev) => ({
      ...prev,
      ema20: last20,
      ema50: last50,
      ema200: last200,
      volume: lastVol,
    }));
  }

  function updateRSI() {
    const c = candlesRef.current;
    if (c.length === 0 || !rsiRef.current) return;
    const cfg = configRef.current;
    const data = rsi(c, cfg.rsi).map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.value,
    }));
    rsiRef.current.setData(data);
    setLastValues((prev) => ({ ...prev, rsi: data.at(-1)?.value }));
  }

  function updateMACD() {
    const c = candlesRef.current;
    if (c.length === 0 || !macdRef.current) return;
    const cfg = configRef.current;
    const m = macd(c, cfg.macdFast, cfg.macdSlow, cfg.macdSignal);
    macdRef.current.setData(
      m.map((p) => ({ time: p.time as UTCTimestamp, value: p.macd })),
    );
    macdSignalRef.current?.setData(
      m.map((p) => ({ time: p.time as UTCTimestamp, value: p.signal })),
    );
    macdHistRef.current?.setData(
      m.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.histogram,
        color: p.histogram >= 0 ? `${TV_COLORS.green}80` : `${TV_COLORS.red}80`,
      })),
    );
    const last = m.at(-1);
    setLastValues((prev) => ({
      ...prev,
      macd: last?.macd,
      macdSignal: last?.signal,
      macdHist: last?.histogram,
    }));
  }

  // Load historical data + subscribe live
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    function applyKlines(klines: Candle[]) {
      candlesRef.current = klines;
      if (candleSeriesRef.current) {
        candleSeriesRef.current.setData(
          klines.map((k) => ({
            time: k.time as UTCTimestamp,
            open: k.open,
            high: k.high,
            low: k.low,
            close: k.close,
          })),
        );
      }
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(
          klines.map((k) => ({
            time: k.time as UTCTimestamp,
            value: k.volume,
            color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
          })),
        );
      }
      updateEMAs();
      updateRSI();
      updateMACD();
      chartRef.current?.timeScale().fitContent();
      requestAnimationFrame(() => recomputePaneOffsets());
      if (klines.length > 0) {
        const last = klines[klines.length - 1];
        const prev = klines[klines.length - 2] ?? last;
        // Store reference price for stocks (used by polling to compute timeframe-aware %)
        stockRefPriceRef.current = prev.close;
        setLastPrice({
          value: last.close,
          pct: prev.close === 0 ? 0 : ((last.close - prev.close) / prev.close) * 100,
        });
      }
      // Update pattern detection whenever new candle data loads
      if (klines.length >= 20) {
        setSrLevels(detectSupportResistance(klines));
        setFlagPatterns(detectFlags(klines));
        setAutoTrendLines(detectAutoTrendLines(klines));
        setPriceChannels(detectChannels(klines));
        setAutoFib(detectAutoFib(klines));
      }
    }

    async function load() {
      try {
        if (symbolType === "stock") {
          // ── Acciones: Yahoo Finance, sin WebSocket ────────────────────────
          const klines = await fetchStockKlines(symbol, timeframe);
          if (cancelled) return;
          applyKlines(klines);

          // Polling del precio actual cada 30s — % calculado según el timeframe activo
          pollTimer = setInterval(async () => {
            if (cancelled) return;
            try {
              const q = await fetchStockQuote(symbol, timeframe);
              if (cancelled) return;
              const ref = stockRefPriceRef.current;
              const pct = ref && ref > 0
                ? ((q.lastPrice - ref) / ref) * 100
                : q.priceChangePercent;
              setLastPrice({ value: q.lastPrice, pct });
            } catch {}
          }, 30_000);
        } else {
          // ── Cripto: Binance REST + WebSocket ─────────────────────────────
          const klines = await fetchKlines(symbol, timeframe, 1000);
          if (cancelled) return;
          applyKlines(klines);

          const ws = getBinanceWS();
          unsub = ws.subscribeKline({
            symbol,
            interval: timeframe,
            onCandle: (k) => {
              if (!candleSeriesRef.current) return;
              const arr = candlesRef.current;
              const lastCandle = arr[arr.length - 1];
              if (lastCandle && lastCandle.time === k.time) {
                arr[arr.length - 1] = k;
              } else if (!lastCandle || k.time > lastCandle.time) {
                arr.push(k);
                if (arr.length > 2000) arr.shift();
              } else {
                return;
              }
              candleSeriesRef.current.update({
                time: k.time as UTCTimestamp,
                open: k.open,
                high: k.high,
                low: k.low,
                close: k.close,
              });
              if (volumeSeriesRef.current) {
                volumeSeriesRef.current.update({
                  time: k.time as UTCTimestamp,
                  value: k.volume,
                  color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
                });
              }
              updateEMAs();
              updateRSI();
              updateMACD();
              const prev = arr[arr.length - 2] ?? lastCandle;
              setLastPrice({
                value: k.close,
                pct: prev && prev.close !== 0 ? ((k.close - prev.close) / prev.close) * 100 : 0,
              });
            },
          });
        }
      } catch (e) {
        console.error("Failed to load chart data:", e);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (unsub) unsub();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [symbol, timeframe, symbolType]);

  const greenOrRed = (n: number) =>
    n >= 0 ? "text-tv-green" : "text-tv-red";

  // Helpers for pill rendering
  const isShown = (key: IndicatorKey) =>
    indicators[key] && (key === "volume" || true); // always renderable if enabled
  void isShown;

  // Determine which pane each indicator lives in (based on current layout)
  const rsiPaneIdx = 1;
  const macdPaneIdx = indicators.rsi ? 2 : 1;

  // ── Computed trend lines (stored + placing, todos los panes) ────────────
  const computedTrendLines: ComputedTrendLine[] = [];
  if (chartRef.current && candleSeriesRef.current) {
    const ts = chartRef.current.timeScale();
    const W = containerRef.current?.offsetWidth ?? 2000;

    const processTrendLine = (
      id: string,
      aTime: number, aPrice: number,
      bTime: number, bPrice: number,
      isPlacing: boolean,
      color = "#2962ff",
      width = 1,
      dash: "solid" | "dashed" | "dotted" = "solid",
      pane: "main" | "rsi" | "macd" = "main",
      lineMode: "segment" | "ray" | "extended" = "segment",
    ) => {
      // Elegir la serie correcta para conversión de precio → píxel
      const priceSeries =
        pane === "rsi" && rsiRef.current ? rsiRef.current :
        pane === "macd" && macdRef.current ? macdRef.current :
        candleSeriesRef.current!;

      const aX = ts.timeToCoordinate(aTime as UTCTimestamp);
      const aY = priceSeries.priceToCoordinate(aPrice);
      const bX = ts.timeToCoordinate(bTime as UTCTimestamp);
      const bY = priceSeries.priceToCoordinate(bPrice);
      if (aX === null || aY === null || bX === null || bY === null) return;

      // Límites del pane
      const paneOffset =
        pane === "rsi" ? paneOffsets[rsiPaneIdx] :
        pane === "macd" ? paneOffsets[macdPaneIdx] :
        paneOffsets[0];
      const paneTop = paneOffset?.top ?? 0;
      const paneBot = paneTop + (paneOffset?.height ?? (containerRef.current?.offsetHeight ?? 2000));

      const ax = Number(aX), ay = Number(aY), bx = Number(bX), by = Number(bY);
      const slope = Math.abs(bx - ax) > 0.5 ? (by - ay) / (bx - ax) : 0;

      // Calcular x1/y1 y x2/y2 según el modo
      let x1 = ax, y1 = ay, x2 = bx, y2 = by;

      if (lineMode === "ray") {
        // Desde A hasta el borde derecho
        x2 = W;
        y2 = ay + slope * (W - ax);
      } else if (lineMode === "extended") {
        // Desde el borde izquierdo hasta el borde derecho
        x1 = 0;
        y1 = ay + slope * (0 - ax);
        x2 = W;
        y2 = ay + slope * (W - ax);
      }
      // "segment" → se queda con ax/ay → bx/by

      // Clip Y dentro del pane
      y1 = Math.max(paneTop, Math.min(paneBot, y1));
      y2 = Math.max(paneTop, Math.min(paneBot, y2));

      const dashArray = dash === "dashed" ? "6 4" : dash === "dotted" ? "2 4" : "";
      computedTrendLines.push({ id, isPlacing, x1, y1, x2, y2, aX: ax, aY: ay, bX: bx, bY: by, color, width, dashArray });
    };

    // Líneas guardadas en el pane principal
    trendLines
      .filter((l) => l.symbol === symbol && (!l.pane || l.pane === "main"))
      .forEach((l) =>
        processTrendLine(l.id, l.aTime, l.aPrice, l.bTime, l.bPrice, false, l.color, l.width, l.dash, "main", l.lineMode ?? "segment"),
      );

    // Líneas guardadas en el pane RSI
    if (rsiRef.current) {
      trendLines
        .filter((l) => l.symbol === symbol && l.pane === "rsi")
        .forEach((l) =>
          processTrendLine(l.id, l.aTime, l.aPrice, l.bTime, l.bPrice, false, l.color, l.width, l.dash, "rsi", l.lineMode ?? "segment"),
        );
    }

    // Líneas guardadas en el pane MACD
    if (macdRef.current) {
      trendLines
        .filter((l) => l.symbol === symbol && l.pane === "macd")
        .forEach((l) =>
          processTrendLine(l.id, l.aTime, l.aPrice, l.bTime, l.bPrice, false, l.color, l.width, l.dash, "macd", l.lineMode ?? "segment"),
        );
    }

    // Preview — pane principal (usa el modo de línea seleccionado)
    if (trendLinePlacing.a && trendLinePlacing.b) {
      processTrendLine("__tl_placing__",
        trendLinePlacing.a.time, trendLinePlacing.a.price,
        trendLinePlacing.b.time, trendLinePlacing.b.price,
        true, "#2962ff", 1, "solid", "main", trendLineModePreference);
    }

    // Preview — pane RSI (usa el modo de línea seleccionado)
    if (rsiTrendLinePlacing.a && rsiTrendLinePlacing.b && rsiRef.current) {
      processTrendLine("__tl_rsi_placing__",
        rsiTrendLinePlacing.a.time, rsiTrendLinePlacing.a.price,
        rsiTrendLinePlacing.b.time, rsiTrendLinePlacing.b.price,
        true, "#ab47bc", 1, "solid", "rsi", trendLineModePreference);
    }
  }

  // ── Computed fibonacci drawings (stored + placing) ───────────────────────
  const computedFibs: ComputedFibDrawing[] = [];
  if (chartRef.current && candleSeriesRef.current) {
    const ts = chartRef.current.timeScale();

    const processFib = (
      id: string,
      aTime: number, aPrice: number,
      bTime: number, bPrice: number,
      isPlacing: boolean,
      fibType: "retracement" | "extension" = "retracement",
    ) => {
      const bX = ts.timeToCoordinate(bTime as UTCTimestamp);
      const bY = candleSeriesRef.current!.priceToCoordinate(bPrice);
      if (bX === null || bY === null) return;

      const levels = fibType === "extension" ? FIB_EXTENSION_LEVELS : FIB_RETRACEMENT_LEVELS;
      const lines = levels.map((lv) => {
        const price = aPrice + lv.ratio * (bPrice - aPrice);
        const y = candleSeriesRef.current!.priceToCoordinate(price);
        return y !== null
          ? { y: Number(y), price, ratio: lv.ratio, label: lv.label, color: lv.color }
          : null;
      }).filter(Boolean) as ComputedFibDrawing["lines"];

      if (lines.length > 0) {
        computedFibs.push({ id, isPlacing, fibType, lines, anchorX: Number(bX), anchorY: Number(bY) });
      }
    };

    fibDrawings
      .filter((f) => f.symbol === symbol)
      .forEach((f) =>
        processFib(f.id, f.aTime, f.aPrice, f.bTime, f.bPrice, false, f.fibType ?? "retracement"),
      );

    if (fibPlacing.a && fibPlacing.b) {
      processFib("__fib_placing__", fibPlacing.a.time, fibPlacing.a.price,
        fibPlacing.b.time, fibPlacing.b.price, true, fibModePreference);
    }
  }

  // ── Computed pattern overlays — each gated by its own toggle ─────────────
  const computedSRLevels: ComputedSRLevel[] = [];
  const computedFlags: ComputedFlag[] = [];
  const computedAutoTL: ComputedAutoTrendLine[] = [];
  const computedChannels: ComputedChannel[] = [];
  let computedFib: ComputedAutoFib | null = null;

  const anyPattern =
    patternToggles.sr || patternToggles.trendlines || patternToggles.channels ||
    patternToggles.flags || patternToggles.fib;

  if (anyPattern && chartRef.current && candleSeriesRef.current && candlesRef.current.length >= 20) {
    const ts = chartRef.current.timeScale();
    const W = containerRef.current?.offsetWidth ?? 2000;
    const paneTop = paneOffsets[0]?.top ?? 0;
    const paneBot = paneTop + (paneOffsets[0]?.height ?? 600);

    if (patternToggles.sr) {
      for (const level of srLevels) {
        const y = candleSeriesRef.current.priceToCoordinate(level.price);
        if (y !== null) {
          const yNum = Number(y);
          if (yNum >= paneTop - 4 && yNum <= paneBot + 4) {
            computedSRLevels.push({ ...level, y: yNum });
          }
        }
      }
    }

    if (patternToggles.flags) {
      for (const flag of flagPatterns) {
        const x1 = ts.timeToCoordinate(flag.poleStartTime as UTCTimestamp);
        const x2 = ts.timeToCoordinate(flag.flagEndTime as UTCTimestamp);
        const midY = candleSeriesRef.current.priceToCoordinate(flag.labelPrice);
        if (x1 !== null && x2 !== null && midY !== null) {
          const midYNum = Number(midY);
          if (midYNum >= paneTop - 20 && midYNum <= paneBot + 20) {
            computedFlags.push({
              type: flag.type,
              x1: Number(x1), x2: Number(x2),
              midY: midYNum,
              chartWidth: W,
            });
          }
        }
      }
    }

    if (patternToggles.trendlines) {
      for (const tl of autoTrendLines) {
        const x1 = ts.timeToCoordinate(tl.startTime as UTCTimestamp);
        const x2 = ts.timeToCoordinate(tl.endTime as UTCTimestamp);
        const y1 = candleSeriesRef.current.priceToCoordinate(tl.startPrice);
        const y2 = candleSeriesRef.current.priceToCoordinate(tl.endPrice);
        if (x1 !== null && x2 !== null && y1 !== null && y2 !== null) {
          computedAutoTL.push({
            type: tl.type,
            x1: Number(x1), y1: Number(y1),
            x2: Number(x2), y2: Number(y2),
            touchCount: tl.touchCount,
          });
        }
      }
    }

    if (patternToggles.channels) {
      for (const ch of priceChannels) {
        const x1 = ts.timeToCoordinate(ch.startTime as UTCTimestamp);
        const x2 = ts.timeToCoordinate(ch.endTime as UTCTimestamp);
        const hY1 = candleSeriesRef.current.priceToCoordinate(ch.highStart);
        const hY2 = candleSeriesRef.current.priceToCoordinate(ch.highEnd);
        const lY1 = candleSeriesRef.current.priceToCoordinate(ch.lowStart);
        const lY2 = candleSeriesRef.current.priceToCoordinate(ch.lowEnd);
        if (x1 !== null && x2 !== null && hY1 !== null && hY2 !== null && lY1 !== null && lY2 !== null) {
          computedChannels.push({
            type: ch.type,
            x1: Number(x1), x2: Number(x2),
            highY1: Number(hY1), highY2: Number(hY2),
            lowY1: Number(lY1), lowY2: Number(lY2),
          });
        }
      }
    }

    if (patternToggles.fib && autoFib) {
      // f(t) = aPrice + (bPrice-aPrice)*t  →  t=1 at B (0% retr.), t=0 at A (100%).
      const diff = autoFib.bPrice - autoFib.aPrice;
      const aX = ts.timeToCoordinate(autoFib.aTime as UTCTimestamp);
      // Retracement levels (0%..100%) reusing the shared palette.
      const retr = FIB_RETRACEMENT_LEVELS.map((l) => ({
        label: l.label, color: l.color, t: 1 - l.ratio,
      }));
      // Extension targets beyond the swing end (continuation).
      const ext = [
        { label: "127.2%", color: "#ffb74d", t: 1.272 },
        { label: "161.8%", color: "#ef5350", t: 1.618 },
        { label: "261.8%", color: "#ab47bc", t: 2.618 },
      ];
      const levels: ComputedAutoFib["levels"] = [];
      for (const lv of [...retr, ...ext]) {
        const price = autoFib.aPrice + diff * lv.t;
        const y = candleSeriesRef.current.priceToCoordinate(price);
        if (y !== null) {
          const yNum = Number(y);
          if (yNum >= paneTop - 60 && yNum <= paneBot + 60) {
            levels.push({ label: lv.label, color: lv.color, price, y: yNum });
          }
        }
      }
      if (levels.length >= 2) {
        computedFib = {
          x1: aX !== null ? Number(aX) : 0,
          direction: autoFib.direction,
          levels,
        };
      }
    }
  }

  let measureRender: React.ReactNode = null;
  if (
    measure.a &&
    measure.b &&
    chartRef.current &&
    candleSeriesRef.current
  ) {
    const ts = chartRef.current.timeScale();
    const aX = ts.timeToCoordinate(measure.a.time as UTCTimestamp);
    const bX = ts.timeToCoordinate(measure.b.time as UTCTimestamp);
    const aY = candleSeriesRef.current.priceToCoordinate(measure.a.price);
    const bY = candleSeriesRef.current.priceToCoordinate(measure.b.price);

    if (aX !== null && bX !== null && aY !== null && bY !== null) {
      const priceDiff = measure.b.price - measure.a.price;
      const pctChange =
        measure.a.price === 0 ? 0 : (priceDiff / measure.a.price) * 100;
      const isUp = priceDiff >= 0;
      const start = Math.min(measure.a.time, measure.b.time);
      const end = Math.max(measure.a.time, measure.b.time);
      const inRange = candlesRef.current.filter(
        (c) => c.time >= start && c.time <= end,
      );
      const bars = inRange.length;
      const volume = inRange.reduce((s, c) => s + c.volume, 0);
      const dur = durationLabel(measure.a.time, measure.b.time);

      measureRender = (
        <MeasureOverlay
          aX={Number(aX)}
          aY={Number(aY)}
          bX={Number(bX)}
          bY={Number(bY)}
          priceDiff={priceDiff}
          pctChange={pctChange}
          bars={bars}
          volume={volume}
          durationText={dur}
          isUp={isUp}
          isPreview={measure.phase === "placing"}
          onClose={() => setMeasure(INITIAL_MEASURE)}
        />
      );
    }
  }
  void renderTick; // consumed above in coordinate computation

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <TrendLineOverlay
        lines={computedTrendLines}
        activeId={activeDrawing?.type === "trendline" ? activeDrawing.id : null}
        onActivate={(id, x, y) => {
          // Si se acaba de terminar un drag, no abrir la toolbar
          if (dragStateRef.current?.didMove) return;
          setActiveDrawing({ type: "trendline", id, x, y });
        }}
        onRemove={(id) => { removeTrendLine(id); setActiveDrawing(null); }}
        onDragStart={(id, clientX, clientY) => {
          const tl = trendLines.find((l) => l.id === id);
          if (!tl) return;
          setDragState({
            id, kind: "body",
            pane: (tl.pane ?? "main") as "main" | "rsi" | "macd",
            startClientX: clientX, startClientY: clientY,
            origATime: tl.aTime, origAPrice: tl.aPrice,
            origBTime: tl.bTime, origBPrice: tl.bPrice,
            didMove: false,
          });
        }}
        onHandleDragStart={(id, handle, clientX, clientY) => {
          const tl = trendLines.find((l) => l.id === id);
          if (!tl) return;
          setDragState({
            id, kind: handle === "a" ? "handle-a" : "handle-b",
            pane: (tl.pane ?? "main") as "main" | "rsi" | "macd",
            startClientX: clientX, startClientY: clientY,
            origATime: tl.aTime, origAPrice: tl.aPrice,
            origBTime: tl.bTime, origBPrice: tl.bPrice,
            didMove: false,
          });
        }}
      />
      <FibOverlay
        drawings={computedFibs}
        activeId={activeDrawing?.type === "fib" ? activeDrawing.id : null}
        onActivate={(id, x, y) => setActiveDrawing({ type: "fib", id, x, y })}
        onRemove={(id) => { removeFibDrawing(id); setActiveDrawing(null); }}
      />

      {/* Overlay de patrones técnicos (S/R, trendlines, canales, banderas) */}
      <PatternOverlay
        srLevels={computedSRLevels}
        flags={computedFlags}
        trendLines={computedAutoTL}
        channels={computedChannels}
        fib={computedFib}
      />

      {/* Hit targets SVG para hlines (líneas horizontales) */}
      {candleSeriesRef.current && (
        <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" style={{ overflow: "visible" }}>
          {priceLines
            .filter((pl) => pl.symbol === symbol)
            .map((pl) => {
              const y = candleSeriesRef.current!.priceToCoordinate(pl.price);
              if (y === null) return null;
              const isActive = activeDrawing?.type === "hline" && activeDrawing.id === pl.id;
              return (
                <g key={pl.id}>
                  {/* Hit target draggable */}
                  <line
                    x1={0} x2="100%" y1={y} y2={y}
                    stroke="transparent"
                    strokeWidth={14}
                    style={{ pointerEvents: "all", cursor: "ns-resize" }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragState({
                        id: pl.id, kind: "hline", pane: "main",
                        startClientX: e.clientX, startClientY: e.clientY,
                        origATime: 0, origAPrice: pl.price,
                        origBTime: 0, origBPrice: pl.price,
                        didMove: false,
                      });
                    }}
                    onClick={(e) => {
                      if (dragStateRef.current?.didMove) return;
                      e.stopPropagation();
                      setActiveDrawing({ type: "hline", id: pl.id, x: e.nativeEvent.offsetX, y });
                    }}
                  />
                  {isActive && (
                    <line x1={0} x2="100%" y1={y} y2={y} stroke="#2962ff" strokeWidth={1.5} strokeOpacity={0.6} />
                  )}
                </g>
              );
            })}
        </svg>
      )}

      {/* DrawingToolbar — aparece al seleccionar un dibujo */}
      {activeDrawing && (
        <DrawingToolbar
          type={activeDrawing.type}
          x={activeDrawing.x}
          y={activeDrawing.y}
          trendLineStyle={
            activeDrawing.type === "trendline"
              ? (() => {
                  const tl = trendLines.find((l) => l.id === activeDrawing.id);
                  return tl ? { color: tl.color, width: tl.width, dash: tl.dash, lineMode: tl.lineMode ?? "segment" } : undefined;
                })()
              : undefined
          }
          onDelete={() => {
            if (activeDrawing.type === "trendline") removeTrendLine(activeDrawing.id);
            else if (activeDrawing.type === "fib") removeFibDrawing(activeDrawing.id);
            else if (activeDrawing.type === "hline") removePriceLine(activeDrawing.id);
            setActiveDrawing(null);
          }}
          onStyleChange={
            activeDrawing.type === "trendline"
              ? (patch) => {
                  updateTrendLine(activeDrawing.id, patch);
                  // Sincronizar preferencia de modo cuando el usuario la cambia en la toolbar
                  if (patch.lineMode) setTrendLineModePreference(patch.lineMode);
                }
              : undefined
          }
        />
      )}

      {measureRender}

      {/* Popup de valor exacto para RSI trendlines */}
      {rsiValuePopup && (
        <form
          className="absolute z-30 flex items-center gap-1.5 rounded border border-tv-border bg-tv-panel px-2 py-1.5 shadow-xl"
          style={{
            left: rsiValuePopup.chartX,
            top: rsiValuePopup.chartY,
            transform: "translate(-50%, -110%)",
          }}
          onSubmit={(e) => {
            e.preventDefault();
            const val = parseFloat(rsiValuePopup.inputValue);
            if (isNaN(val)) { setRsiValuePopup(null); return; }

            const exactPrice = val;
            const t = rsiValuePopup.pendingTime;
            const mode = trendLineModeRef.current;

            if (mode === "extended" && !rsiTrendLinePlacingRef.current.a) {
              // Un solo click → línea extendida horizontal RSI
              addTrendLine({
                symbol, timeframe,
                aTime: t, aPrice: exactPrice,
                bTime: t, bPrice: exactPrice,
                color: "#ab47bc", width: 1, dash: "solid",
                lineMode: "extended", pane: "rsi",
              });
            } else if (rsiTrendLinePlacingRef.current.a && !rsiTrendLinePlacingRef.current.a.price) {
              // Segundo punto aún no confirmado — no debería llegar acá
              setRsiValuePopup(null);
            } else {
              // Primer punto confirmado con valor exacto
              setRsiTrendLinePlacing({ a: { time: t, price: exactPrice }, b: { time: t, price: exactPrice } });
            }
            setRsiValuePopup(null);
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] font-medium text-tv-text-muted">RSI</span>
          <input
            autoFocus
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={rsiValuePopup.inputValue}
            onChange={(e) =>
              setRsiValuePopup((prev) => prev ? { ...prev, inputValue: e.target.value } : null)
            }
            className="w-16 rounded border border-tv-border bg-tv-bg px-1 py-0.5 text-xs text-tv-text focus:border-tv-blue focus:outline-none"
          />
          <button
            type="submit"
            className="rounded bg-tv-blue px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-tv-blue/80"
          >↵</button>
          <button
            type="button"
            onClick={() => { setRsiValuePopup(null); setRsiTrendLinePlacing(INITIAL_TWOPOINT); }}
            className="text-[11px] text-tv-text-muted hover:text-tv-text"
          >✕</button>
        </form>
      )}

      {/* Top-left of main pane: symbol info + OHLC + Volume pill + EMA pills */}
      <div
        style={{ top: (paneOffsets[0]?.top ?? 0) + 12, left: 12 }}
        className="pointer-events-none absolute z-10 flex flex-col gap-1 text-xs tabular-nums"
      >
        {/* Row 1: symbol info + OHLC stats inline on hover (fixed height, never wraps) */}
        <div className="flex h-5 flex-nowrap items-center gap-x-3 overflow-hidden whitespace-nowrap">
          <div className="flex shrink-0 items-center gap-2 text-[13px] font-semibold">
            <span className="text-tv-text">{symbol}</span>
            <span className="text-tv-text-muted">·</span>
            <span className="uppercase text-tv-text-muted">{timeframe}</span>
            <span className="text-tv-text-muted">·</span>
            <span className="text-tv-text-muted">
              {symbolType === "stock" ? "Yahoo Finance" : "Binance"}
            </span>
          </div>
          {hover && (
            <div className="flex items-center gap-x-3 text-[11px]">
              <span className="text-tv-text-muted">
                O <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.o)}</span>
              </span>
              <span className="text-tv-text-muted">
                H <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.h)}</span>
              </span>
              <span className="text-tv-text-muted">
                L <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.l)}</span>
              </span>
              <span className="text-tv-text-muted">
                C <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.c)}</span>
              </span>
              <span className={greenOrRed(hover.pct)}>
                {hover.pct >= 0 ? "+" : ""}
                {hover.pct.toFixed(2)}%
              </span>
              <span className="text-tv-text-muted">
                Vol <span className="text-tv-text">{formatVolume(hover.v)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Row 2: big live price (always present — reserves space even while loading) */}
        <div className="flex h-7 items-center gap-2">
          {lastPrice ? (
            <>
              <span className={`text-lg font-semibold tabular-nums ${greenOrRed(lastPrice.pct)}`}>
                {formatPrice(lastPrice.value)}
              </span>
              <span className={`text-xs ${greenOrRed(lastPrice.pct)}`}>
                {lastPrice.pct >= 0 ? "+" : ""}
                {lastPrice.pct.toFixed(2)}%
              </span>
            </>
          ) : (
            <span className="text-xs text-tv-text-muted">Cargando…</span>
          )}
        </div>

        {/* Indicator pills for the main pane (fixed position below price) */}
        <div className="mt-1 flex flex-col items-start gap-1">
          {indicators.ema20 && (
            <IndicatorPill
              name={`EMA ${config.ema20}`}
              value={lastValues.ema20 !== undefined ? formatPrice(lastValues.ema20) : undefined}
              color={INDICATOR_COLORS.ema20}
              hidden={hidden.ema20}
              onToggleHide={() => toggleHidden("ema20")}
              onSettings={() => setSettingsTarget("ema20")}
              onRemove={() => removeIndicator("ema20")}
            />
          )}
          {indicators.ema50 && (
            <IndicatorPill
              name={`EMA ${config.ema50}`}
              value={lastValues.ema50 !== undefined ? formatPrice(lastValues.ema50) : undefined}
              color={INDICATOR_COLORS.ema50}
              hidden={hidden.ema50}
              onToggleHide={() => toggleHidden("ema50")}
              onSettings={() => setSettingsTarget("ema50")}
              onRemove={() => removeIndicator("ema50")}
            />
          )}
          {indicators.ema200 && (
            <IndicatorPill
              name={`EMA ${config.ema200}`}
              value={lastValues.ema200 !== undefined ? formatPrice(lastValues.ema200) : undefined}
              color={INDICATOR_COLORS.ema200}
              hidden={hidden.ema200}
              onToggleHide={() => toggleHidden("ema200")}
              onSettings={() => setSettingsTarget("ema200")}
              onRemove={() => removeIndicator("ema200")}
            />
          )}
          {indicators.volume && (
            <IndicatorPill
              name="Vol"
              value={lastValues.volume !== undefined ? formatVolume(lastValues.volume) : undefined}
              color={INDICATOR_COLORS.volume}
              hidden={hidden.volume}
              onToggleHide={() => toggleHidden("volume")}
              onSettings={() => setSettingsTarget("volume")}
              onRemove={() => removeIndicator("volume")}
            />
          )}
        </div>
      </div>

      {/* RSI pane label */}
      {indicators.rsi && paneOffsets[rsiPaneIdx] && (
        <div
          style={{ top: paneOffsets[rsiPaneIdx].top + 6, left: 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            name={`RSI ${config.rsi}`}
            value={lastValues.rsi !== undefined ? lastValues.rsi.toFixed(2) : undefined}
            color={INDICATOR_COLORS.rsi}
            hidden={hidden.rsi}
            onToggleHide={() => toggleHidden("rsi")}
            onSettings={() => setSettingsTarget("rsi")}
            onRemove={() => removeIndicator("rsi")}
          />
        </div>
      )}

      {/* MACD pane label */}
      {indicators.macd && paneOffsets[macdPaneIdx] && (
        <div
          style={{ top: paneOffsets[macdPaneIdx].top + 6, left: 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            name={`MACD ${config.macdFast}, ${config.macdSlow}, ${config.macdSignal}`}
            value={
              lastValues.macd !== undefined
                ? `${lastValues.macd.toFixed(2)} / ${(lastValues.macdSignal ?? 0).toFixed(2)}`
                : undefined
            }
            color={INDICATOR_COLORS.macd}
            hidden={hidden.macd}
            onToggleHide={() => toggleHidden("macd")}
            onSettings={() => setSettingsTarget("macd")}
            onRemove={() => removeIndicator("macd")}
          />
        </div>
      )}
    </div>
  );
}
