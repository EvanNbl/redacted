"use client";

import { useRef, useState, useCallback } from "react";
import type { Seat, Zone, SeatPosition } from "@/lib/salle-types";
import {
  DEFAULT_SEAT_SIZE,
  generateSeatId,
  computeLineSeats,
  computeArcSeats,
} from "@/lib/salle-types";
import { SeatItem } from "./SeatItem";
import type { SalleTool } from "./SalleToolbar";

interface SalleCanvasProps {
  seats: Seat[];
  zones: Zone[];
  selectedIds: Set<string>;
  activeTool: SalleTool;
  zoom: number;
  snapEnabled?: boolean;
  gridSize?: number;
  onSeatsChange: (seats: Seat[]) => void;
  onSelectionChange: (ids: Set<string>) => void;
  onSeatDoubleClick: (id: string) => void;
}

const CANVAS_SIZE = 4000;

function snapValue(v: number, gridSize: number): number {
  return Math.round(v / gridSize) * gridSize;
}

export function SalleCanvas({
  seats,
  zones,
  selectedIds,
  activeTool,
  zoom,
  snapEnabled = false,
  gridSize = 20,
  onSeatsChange,
  onSelectionChange,
  onSeatDoubleClick,
}: SalleCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [linePreview, setLinePreview] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [arcPreview, setArcPreview] = useState<{
    cx: number;
    cy: number;
    endX: number;
    endY: number;
  } | null>(null);

  const getCanvasPos = useCallback(
    (e: React.MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const scrollLeft = containerRef.current!.scrollLeft;
      const scrollTop = containerRef.current!.scrollTop;
      return {
        x: (e.clientX - rect.left + scrollLeft) / zoom,
        y: (e.clientY - rect.top + scrollTop) / zoom,
      };
    },
    [zoom]
  );

  const handleSelectSeat = useCallback(
    (id: string, additive: boolean) => {
      if (additive) {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onSelectionChange(next);
      } else {
        onSelectionChange(new Set([id]));
      }
    },
    [selectedIds, onSelectionChange]
  );

  const handleDragMove = useCallback(
    (id: string, dx: number, dy: number) => {
      const idsToMove = selectedIds.has(id) ? selectedIds : new Set([id]);
      onSeatsChange(
        seats.map((s) => {
          if (!idsToMove.has(s.id)) return s;
          let nx = s.x + dx;
          let ny = s.y + dy;
          if (snapEnabled) {
            nx = snapValue(nx, gridSize);
            ny = snapValue(ny, gridSize);
          }
          return { ...s, x: nx, y: ny };
        })
      );
    },
    [seats, selectedIds, onSeatsChange, snapEnabled, gridSize]
  );

  const handleDragEnd = useCallback(() => {}, []);

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement) !== containerRef.current?.firstElementChild)
        return;

      const pos = getCanvasPos(e);

      if (activeTool === "select") {
        if (!e.shiftKey && !e.ctrlKey) onSelectionChange(new Set());
        setMarquee({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
      } else if (activeTool === "addSingle") {
        let sx = pos.x - DEFAULT_SEAT_SIZE / 2;
        let sy = pos.y - DEFAULT_SEAT_SIZE / 2;
        if (snapEnabled) {
          sx = snapValue(sx, gridSize);
          sy = snapValue(sy, gridSize);
        }
        const newSeat: Seat = {
          id: generateSeatId(),
          x: sx,
          y: sy,
          width: DEFAULT_SEAT_SIZE,
          height: DEFAULT_SEAT_SIZE,
          rotation: 0,
        };
        onSeatsChange([...seats, newSeat]);
        onSelectionChange(new Set([newSeat.id]));
      } else if (activeTool === "addLine") {
        setLinePreview({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
      } else if (activeTool === "addArc") {
        setArcPreview({ cx: pos.x, cy: pos.y, endX: pos.x, endY: pos.y });
      }
    },
    [activeTool, seats, getCanvasPos, onSeatsChange, onSelectionChange]
  );

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pos = getCanvasPos(e);
      if (marquee) {
        setMarquee((m) => (m ? { ...m, endX: pos.x, endY: pos.y } : null));
      }
      if (linePreview) {
        setLinePreview((l) => (l ? { ...l, endX: pos.x, endY: pos.y } : null));
      }
      if (arcPreview) {
        setArcPreview((a) => (a ? { ...a, endX: pos.x, endY: pos.y } : null));
      }
    },
    [marquee, linePreview, arcPreview, getCanvasPos]
  );

  const handleCanvasPointerUp = useCallback(() => {
    if (marquee) {
      const x1 = Math.min(marquee.startX, marquee.endX);
      const y1 = Math.min(marquee.startY, marquee.endY);
      const x2 = Math.max(marquee.startX, marquee.endX);
      const y2 = Math.max(marquee.startY, marquee.endY);
      if (Math.abs(x2 - x1) > 5 && Math.abs(y2 - y1) > 5) {
        const selected = seats.filter(
          (s) =>
            s.x + s.width > x1 &&
            s.x < x2 &&
            s.y + s.height > y1 &&
            s.y < y2
        );
        onSelectionChange(new Set(selected.map((s) => s.id)));
      }
      setMarquee(null);
    }

    if (linePreview) {
      const dx = linePreview.endX - linePreview.startX;
      const dy = linePreview.endY - linePreview.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const count = Math.max(2, Math.round(dist / (DEFAULT_SEAT_SIZE + 8)));
      const newSeats: Seat[] = [];
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : i / (count - 1);
        newSeats.push({
          id: generateSeatId(),
          x: linePreview.startX + dx * t - DEFAULT_SEAT_SIZE / 2,
          y: linePreview.startY + dy * t - DEFAULT_SEAT_SIZE / 2,
          width: DEFAULT_SEAT_SIZE,
          height: DEFAULT_SEAT_SIZE,
          rotation: 0,
        });
      }
      onSeatsChange([...seats, ...newSeats]);
      onSelectionChange(new Set(newSeats.map((s) => s.id)));
      setLinePreview(null);
    }

    if (arcPreview) {
      const dx = arcPreview.endX - arcPreview.cx;
      const dy = arcPreview.endY - arcPreview.cy;
      const radius = Math.sqrt(dx * dx + dy * dy);
      if (radius > 20) {
        const circumference = Math.PI * radius;
        const count = Math.max(3, Math.round(circumference / (DEFAULT_SEAT_SIZE + 8)));
        const startAngle = Math.atan2(dy, dx);
        const newSeats: Seat[] = [];
        for (let i = 0; i < count; i++) {
          const angle = startAngle + (Math.PI * i) / (count - 1);
          newSeats.push({
            id: generateSeatId(),
            x: arcPreview.cx + Math.cos(angle) * radius - DEFAULT_SEAT_SIZE / 2,
            y: arcPreview.cy + Math.sin(angle) * radius - DEFAULT_SEAT_SIZE / 2,
            width: DEFAULT_SEAT_SIZE,
            height: DEFAULT_SEAT_SIZE,
            rotation: 0,
          });
        }
        onSeatsChange([...seats, ...newSeats]);
        onSelectionChange(new Set(newSeats.map((s) => s.id)));
      }
      setArcPreview(null);
    }
  }, [marquee, linePreview, arcPreview, seats, onSeatsChange, onSelectionChange]);

  const marqueeRect = marquee
    ? {
        left: Math.min(marquee.startX, marquee.endX),
        top: Math.min(marquee.startY, marquee.endY),
        width: Math.abs(marquee.endX - marquee.startX),
        height: Math.abs(marquee.endY - marquee.startY),
      }
    : null;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-[#07070b] relative"
      style={{ cursor: activeTool === "select" ? "default" : "crosshair" }}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
    >
      <div
        className="relative"
        style={{
          width: CANVAS_SIZE * zoom,
          height: CANVAS_SIZE * zoom,
          transform: `scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* Grid dots */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: snapEnabled
              ? "radial-gradient(circle, rgba(139,92,246,0.12) 1px, transparent 1px)"
              : "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: snapEnabled
              ? `${gridSize}px ${gridSize}px`
              : "40px 40px",
          }}
        />

        {seats.map((seat) => (
          <SeatItem
            key={seat.id}
            seat={seat}
            zones={zones}
            selected={selectedIds.has(seat.id)}
            zoom={zoom}
            onSelect={handleSelectSeat}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onDoubleClick={onSeatDoubleClick}
          />
        ))}

        {/* Marquee selection rectangle */}
        {marqueeRect && marqueeRect.width > 2 && (
          <div
            className="absolute border border-violet-500 bg-violet-500/10 pointer-events-none"
            style={marqueeRect}
          />
        )}

        {/* Ghost seat previews for line tool */}
        {linePreview &&
          computeLineSeats(
            linePreview.startX,
            linePreview.startY,
            linePreview.endX,
            linePreview.endY
          ).map((pos, i) => (
            <div
              key={`ghost-line-${i}`}
              className="absolute rounded-md border-2 border-violet-500/50 bg-violet-500/20 pointer-events-none"
              style={{
                left: pos.x,
                top: pos.y,
                width: DEFAULT_SEAT_SIZE,
                height: DEFAULT_SEAT_SIZE,
              }}
            />
          ))}

        {/* Ghost seat previews for arc tool */}
        {arcPreview &&
          computeArcSeats(
            arcPreview.cx,
            arcPreview.cy,
            arcPreview.endX,
            arcPreview.endY
          ).map((pos, i) => (
            <div
              key={`ghost-arc-${i}`}
              className="absolute rounded-md border-2 border-violet-500/50 bg-violet-500/20 pointer-events-none"
              style={{
                left: pos.x,
                top: pos.y,
                width: DEFAULT_SEAT_SIZE,
                height: DEFAULT_SEAT_SIZE,
              }}
            />
          ))}

        {/* Arc center indicator */}
        {arcPreview && (
          <div
            className="absolute size-2 rounded-full bg-violet-500 pointer-events-none -translate-x-1 -translate-y-1"
            style={{ left: arcPreview.cx, top: arcPreview.cy }}
          />
        )}
      </div>
    </div>
  );
}
