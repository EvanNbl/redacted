"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { LayoutGrid, Plus, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { SalleCanvas } from "@/components/salle/SalleCanvas";
import { SalleToolbar, type SalleTool } from "@/components/salle/SalleToolbar";
import { ZonePanel } from "@/components/salle/ZonePanel";
import { SeatAssignDialog } from "@/components/salle/SeatAssignDialog";
import { NewPlanModal } from "@/components/salle/NewPlanModal";
import { fetchSallePlans, saveSallePlan, deleteSallePlan, appendJournalEntry } from "@/lib/supabase-data";
import { buildPlanFromTemplate } from "@/lib/salle-templates";
import type { SallePlan, Seat, Zone } from "@/lib/salle-types";
import { PRESET_COLORS } from "@/lib/salle-types";
import { useAuth } from "@/lib/auth-context";
import { PageGuard } from "@/components/PageGuard";
import { usePermission } from "@/hooks/usePermission";
import { getSalleBetaEnabled } from "@/lib/beta-flags";

export default function SallePage() {
  const { profile } = useAuth();
  const { canEdit, canDelete } = usePermission("salle");
  const [betaEnabled, setBetaEnabled] = useState(false);
  const [plans, setPlans] = useState<SallePlan[]>([]);
  const [currentPlanName, setCurrentPlanName] = useState<string | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTool, setActiveTool] = useState<SalleTool>("select");
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignSeatId, setAssignSeatId] = useState<string | null>(null);
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [lastChangeTime, setLastChangeTime] = useState<number | null>(null);
  const mounted = useRef(true);

  const currentPlan = plans.find((p) => p.name === currentPlanName);

  useEffect(() => {
    setBetaEnabled(getSalleBetaEnabled());
  }, []);

  /* ── Load ────────────────────────────────────────────── */

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await fetchSallePlans();
      if (!mounted.current) return;
      setPlans(loaded);
      if (loaded.length > 0 && !currentPlanName) {
        const first = loaded[0];
        setCurrentPlanName(first.name);
        setSeats(first.seats);
        setZones(first.zones);
      } else if (currentPlanName) {
        const p = loaded.find((pl) => pl.name === currentPlanName);
        if (p) {
          setSeats(p.seats);
          setZones(p.zones);
        }
      }
    } catch {
      if (mounted.current) setError("Impossible de charger les plans de salle.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [currentPlanName]);

  useEffect(() => {
    mounted.current = true;
    void loadPlans();
    return () => { mounted.current = false; };
  }, []);

  /* ── Switch plan ─────────────────────────────────────── */

  const switchPlan = useCallback(
    (name: string) => {
      const plan = plans.find((p) => p.name === name);
      if (!plan) return;
      setCurrentPlanName(name);
      setSeats(plan.seats);
      setZones(plan.zones);
      setSelectedIds(new Set());
    },
    [plans]
  );

  const createNewPlan = useCallback(
    (planName: string, templateId: string) => {
      const trimmed = planName.trim();
      if (!trimmed || plans.some((p) => p.name === trimmed)) return;
      const { zones: initialZones, seats: initialSeats } = buildPlanFromTemplate(
        trimmed,
        templateId
      );
      const newPlan: SallePlan = {
        name: trimmed,
        zones: initialZones,
        seats: initialSeats,
      };
      setPlans((prev) => [...prev, newPlan]);
      setCurrentPlanName(trimmed);
      setSeats(initialSeats);
      setZones(initialZones);
      setSelectedIds(new Set());
      setShowNewPlanModal(false);
      void appendJournalEntry("Créé", "salle", {
        pseudo: trimmed,
        details: `Nouveau plan de salle "${trimmed}"`,
        userEmail: profile?.email,
      });
      setLastChangeTime(Date.now());
    },
    [plans, profile]
  );

  /* ── Save ────────────────────────────────────────────── */

  const handleSave = useCallback(async () => {
    if (!currentPlanName) return;
    setSaving(true);
    setError(null);
    const plan: SallePlan = { name: currentPlanName, zones, seats };
    const result = await saveSallePlan(plan);
    if (mounted.current) {
      setSaving(false);
      if (!result.ok) setError(result.error ?? "Erreur lors de la sauvegarde.");
      else {
        setPlans((prev) =>
          prev.map((p) => (p.name === currentPlanName ? plan : p))
        );
        void appendJournalEntry("Sauvegardé", "salle", {
          pseudo: currentPlanName,
          details: `Plan "${currentPlanName}" sauvegardé (${seats.length} places)`,
          userEmail: profile?.email,
        });
      }
    }
  }, [currentPlanName, zones, seats]);

  const handleDeletePlan = useCallback(async () => {
    if (!currentPlanName) return;
    const result = await deleteSallePlan(currentPlanName);
    if (!result.ok) {
      setError(result.error ?? "Erreur lors de la suppression.");
      return;
    }
    void appendJournalEntry("Supprimé", "salle", {
      pseudo: currentPlanName,
      details: `Plan "${currentPlanName}" supprimé`,
      userEmail: profile?.email,
    });
    setPlans((prev) => prev.filter((p) => p.name !== currentPlanName));
    setCurrentPlanName(null);
    setSeats([]);
    setZones([]);
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
  }, [currentPlanName, profile]);

  /* ── Keyboard shortcuts ──────────────────────────────── */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (document.activeElement as HTMLElement | null)?.isContentEditable;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (isTyping) return;
        if (selectedIds.size > 0) {
          setSeats((prev) => prev.filter((s) => !selectedIds.has(s.id)));
          setSelectedIds(new Set());
          setLastChangeTime(Date.now());
        }
      }
      if (e.key === "Escape") {
        setSelectedIds(new Set());
        setActiveTool("select");
      }
      if ((e.key === "+" || e.key === "=") && !isTyping) {
        e.preventDefault();
        setZoom((z) => Math.min(3, z + 0.15));
      }
      if (e.key === "-" && !isTyping) {
        e.preventDefault();
        setZoom((z) => Math.max(0.2, z - 0.15));
      }
      // Tool shortcuts
      if (!isTyping) {
        if (e.key === "s" || e.key === "S") setActiveTool("select");
        if (e.key === "a" || e.key === "A") setActiveTool("addSingle");
        if (e.key === "l" || e.key === "L") setActiveTool("addLine");
        if (e.key === "r" || e.key === "R") setActiveTool("addArc");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds]);

  /* ── Actions ─────────────────────────────────────────── */

  const handleDeleteSelected = useCallback(() => {
    setSeats((prev) => prev.filter((s) => !selectedIds.has(s.id)));
    setSelectedIds(new Set());
    setLastChangeTime(Date.now());
  }, [selectedIds]);

  const handleRotateSelected = useCallback(() => {
    setSeats((prev) =>
      prev.map((s) =>
        selectedIds.has(s.id) ? { ...s, rotation: (s.rotation + 15) % 360 } : s
      )
    );
    setLastChangeTime(Date.now());
  }, [selectedIds]);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(3, z + 0.15)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(0.2, z - 0.15)), []);
  const handleResetZoom = useCallback(() => setZoom(1), []);

  const handleResetView = useCallback(() => {
    // Déclenche le re-centrage dans SalleCanvas en forçant un re-scroll
    // On utilise un ref exposé via la clé du composant; ici on scrolle manuellement
    const canvas = document.querySelector<HTMLDivElement>(".salle-canvas-container");
    if (!canvas) return;
    const center = 4000 / 2;
    canvas.scrollLeft = center * zoom - canvas.clientWidth / 2;
    canvas.scrollTop = center * zoom - canvas.clientHeight / 2;
  }, [zoom]);

  /* ── Zones ───────────────────────────────────────────── */

  const handleAddZone = useCallback((zone: Zone) => {
    setZones((prev) => [...prev, zone]);
    setLastChangeTime(Date.now());
  }, []);

  const handleRemoveZone = useCallback((name: string) => {
    setZones((prev) => prev.filter((z) => z.name !== name));
    setSeats((prev) =>
      prev.map((s) => (s.zone === name ? { ...s, zone: undefined } : s))
    );
    setLastChangeTime(Date.now());
  }, []);

  const handleRenameZone = useCallback((oldName: string, newName: string) => {
    setZones((prev) =>
      prev.map((z) => (z.name === oldName ? { ...z, name: newName } : z))
    );
    setSeats((prev) =>
      prev.map((s) => (s.zone === oldName ? { ...s, zone: newName } : s))
    );
    setLastChangeTime(Date.now());
  }, []);

  const handleAssignZone = useCallback(
    (zoneName: string) => {
      setSeats((prev) =>
        prev.map((s) => (selectedIds.has(s.id) ? { ...s, zone: zoneName } : s))
      );
      setLastChangeTime(Date.now());
    },
    [selectedIds]
  );

  /* ── Seat assign dialog ──────────────────────────────── */

  const handleSeatDoubleClick = useCallback((id: string) => {
    setAssignSeatId(id);
  }, []);

  const handleAssignSave = useCallback(
    (seatId: string, person: string, zone?: string) => {
      setSeats((prev) =>
        prev.map((s) =>
          s.id === seatId ? { ...s, person: person || undefined, zone: zone ?? s.zone } : s
        )
      );
      setAssignSeatId(null);
      setLastChangeTime(Date.now());
    },
    []
  );

  const assignSeat = seats.find((s) => s.id === assignSeatId);

  // Sauvegarde automatique après modifications (création ou édition du plan)
  useEffect(() => {
    if (!currentPlanName || !lastChangeTime) return;
    const timeout = setTimeout(() => {
      void handleSave();
    }, 1500);
    return () => clearTimeout(timeout);
  }, [currentPlanName, lastChangeTime, handleSave]);

  /* ── Render ──────────────────────────────────────────── */

  if (!betaEnabled) {
    return (
      <PageGuard page="salle">
        <div className="flex h-full flex-col items-center justify-center bg-[#07070b] text-zinc-100 px-4">
          <div className="max-w-md text-center space-y-4">
            <div className="inline-flex items-center justify-center rounded-2xl bg-primary/15 px-4 py-2 text-xs font-medium text-primary">
              Fonctionnalité bêta désactivée
            </div>
            <h1 className="text-xl font-semibold text-white">
              Page plan de salle désactivée
            </h1>
            <p className="text-sm text-zinc-400">
              Cette page fait partie des fonctionnalités bêta. Vous pouvez
              l&apos;activer depuis les{" "}
              <Link href="/settings" className="text-primary hover:text-primary/80 underline underline-offset-4">
                paramètres
              </Link>
              .
            </p>
          </div>
        </div>
      </PageGuard>
    );
  }

  return (
    <PageGuard page="salle">
      <div className="flex h-full flex-col overflow-hidden bg-[#07070b] text-zinc-100">
        {/* Header */}
        <header className="shrink-0 border-b border-white/[0.06] bg-[#0a0a10]/90 backdrop-blur-xl">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/20">
                <LayoutGrid className="size-3.5 text-primary" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-white">
                Placement Salle
              </span>
            </div>

            {/* Plan selector */}
            <div className="flex items-center gap-1 ml-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-zinc-300 border border-white/10 bg-white/5"
                  >
                    {currentPlanName ?? "Aucun plan"}
                    <ChevronDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-56 border-white/10 bg-zinc-900/95 backdrop-blur-xl"
                >
                  <DropdownMenuLabel className="text-zinc-400">
                    Plans de salle
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  {plans.map((p) => (
                    <DropdownMenuItem
                      key={p.name}
                      onClick={() => switchPlan(p.name)}
                      className={
                        p.name === currentPlanName
                          ? "bg-primary/20 text-primary-foreground"
                          : "focus:bg-primary/20 focus:text-primary-foreground"
                      }
                    >
                      <LayoutGrid className="size-3.5 mr-2" />
                      {p.name}
                      <span className="ml-auto text-xs text-zinc-500">
                        {p.seats.length} place{p.seats.length !== 1 ? "s" : ""}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  {plans.length === 0 && (
                    <div className="px-2 py-3 text-center text-xs text-zinc-500">
                      Aucun plan existant
                    </div>
                  )}
                  {canEdit && (
                  <>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={() => setShowNewPlanModal(true)}
                    className="focus:bg-primary/20 focus:text-primary-foreground"
                  >
                    <Plus className="size-3.5 mr-2" />
                    Nouveau plan
                  </DropdownMenuItem>
                  </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              </div>

            {/* Delete plan button */}
            {currentPlanName && canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                title="Supprimer ce plan"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}

            <div className="flex-1" />

            {/* Status */}
            {currentPlanName && (
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>
                  {seats.length} place{seats.length !== 1 ? "s" : ""}
                  {selectedIds.size > 0 && (
                    <> &middot; {selectedIds.size} sélectionnée{selectedIds.size !== 1 ? "s" : ""}</>
                  )}
                </span>
                {saving && (
                  <span className="text-primary">
                    Sauvegarde en cours…
                  </span>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Error bar */}
        {error && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
            ⚠ {error}
          </div>
        )}

        {/* No plan selected */}
        {!currentPlanName && !loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                <LayoutGrid className="size-8 text-primary/80" />
              </div>
              <p className="text-zinc-400 font-medium">Aucun plan de salle</p>
              {canEdit ? (
                <>
                  <p className="mt-2 text-sm text-zinc-500 max-w-md">
                    Créez un nouveau plan pour commencer à placer les sièges.
                  </p>
                  <Button
                    onClick={() => setShowNewPlanModal(true)}
                    className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="size-4" />
                    Nouveau plan
                  </Button>
                </>
              ) : (
                <p className="mt-2 text-sm text-zinc-500 max-w-md">
                  Aucun plan disponible. Vous n'avez pas la permission d'en creer.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-zinc-500">Chargement des plans…</p>
            </div>
          </div>
        )}

        {/* Editor */}
        {currentPlanName && !loading && (
          <>
            <SalleToolbar
              activeTool={activeTool}
              snapEnabled={snapEnabled}
              zoom={zoom}
              onToolChange={setActiveTool}
              onToggleSnap={() => setSnapEnabled((s) => !s)}
              onDeleteSelected={handleDeleteSelected}
              onRotateSelected={handleRotateSelected}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onResetZoom={handleResetZoom}
              onResetView={handleResetView}
              onRefresh={loadPlans}
              loading={loading}
              hasSelection={selectedIds.size > 0}
              canEdit={canEdit}
            />

            <div className="flex flex-1 overflow-hidden">
              <SalleCanvas
                key={currentPlanName ?? "none"}
                seats={seats}
                zones={zones}
                selectedIds={selectedIds}
                activeTool={activeTool}
                zoom={zoom}
                snapEnabled={snapEnabled}
                gridSize={20}
                onSeatsChange={(nextSeats) => {
                  setSeats(nextSeats);
                  setLastChangeTime(Date.now());
                }}
                onSelectionChange={setSelectedIds}
                onSeatDoubleClick={handleSeatDoubleClick}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
              />

              <ZonePanel
                zones={zones}
                onAddZone={handleAddZone}
                onRemoveZone={handleRemoveZone}
                onRenameZone={handleRenameZone}
                onAssignZone={handleAssignZone}
                selectedSeatsCount={selectedIds.size}
                canEdit={canEdit}
              />
            </div>
          </>
        )}

        {/* Assign dialog */}
        {assignSeat && (
          <SeatAssignDialog
            seat={assignSeat}
            zones={zones}
            onClose={() => setAssignSeatId(null)}
            onSave={handleAssignSave}
          />
        )}

        {/* New plan modal */}
        {canEdit && (
          <NewPlanModal
            open={showNewPlanModal}
            onClose={() => setShowNewPlanModal(false)}
            onCreate={createNewPlan}
            existingPlanNames={plans.map((p) => p.name)}
          />
        )}

        {/* Delete plan confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-xl border border-red-500/20 bg-zinc-900 p-6 shadow-2xl mx-4">
              <h3 className="text-lg font-semibold text-white mb-2">
                Supprimer le plan
              </h3>
              <p className="text-sm text-zinc-400 mb-6">
                Etes-vous sur de vouloir supprimer le plan
                <span className="font-medium text-white"> &quot;{currentPlanName}&quot;</span> ?
                Toutes les places seront perdues.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                >
                  Annuler
                </Button>
                <Button
                  onClick={() => void handleDeletePlan()}
                  className="flex-1 bg-red-600 text-white hover:bg-red-500"
                >
                  <Trash2 className="size-4" />
                  Supprimer
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageGuard>
  );
}
