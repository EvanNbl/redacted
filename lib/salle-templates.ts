import type { Zone, Seat } from "@/lib/salle-types";
import { DEFAULT_SEAT_SIZE, PRESET_COLORS, generateSeatId, SALLE_CANVAS_SIZE } from "@/lib/salle-types";

const GAP = 8;
const STEP = DEFAULT_SEAT_SIZE + GAP;

export interface SalleTemplate {
  id: string;
  label: string;
  description: string;
  getZonesAndSeats: () => { zones: Zone[]; seats: Omit<Seat, "id">[] };
}

function withIds(seats: Omit<Seat, "id">[]): Seat[] {
  return seats.map((s) => ({ ...s, id: generateSeatId() }));
}

export const SALLE_TEMPLATES: SalleTemplate[] = [
  {
    id: "vide",
    label: "Vide",
    description: "Plan vierge, à remplir manuellement",
    getZonesAndSeats: () => ({ zones: [], seats: [] }),
  },
  {
    id: "rangées",
    label: "Salle en rangées",
    description: "6 rangées de 10 places",
    getZonesAndSeats: () => {
      const zones: Zone[] = [
        { name: "Salle", color: PRESET_COLORS[0] },
      ];
      const seats: Omit<Seat, "id">[] = [];
      const rows = 6;
      const cols = 10;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = (col - (cols - 1) / 2) * STEP;
          const y = row * STEP;
          seats.push({
            x, y,
            width: DEFAULT_SEAT_SIZE,
            height: DEFAULT_SEAT_SIZE,
            rotation: 0,
            zone: "Salle",
          });
        }
      }
      return { zones, seats };
    },
  },
  {
    id: "u",
    label: "Salle en U",
    description: "Disposition en U avec scène et trois côtés",
    getZonesAndSeats: () => {
      const zones: Zone[] = [
        { name: "Scène", color: PRESET_COLORS[1] },
        { name: "Face", color: PRESET_COLORS[0] },
        { name: "Gauche", color: PRESET_COLORS[2] },
        { name: "Droite", color: PRESET_COLORS[3] },
      ];
      const seats: Omit<Seat, "id">[] = [];
      const step = STEP;
      // Face (fond) : 8 places
      for (let i = 0; i < 8; i++) {
        seats.push({
          x: (i - 3.5) * step,
          y: 4 * step,
          width: DEFAULT_SEAT_SIZE,
          height: DEFAULT_SEAT_SIZE,
          rotation: 0,
          zone: "Face",
        });
      }
      // Gauche : 3 rangées de 3
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          seats.push({
            x: -4 * step - col * step,
            y: row * step,
            width: DEFAULT_SEAT_SIZE,
            height: DEFAULT_SEAT_SIZE,
            rotation: 90,
            zone: "Gauche",
          });
        }
      }
      // Droite : 3 rangées de 3
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          seats.push({
            x: 4 * step + col * step,
            y: row * step,
            width: DEFAULT_SEAT_SIZE,
            height: DEFAULT_SEAT_SIZE,
            rotation: -90,
            zone: "Droite",
          });
        }
      }
      return { zones, seats };
    },
  }
];

/** Centre les sièges dans le canvas pour qu’ils soient visibles à l’écran (origine en haut à gauche). */
function centerSeatsInCanvas(seats: Omit<Seat, "id">[]): Omit<Seat, "id">[] {
  if (seats.length === 0) return seats;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of seats) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.width);
    maxY = Math.max(maxY, s.y + s.height);
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const canvasCenter = SALLE_CANVAS_SIZE / 2;
  const offsetX = canvasCenter - centerX;
  const offsetY = canvasCenter - centerY;
  return seats.map((s) => ({
    ...s,
    x: s.x + offsetX,
    y: s.y + offsetY,
  }));
}

export function buildPlanFromTemplate(
  planName: string,
  templateId: string
): { zones: Zone[]; seats: Seat[] } {
  const template = SALLE_TEMPLATES.find((t) => t.id === templateId) ?? SALLE_TEMPLATES[0];
  const { zones, seats } = template.getZonesAndSeats();
  const centered = centerSeatsInCanvas(seats);
  return { zones, seats: withIds(centered) };
}
