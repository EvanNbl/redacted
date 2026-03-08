"use client";

import React, { useRef, useCallback } from "react";
import type { Seat, Zone } from "@/lib/salle-types";
import { cn } from "@/lib/utils";

interface SeatItemProps {
  seat: Seat;
  zones: Zone[];
  selected: boolean;
  zoom: number;
  onSelect: (id: string, additive: boolean) => void;
  onDragMove: (id: string, dx: number, dy: number) => void;
  onDragEnd: () => void;
  onDoubleClick: (id: string) => void;
}

export const SeatItem = React.memo(function SeatItem({
  seat,
  zones,
  selected,
  zoom,
  onSelect,
  onDragMove,
  onDragEnd,
  onDoubleClick,
}: SeatItemProps) {
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const zone = zones.find((z) => z.name === seat.zone);
  const bgColor = zone?.color ?? "#3f3f46";

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      onSelect(seat.id, e.ctrlKey || e.metaKey || e.shiftKey);
      dragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [seat.id, onSelect]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const dx = (e.clientX - lastPos.current.x) / zoom;
      const dy = (e.clientY - lastPos.current.y) / zoom;
      lastPos.current = { x: e.clientX, y: e.clientY };
      onDragMove(seat.id, dx, dy);
    },
    [seat.id, zoom, onDragMove]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      onDragEnd();
    },
    [onDragEnd]
  );

  return (
    <div
      className={cn(
        "absolute flex items-center justify-center cursor-grab active:cursor-grabbing select-none border-2 text-[10px] font-medium leading-tight text-center overflow-hidden transition-shadow",
        selected
          ? "border-white ring-2 ring-violet-500 shadow-lg shadow-violet-500/20"
          : "border-white/20 hover:border-white/40"
      )}
      style={{
        left: seat.x,
        top: seat.y,
        width: seat.width,
        height: seat.height,
        transform: seat.rotation ? `rotate(${seat.rotation}deg)` : undefined,
        backgroundColor: bgColor,
        borderRadius: 4,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(seat.id);
      }}
      title={
        seat.person
          ? `${seat.person}${seat.zone ? ` (${seat.zone})` : ""}`
          : seat.zone ?? "Place libre"
      }
    >
      {seat.person ? (
        <span className="truncate px-0.5 text-white drop-shadow-sm">
          {seat.person}
        </span>
      ) : (
        seat.zone && (
          <span className="truncate px-0.5 text-white/60">{seat.zone}</span>
        )
      )}
    </div>
  );
});
