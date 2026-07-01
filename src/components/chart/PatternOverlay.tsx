"use client";

import { formatPrice } from "@/lib/format";

export interface ComputedSRLevel {
  price: number;
  y: number;
  count: number;
  type: "support" | "resistance";
}

export interface ComputedFlag {
  type: "bull-flag" | "bear-flag";
  x1: number;
  x2: number;
  midY: number;
  chartWidth: number;
}

export interface ComputedAutoTrendLine {
  type: "support-trendline" | "resistance-trendline";
  x1: number; y1: number;
  x2: number; y2: number;
  touchCount: number;
}

export interface ComputedChannel {
  type: "ascending-channel" | "descending-channel" | "horizontal-channel";
  x1: number; x2: number;
  highY1: number; highY2: number;
  lowY1: number; lowY2: number;
}

export interface ComputedFibLevel {
  label: string;
  y: number;
  price: number;
  color: string;
}

export interface ComputedAutoFib {
  x1: number;
  direction: "up" | "down";
  levels: ComputedFibLevel[];
}

interface Props {
  srLevels: ComputedSRLevel[];
  flags: ComputedFlag[];
  trendLines?: ComputedAutoTrendLine[];
  channels?: ComputedChannel[];
  fib?: ComputedAutoFib | null;
}

const CHANNEL_LABELS: Record<ComputedChannel["type"], string> = {
  "ascending-channel": "▲ Canal alcista",
  "descending-channel": "▼ Canal bajista",
  "horizontal-channel": "— Canal lateral",
};

