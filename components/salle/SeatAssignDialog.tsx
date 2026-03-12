"use client";

import { useState, useEffect, useRef } from "react";
import { X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Seat, Zone } from "@/lib/salle-types";

interface SeatAssignDialogProps {
  seat: Seat;
  zones: Zone[];
  onClose: () => void;
  onSave: (seatId: string, person: string, zone?: string) => void;
}

export function SeatAssignDialog({
  seat,
  zones,
  onClose,
  onSave,
}: SeatAssignDialogProps) {
  const [person, setPerson] = useState(seat.person ?? "");
  const [zone, setZone] = useState(seat.zone ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(seat.id, person.trim(), zone || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <User className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-white">
              Assigner une place
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">
              Personne
            </label>
            <Input
              ref={inputRef}
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              placeholder="Nom de la personne…"
              className="h-8 text-sm bg-white/5 border-white/10 text-white placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Zone</label>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="h-8 w-full rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-sm text-white outline-none focus-visible:border-primary/50 [&>option]:bg-zinc-900 [&>option]:text-white"
            >
              <option value="">— Aucune zone —</option>
              {zones.map((z) => (
                <option key={z.name} value={z.name}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="flex-1 text-zinc-400"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Enregistrer
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
