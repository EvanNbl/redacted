"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { LayoutGrid, Plus, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { fetchSallePlans, saveSallePlan, deleteSallePlan, appendJournalEntry } from "@/lib/supabase-data";
import type { SallePlan, Seat, Zone } from "@/lib/salle-types";
import { PRESET_COLORS } from "@/lib/salle-types";
import { useAuth } from "@/lib/auth-context";
import { PageGuard } from "@/components/PageGuard";
import { usePermission } from "@/hooks/usePermission";

export default function SallePage() {
  const { profile } = useAuth();
  const { canEdit, canDelete } = usePermission("salle");
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
  const [showNewPlanInput, setShowNewPlanInput] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const mounted = useRef(true);

  const currentPlan = plans.find((p) => p.name === currentPlanName);

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

  const createNewPlan = useCallback(() => {
    const trimmed = newPlanName.trim();
    if (!trimmed || plans.some((p) => p.name === trimmed)) return;
    const newPlan: SallePlan = { name: trimmed, zones: [], seats: [] };
    setPlans((prev) => [...prev, newPlan]);
    setCurrentPlanName(trimmed);
    setSeats([]);
    setZones([]);
    setSelectedIds(new Set());
    setShowNewPlanInput(false);
    setNewPlanName("");
    void appendJournalEntry("Créé", "salle", {
      pseudo: trimmed,
      details: `Nouveau plan de salle "${trimmed}"`,
      userEmail: profile?.email,
    });
  }, [newPlanName, plans, profile]);

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
      if (e.key === "Delete" || e.key === "Backspace") {
        if (document.activeElement?.tagName === "INPUT") return;
        if (selectedIds.size > 0) {
          setSeats((prev) => prev.filter((s) => !selectedIds.has(s.id)));
          setSelectedIds(new Set());
        }
      }
      if (e.key === "Escape") {
        setSelectedIds(new Set());
        setActiveTool("select");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds]);

  /* ── Actions ─────────────────────────────────────────── */

  const handleDeleteSelected = useCallback(() => {
    setSeats((prev) => prev.filter((s) => !selectedIds.has(s.id)));
    setSelectedIds(new Set());
  }, [selectedIds]);

  const handleRotateSelected = useCallback(() => {
    setSeats((prev) =>
      prev.map((s) =>
        selectedIds.has(s.id) ? { ...s, rotation: (s.rotation + 15) % 360 } : s
      )
    );
  }, [selectedIds]);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(3, z + 0.15)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(0.2, z - 0.15)), []);

  /* ── Zones ───────────────────────────────────────────── */

  const handleAddZone = useCallback((zone: Zone) => {
    setZones((prev) => [...prev, zone]);
  }, []);

  const handleRemoveZone = useCallback((name: string) => {
    setZones((prev) => prev.filter((z) => z.name !== name));
    setSeats((prev) =>
      prev.map((s) => (s.zone === name ? { ...s, zone: undefined } : s))
    );
  }, []);

  const handleRenameZone = useCallback((oldName: string, newName: string) => {
    setZones((prev) =>
      prev.map((z) => (z.name === oldName ? { ...z, name: newName } : z))
    );
    setSeats((prev) =>
      prev.map((s) => (s.zone === oldName ? { ...s, zone: newName } : s))
    );
  }, []);

  const handleAssignZone = useCallback(
    (zoneName: string) => {
      setSeats((prev) =>
        prev.map((s) => (selectedIds.has(s.id) ? { ...s, zone: zoneName } : s))
      );
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
    },
    []
  );

  const assignSeat = seats.find((s) => s.id === assignSeatId);

  /* ── Render ──────────────────────────────────────────── */

  return (
    <PageGuard page="salle">
      <div className="flex h-full flex-col overflow-hidden bg-[#07070b] text-zinc-100">
        {/* Header */}
        <header className="shrink-0 border-b border-white/[0.06] bg-[#0a0a10]/90 backdrop-blur-xl">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-violet-600/20">
                <LayoutGrid className="size-3.5 text-violet-400" />
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
                          ? "bg-violet-600/20 text-violet-200"
                          : "focus:bg-violet-600/20 focus:text-violet-100"
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
                    onClick={() => setShowNewPlanInput(true)}
                    className="focus:bg-violet-600/20 focus:text-violet-100"
                  >
                    <Plus className="size-3.5 mr-2" />
                    Nouveau plan
                  </DropdownMenuItem>
                  </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {showNewPlanInput && canEdit && (
                <form
                  className="flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    createNewPlan();
                  }}
                >
                  <Input
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    placeholder="Nom du plan…"
                    className="h-7 w-40 text-xs bg-white/5 border-white/10 text-white"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    size="xs"
                    disabled={!newPlanName.trim()}
                    className="bg-violet-600 text-white hover:bg-violet-500"
                  >
                    Créer
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setShowNewPlanInput(false);
                      setNewPlanName("");
                    }}
                    className="text-zinc-500"
                  >
                    ✕
                  </Button>
                </form>
              )}
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
              <span className="text-xs text-zinc-500">
                {seats.length} place{seats.length !== 1 ? "s" : ""}
                {selectedIds.size > 0 && (
                  <> &middot; {selectedIds.size} sélectionnée{selectedIds.size !== 1 ? "s" : ""}</>
                )}
              </span>
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
              <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-violet-600/10 mb-4">
                <LayoutGrid className="size-8 text-violet-400/80" />
              </div>
              <p className="text-zinc-400 font-medium">Aucun plan de salle</p>
              {canEdit ? (
                <>
                  <p className="mt-2 text-sm text-zinc-500 max-w-md">
                    Créez un nouveau plan pour commencer à placer les sièges.
                  </p>
                  <Button
                    onClick={() => setShowNewPlanInput(true)}
                    className="mt-4 bg-violet-600 text-white hover:bg-violet-500"
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
              <div className="size-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
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
              onToolChange={setActiveTool}
              onToggleSnap={() => setSnapEnabled((s) => !s)}
              onDeleteSelected={handleDeleteSelected}
              onRotateSelected={handleRotateSelected}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onSave={handleSave}
              onRefresh={loadPlans}
              saving={saving}
              loading={loading}
              hasSelection={selectedIds.size > 0}
              canEdit={canEdit}
            />

            <div className="flex flex-1 overflow-hidden">
              <SalleCanvas
                seats={seats}
                zones={zones}
                selectedIds={selectedIds}
                activeTool={activeTool}
                zoom={zoom}
                snapEnabled={snapEnabled}
                gridSize={20}
                onSeatsChange={setSeats}
                onSelectionChange={setSelectedIds}
                onSeatDoubleClick={handleSeatDoubleClick}
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
