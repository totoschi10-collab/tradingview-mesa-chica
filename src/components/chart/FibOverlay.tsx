"use client";

import { formatPrice } from "@/lib/format";

export const FIB_RETRACEMENT_LEVELS = [
  { ratio: 0,     label: "0%",    color: "#787b86" },
  { ratio: 0.236, label: "23.6%", color: "#ffb74d" },
  { ratio: 0.382, label: "38.2%", color: "#ef5350" },
  { ratio: 0.5,   label: "50%",   color: "#d1d4dc" },
  { ratio: 0.618, label: "61.8%", color: "#26a69a" },
  { ratio: 0.786, label: "78.6%", color: "#ab47bc" },
  { ratio: 1,     label: "100%",  color: "#787b86" },
];

export const FIB_EXTENSION_LEVELS = [
  { ratio: 0,     label: "0%",     color: "#787b86" },
  { ratio: 0.618, label: "61.8%",  color: "#26a69a" },
  { ratio: 1,     label: "100%",   color: "#787b86" },
  { ratio: 1.272, label: "127.2%", color: "#ffb74d" },
  { ratio: 1.618, label: "161.8%", color: "#ef5350" },
  { ratio: 2,     label: "200%",   color: "#2962ff" },
  { ratio: 2.618, label: "261.8%", color: "#ab47bc" },
];

// Alias compat para el código existente
export const FIB_LEVELS = FIB_RETRACEMENT_LEVELS;

export interface ComputedFibLine {
  y: number; price: number; ratio: number; label: string; color: string;
}

export interface ComputedFibDrawing {
  id: string;
  isPlacing: boolean;
  fibType: "retracement" | "extension";
  lines: ComputedFibLine[];
  anchorX: number;
  anchorY: number;
}

interface Props {
  drawings: ComputedFibDrawing[];
  activeId: string | null;
  onActivate: (id: string, x: number, y: number) => void;
  onRemove: (id: string) => void;
}

export function FibOverlay({ drawings, activeId, onActivate, onRemove }: Props) {
  if (drawings.length === 0) return null;
  void onRemove;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      style={{ overflow: "visible" }}
    >
      {drawings.map((d) => {
        const isActive = d.id === activeId;
        const anchorColor = d.fibType === "extension" ? "#ffb74d" : "#26a69a";

        return (
          <g key={d.id}>
            {/* Relleno semitransparente entre niveles */}
            {d.lines.slice(0, -1).map((line, i) => {
              const next = d.lines[i + 1];
              if (!next) return null;
              return (
                <rect
                  key={`fill-${i}`}
                  x={0} y={Math.min(line.y, next.y)}
                  width="100%" height={Math.abs(next.y - line.y)}
                  fill={line.color}
                  fillOpacity={isActive ? 0.07 : 0.04}
                />
              );
            })}

            {/* Líneas + etiquetas */}
            {d.lines.map((line) => (
              <g key={`lv-${line.ratio}`}>
                <line
                  x1={0} x2="100%" y1={line.y} y2={line.y}
                  stroke={line.color}
                  strokeWidth={isActive ? 1.5 : 1}
                  strokeOpacity={d.isPlacing ? 0.55 : 0.9}
                  strokeDasharray={d.isPlacing ? "5 4" : undefined}
                />
                <text
                  x="99%" y={line.y - 3}
                  textAnchor="end"
                  fill={line.color}
                  fontSize={9}
                  fontFamily="'Courier New', monospace"
                  opacity={d.isPlacing ? 0.7 : 1}
                >
                  {line.label} — {formatPrice(line.price)}
                </text>

                {/* Hit target por nivel */}
                {!d.isPlacing && (
                  <line
                    x1={0} x2="100%" y1={line.y} y2={line.y}
                    stroke="transparent"
                    strokeWidth={12}
                    style={{ pointerEvents: "all", cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onActivate(d.id, d.anchorX, line.y);
                    }}
                  />
                )}
              </g>
            ))}

            {/* Punto ancla */}
            {!d.isPlacing && (
              <circle
                cx={d.anchorX} cy={d.anchorY} r={isActive ? 5 : 3}
                fill={anchorColor}
                opacity={isActive ? 0.8 : 0.4}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
