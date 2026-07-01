"use client";

import { MousePointer2, Minus, Ruler, Trash2, TrendingUp, GitCommitHorizontal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useChartStore, type DrawingTool, type LineMode, type FibMode } from "@/lib/store/chart-store";
import { cn } from "@/lib/utils";

interface ToolDef {
  key: DrawingTool;
  icon: typeof MousePointer2;
  label: string;
  hint?: string;
}

const TOOLS: ToolDef[] = [
  { key: "cursor",    icon: MousePointer2,      label: "Cursor",               hint: "Modo navegación · click derecho cancela dibujo" },
  { key: "hline",     icon: Minus,              label: "Línea horizontal",     hint: "Click para marcar un precio · click derecho cancela" },
  { key: "trendline", icon: TrendingUp,          label: "Línea de tendencia",   hint: "Click en dos puntos · click derecho cancela · soporta RSI" },
  { key: "fibonacci", icon: GitCommitHorizontal, label: "Fibonacci",            hint: "Retroceso o extensión según el modo seleccionado" },
  { key: "measure",   icon: Ruler,               label: "Regla / Medir",        hint: "Mide Δ precio, %, barras y volumen · persiste en el gráfico" },
];

const LINE_MODES: { value: LineMode; label: string; title: string }[] = [
  { value: "segment",  label: "╺╸", title: "Segmento" },
  { value: "ray",      label: "╺→", title: "Rayo (extiende a la derecha)" },
  { value: "extended", label: "←→", title: "Extendida (ambas direcciones)" },
];

const FIB_MODES: { value: FibMode; label: string; title: string }[] = [
  { value: "retracement", label: "Ret", title: "Retroceso (0%–100%)" },
  { value: "extension",   label: "Ext", title: "Extensión (100%–261.8%)" },
];

export function LeftSidebar() {
  const tool = useChartStore((s) => s.tool);
  const setTool = useChartStore((s) => s.setTool);
  const clearAllDrawings = useChartStore((s) => s.clearAllDrawings);
  const symbol = useChartStore((s) => s.symbol);
  const lineMode = useChartStore((s) => s.trendLineModePreference);
  const setLineMode = useChartStore((s) => s.setTrendLineModePreference);
  const fibMode = useChartStore((s) => s.fibModePreference);
  const setFibMode = useChartStore((s) => s.setFibModePreference);

  return (
    <aside className="flex w-11 flex-col items-center gap-0.5 border-r border-tv-border bg-tv-panel py-1.5">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const active = tool === t.key;
        return (
          <Tooltip key={t.key}>
            <TooltipTrigger
              onClick={() => setTool(t.key)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover",
                active
                  ? "bg-tv-blue/15 text-tv-blue"
                  : "text-tv-text-muted hover:text-tv-text",
              )}
            >
              <Icon className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              <div className="font-medium">{t.label}</div>
              {t.hint && (
                <div className="mt-0.5 text-[10px] text-tv-text-muted">{t.hint}</div>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}

      {/* Sub-barra de modo de línea de tendencia */}
      {tool === "trendline" && (
        <div className="mt-0.5 flex w-full flex-col items-center gap-0.5 border-t border-tv-border pt-0.5">
          {LINE_MODES.map((m) => (
            <Tooltip key={m.value}>
              <TooltipTrigger
                onClick={() => setLineMode(m.value)}
                className={cn(
                  "flex h-7 w-8 items-center justify-center rounded font-mono text-[11px] transition-colors hover:bg-tv-panel-hover",
                  lineMode === m.value
                    ? "bg-tv-blue/15 text-tv-blue"
                    : "text-tv-text-muted hover:text-tv-text",
                )}
              >
                {m.label}
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {m.title}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Sub-barra de modo Fibonacci */}
      {tool === "fibonacci" && (
        <div className="mt-0.5 flex w-full flex-col items-center gap-0.5 border-t border-tv-border pt-0.5">
          {FIB_MODES.map((m) => (
            <Tooltip key={m.value}>
              <TooltipTrigger
                onClick={() => setFibMode(m.value)}
                className={cn(
                  "flex h-7 w-8 items-center justify-center rounded text-[9px] font-medium transition-colors hover:bg-tv-panel-hover",
                  fibMode === m.value
                    ? "bg-tv-blue/15 text-tv-blue"
                    : "text-tv-text-muted hover:text-tv-text",
                )}
              >
                {m.label}
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {m.title}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      <div className="mt-auto">
        <Tooltip>
          <TooltipTrigger
            onClick={() => clearAllDrawings(symbol)}
            className="flex h-8 w-8 items-center justify-center rounded text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-red"
          >
            <Trash2 className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            <div className="font-medium">Borrar todos los dibujos</div>
            <div className="mt-0.5 text-[10px] text-tv-text-muted">
              Limpia líneas, tendencias y Fibonacci de este símbolo
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
