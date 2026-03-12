"use client";

import React from "react";
import type { Seat, Zone } from "@/lib/salle-types";
import { cn } from "@/lib/utils";

interface SeatItemProps {
  seat: Seat;
  zones: Zone[];
  selected: boolean;
  zoom: number;
  onPointerDown: (e: React.PointerEvent, seatId: string) => void;
  onDoubleClick: (id: string) => void;
}

export const SeatItem = React.memo(function SeatItem({
  seat,
  zones,
  selected,
  zoom,
  onPointerDown,
  onDoubleClick,
}: SeatItemProps) {
  const zone = zones.find((z) => z.name === seat.zone);
  const bgColor = zone?.color ?? "#3f3f46";

  // Show label based on available space (zoom-aware)
  const showLabel = zoom >= 0.4;
  const showPerson = zoom >= 0.55;

  const displayText = showPerson && seat.person
    ? seat.person
    : showLabel && seat.label
    ? seat.label
    : null;

  const subText = showPerson && seat.person && seat.zone ? seat.zone : null;

  return (
    <div
      className={cn(
        "absolute flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none border-2 text-[9px] font-medium leading-tight text-center overflow-hidden transition-[box-shadow,border-color] duration-100",
        selected
          ? "border-white ring-2 ring-primary shadow-lg shadow-primary/30"
          : "border-white/20 hover:border-white/50"
      )}
      style={{
        left: seat.x,
        top: seat.y,
        width: seat.width,
        height: seat.height,
        transform: seat.rotation ? `rotate(${seat.rotation}deg)` : undefined,
        backgroundColor: bgColor,
        borderRadius: 5,
      }}
      onPointerDown={(e) => onPointerDown(e, seat.id)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(seat.id);
      }}
      title={
        seat.person
          ? `${seat.person}${seat.zone ? ` · ${seat.zone}` : ""}${seat.label ? ` · ${seat.label}` : ""}`
          : seat.label ?? seat.zone ?? "Place libre"
      }
    >
      {displayText ? (
        <span className="truncate w-full px-0.5 text-center text-white drop-shadow-sm leading-none">
          {displayText}
        </span>
      ) : null}
      {subText ? (
        <span className="truncate w-full px-0.5 text-center text-white/50 leading-none mt-0.5" style={{ fontSize: "7px" }}>
          {subText}
        </span>
      ) : null}
      {!displayText && showLabel && !seat.person && !seat.label && seat.zone ? (
        <span className="truncate w-full px-0.5 text-center text-white/50 leading-none" style={{ fontSize: "7px" }}>
          {seat.zone}
        </span>
      ) : null}
    </div>
  );
});
