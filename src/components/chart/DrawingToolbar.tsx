"use client";

import { Trash2 } from "lucide-react";
import type { DashStyle, LineMode } from "@/lib/store/chart-store";

interface TrendLineStyle {
  color: string;
  width: number;
  dash: DashStyle;
  lineMode: LineMode;
}

interface Props {
  type: "hline" | "trendline" | "fib";
  x: number;
  y: number;
  trendLineStyle?: TrendLineStyle;
  onDelete: () => void;
  onStyleChange?: (patch: Partial<TrendLineStyle>) => void;
}

const WIDTHS = [1, 2, 3] as const;
const DASHES: { value: DashStyle; label: string }[] = [
  { value: "solid",  label: "—" },
  { value: "dashed", label: "╌" },
  { value: "dotted", label: "·····" },
];
const LINE_MODES: { value: LineMode; label: string; title: string }[] = [
  { value: "segment",  label: "╺╸",  title: "Segmento (entre los dos puntos)" },
  { value: "ray",      label: "╺→",  title: "Rayo (extiende hacia la derecha)" },
  { value: "extended", label: "←→",  title: "Extendida (extiende en ambas direcciones)" },
];

export function DrawingToolbar({ type, x, y, trendLineStyle, onDelete, onStyleChange }: Props) {
  return (
    <div
      className="absolute z-30 flex items-center gap-1 rounded border border-tv-border bg-tv-panel px-2 py-1 shadow-xl"
      style={{ left: x, top: y, transform: "translateY(-100%) translateX(-50%)" }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Opciones de estilo — sólo para líneas de tendencia */}
      {type === "trendline" && trendLineStyle && onStyleChange && (
        <>
          {/* Color */}
          <label className="flex items-center gap-1" title="Color">
            <input
              type="color"
              value={trendLineStyle.color}
              onChange={(e) => onStyleChange({ color: e.target.value })}
              className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
              style={{ colorScheme: "dark" }}
            />
          </label>

          <div className="mx-0.5 h-4 w-px bg-tv-border" />

          {/* Grosor */}
          {WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => onStyleChange({ width: w })}
              title={`${w}px`}
              className={`flex h-6 w-6 items-center justify-center rounded text-[10px] transition-colors
                ${trendLineStyle.width === w
                  ? "bg-tv-blue/20 text-tv-blue"
                  : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"}`}
            >
              <div className="w-4 rounded-full bg-current" style={{ height: w }} />
            </button>
          ))}

          <div className="mx-0.5 h-4 w-px bg-tv-border" />

          {/* Tipo de trazo */}
          {DASHES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onStyleChange({ dash: value })}
              title={value}
              className={`rounded px-1.5 py-0.5 text-xs transition-colors
                ${trendLineStyle.dash === value
                  ? "bg-tv-blue/20 text-tv-blue"
                  : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"}`}
            >
              {label}
            </button>
          ))}

          <div className="mx-0.5 h-4 w-px bg-tv-border" />

          {/* Modo de extensión */}
          {LINE_MODES.map(({ value, label, title }) => (
            <button
              key={value}
              onClick={() => onStyleChange({ lineMode: value })}
              title={title}
              className={`rounded px-1.5 py-0.5 text-[11px] font-mono transition-colors
                ${trendLineStyle.lineMode === value
                  ? "bg-tv-blue/20 text-tv-blue"
                  : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"}`}
            >
              {label}
            </button>
          ))}

          <div className="mx-0.5 h-4 w-px bg-tv-border" />
        </>
      )}

      {/* Eliminar */}
      <button
        onClick={onDelete}
        title="Eliminar (o click derecho sobre la línea)"
        className="flex h-6 w-6 items-center justify-center rounded text-tv-text-muted transition-colors hover:bg-tv-red/10 hover:text-tv-red"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
