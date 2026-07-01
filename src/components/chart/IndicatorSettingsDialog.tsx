"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useChartStore,
  DEFAULT_CONFIG,
  INDICATOR_COLORS,
  type IndicatorKey,
  type IndicatorLevel,
} from "@/lib/store/chart-store";

const TITLES: Record<IndicatorKey, string> = {
  ema20:   "EMA — Slot 1",
  ema50:   "EMA — Slot 2",
  ema200:  "EMA — Slot 3",
  rsi:     "RSI",
  macd:    "MACD",
  volume:  "Volumen",
};

export function IndicatorSettingsDialog() {
  const target = useChartStore((s) => s.settingsTarget);
  const setTarget = useChartStore((s) => s.setSettingsTarget);
  const config = useChartStore((s) => s.config);
  const setConfig = useChartStore((s) => s.setConfig);
  const indicatorColors = useChartStore((s) => s.indicatorColors);
  const setIndicatorColor = useChartStore((s) => s.setIndicatorColor);
  const resetIndicatorColor = useChartStore((s) => s.resetIndicatorColor);

  const open = target !== null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setTarget(null); }}>
      <DialogContent className="max-w-sm bg-tv-panel">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {target ? TITLES[target] : ""} — Configuración
          </DialogTitle>
        </DialogHeader>
        {target && (
          <SettingsForm
            target={target}
            config={config}
            indicatorColors={indicatorColors}
            onSave={(patch, color) => {
              setConfig(patch);
              if (color !== undefined) setIndicatorColor(target, color);
              setTarget(null);
            }}
            onReset={() => {
              setConfig(DEFAULT_CONFIG);
              resetIndicatorColor(target);
              setTarget(null);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FormProps {
  target: IndicatorKey;
  config: typeof DEFAULT_CONFIG;
  indicatorColors: Partial<Record<IndicatorKey, string>>;
  onSave: (patch: Partial<typeof DEFAULT_CONFIG>, color?: string) => void;
  onReset: () => void;
}

function SettingsForm({ target, config, indicatorColors, onSave, onReset }: FormProps) {
  const [draft, setDraft] = useState({
    ema20:      config.ema20,
    ema50:      config.ema50,
    ema200:     config.ema200,
    rsi:        config.rsi,
    macdFast:   config.macdFast,
    macdSlow:   config.macdSlow,
    macdSignal: config.macdSignal,
  });
  const [draftColor, setDraftColor] = useState(
    indicatorColors[target] ?? INDICATOR_COLORS[target],
  );

  useEffect(() => {
    setDraft({
      ema20:      config.ema20,
      ema50:      config.ema50,
      ema200:     config.ema200,
      rsi:        config.rsi,
      macdFast:   config.macdFast,
      macdSlow:   config.macdSlow,
      macdSignal: config.macdSignal,
    });
    setDraftColor(indicatorColors[target] ?? INDICATOR_COLORS[target]);
  }, [config, target, indicatorColors]);

  function save() {
    let patch: Partial<typeof DEFAULT_CONFIG> = {};
    if (target === "ema20")  patch = { ema20: clamp(draft.ema20, 2, 500) };
    else if (target === "ema50")  patch = { ema50: clamp(draft.ema50, 2, 500) };
    else if (target === "ema200") patch = { ema200: clamp(draft.ema200, 2, 500) };
    else if (target === "rsi")    patch = { rsi: clamp(draft.rsi, 2, 100) };
    else if (target === "macd")   patch = {
      macdFast:   clamp(draft.macdFast, 2, 100),
      macdSlow:   clamp(draft.macdSlow, 2, 200),
      macdSignal: clamp(draft.macdSignal, 2, 100),
    };
    onSave(patch, draftColor);
  }

  const showLevels = target === "rsi" || target === "macd";

  return (
    <div className="flex flex-col gap-4">
      {/* ── Parámetros numéricos ── */}
      {(target === "ema20" || target === "ema50" || target === "ema200") && (
        <Field
          label="Período"
          value={draft[target]}
          onChange={(n) => setDraft((d) => ({ ...d, [target]: n }))}
        />
      )}
      {target === "rsi" && (
        <Field label="Período" value={draft.rsi} onChange={(n) => setDraft((d) => ({ ...d, rsi: n }))} />
      )}
      {target === "macd" && (
        <div className="grid grid-cols-3 gap-2">
          <Field label="Rápida" value={draft.macdFast}   onChange={(n) => setDraft((d) => ({ ...d, macdFast: n }))} />
          <Field label="Lenta"  value={draft.macdSlow}   onChange={(n) => setDraft((d) => ({ ...d, macdSlow: n }))} />
          <Field label="Señal"  value={draft.macdSignal} onChange={(n) => setDraft((d) => ({ ...d, macdSignal: n }))} />
        </div>
      )}
      {target === "volume" && (
        <p className="text-xs text-tv-text-muted">
          El volumen no tiene parámetros numéricos configurables.
        </p>
      )}

      {/* ── Color ── */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
          Color
        </span>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={draftColor}
            onChange={(e) => setDraftColor(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border border-tv-border bg-transparent p-0.5"
            style={{ colorScheme: "dark" }}
          />
          <span className="font-mono text-xs text-tv-text-muted">{draftColor.toUpperCase()}</span>
          <button
            onClick={() => setDraftColor(INDICATOR_COLORS[target])}
            className="ml-auto rounded px-2 py-0.5 text-[10px] text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
          >
            Default
          </button>
        </div>
      </div>

      {/* ── Niveles horizontales (RSI / MACD) ── */}
      {showLevels && (
        <LevelManager indicatorKey={target as "rsi" | "macd"} />
      )}

      {/* ── Acciones ── */}
      <div className="mt-1 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-tv-text-muted hover:text-tv-text"
        >
          Reset todo
        </Button>
        <Button size="sm" onClick={save} className="bg-tv-blue hover:bg-tv-blue/90">
          Aplicar
        </Button>
      </div>
    </div>
  );
}

function LevelManager({ indicatorKey }: { indicatorKey: "rsi" | "macd" }) {
  const indicatorLevels = useChartStore((s) => s.indicatorLevels);
  const addIndicatorLevel = useChartStore((s) => s.addIndicatorLevel);
  const removeIndicatorLevel = useChartStore((s) => s.removeIndicatorLevel);

  const levels = indicatorLevels.filter((l) => l.indicatorKey === indicatorKey);

  const [newPrice, setNewPrice] = useState("");
  const [newColor, setNewColor] = useState("#787b86");
  const [newLabel, setNewLabel] = useState("");

  function handleAdd() {
    const price = parseFloat(newPrice);
    if (isNaN(price)) return;
    const label = newLabel.trim() || String(price);
    addIndicatorLevel({ indicatorKey, price, color: newColor, label });
    setNewPrice("");
    setNewLabel("");
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        Niveles
      </span>

      {/* Lista de niveles actuales */}
      {levels.length === 0 ? (
        <p className="text-xs text-tv-text-muted">Sin niveles.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {levels.map((l: IndicatorLevel) => (
            <div key={l.id} className="flex items-center gap-2 rounded bg-tv-bg px-2 py-1">
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{ background: l.color }}
              />
              <span className="flex-1 text-xs tabular-nums text-tv-text">{l.label}</span>
              <span className="text-xs tabular-nums text-tv-text-muted">{l.price}</span>
              <button
                onClick={() => removeIndicatorLevel(l.id)}
                className="text-tv-text-muted transition-colors hover:text-tv-red"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formulario para agregar nuevo nivel */}
      <div className="mt-1 flex items-center gap-1.5">
        <Input
          type="number"
          placeholder="Precio"
          value={newPrice}
          onChange={(e) => setNewPrice(e.target.value)}
          className="h-7 w-20 bg-tv-bg text-xs tabular-nums"
        />
        <Input
          type="text"
          placeholder="Etiqueta"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="h-7 flex-1 bg-tv-bg text-xs"
        />
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded border border-tv-border bg-transparent p-0.5"
          style={{ colorScheme: "dark" }}
          title="Color del nivel"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleAdd}
          disabled={!newPrice}
          className="h-7 px-2 text-tv-text-muted hover:text-tv-text"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        {label}
      </span>
      <Input
        type="number"
        min={2}
        max={500}
        value={value}
        onChange={(e) => { const n = parseInt(e.target.value, 10); if (!isNaN(n)) onChange(n); }}
        className="bg-tv-bg tabular-nums"
      />
    </label>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
