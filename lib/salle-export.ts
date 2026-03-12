import type { Seat, Zone, SalleUser, SallePlan } from "./salle-types";

export interface ExportRow {
  seat_id: string;
  label: string;
  zone: string;
  person: string;
  category: string;
}

function buildRows(seats: Seat[], zones: Zone[], users: SalleUser[]): ExportRow[] {
  return seats.map((seat) => {
    const user = users.find((u) => u.assignedSeatId === seat.id || u.name === seat.person);
    const zone = zones.find((z) => z.name === seat.zone);
    return {
      seat_id: seat.id,
      label: seat.label ?? "",
      zone: zone?.name ?? seat.zone ?? "",
      person: seat.person ?? user?.name ?? "",
      category: user?.category ?? "",
    };
  });
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSeatPlanCsv(
  seats: Seat[],
  zones: Zone[],
  users: SalleUser[],
  planName = "plan"
): void {
  const rows = buildRows(seats, zones, users);
  const header = "seat_id,label,zone,person,category";
  const lines = rows.map((r) =>
    [r.seat_id, r.label, r.zone, r.person, r.category]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [header, ...lines].join("\n");
  triggerDownload(csv, `${planName}-plan-salle.csv`, "text/csv;charset=utf-8;");
}

export function exportSeatPlanJson(
  plan: SallePlan,
  users: SalleUser[],
): void {
  const payload = {
    name: plan.name,
    exportedAt: new Date().toISOString(),
    seats: plan.seats.map((s) => ({
      id: s.id,
      label: s.label,
      x: s.x,
      y: s.y,
      zone: s.zone,
      person: s.person,
    })),
    zones: plan.zones,
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      category: u.category,
      assignedSeatId: u.assignedSeatId,
    })),
  };
  triggerDownload(
    JSON.stringify(payload, null, 2),
    `${plan.name}-plan-salle.json`,
    "application/json"
  );
}
