import type { Candle } from "@/lib/binance/types";

export interface SRLevel {
  price: number;
  count: number;
  type: "support" | "resistance";
}

export interface FlagPattern {
  type: "bull-flag" | "bear-flag";
  poleStartTime: number;
  flagEndTime: number;
  labelPrice: number;
}

export interface AutoTrendLine {
  type: "support-trendline" | "resistance-trendline";
  startTime: number;
  endTime: number;
  startPrice: number;
  endPrice: number;
  touchCount: number;
}

export interface PriceChannel {
  type: "ascending-channel" | "descending-channel" | "horizontal-channel";
  startTime: number;
  endTime: number;
  highStart: number;
  highEnd: number;
  lowStart: number;
  lowEnd: number;
}

export interface AutoFib {
  direction: "up" | "down";
  aTime: number; aPrice: number;   // swing start (100% retracement)
  bTime: number; bPrice: number;   // swing end (0% retracement)
}

// ── Helpers ────────────────────────────────────────────────────────────────

interface Pivot { idx: number; time: number; price: number; }

function linearRegression(points: Array<{ x: number; y: number }>): {
  slope: number; intercept: number; r2: number;
} {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const p of points) {
    sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumX2 += p.x * p.x;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}

/**
 * Pivot highs/lows requiring `strength` higher/lower bars on each side.
 * Larger strength → fewer, more significant swing points.
 */