export function PatternOverlay({ srLevels, flags, trendLines = [], channels = [], fib = null }: Props) {
  if (
    srLevels.length === 0 && flags.length === 0 &&
    trendLines.length === 0 && channels.length === 0 &&
    !fib
  ) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      style={{ overflow: "visible" }}
    >
      {/* ── Auto Fibonacci (retracements + extensions) ── */}
      {fib && (() => {
        const x1 = Math.max(fib.x1, 0);
        const ys = fib.levels.map((l) => l.y);
        const top = Math.min(...ys), bot = Math.max(...ys);
        return (
          <g key="autofib">
            {/* Shaded band over the retracement zone */}
            <rect x={x1} y={top} width="100%" height={Math.max(bot - top, 1)}
              fill={fib.direction === "up" ? "#26a69a" : "#ef5350"} fillOpacity={0.04} />
            {fib.levels.map((lv, i) => (
              <g key={`fib-${i}`}>
                <line
                  x1={x1} x2="100%" y1={lv.y} y2={lv.y}
                  stroke={lv.color} strokeWidth={1} strokeOpacity={0.85}
                  strokeDasharray="6 3"
                />
                <text
                  x="99%" y={lv.y - 3} textAnchor="end"
                  fill={lv.color} fontSize={9} fontFamily="'Courier New', monospace"
                >
                  {lv.label} — {formatPrice(lv.price)}
                </text>
              </g>
            ))}
          </g>
        );
      })()}

      {/* ── Channels (behind everything else) ── */}
      {channels.map((ch, i) => {
        const isBull = ch.type === "ascending-channel";
        const isLat  = ch.type === "horizontal-channel";
        const color  = isBull ? "#26a69a" : isLat ? "#b0b8c8" : "#ef5350";
        const labelX = Math.max(ch.x1 + 8, 8);
        const labelY = (ch.highY1 + ch.lowY1) / 2;

        const pts = `${ch.x1},${ch.highY1} ${ch.x2},${ch.highY2} ${ch.x2},${ch.lowY2} ${ch.x1},${ch.lowY1}`;

        return (
          <g key={`ch-${i}`}>
            {/* Shaded interior */}
            <polygon points={pts} fill={color} fillOpacity={0.06} />
            {/* Upper boundary */}
            <line
              x1={ch.x1} y1={ch.highY1} x2={ch.x2} y2={ch.highY2}
              stroke={color} strokeWidth={1.5} strokeOpacity={0.7} strokeDasharray="7 4"
            />
            {/* Lower boundary */}
            <line
              x1={ch.x1} y1={ch.lowY1} x2={ch.x2} y2={ch.lowY2}
              stroke={color} strokeWidth={1.5} strokeOpacity={0.7} strokeDasharray="7 4"
            />
            {/* Label */}
            <rect x={labelX} y={labelY - 9} width={108} height={17} rx={3}
              fill={color} fillOpacity={0.12} stroke={color} strokeOpacity={0.4} strokeWidth={0.7} />
            <text x={labelX + 5} y={labelY + 4} fontSize={9} fontWeight="600"
              fill={color} fontFamily="system-ui, sans-serif">
              {CHANNEL_LABELS[ch.type]}
            </text>
          </g>
        );
      })}

      {/* ── Auto trendlines ── */}
      {trendLines.map((tl, i) => {
        const isRes = tl.type === "resistance-trendline";
        const color = isRes ? "#ef5350" : "#26a69a";
        const label = isRes ? "Resistencia" : "Soporte";
        const midX = (tl.x1 + tl.x2) / 2;
        const midY = (tl.y1 + tl.y2) / 2;

        return (
          <g key={`tl-${i}`}>
            {/* Subtle glow */}
            <line
              x1={tl.x1} y1={tl.y1} x2={tl.x2} y2={tl.y2}
              stroke={color} strokeWidth={5} strokeOpacity={0.1}
            />
            {/* Solid main line */}
            <line
              x1={tl.x1} y1={tl.y1} x2={tl.x2} y2={tl.y2}
              stroke={color} strokeWidth={1.5} strokeOpacity={0.9}
            />
            {/* Dot at each end */}
            <circle cx={tl.x1} cy={tl.y1} r={3} fill={color} fillOpacity={0.8} />
            <circle cx={tl.x2} cy={tl.y2} r={3} fill={color} fillOpacity={0.8} />
            {/* Label badge */}
            <rect x={midX - 36} y={midY - 9} width={72} height={17} rx={3}
              fill={color} fillOpacity={0.14} stroke={color} strokeOpacity={0.45} strokeWidth={0.8} />
            <text x={midX} y={midY + 4} textAnchor="middle"
              fontSize={9} fontWeight="600" fill={color} fontFamily="system-ui, sans-serif">
              {label} ({tl.touchCount})
            </text>
          </g>
        );
      })}

      {/* ── S/R horizontal levels ── */}
      {srLevels.map((level, i) => {
        const color = level.type === "support" ? "#26a69a" : "#ef5350";
        const strong = level.count >= 3;
        const opacity = Math.min(0.65 + level.count * 0.08, 1.0);

        return (
          <g key={`sr-${i}`}>
            {/* Glow layer */}
            <line
              x1={0} x2="100%" y1={level.y} y2={level.y}
              stroke={color} strokeWidth={strong ? 6 : 4} strokeOpacity={0.1}
            />
            {/* Solid line */}
            <line
              x1={0} x2="100%" y1={level.y} y2={level.y}
              stroke={color}
              strokeWidth={strong ? 1.5 : 1}
              strokeOpacity={opacity}
            />
            {/* S/R badge */}
            <rect x={4} y={level.y - 9} width={16} height={16} rx={2}
              fill={color} fillOpacity={0.22} stroke={color} strokeOpacity={0.65} strokeWidth={0.8} />
            <text x={12} y={level.y + 4} textAnchor="middle"
              fontSize={8.5} fontWeight="700" fill={color} fontFamily="monospace">
              {level.type === "support" ? "S" : "R"}
            </text>
            {/* Price + touch count */}
            <text x={24} y={level.y - 2} fontSize={9} fill={color} fillOpacity={opacity} fontFamily="monospace">
              {formatPrice(level.price)}
              {level.count > 1 && (
                <tspan fill={color} fillOpacity={0.65}> ×{level.count}</tspan>
              )}
            </text>
          </g>
        );
      })}

      {/* ── Bull/Bear Flags ── */}
      {flags.map((flag, i) => {
        const isBull = flag.type === "bull-flag";
        const color  = isBull ? "#26a69a" : "#ef5350";
        const x1 = Math.min(flag.x1, flag.x2);
        const x2 = Math.max(flag.x1, flag.x2);
        const labelX = Math.min(x2 + 6, flag.chartWidth - 80);

        return (
          <g key={`flag-${i}`}>
            <rect x={x1} y={flag.midY - 16} width={Math.max(x2 - x1, 2)} height={32}
              fill={color} fillOpacity={0.07} />
            <line x1={x1} x2={x1} y1={flag.midY - 16} y2={flag.midY + 16}
              stroke={color} strokeWidth={1} strokeOpacity={0.45} strokeDasharray="3 3" />
            <rect x={labelX} y={flag.midY - 9} width={76} height={17} rx={3}
              fill={color} fillOpacity={0.13} stroke={color} strokeOpacity={0.5} strokeWidth={0.7} />
            <text x={labelX + 5} y={flag.midY + 4} fontSize={9} fontWeight="600"
              fill={color} fontFamily="system-ui, sans-serif">
              {isBull ? "▲ Bull Flag" : "▼ Bear Flag"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
