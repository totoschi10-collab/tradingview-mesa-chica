"use client";

export interface ComputedTrendLine {
  id: string;
  isPlacing: boolean;
  x1: number; y1: number;
  x2: number; y2: number;
  aX: number; aY: number;
  bX: number; bY: number;
  color: string;
  width: number;
  dashArray: string;
}

interface Props {
  lines: ComputedTrendLine[];
  activeId: string | null;
  onActivate: (id: string, x: number, y: number) => void;
  onRemove: (id: string) => void;
  onDragStart: (id: string, clientX: number, clientY: number) => void;
  onHandleDragStart: (id: string, handle: "a" | "b", clientX: number, clientY: number) => void;
}

export function TrendLineOverlay({ lines, activeId, onActivate, onRemove, onDragStart, onHandleDragStart }: Props) {
  if (lines.length === 0) return null;
  void onRemove;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      style={{ overflow: "visible" }}
    >
      {lines.map((l) => {
        const isActive = l.id === activeId;
        const midX = (l.aX + l.bX) / 2;
        const midY = (l.aY + l.bY) / 2;

        return (
          <g key={l.id}>
            {/* Línea visible */}
            <line
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke={l.color}
              strokeWidth={isActive ? l.width + 1 : l.width}
              strokeOpacity={l.isPlacing ? 0.6 : 1}
              strokeDasharray={l.isPlacing ? "6 4" : l.dashArray}
            />

            {/* Handles en anclajes */}
            {!l.isPlacing && (
              <>
                <circle
                  cx={l.aX} cy={l.aY}
                  r={isActive ? 5 : 3}
                  fill={l.color}
                  opacity={isActive ? 1 : 0.6}
                  style={{ pointerEvents: "all", cursor: "crosshair" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onHandleDragStart(l.id, "a", e.clientX, e.clientY);
                  }}
                />
                <circle
                  cx={l.bX} cy={l.bY}
                  r={isActive ? 5 : 3}
                  fill={l.color}
                  opacity={isActive ? 1 : 0.6}
                  style={{ pointerEvents: "all", cursor: "crosshair" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onHandleDragStart(l.id, "b", e.clientX, e.clientY);
                  }}
                />
              </>
            )}

            {/* Hit target — drag cuerpo o click para seleccionar */}
            {!l.isPlacing && (
              <line
                x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke="transparent"
                strokeWidth={16}
                style={{ pointerEvents: "all", cursor: "move" }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDragStart(l.id, e.clientX, e.clientY);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onActivate(l.id, midX, midY);
                }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
