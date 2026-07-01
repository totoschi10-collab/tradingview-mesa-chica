"use client";

import { useState } from "react";
import { BookMarked, Trash2, Download, Pencil, Check, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChartStore } from "@/lib/store/chart-store";

export function StrategyDialog() {
  const open = useChartStore((s) => s.strategyDialogOpen);
  const setOpen = useChartStore((s) => s.setStrategyDialogOpen);
  const symbol = useChartStore((s) => s.symbol);
  const strategies = useChartStore((s) => s.strategies);
  const trendLines = useChartStore((s) => s.trendLines);
  const priceLines = useChartStore((s) => s.priceLines);
  const fibDrawings = useChartStore((s) => s.fibDrawings);
  const saveStrategy = useChartStore((s) => s.saveStrategy);
  const loadStrategy = useChartStore((s) => s.loadStrategy);
  const deleteStrategy = useChartStore((s) => s.deleteStrategy);
  const renameStrategy = useChartStore((s) => s.renameStrategy);

  const [name, setName] = useState("");

  const currentTrendLines = trendLines.filter((l) => l.symbol === symbol).length;
  const currentPriceLines = priceLines.filter((p) => p.symbol === symbol).length;
  const currentFibs = fibDrawings.filter((f) => f.symbol === symbol).length;
  const totalDrawings = currentTrendLines + currentPriceLines + currentFibs;

  function handleSave() {
    const n = name.trim() || `${symbol} — ${new Date().toLocaleDateString("es-AR")}`;
    saveStrategy(n, symbol);
    setName("");
  }

  const sorted = [...strategies].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
      <DialogContent className="max-h-[80vh] max-w-lg bg-tv-panel">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <BookMarked className="h-4 w-4 text-tv-blue" />
            Mis Estrategias
          </DialogTitle>
        </DialogHeader>

        {/* Guardar estado actual */}
        <div className="rounded border border-tv-border bg-tv-bg p-3">
          <p className="mb-2 text-xs text-tv-text-muted">
            Guardar los dibujos actuales de{" "}
            <span className="font-semibold text-tv-text">{symbol}</span>
            {" "}({totalDrawings} objeto{totalDrawings !== 1 ? "s" : ""})
          </p>
          <div className="flex gap-2">
            <Input
              placeholder={`${symbol} — estrategia`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && totalDrawings > 0 && handleSave()}
              className="h-8 bg-tv-panel text-xs"
            />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={totalDrawings === 0}
              className="h-8 shrink-0 bg-tv-blue hover:bg-tv-blue/90"
            >
              Guardar
            </Button>
          </div>
          {totalDrawings === 0 && (
            <p className="mt-1.5 text-[10px] text-tv-text-muted">
              No hay dibujos en {symbol} para guardar.
            </p>
          )}
        </div>

        {/* Lista global de estrategias */}
        {sorted.length > 0 ? (
          <ScrollArea className="max-h-[40vh]">
            <div className="flex flex-col gap-1 pr-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
                Todas las estrategias ({sorted.length})
              </p>
              {sorted.map((s) => {
                const count =
                  (s.trendLineData?.length ?? s.trendLineIds?.length ?? 0) +
                  (s.priceLineData?.length ?? s.priceLineIds?.length ?? 0) +
                  (s.fibDrawingData?.length ?? s.fibDrawingIds?.length ?? 0);
                return (
                  <StrategyRow
                    key={s.id}
                    name={s.name}
                    symbol={s.symbol}
                    isCurrent={s.symbol === symbol}
                    date={s.createdAt}
                    count={count}
                    onApply={() => { loadStrategy(s.id, symbol); setOpen(false); }}
                    onDelete={() => deleteStrategy(s.id)}
                    onRename={(n) => renameStrategy(s.id, n)}
                  />
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <p className="py-2 text-center text-xs text-tv-text-muted">
            Aún no guardaste ninguna estrategia.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StrategyRow({
  name, symbol, isCurrent, date, count, onApply, onDelete, onRename,
}: {
  name: string;
  symbol: string;
  isCurrent: boolean;
  date: number;
  count: number;
  onApply: () => void;
  onDelete: () => void;
  onRename: (n: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  function commitRename() {
    const n = draft.trim();
    if (n && n !== name) onRename(n);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2 rounded bg-tv-bg px-2.5 py-1.5">
      <div className="flex min-w-0 flex-1 flex-col">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={commitRename}
            className="w-full rounded border border-tv-blue bg-tv-panel px-1 py-0.5 text-xs text-tv-text outline-none"
          />
        ) : (
          <span className="truncate text-xs font-medium text-tv-text">{name}</span>
        )}
        <span className="text-[10px] text-tv-text-muted">
          <span className={`mr-1 font-semibold ${isCurrent ? "text-tv-green" : "text-tv-blue"}`}>
            {symbol}
          </span>
          {count} objeto{count !== 1 ? "s" : ""} · {new Date(date).toLocaleDateString("es-AR")}
        </span>
      </div>

      {/* Aplicar al gráfico actual */}
      <button
        onClick={onApply}
        title={isCurrent ? "Restaurar en este gráfico" : `Aplicar a ${symbol} actual`}
        className="flex h-6 w-6 items-center justify-center rounded text-tv-text-muted transition-colors hover:bg-tv-panel-hover hover:text-tv-blue"
      >
        <Download className="h-3.5 w-3.5" />
      </button>

      {/* Renombrar */}
      {editing ? (
        <button
          onClick={commitRename}
          className="flex h-6 w-6 items-center justify-center rounded text-tv-text-muted transition-colors hover:bg-tv-panel-hover hover:text-tv-green"
        >
          <Check className="h-3 w-3" />
        </button>
      ) : (
        <button
          onClick={() => { setDraft(name); setEditing(true); }}
          title="Renombrar"
          className="flex h-6 w-6 items-center justify-center rounded text-tv-text-muted transition-colors hover:bg-tv-panel-hover hover:text-tv-text"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}

      {/* Eliminar */}
      {editing ? (
        <button
          onClick={() => setEditing(false)}
          className="flex h-6 w-6 items-center justify-center rounded text-tv-text-muted transition-colors hover:bg-tv-panel-hover hover:text-tv-text"
        >
          <X className="h-3 w-3" />
        </button>
      ) : (
        <button
          onClick={onDelete}
          title="Eliminar estrategia"
          className="flex h-6 w-6 items-center justify-center rounded text-tv-text-muted transition-colors hover:bg-tv-panel-hover hover:text-tv-red"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
