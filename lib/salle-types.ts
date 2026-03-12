export interface Seat {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zone?: string;
  person?: string;
  label?: string;
}

export interface Zone {
  name: string;
  color: string;
}

export interface SalleUser {
  id: string;
  name: string;
  category?: string;
  assignedSeatId?: string;
}

export interface SallePlan {
  name: string;
  zones: Zone[];
  seats: Seat[];
  users?: SalleUser[];
}

export const DEFAULT_SEAT_SIZE = 40;

/** Taille du canvas de placement (origine en haut à gauche). Utilisé pour centrer les templates. */
export const SALLE_CANVAS_SIZE = 4000;

export const PRESET_COLORS = [
  "#8b5cf6", // violet
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#6366f1", // indigo
];

export function generateSeatId(): string {
  return `seat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface SeatPosition {
  x: number;
  y: number;
  rotation?: number;
}

export function computeLineSeats(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): SeatPosition[] {
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const count = Math.max(2, Math.round(dist / (DEFAULT_SEAT_SIZE + 8)));
  const seats: SeatPosition[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    seats.push({
      x: startX + dx * t - DEFAULT_SEAT_SIZE / 2,
      y: startY + dy * t - DEFAULT_SEAT_SIZE / 2,
    });
  }
  return seats;
}

export function computeArcSeats(
  cx: number,
  cy: number,
  endX: number,
  endY: number
): SeatPosition[] {
  const dx = endX - cx;
  const dy = endY - cy;
  const radius = Math.sqrt(dx * dx + dy * dy);
  if (radius < 20) return [];
  const circumference = Math.PI * radius;
  const count = Math.max(3, Math.round(circumference / (DEFAULT_SEAT_SIZE + 8)));
  const startAngle = Math.atan2(dy, dx);
  const seats: SeatPosition[] = [];
  for (let i = 0; i < count; i++) {
    const angle = startAngle + (Math.PI * i) / (count - 1);
    seats.push({
      x: cx + Math.cos(angle) * radius - DEFAULT_SEAT_SIZE / 2,
      y: cy + Math.sin(angle) * radius - DEFAULT_SEAT_SIZE / 2,
      rotation: (angle * 180) / Math.PI,
    });
  }
  return seats;
}
