"use client";

import {
  MousePointer2,
  Plus,
  Rows3,
  CircleDot,
  Trash2,
  ZoomIn,
  ZoomOut,
  Save,
  RefreshCw,
  RotateCw,
  Grid3X3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SalleTool = "select" | "addSingle" | "addLine" | "addArc";

interface SalleToolbarProps {
  activeTool: SalleTool;
  snapEnabled: boolean;
  onToolChange: (tool: SalleTool) => void;
  onToggleSnap: () => void;
  onDeleteSelected: () => void;
  onRotateSelected: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSave: () => void;
  onRefresh: () => void;
  saving: boolean;
  loading: boolean;
  hasSelection: boolean;
  canEdit?: boolean;
}

const TOOLS: { id: SalleTool; label: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "Selectionner", icon: MousePointer2 },
  { id: "addSingle", label: "Ajouter une place", icon: Plus },
  { id: "addLine", label: "Ajouter en ligne", icon: Rows3 },
  { id: "addArc", label: "Ajouter en arc", icon: CircleDot },
];

export function SalleToolbar({
  activeTool,
  snapEnabled,
  onToolChange,
  onToggleSnap,
  onDeleteSelected,
  onRotateSelected,
  onZoomIn,
  onZoomOut,
  onSave,
  onRefresh,
  saving,
  loading,
  hasSelection,
  canEdit = true,
}: SalleToolbarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-white/[0.06] bg-[#0a0a10]/90 px-3 py-1.5 backdrop-blur-xl">
      {/* Drawing tools */}
      {canEdit && (
      <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 p-0.5">
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onToolChange(id)}
            title={label}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              activeTool === id
                ? "bg-violet-600 text-white"
                : "text-zinc-400 hover:text-white hover:bg-white/10"
            )}
          >
            <Icon className="size-3.5" />
            <span className="hidden lg:inline">{label}</span>
          </button>
        ))}
      </div>
      )}

      {canEdit && <div className="mx-1 h-5 w-px bg-white/10" />}

      {/* Selection actions */}
      {canEdit && (
      <>
      <Button
        variant="ghost"
        size="xs"
        onClick={onRotateSelected}
        disabled={!hasSelection}
        title="Rotation +15deg"
        className="text-zinc-400 hover:text-white disabled:opacity-30"
      >
        <RotateCw className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="xs"
        onClick={onDeleteSelected}
        disabled={!hasSelection}
        title="Supprimer la selection"
        className="text-zinc-400 hover:text-red-400 disabled:opacity-30"
      >
        <Trash2 className="size-3.5" />
      </Button>
      </>
      )}

      <div className="mx-1 h-5 w-px bg-white/10" />

      {/* Snap grid toggle */}
      <Button
        variant="ghost"
        size="xs"
        onClick={onToggleSnap}
        title={snapEnabled ? "Desactiver la grille" : "Activer la grille"}
        className={cn(
          "gap-1.5",
          snapEnabled
            ? "text-violet-400 bg-violet-600/20"
            : "text-zinc-400 hover:text-white"
        )}
      >
        <Grid3X3 className="size-3.5" />
        <span className="hidden lg:inline text-xs">Grille</span>
      </Button>

      <div className="mx-1 h-5 w-px bg-white/10" />

      {/* Zoom */}
      <Button
        variant="ghost"
        size="xs"
        onClick={onZoomOut}
        title="Dezoomer"
        className="text-zinc-400 hover:text-white"
      >
        <ZoomOut className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="xs"
        onClick={onZoomIn}
        title="Zoomer"
        className="text-zinc-400 hover:text-white"
      >
        <ZoomIn className="size-3.5" />
      </Button>

      <div className="flex-1" />

      {/* Save / Refresh */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={loading}
        className="h-7 text-xs text-zinc-400 hover:text-white"
      >
        <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        <span className="hidden sm:inline ml-1">Rafraichir</span>
      </Button>
      {canEdit && (
      <Button
        size="sm"
        onClick={onSave}
        disabled={saving}
        className="h-7 bg-violet-600 text-xs text-white hover:bg-violet-500"
      >
        <Save className={cn("size-3.5", saving && "animate-pulse")} />
        <span className="ml-1">{saving ? "Sauvegarde…" : "Sauvegarder"}</span>
      </Button>
      )}
    </div>
  );
}
