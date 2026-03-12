"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, LayoutGrid, FilePlus, Rows3, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SALLE_TEMPLATES } from "@/lib/salle-templates";
import { cn } from "@/lib/utils";
import type { Seat } from "@/lib/salle-types";

interface NewPlanModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (planName: string, templateId: string) => void;
  existingPlanNames: string[];
}

const PREVIEW_SIZE = 240;
const PADDING = 14;

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  vide: <FilePlus className="size-4 text-zinc-500" />,
  rangées: <Rows3 className="size-4" />,
  u: <Square className="size-4" />,
};

function TemplatePreview({ templateId }: { templateId: string }) {
  const { seats, zones, bounds } = useMemo(() => {
    const template = SALLE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return { seats: [], zones: [], bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 } };
    const { zones, seats } = template.getZonesAndSeats();
    if (seats.length === 0) {
      return { seats: [], zones, bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 } };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of seats) {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + s.width);
      maxY = Math.max(maxY, s.y + s.height);
    }
    const pad = 20;
    return {
      seats,
      zones,
      bounds: { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad },
    };
  }, [templateId]);

  if (seats.length === 0) {
    return (
      <div
        className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent flex items-center justify-center text-zinc-500 text-sm"
        style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE * 0.45 }}
      >
        <span>Plan vierge</span>
      </div>
    );
  }

  const w = bounds.maxX - bounds.minX || 1;
  const h = bounds.maxY - bounds.minY || 1;
  const scale = Math.min(
    (PREVIEW_SIZE - PADDING * 2) / w,
    (PREVIEW_SIZE * 0.45 - PADDING * 2) / h
  );
  const ox = PADDING - bounds.minX * scale;
  const oy = PADDING - bounds.minY * scale;

  const zoneColor = (zoneName: string) =>
    zones.find((z) => z.name === zoneName)?.color ?? "#6b7280";

  return (
    <div
      className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent overflow-hidden ring-1 ring-white/[0.04]"
      style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE * 0.45 }}
    >
      <svg
        width={PREVIEW_SIZE}
        height={PREVIEW_SIZE * 0.45}
        className="block"
      >
        {seats.map((s: Omit<Seat, "id">, i: number) => {
          const x = ox + s.x * scale;
          const y = oy + s.y * scale;
          const rw = Math.max(2, s.width * scale);
          const rh = Math.max(2, s.height * scale);
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={rw}
              height={rh}
              rx={2}
              fill={s.zone ? zoneColor(s.zone) : "#4b5563"}
              opacity={0.92}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={0.5}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function NewPlanModal({
  open,
  onClose,
  onCreate,
  existingPlanNames,
}: NewPlanModalProps) {
  const [planName, setPlanName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(SALLE_TEMPLATES[0].id);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPlanName("");
      setSelectedTemplateId(SALLE_TEMPLATES[0].id);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const trimmed = planName.trim();
  const isDuplicate = trimmed && existingPlanNames.some((n) => n === trimmed);
  const canSubmit = trimmed && !isDuplicate;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onCreate(trimmed, selectedTemplateId);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md my-auto rounded-2xl border border-white/[0.08] bg-[#0c0c14]/95 backdrop-blur-2xl shadow-2xl shadow-black/50 flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="shrink-0 px-6 pt-6 pb-4 border-b border-white/[0.06]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 border border-primary/20">
                    <LayoutGrid className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      Nouveau plan de salle
                    </h2>
                    <p className="text-sm text-zinc-500 mt-0.5">
                      Donnez un nom et choisissez un template de base.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* Nom du plan */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Nom du plan
                  </label>
                  <Input
                    ref={inputRef}
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="Ex : Salle A, Réunion du 15/03…"
                    className="h-10 rounded-xl bg-white/[0.04] border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-primary/50 focus-visible:border-primary/30"
                  />
                  {isDuplicate && (
                    <p className="text-xs text-amber-400 flex items-center gap-1.5">
                      <span className="size-1 rounded-full bg-amber-400" />
                      Un plan avec ce nom existe déjà.
                    </p>
                  )}
                </div>

                {/* Aperçu */}
                <div className="space-y-2">
                  <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Aperçu
                  </span>
                  <div className="flex justify-center">
                    <TemplatePreview templateId={selectedTemplateId} />
                  </div>
                </div>

                {/* Templates */}
                <div className="space-y-2">
                  <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Template de base
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {SALLE_TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(t.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
                          selectedTemplateId === t.id
                            ? "border-primary/50 bg-primary/15 text-white shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_20%,transparent)]"
                            : "border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] hover:border-white/15"
                        )}
                      >
                        <span className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg",
                          selectedTemplateId === t.id ? "bg-primary/25 text-primary" : "bg-white/5 text-zinc-500"
                        )}>
                          {TEMPLATE_ICONS[t.id] ?? <LayoutGrid className="size-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium block truncate">{t.label}</span>
                          <span className="text-[11px] text-zinc-500 line-clamp-2">{t.description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 px-6 py-4 border-t border-white/[0.06] flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="flex-1 rounded-xl text-zinc-400 hover:bg-white/5 hover:text-white"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="flex-1 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium disabled:opacity-40 disabled:pointer-events-none"
                >
                  Créer le plan
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
