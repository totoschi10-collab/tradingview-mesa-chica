"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Watchlist } from "@/components/watchlist/Watchlist";
import { useChartStore } from "@/lib/store/chart-store";

export function RightSidebar() {
  const visible = useChartStore((s) => s.watchlistVisible);
  const toggle = useChartStore((s) => s.toggleWatchlist);

  return (
    <div className="flex flex-shrink-0">
      {/* Lengüeta de toggle — siempre en el flujo normal, nunca absolute */}
      <button
        onClick={toggle}
        title={visible ? "Ocultar watchlist" : "Mostrar watchlist"}
        className="flex w-4 items-center justify-center border-l border-tv-border bg-tv-panel text-tv-text-muted transition-colors hover:bg-tv-panel-hover hover:text-tv-text"
      >
        {visible ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>

      {/*
        El contenido NUNCA se desmonta: se oculta con display:none.
        display:none colapsa el layout correctamente (a diferencia de width:0,
        que NO colapsa porque el hijo de ancho fijo lo impide en flexbox),
        pero mantiene el componente React montado — evitando el bug donde el
        componente remontado queda en estado inválido tras llamadas async en
        vuelo durante el ciclo mount/unmount.
      */}
      <aside
        className="flex-col overflow-hidden border-l border-tv-border bg-tv-panel"
        style={{ width: 256, minWidth: 256, display: visible ? "flex" : "none" }}
      >
        <Watchlist />
      </aside>
    </div>
  );
}
