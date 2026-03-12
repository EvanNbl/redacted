"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import type { Seat, Zone } from "@/lib/salle-types";
import {
  DEFAULT_SEAT_SIZE,
  generateSeatId,
  computeLineSeats,
  computeArcSeats,
} from "@/lib/salle-types";
import { SeatItem } from "./SeatItem";
import type { SalleTool } from "./SalleToolbar";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 5;
const ZOOM_FACTOR = 1.12;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function snapValue(v: number, gridSize: number): number {
  return Math.round(v / gridSize) * gridSize;
}

export interface SalleCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  centerView: () => void;
}

interface SalleCanvasProps {
  seats: Seat[];
  zones: Zone[];
  selectedIds: Set<string>;
  activeTool: SalleTool;
  snapEnabled?: boolean;
  gridSize?: number;
  onSeatsChange: (seats: Seat[]) => void;
  onSelectionChange: (ids: Set<string>) => void;
  onSeatDoubleClick: (id: string) => void;
  onZoomChange?: (zoom: number) => void;
}

interface DragState {
  seatId: string;
  startMouseX: number;
  startMouseY: number;
  startPositions: Map<string, { x: number; y: number }>;
}

interface MarqueeState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface LinePreview {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface ArcPreview {
  cx: number;
  cy: number;
  endX: number;
  endY: number;
}

export const SalleCanvas = forwardRef<SalleCanvasHandle, SalleCanvasProps>(
  function SalleCanvas(
    {
      seats,
      zones,
      selectedIds,
      activeTool,
      snapEnabled = false,
      gridSize = 20,
      onSeatsChange,
      onSelectionChange,
      onSeatDoubleClick,
      onZoomChange,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Viewport state: viewX/viewY = canvas origin position in screen space
    const [zoom, setZoom] = useState(1);
    const [viewX, setViewX] = useState(0);
    const [viewY, setViewY] = useState(0);
    const zoomRef = useRef(1);
    const viewXRef = useRef(0);
    const viewYRef = useRef(0);

    // Keep refs in sync with state for use in event handlers
    useEffect(() => {
      zoomRef.current = zoom;
      viewXRef.current = viewX;
      viewYRef.current = viewY;
    }, [zoom, viewX, viewY]);

    // Pan state
    const isPanning = useRef(false);
    const panStart = useRef<{ mouseX: number; mouseY: number; vx: number; vy: number } | null>(null);
    const spaceHeldRef = useRef(false);
    const [spaceHeld, setSpaceHeld] = useState(false);

    // Drag state (seats)
    const dragState = useRef<DragState | null>(null);
    const hasDragged = useRef(false);

    // Tools state
    const [marquee, setMarquee] = useState<MarqueeState | null>(null);
    const [linePreview, setLinePreview] = useState<LinePreview | null>(null);
    const [arcPreview, setArcPreview] = useState<ArcPreview | null>(null);

    // --- Coordinate conversion ---
    const screenToCanvas = useCallback(
      (sx: number, sy: number) => {
        const rect = containerRef.current!.getBoundingClientRect();
        return {
          x: (sx - rect.left - viewXRef.current) / zoomRef.current,
          y: (sy - rect.top - viewYRef.current) / zoomRef.current,
        };
      },
      []
    );

    // --- Center view on seats ---
    const centerView = useCallback(() => {
      const el = containerRef.current;
      if (!el) return;
      if (seats.length === 0) {
        setViewX(el.clientWidth / 2 - 2000);
        setViewY(el.clientHeight / 2 - 2000);
        return;
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const s of seats) {
        minX = Math.min(minX, s.x);
        minY = Math.min(minY, s.y);
        maxX = Math.max(maxX, s.x + s.width);
        maxY = Math.max(maxY, s.y + s.height);
      }
      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const padding = 80;
      const scaleX = (el.clientWidth - padding * 2) / contentW;
      const scaleY = (el.clientHeight - padding * 2) / contentH;
      const newZoom = clamp(Math.min(scaleX, scaleY, 2), MIN_ZOOM, MAX_ZOOM);
      const newVx = el.clientWidth / 2 - ((minX + maxX) / 2) * newZoom;
      const newVy = el.clientHeight / 2 - ((minY + maxY) / 2) * newZoom;
      setZoom(newZoom);
      setViewX(newVx);
      setViewY(newVy);
      zoomRef.current = newZoom;
      viewXRef.current = newVx;
      viewYRef.current = newVy;
      onZoomChange?.(newZoom);
    }, [seats, onZoomChange]);

    // Initial center on first load with seats
    const didCenter = useRef(false);
    useEffect(() => {
      if (seats.length === 0) {
        didCenter.current = false;
        return;
      }
      if (didCenter.current) return;
      // Wait for layout
      const id = requestAnimationFrame(() => {
        centerView();
        didCenter.current = true;
      });
      return () => cancelAnimationFrame(id);
    }, [seats.length, centerView]);

    // --- Zoom helpers ---
    const applyZoom = useCallback(
      (newZoom: number, pivotX: number, pivotY: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        const px = pivotX - (rect?.left ?? 0);
        const py = pivotY - (rect?.top ?? 0);
        const canvasX = (px - viewXRef.current) / zoomRef.current;
        const canvasY = (py - viewYRef.current) / zoomRef.current;
        const clamped = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);
        const nvx = px - canvasX * clamped;
        const nvy = py - canvasY * clamped;
        setZoom(clamped);
        setViewX(nvx);
        setViewY(nvy);
        zoomRef.current = clamped;
        viewXRef.current = nvx;
        viewYRef.current = nvy;
        onZoomChange?.(clamped);
      },
      [onZoomChange]
    );

    // Expose imperative handle for toolbar
    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => {
          const el = containerRef.current;
          const cx = el ? el.clientWidth / 2 : 0;
          const cy = el ? el.clientHeight / 2 : 0;
          applyZoom(zoomRef.current * ZOOM_FACTOR, (el?.getBoundingClientRect().left ?? 0) + cx, (el?.getBoundingClientRect().top ?? 0) + cy);
        },
        zoomOut: () => {
          const el = containerRef.current;
          const cx = el ? el.clientWidth / 2 : 0;
          const cy = el ? el.clientHeight / 2 : 0;
          applyZoom(zoomRef.current / ZOOM_FACTOR, (el?.getBoundingClientRect().left ?? 0) + cx, (el?.getBoundingClientRect().top ?? 0) + cy);
        },
        resetZoom: () => {
          const el = containerRef.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          applyZoom(1, rect.left + el.clientWidth / 2, rect.top + el.clientHeight / 2);
        },
        centerView,
      }),
      [applyZoom, centerView]
    );

    // --- Space key for pan ---
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.code === "Space" && !e.repeat) {
          const tag = document.activeElement?.tagName;
          if (tag === "INPUT" || tag === "TEXTAREA") return;
          e.preventDefault();
          spaceHeldRef.current = true;
          setSpaceHeld(true);
        }
      };
      const onKeyUp = (e: KeyboardEvent) => {
        if (e.code === "Space") {
          spaceHeldRef.current = false;
          setSpaceHeld(false);
          isPanning.current = false;
          panStart.current = null;
        }
      };
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
      };
    }, []);

    // --- Seat selection ---
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

    // --- Seat drag (initiated from canvas, not SeatItem) ---
    const handleSeatPointerDown = useCallback(
      (e: React.PointerEvent, seatId: string) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        // Select the seat
        const additive = e.ctrlKey || e.metaKey || e.shiftKey;
        if (additive) {
          const next = new Set(selectedIds);
          if (next.has(seatId)) next.delete(seatId);
          else next.add(seatId);
          onSelectionChange(next);
        } else if (!selectedIds.has(seatId)) {
          onSelectionChange(new Set([seatId]));
        }

        // Record drag start positions for all seats that will be moved
        const idsToMove = selectedIds.has(seatId) ? selectedIds : new Set([seatId]);
        const startPositions = new Map<string, { x: number; y: number }>();
        for (const s of seats) {
          if (idsToMove.has(s.id)) {
            startPositions.set(s.id, { x: s.x, y: s.y });
          }
        }

        dragState.current = {
          seatId,
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          startPositions,
        };
        hasDragged.current = false;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      },
      [seats, selectedIds, onSelectionChange]
    );

    // --- Pointer down on canvas background ---
    const handleCanvasPointerDown = useCallback(
      (e: React.PointerEvent) => {
        if (e.button === 1 || (spaceHeldRef.current && e.button === 0)) {
          e.preventDefault();
          isPanning.current = true;
          panStart.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            vx: viewXRef.current,
            vy: viewYRef.current,
          };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }

        if (e.button !== 0) return;

        const pos = screenToCanvas(e.clientX, e.clientY);

        if (activeTool === "select") {
          if (!e.shiftKey && !e.ctrlKey) onSelectionChange(new Set());
          setMarquee({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } else if (activeTool === "addArc") {
          setArcPreview({ cx: pos.x, cy: pos.y, endX: pos.x, endY: pos.y });
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }
      },
      [activeTool, seats, screenToCanvas, onSeatsChange, onSelectionChange, snapEnabled, gridSize]
    );

    // --- Pointer move ---
    const handlePointerMove = useCallback(
      (e: React.PointerEvent) => {
        // Pan
        if (isPanning.current && panStart.current) {
          const dx = e.clientX - panStart.current.mouseX;
          const dy = e.clientY - panStart.current.mouseY;
          const nvx = panStart.current.vx + dx;
          const nvy = panStart.current.vy + dy;
          setViewX(nvx);
          setViewY(nvy);
          viewXRef.current = nvx;
          viewYRef.current = nvy;
          return;
        }

        // Seat drag
        if (dragState.current) {
          const ds = dragState.current;
          const rawDx = (e.clientX - ds.startMouseX) / zoomRef.current;
          const rawDy = (e.clientY - ds.startMouseY) / zoomRef.current;
          if (Math.abs(rawDx) > 2 || Math.abs(rawDy) > 2) {
            hasDragged.current = true;
          }
          onSeatsChange(
            seats.map((s) => {
              const orig = ds.startPositions.get(s.id);
              if (!orig) return s;
              let nx = orig.x + rawDx;
              let ny = orig.y + rawDy;
              if (snapEnabled) {
                nx = snapValue(nx, gridSize);
                ny = snapValue(ny, gridSize);
              }
              return { ...s, x: nx, y: ny };
            })
          );
          return;
        }

        const pos = screenToCanvas(e.clientX, e.clientY);

        if (marquee) {
          setMarquee((m) => (m ? { ...m, endX: pos.x, endY: pos.y } : null));
        }

        if (linePreview) {
          let ex = pos.x;
          let ey = pos.y;
          if (e.shiftKey) {
            const ddx = pos.x - linePreview.startX;
            const ddy = pos.y - linePreview.startY;
            if (Math.abs(ddx) > Math.abs(ddy)) ey = linePreview.startY;
            else ex = linePreview.startX;
          }
          setLinePreview((l) => (l ? { ...l, endX: ex, endY: ey } : null));
        }

        if (arcPreview) {
          setArcPreview((a) => (a ? { ...a, endX: pos.x, endY: pos.y } : null));
        }
      },
      [marquee, linePreview, arcPreview, seats, screenToCanvas, onSeatsChange, snapEnabled, gridSize]
    );

    // --- Pointer up ---
    const handlePointerUp = useCallback(
      (e: React.PointerEvent) => {
        // End pan
        if (isPanning.current) {
          isPanning.current = false;
          panStart.current = null;
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          return;
        }

        // End seat drag
        if (dragState.current) {
          if (!hasDragged.current) {
            // It was a click, not a drag → toggle selection properly
            const id = dragState.current.seatId;
            const additive = e.ctrlKey || e.metaKey || e.shiftKey;
            if (!additive) {
              onSelectionChange(new Set([id]));
            }
          }
          dragState.current = null;
          hasDragged.current = false;
          return;
        }

        // End marquee
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
          return;
        }

        // Finalize line tool
        if (linePreview) {
          const dx = linePreview.endX - linePreview.startX;
          const dy = linePreview.endY - linePreview.startY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const count = Math.max(2, Math.round(dist / (DEFAULT_SEAT_SIZE + 8)));
          const newSeats: Seat[] = [];
          for (let i = 0; i < count; i++) {
            const t = count === 1 ? 0 : i / (count - 1);
            let sx = linePreview.startX + dx * t - DEFAULT_SEAT_SIZE / 2;
            let sy = linePreview.startY + dy * t - DEFAULT_SEAT_SIZE / 2;
            if (snapEnabled) {
              sx = snapValue(sx, gridSize);
              sy = snapValue(sy, gridSize);
            }
            newSeats.push({
              id: generateSeatId(),
              x: sx,
              y: sy,
              width: DEFAULT_SEAT_SIZE,
              height: DEFAULT_SEAT_SIZE,
              rotation: 0,
            });
          }
          onSeatsChange([...seats, ...newSeats]);
          onSelectionChange(new Set(newSeats.map((s) => s.id)));
          setLinePreview(null);
          return;
        }

        // Finalize arc tool
        if (arcPreview) {
          const positions = computeArcSeats(
            arcPreview.cx,
            arcPreview.cy,
            arcPreview.endX,
            arcPreview.endY
          );
          if (positions.length > 0) {
            const newSeats: Seat[] = positions.map((pos) => ({
              id: generateSeatId(),
              x: pos.x,
              y: pos.y,
              width: DEFAULT_SEAT_SIZE,
              height: DEFAULT_SEAT_SIZE,
              rotation: pos.rotation ?? 0,
            }));
            onSeatsChange([...seats, ...newSeats]);
            onSelectionChange(new Set(newSeats.map((s) => s.id)));
          }
          setArcPreview(null);
        }
      },
      [marquee, linePreview, arcPreview, seats, onSeatsChange, onSelectionChange, snapEnabled, gridSize]
    );

    // --- Wheel zoom ---
    const handleWheel = useCallback(
      (e: WheelEvent) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
        applyZoom(zoomRef.current * factor, e.clientX, e.clientY);
      },
      [applyZoom]
    );

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      el.addEventListener("wheel", handleWheel, { passive: false });
      return () => el.removeEventListener("wheel", handleWheel);
    }, [handleWheel]);

    // --- Cursor style ---
    const cursorStyle =
      spaceHeld || isPanning.current
        ? isPanning.current
          ? "grabbing"
          : "grab"
        : activeTool === "select"
        ? "default"
        : "crosshair";

    // --- Grid density ---
    const effectiveGridSize = snapEnabled ? gridSize : 40;
    const gridScreenSize = effectiveGridSize * zoom;
    const gridOffsetX = ((viewX % gridScreenSize) + gridScreenSize) % gridScreenSize;
    const gridOffsetY = ((viewY % gridScreenSize) + gridScreenSize) % gridScreenSize;

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
        className="flex-1 overflow-hidden bg-[#07070b] relative select-none"
        style={{ cursor: cursorStyle }}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          if (isPanning.current) {
            isPanning.current = false;
            panStart.current = null;
          }
        }}
      >
        {/* Infinite grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: snapEnabled
              ? `radial-gradient(circle, rgba(var(--color-primary),0.18) 1px, transparent 1px)`
              : `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)`,
            backgroundSize: `${gridScreenSize}px ${gridScreenSize}px`,
            backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
          }}
        />

        {/* Canvas content layer */}
        <div
          className="absolute"
          style={{
            transform: `translate(${viewX}px, ${viewY}px) scale(${zoom})`,
            transformOrigin: "0 0",
            willChange: "transform",
          }}
        >
          {seats.map((seat) => (
            <SeatItem
              key={seat.id}
              seat={seat}
              zones={zones}
              selected={selectedIds.has(seat.id)}
              zoom={zoom}
              onPointerDown={handleSeatPointerDown}
              onDoubleClick={onSeatDoubleClick}
            />
          ))}

          {/* Marquee selection rectangle */}
          {marqueeRect && marqueeRect.width > 2 && (
            <div
              className="absolute border border-primary bg-primary/10 pointer-events-none"
              style={marqueeRect}
            />
          )}

          {/* Ghost previews — line */}
          {linePreview &&
            computeLineSeats(
              linePreview.startX,
              linePreview.startY,
              linePreview.endX,
              linePreview.endY
            ).map((pos, i) => (
              <div
                key={`ghost-line-${i}`}
                className="absolute rounded-md border-2 border-primary/60 bg-primary/20 pointer-events-none"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: DEFAULT_SEAT_SIZE,
                  height: DEFAULT_SEAT_SIZE,
                }}
              />
            ))}

          {/* Ghost previews — arc */}
          {arcPreview &&
            computeArcSeats(
              arcPreview.cx,
              arcPreview.cy,
              arcPreview.endX,
              arcPreview.endY
            ).map((pos, i) => (
              <div
                key={`ghost-arc-${i}`}
                className="absolute rounded-md border-2 border-primary/60 bg-primary/20 pointer-events-none"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: DEFAULT_SEAT_SIZE,
                  height: DEFAULT_SEAT_SIZE,
                  transform: pos.rotation ? `rotate(${pos.rotation}deg)` : undefined,
                  transformOrigin: "50% 50%",
                }}
              />
            ))}

          {/* Arc center indicator */}
          {arcPreview && (
            <div
              className="absolute size-2 rounded-full bg-primary pointer-events-none -translate-x-1 -translate-y-1"
              style={{ left: arcPreview.cx, top: arcPreview.cy }}
            />
          )}

          {/* Line preview line */}
          {linePreview && (
            <svg
              className="absolute inset-0 pointer-events-none overflow-visible"
              style={{ left: 0, top: 0, width: 0, height: 0 }}
            >
              <line
                x1={linePreview.startX}
                y1={linePreview.startY}
                x2={linePreview.endX}
                y2={linePreview.endY}
                stroke="rgba(var(--color-primary),0.4)"
                strokeWidth="1"
                strokeDasharray="6 4"
              />
            </svg>
          )}
        </div>

        {/* Zoom indicator */}
        <div className="absolute bottom-3 right-3 pointer-events-none">
          <div className="rounded-md bg-black/40 px-2 py-1 text-[10px] font-mono text-zinc-500 backdrop-blur-sm">
            {Math.round(zoom * 100)}%
          </div>
        </div>
      </div>
    );
  }
);
