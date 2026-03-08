"use client";

import { useState } from "react";
import { Plus, X, Paintbrush, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Zone } from "@/lib/salle-types";
import { PRESET_COLORS } from "@/lib/salle-types";
import { cn } from "@/lib/utils";

interface ZonePanelProps {
  zones: Zone[];
  onAddZone: (zone: Zone) => void;
  onRemoveZone: (name: string) => void;
  onRenameZone: (oldName: string, newName: string) => void;
  onAssignZone: (zoneName: string) => void;
  selectedSeatsCount: number;
  canEdit?: boolean;
}

export function ZonePanel({
  zones,
  onAddZone,
  onRemoveZone,
  onRenameZone,
  onAssignZone,
  selectedSeatsCount,
  canEdit = true,
}: ZonePanelProps) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingZone, setEditingZone] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed || zones.some((z) => z.name === trimmed)) return;
    onAddZone({ name: trimmed, color: newColor });
    setNewName("");
    const nextColor = PRESET_COLORS.find((c) => !zones.some((z) => z.color === c));
    if (nextColor) setNewColor(nextColor);
  };

  const handleRename = (oldName: string) => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== oldName && !zones.some((z) => z.name === trimmed)) {
      onRenameZone(oldName, trimmed);
    }
    setEditingZone(null);
  };

  return (
    <div className="flex h-full w-64 flex-col border-l border-white/[0.06] bg-[#0a0a10]/60">
      <div className="border-b border-white/[0.06] px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Zones / Catégories
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {zones.map((zone) => (
          <div
            key={zone.name}
            className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"
          >
            <div
              className="size-4 rounded-sm shrink-0 border border-white/20"
              style={{ backgroundColor: zone.color }}
            />
            {editingZone === zone.name ? (
              <form
                className="flex-1 flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRename(zone.name);
                }}
              >
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-6 text-xs bg-white/5 border-white/20 px-1.5"
                  autoFocus
                  onBlur={() => handleRename(zone.name)}
                />
              </form>
            ) : (
              <span
                className="flex-1 text-xs text-zinc-200 truncate cursor-pointer"
                onDoubleClick={() => {
                  setEditingZone(zone.name);
                  setEditName(zone.name);
                }}
              >
                {zone.name}
              </span>
            )}

            {canEdit && selectedSeatsCount > 0 && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onAssignZone(zone.name)}
                title={`Assigner ${selectedSeatsCount} place(s) à "${zone.name}"`}
                className="text-zinc-500 hover:text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Paintbrush className="size-3" />
              </Button>
            )}
            {canEdit && (
            <button
              onClick={() => onRemoveZone(zone.name)}
              className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Supprimer cette zone"
            >
              <X className="size-3" />
            </button>
            )}
          </div>
        ))}
        {zones.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-4">
            Aucune zone définie
          </p>
        )}
      </div>

      {/* Add zone form */}
      {canEdit && (
      <div className="border-t border-white/[0.06] p-3 space-y-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nom de la zone…"
          className="h-7 text-xs bg-white/5 border-white/10 text-white placeholder:text-zinc-600"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <div className="flex items-center gap-1 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setNewColor(c)}
              className={cn(
                "size-5 rounded-sm border-2 transition-transform",
                c === newColor ? "border-white scale-110" : "border-transparent hover:scale-105"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <Button
          size="xs"
          onClick={handleAdd}
          disabled={!newName.trim()}
          className="w-full bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40"
        >
          <Plus className="size-3" />
          Ajouter zone
        </Button>
      </div>
      )}
    </div>
  );
}
