"use client";

import { Activity, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChartStore, type IndicatorKey, type PatternKey } from "@/lib/store/chart-store";

const PATTERN_ITEMS: { key: PatternKey; label: string; sub: string }[] = [
  { key: "sr",         label: "Soportes / Resistencias", sub: "Niveles horizontales validados" },
  { key: "trendlines", label: "Líneas de tendencia",     sub: "Diagonales por máximos / mínimos" },
  { key: "channels",   label: "Canales",                 sub: "Canal paralelo de tendencia" },
  { key: "flags",      label: "Banderas",                sub: "Bull flag / Bear flag" },
  { key: "fib",        label: "Fibonacci automático",    sub: "Retrocesos y extensiones del swing" },
];

interface Entry {
  key: IndicatorKey;
  label: (cfg: {
    ema20: number; ema50: number; ema200: number;
    rsi: number; macdFast: number; macdSlow: number; macdSignal: number;
  }) => string;
  group: string;
}

const ENTRIES: Entry[] = [
  { key: "ema20",   group: "Medias móviles", label: (c) => `EMA ${c.ema20}` },
  { key: "ema50",   group: "Medias móviles", label: (c) => `EMA ${c.ema50}` },
  { key: "ema200",  group: "Medias móviles", label: (c) => `EMA ${c.ema200}` },
  { key: "volume",  group: "Volumen",        label: () => "Volumen" },
  { key: "rsi",     group: "Osciladores",    label: (c) => `RSI (${c.rsi})` },
  { key: "macd",    group: "Osciladores",    label: (c) => `MACD (${c.macdFast}, ${c.macdSlow}, ${c.macdSignal})` },
];

export function IndicatorMenu() {
  const indicators = useChartStore((s) => s.indicators);
  const config = useChartStore((s) => s.config);
  const toggle = useChartStore((s) => s.toggleIndicator);
  const patternToggles = useChartStore((s) => s.patternToggles);
  const togglePattern = useChartStore((s) => s.togglePattern);

  const groups = ENTRIES.reduce<Record<string, Entry[]>>((acc, i) => {
    (acc[i.group] ||= []).push(i);
    return acc;
  }, {});

  const activeCount =
    Object.values(indicators).filter(Boolean).length +
    Object.values(patternToggles).filter(Boolean).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-tv-text hover:bg-tv-panel-hover">
        <Activity className="h-3.5 w-3.5" />
        <span>Indicadores</span>
        {activeCount > 0 && (
          <span className="ml-1 rounded bg-tv-blue/20 px-1.5 py-0.5 text-[10px] font-semibold text-tv-blue">
            {activeCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 bg-tv-panel">
        {Object.entries(groups).map(([group, items], idx) => (
          <DropdownMenuGroup key={group}>
            {idx > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-tv-text-muted">
              {group}
            </DropdownMenuLabel>
            {items.map((i) => (
              <DropdownMenuItem
                key={i.key}
                closeOnClick={false}
                onClick={() => toggle(i.key)}
                className="flex items-center justify-between text-xs"
              >
                <span>{i.label(config)}</span>
                {indicators[i.key] && <Check className="h-3.5 w-3.5 text-tv-blue" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-tv-text-muted">
            Detección automática
          </DropdownMenuLabel>
          {PATTERN_ITEMS.map((p) => (
            <DropdownMenuItem
              key={p.key}
              closeOnClick={false}
              onClick={() => togglePattern(p.key)}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex flex-col">
                <span>{p.label}</span>
                <span className="text-[10px] text-tv-text-muted">{p.sub}</span>
              </div>
              {patternToggles[p.key] && <Check className="h-3.5 w-3.5 text-tv-blue" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
