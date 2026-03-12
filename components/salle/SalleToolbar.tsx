"use client";

import {
  MousePointer2,
  Plus,
  Rows3,
  CircleDot,
  Trash2,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  RotateCw,
  Grid3X3,
  Crosshair,
  HelpCircle,
  Download,
  Users,
  FileJson,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type SalleTool = "select" | "addSingle" | "addLine" | "addArc";

interface SalleToolbarProps {
  activeTool: SalleTool;
  snapEnabled: boolean;
  zoom: number;
  showUsersPanel: boolean;
  onToolChange: (tool: SalleTool) => void;
  onToggleSnap: () => void;
  onDeleteSelected: () => void;
  onRotateSelected: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onResetView: () => void;
  onRefresh: () => void;
  onSelectAll: () => void;
  onToggleUsersPanel: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  loading: boolean;
  hasSelection: boolean;
  canEdit?: boolean;
}

interface ToolDef {
  id: SalleTool;
  label: string;
  icon: typeof MousePointer2;
  shortcut: string;
  hint: string;
}

const TOOLS: ToolDef[] = [
  {
    id: "select",
    label: "Sélection",
    icon: MousePointer2,
    shortcut: "S",
    hint: "Cliquer pour sélectionner · Glisser sur le fond pour sélection zone",
  },
  {
    id: "addSingle",
    label: "Ajouter",
    icon: Plus,
    shortcut: "A",
    hint: "Cliquer sur le canvas pour placer une place",
  },
  {
    id: "addLine",
    label: "Rangée",
    icon: Rows3,
    shortcut: "L",
    hint: "Glisser pour créer une rangée · Maj pour forcer H/V",
  },
  {
    id: "addArc",
    label: "Arc",
    icon: CircleDot,
    shortcut: "R",
    hint: "Glisser depuis le centre pour créer un arc de cercle",
  },
];

export function SalleToolbar({
  activeTool,
  snapEnabled,
  zoom,
  showUsersPanel,
  onToolChange,
  onToggleSnap,
  onDeleteSelected,
  onRotateSelected,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onResetView,
  onRefresh,
  onSelectAll,
  onToggleUsersPanel,
  onExportCsv,
  onExportJson,
  loading,
  hasSelection,
  canEdit = true,
}: SalleToolbarProps) {
  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex items-center gap-1 border-b border-white/[0.06] bg-[#0a0a10]/90 px-3 py-1.5 backdrop-blur-xl overflow-x-auto shrink-0">

        {/* Drawing tools */}
        {canEdit && (
          <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 p-0.5 shrink-0">
            {TOOLS.map(({ id, label, icon: Icon, shortcut, hint }) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onToolChange(id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      activeTool === id
                        ? "bg-primary text-primary-foreground"
                        : "text-zinc-400 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span>{label}</span>
                    <kbd className={cn(
                      "ml-0.5 rounded px-1 py-0.5 text-[9px] font-mono leading-none",
                      activeTool === id
                        ? "bg-primary-foreground/20 text-primary-foreground/70"
                        : "bg-white/10 text-zinc-500"
                    )}>
                      {shortcut}
                    </kbd>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px] text-center text-xs">
                  <p className="font-medium">{label}</p>
                  <p className="text-zinc-400 mt-0.5">{hint}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}

        {canEdit && <div className="mx-1 h-5 w-px bg-white/10 shrink-0" />}

        {/* Selection actions */}
        {canEdit && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={onSelectAll}
                  className="shrink-0 text-zinc-400 hover:text-white gap-1"
                >
                  <MousePointer2 className="size-3.5" />
                  <span className="text-xs">Tout</span>
                  <kbd className="ml-0.5 rounded bg-white/10 px-1 py-0.5 text-[9px] font-mono text-zinc-500">Ctrl+A</kbd>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Tout sélectionner <kbd className="ml-1 rounded bg-white/10 px-1 py-0.5 font-mono text-[9px]">Ctrl+A</kbd>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={onRotateSelected}
                  disabled={!hasSelection}
                  className="shrink-0 text-zinc-400 hover:text-white disabled:opacity-30 gap-1"
                >
                  <RotateCw className="size-3.5" />
                  <span className="text-xs">+15°</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Rotation +15°
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={onDeleteSelected}
                  disabled={!hasSelection}
                  className="shrink-0 text-zinc-400 hover:text-red-400 disabled:opacity-30 gap-1"
                >
                  <Trash2 className="size-3.5" />
                  <span className="text-xs">Suppr.</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Supprimer la sélection <kbd className="ml-1 rounded bg-white/10 px-1 py-0.5 font-mono text-[9px]">Del</kbd>
              </TooltipContent>
            </Tooltip>
          </>
        )}

        <div className="mx-1 h-5 w-px bg-white/10 shrink-0" />

        {/* Snap grid toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              onClick={onToggleSnap}
              className={cn(
                "shrink-0 gap-1.5",
                snapEnabled
                  ? "text-primary bg-primary/20"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <Grid3X3 className="size-3.5" />
              <span className="text-xs">Grille</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {snapEnabled ? "Désactiver" : "Activer"} l&apos;alignement sur la grille
          </TooltipContent>
        </Tooltip>

        <div className="mx-1 h-5 w-px bg-white/10 shrink-0" />

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                onClick={onZoomOut}
                className="text-zinc-400 hover:text-white"
              >
                <ZoomOut className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Dézoomer <kbd className="ml-1 rounded bg-white/10 px-1 py-0.5 font-mono text-[9px]">−</kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onResetZoom}
                className="min-w-[46px] rounded-md px-2 py-1 text-center text-xs font-mono text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                {Math.round(zoom * 100)}%
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Réinitialiser le zoom (100%)
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                onClick={onZoomIn}
                className="text-zinc-400 hover:text-white"
              >
                <ZoomIn className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Zoomer <kbd className="ml-1 rounded bg-white/10 px-1 py-0.5 font-mono text-[9px]">+</kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                onClick={onResetView}
                className="text-zinc-400 hover:text-white"
              >
                <Crosshair className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Centrer la vue sur les sièges
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex-1" />

        {/* Users panel toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              onClick={onToggleUsersPanel}
              className={cn(
                "shrink-0 gap-1.5",
                showUsersPanel
                  ? "text-primary bg-primary/20"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <Users className="size-3.5" />
              <span className="text-xs">Utilisateurs</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {showUsersPanel ? "Masquer" : "Afficher"} le panel utilisateurs
          </TooltipContent>
        </Tooltip>

        {/* Export */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  className="shrink-0 text-zinc-400 hover:text-white gap-1.5"
                >
                  <Download className="size-3.5" />
                  <span className="text-xs">Exporter</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Exporter le plan de salle
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align="end"
            className="w-44 border-white/10 bg-zinc-900/95 backdrop-blur-xl"
          >
            <DropdownMenuItem
              onClick={onExportCsv}
              className="gap-2 text-xs focus:bg-primary/20"
            >
              <FileText className="size-3.5 text-emerald-400" />
              Exporter en CSV
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={onExportJson}
              className="gap-2 text-xs focus:bg-primary/20"
            >
              <FileJson className="size-3.5 text-blue-400" />
              Exporter en JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Keyboard shortcuts help */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              className="shrink-0 text-zinc-500 hover:text-zinc-300"
            >
              <HelpCircle className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" className="text-xs w-60">
            <p className="font-semibold mb-2 text-white">Raccourcis clavier</p>
            <div className="space-y-1 text-zinc-400">
              <div className="flex justify-between"><span>Sélection</span><kbd className="rounded bg-white/10 px-1 font-mono text-[9px]">S</kbd></div>
              <div className="flex justify-between"><span>Ajouter une place</span><kbd className="rounded bg-white/10 px-1 font-mono text-[9px]">A</kbd></div>
              <div className="flex justify-between"><span>Rangée</span><kbd className="rounded bg-white/10 px-1 font-mono text-[9px]">L</kbd></div>
              <div className="flex justify-between"><span>Arc</span><kbd className="rounded bg-white/10 px-1 font-mono text-[9px]">R</kbd></div>
              <div className="flex justify-between"><span>Tout sélectionner</span><kbd className="rounded bg-white/10 px-1 font-mono text-[9px]">Ctrl+A</kbd></div>
              <div className="flex justify-between"><span>Supprimer</span><kbd className="rounded bg-white/10 px-1 font-mono text-[9px]">Del</kbd></div>
              <div className="flex justify-between"><span>Désélectionner</span><kbd className="rounded bg-white/10 px-1 font-mono text-[9px]">Esc</kbd></div>
              <div className="flex justify-between"><span>Zoom +/−</span><kbd className="rounded bg-white/10 px-1 font-mono text-[9px]">+ / −</kbd></div>
              <div className="flex justify-between"><span>Zoom souris</span><kbd className="rounded bg-white/10 px-1 font-mono text-[9px]">Molette</kbd></div>
              <div className="flex justify-between"><span>Pan</span><kbd className="rounded bg-white/10 px-1 font-mono text-[9px]">Espace + drag</kbd></div>
              <div className="flex justify-between"><span>Pan souris</span><kbd className="rounded bg-white/10 px-1 font-mono text-[9px]">Clic molette</kbd></div>
              <div className="flex justify-between"><span>Rangée droite</span><kbd className="rounded bg-white/10 px-1 font-mono text-[9px]">Maj + drag</kbd></div>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Refresh */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="h-7 shrink-0 text-xs text-zinc-400 hover:text-white"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          <span className="ml-1">Rafraîchir</span>
        </Button>
      </div>
    </TooltipProvider>
  );
}