function getPivots(data: Candle[], strength = 3): { highs: Pivot[]; lows: Pivot[] } {
  const highs: Pivot[] = [];
  const lows: Pivot[] = [];

  for (let i = strength; i < data.length - strength; i++) {
    let isHigh = true, isLow = true;
    for (let k = 1; k <= strength; k++) {
      if (data[i].high <= data[i - k].high || data[i].high <= data[i + k].high) isHigh = false;
      if (data[i].low >= data[i - k].low || data[i].low >= data[i + k].low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) highs.push({ idx: i, time: data[i].time, price: data[i].high });
    if (isLow) lows.push({ idx: i, time: data[i].time, price: data[i].low });
  }
  return { highs, lows };
}

// ── S/R Levels ─────────────────────────────────────────────────────────────

export function detectSupportResistance(candles: Candle[], lookback = 220): SRLevel[] {
  const data = candles.slice(-lookback);
  if (data.length < 20) return [];

  const currentPrice = data[data.length - 1]?.close ?? 0;
  if (currentPrice === 0) return [];

  const tol = 0.005;        // 0.5% clustering tolerance
  const minSeparation = 0.012; // 1.2% minimum gap between displayed levels

  const { highs, lows } = getPivots(data, 3);
  const prices = [...highs.map((p) => p.price), ...lows.map((p) => p.price)];
  if (prices.length === 0) return [];

  // Cluster nearby pivot prices (weighted average)
  const clusters: Array<{ sum: number; count: number }> = [];
  for (const price of prices) {
    let merged = false;
    for (const c of clusters) {
      if (Math.abs(c.sum / c.count - price) / (c.sum / c.count) < tol) {
        c.sum += price; c.count++; merged = true; break;
      }
    }
    if (!merged) clusters.push({ sum: price, count: 1 });
  }

  // Only validated levels: touched ≥ 2 times. Keep the strongest, well-separated.
  const candidates = clusters
    .filter((c) => c.count >= 2)
    .map((c) => ({ price: c.sum / c.count, count: c.count }))
    .sort((a, b) => b.count - a.count);

  const chosen: Array<{ price: number; count: number }> = [];
  for (const cand of candidates) {
    if (chosen.length >= 6) break;
    const tooClose = chosen.some(
      (ch) => Math.abs(ch.price - cand.price) / cand.price < minSeparation,
    );
    if (!tooClose) chosen.push(cand);
  }

  return chosen.map((c) => ({
    price: c.price,
    count: c.count,
    type: c.price < currentPrice ? "support" : "resistance",
  }));
}

// ── Auto Trendlines ────────────────────────────────────────────────────────

/** A validated trendline: ≥3 touches, very linear, and not crossed by price. */
export function detectAutoTrendLines(candles: Candle[], lookback = 200): AutoTrendLine[] {
  const data = candles.slice(-lookback);
  if (data.length < 40) return [];

  const { highs, lows } = getPivots(data, 3);
  const result: AutoTrendLine[] = [];
  const extendBars = 20;
  const lastIdx = data.length - 1;

  const build = (
    pivots: Pivot[],
    type: AutoTrendLine["type"],
  ): AutoTrendLine | null => {
    const recent = pivots.slice(-5);
    if (recent.length < 3) return null;

    const { slope, intercept, r2 } = linearRegression(recent.map((p) => ({ x: p.idx, y: p.price })));
    if (r2 < 0.9) return null; // must be almost perfectly linear

    // Must be recent: the last pivot near the right edge
    if (recent[recent.length - 1].idx < lastIdx - lookback * 0.25) return null;

    const i0 = recent[0].idx;
    const i1 = Math.min(recent[recent.length - 1].idx + extendBars, lastIdx);

    // Validate the line is a true boundary: between the first/last pivot,
    // price should not significantly cross to the wrong side.
    const range = Math.max(...data.map((d) => d.high)) - Math.min(...data.map((d) => d.low));
    const cross = 0.012 * range; // allowed wick overshoot
    let violations = 0, checked = 0;
    for (let i = i0; i <= recent[recent.length - 1].idx; i++) {
      const lineY = slope * i + intercept;
      checked++;
      if (type === "resistance-trendline" && data[i].close > lineY + cross) violations++;
      if (type === "support-trendline" && data[i].close < lineY - cross) violations++;
    }
    if (checked > 0 && violations / checked > 0.15) return null;

    return {
      type,
      startTime: data[i0].time,
      endTime: data[i1].time,
      startPrice: slope * i0 + intercept,
      endPrice: slope * i1 + intercept,
      touchCount: recent.length,
    };
  };

  const res = build(highs, "resistance-trendline");
  const sup = build(lows, "support-trendline");
  if (res) result.push(res);
  if (sup) result.push(sup);

  return result;
}

// ── Price Channels (parallel, TradingView-style) ────────────────────────────

/**
 * A parallel channel: two lines with an IDENTICAL slope (not two independent
 * regressions). We derive one shared slope from the swing pivots, reject
 * converging/diverging structures (triangles/wedges), and require the price to
 * touch BOTH rails at least twice. Returns at most one channel — the best fit.
 */
export function detectChannels(candles: Candle[], lookback = 160): PriceChannel[] {
  const data = candles.slice(-lookback);
  if (data.length < 40) return [];

  const currentPrice = data[data.length - 1].close;
  const lastIdx = data.length - 1;

  let best: { channel: PriceChannel; score: number } | null = null;

  // Try a few recent windows; keep the best validated channel.
  for (const win of [Math.min(120, data.length), 90, 60]) {
    if (win > data.length || win < 40) continue;
    const startData = data.length - win;
    const seg = data.slice(startData);
    const { highs, lows } = getPivots(seg, 3);
    if (highs.length < 2 || lows.length < 2) continue;

    const hReg = linearRegression(highs.map((p) => ({ x: p.idx, y: p.price })));
    const lReg = linearRegression(lows.map((p) => ({ x: p.idx, y: p.price })));

    // Reject triangles/wedges: rails must share direction and similar magnitude.
    const sH = hReg.slope, sL = lReg.slope;
    const flat = 0.00005 * currentPrice;
    const bothFlat = Math.abs(sH) < flat && Math.abs(sL) < flat;
    const sameSign = Math.sign(sH) === Math.sign(sL);
    const ratio = Math.abs(sH) > 1e-12 ? Math.abs(sL / sH) : 999;
    if (!bothFlat && (!sameSign || ratio < 0.45 || ratio > 2.2)) continue;

    // Shared slope → strictly parallel rails.
    const m = (sH + sL) / 2;

    // Centre line through the mean of all pivots.
    const allP = [...highs, ...lows];
    const meanIdx = allP.reduce((s, p) => s + p.idx, 0) / allP.length;
    const meanPrice = allP.reduce((s, p) => s + p.price, 0) / allP.length;
    const bMid = meanPrice - m * meanIdx;

    // Offset rails to the extreme swing points.
    let upperOff = -Infinity, lowerOff = Infinity;
    for (const p of highs) upperOff = Math.max(upperOff, p.price - (m * p.idx + bMid));
    for (const p of lows) lowerOff = Math.min(lowerOff, p.price - (m * p.idx + bMid));
    const width = upperOff - lowerOff;
    if (!isFinite(width) || width <= 0) continue;

    const widthPct = width / currentPrice;
    if (widthPct < 0.015 || widthPct > 0.45) continue; // too tight / too wide

    // Touches: pivots within 14% of the channel width from their rail.
    const tol = width * 0.14;
    let upTouch = 0, lowTouch = 0;
    for (const p of highs) if (Math.abs(p.price - (m * p.idx + bMid + upperOff)) <= tol) upTouch++;
    for (const p of lows)  if (Math.abs(p.price - (m * p.idx + bMid + lowerOff)) <= tol) lowTouch++;
    if (upTouch < 2 || lowTouch < 2) continue;

    // Containment: ≥85% of closes inside the rails.
    let inside = 0;
    for (let i = 0; i < seg.length; i++) {
      const up = m * i + bMid + upperOff;
      const lo = m * i + bMid + lowerOff;
      if (seg[i].close <= up + tol && seg[i].close >= lo - tol) inside++;
    }
    if (inside / seg.length < 0.85) continue;

    const score = upTouch + lowTouch + (inside / seg.length) * 3;

    // seg-local start = 0 → absolute = startData. End extends 15 bars to the right.
    const absStart = startData;
    const absEndIdx = Math.min(startData + (seg.length - 1) + 15, lastIdx);
    const endSegIdx = absEndIdx - startData; // seg-local index of the (clamped) end

    const type: PriceChannel["type"] =
      Math.abs(m) < flat ? "horizontal-channel" : m > 0 ? "ascending-channel" : "descending-channel";

    const channel: PriceChannel = {
      type,
      startTime: data[absStart].time,
      endTime: data[absEndIdx].time,
      highStart: m * 0 + bMid + upperOff,
      highEnd:   m * endSegIdx + bMid + upperOff,
      lowStart:  m * 0 + bMid + lowerOff,
      lowEnd:    m * endSegIdx + bMid + lowerOff,
    };

    if (!best || score > best.score) best = { channel, score };
  }

  return best ? [best.channel] : [];
}

// ── Auto Fibonacci (latest significant swing / trend change) ─────────────────

/**
 * Finds the most recent dominant swing leg (a trend change) and returns its
 * anchors so retracement/extension levels can be drawn. The leg is defined by
 * the latest opposing swing pivots: the move into the most recent extreme.
 */
export function detectAutoFib(candles: Candle[], lookback = 160): AutoFib | null {
  const data = candles.slice(-lookback);
  if (data.length < 30) return null;

  const { highs, lows } = getPivots(data, 4); // strong swings only
  if (highs.length === 0 || lows.length === 0) return null;

  // The most recent pivot of either kind marks the end of the current leg.
  const lastHigh = highs[highs.length - 1];
  const lastLow = lows[lows.length - 1];

  let a: Pivot, b: Pivot, direction: "up" | "down";

  if (lastHigh.idx > lastLow.idx) {
    // Most recent extreme is a high → up-leg from the prior low to that high.
    // Use the lowest low that occurs before this high (and after any earlier high).
    const priorLows = lows.filter((l) => l.idx < lastHigh.idx);
    if (priorLows.length === 0) return null;
    const swingLow = priorLows.reduce((m, l) => (l.price < m.price ? l : m), priorLows[priorLows.length - 1]);
    a = swingLow; b = lastHigh; direction = "up";
  } else {
    // Most recent extreme is a low → down-leg from the prior high to that low.
    const priorHighs = highs.filter((h) => h.idx < lastLow.idx);
    if (priorHighs.length === 0) return null;
    const swingHigh = priorHighs.reduce((m, h) => (h.price > m.price ? h : m), priorHighs[priorHighs.length - 1]);
    a = swingHigh; b = lastLow; direction = "down";
  }

  // Require the leg to be significant (≥ 4% move, ≥ 5 bars).
  const move = Math.abs(b.price - a.price) / a.price;
  if (move < 0.04 || Math.abs(b.idx - a.idx) < 5) return null;

  return {
    direction,
    aTime: a.time, aPrice: a.price,
    bTime: b.time, bPrice: b.price,
  };
}

// ── Bull/Bear Flags ─────────────────────────────────────────────────────────

/**
 * A flag = a sharp, efficient (near-monotonic) pole followed by a tight
 * counter-trend / sideways consolidation. Heavily validated; returns at most
 * the single most recent valid flag to avoid clutter.
 */
export function detectFlags(candles: Candle[], lookback = 120): FlagPattern[] {
  const data = candles.slice(-lookback);
  if (data.length < 25) return [];

  const POLE_LEN = 6;
  const MIN_FLAG = 5;
  const MAX_FLAG = 12;
  const MIN_POLE_MOVE = 0.05;   // ≥5% pole
  const MIN_EFFICIENCY = 0.6;   // net move ≥ 60% of summed bar moves (monotonic)

  let found: FlagPattern | null = null;

  for (let i = POLE_LEN; i <= data.length - MIN_FLAG; i++) {
    const pole = data.slice(i - POLE_LEN, i);
    const poleOpen = pole[0].open;
    const poleClose = pole[pole.length - 1].close;
    const net = poleClose - poleOpen;
    const poleChange = net / poleOpen;
    const poleHeight = Math.abs(net);
    if (poleHeight === 0) continue;

    // Efficiency: directional, not choppy.
    let summedAbs = 0;
    for (let k = 1; k < pole.length; k++) summedAbs += Math.abs(pole[k].close - pole[k - 1].close);
    const efficiency = summedAbs > 0 ? Math.abs(net) / summedAbs : 0;
    if (efficiency < MIN_EFFICIENCY) continue;

    const maxFlagLen = Math.min(MAX_FLAG, data.length - i);
    if (maxFlagLen < MIN_FLAG) continue;

    if (poleChange >= MIN_POLE_MOVE) {
      // Bull flag — consolidation drifts down/sideways, modest retrace, tight.
      for (let j = MIN_FLAG; j <= maxFlagLen; j++) {
        const flag = data.slice(i, i + j);
        const retrace = (flag[0].close - flag[flag.length - 1].close) / poleHeight; // >0 = pulling back
        const flagHigh = Math.max(...flag.map((c) => c.high));
        const flagLow = Math.min(...flag.map((c) => c.low));
        const range = flagHigh - flagLow;
        if (retrace >= -0.05 && retrace <= 0.6 && range < poleHeight * 0.5 && range > 0) {
          found = {
            type: "bull-flag",
            poleStartTime: data[i - POLE_LEN].time,
            flagEndTime: data[i + j - 1].time,
            labelPrice: flagHigh,
          };
          break;
        }
      }
    } else if (poleChange <= -MIN_POLE_MOVE) {
      // Bear flag — consolidation drifts up/sideways.
      for (let j = MIN_FLAG; j <= maxFlagLen; j++) {
        const flag = data.slice(i, i + j);
        const retrace = (flag[flag.length - 1].close - flag[0].close) / poleHeight; // >0 = bouncing up
        const flagHigh = Math.max(...flag.map((c) => c.high));
        const flagLow = Math.min(...flag.map((c) => c.low));
        const range = flagHigh - flagLow;
        if (retrace >= -0.05 && retrace <= 0.6 && range < poleHeight * 0.5 && range > 0) {
          found = {
            type: "bear-flag",
            poleStartTime: data[i - POLE_LEN].time,
            flagEndTime: data[i + j - 1].time,
            labelPrice: flagLow,
          };
          break;
        }
      }
    }
  }

  // Only the most recent valid flag.
  return found ? [found] : [];
}
