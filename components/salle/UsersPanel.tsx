"use client";

import { useState, useRef, useCallback } from "react";
import {
  Users,
  UserPlus,
  Upload,
  Wand2,
  UserX,
  X,
  Search,
  ChevronRight,
  CircleUser,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SalleUser, Seat } from "@/lib/salle-types";
import { generateSeatId } from "@/lib/salle-types";
import { cn } from "@/lib/utils";

interface UsersPanelProps {
  users: SalleUser[];
  seats: Seat[];
  selectedSeatIds: Set<string>;
  onUsersChange: (users: SalleUser[]) => void;
  onSeatsChange: (seats: Seat[]) => void;
  canEdit?: boolean;
}

function generateUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  VIP: "#8b5cf6",
  Standard: "#3b82f6",
  Staff: "#10b981",
  Presse: "#f59e0b",
  Réservé: "#ef4444",
};

function getCategoryColor(cat?: string): string {
  if (!cat) return "#52525b";
  return CATEGORY_COLORS[cat] ?? "#52525b";
}

export function UsersPanel({
  users,
  seats,
  selectedSeatIds,
  onUsersChange,
  onSeatsChange,
  canEdit = true,
}: UsersPanelProps) {
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.category ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const unassignedCount = users.filter((u) => !u.assignedSeatId).length;
  const assignedCount = users.filter((u) => u.assignedSeatId).length;

  // --- Assign a user to the currently selected seat ---
  const handleAssignUser = useCallback(
    (userId: string) => {
      if (selectedSeatIds.size !== 1) return;
      const seatId = [...selectedSeatIds][0];
      const user = users.find((u) => u.id === userId);
      if (!user) return;

      // Unassign any user already on this seat
      const updatedUsers = users.map((u) => {
        if (u.assignedSeatId === seatId) return { ...u, assignedSeatId: undefined };
        if (u.id === userId) return { ...u, assignedSeatId: seatId };
        return u;
      });
      onUsersChange(updatedUsers);

      // Update seat person field
      const seat = seats.find((s) => s.id === seatId);
      onSeatsChange(
        seats.map((s) =>
          s.id === seatId
            ? { ...s, person: user.name }
            : s
        )
      );
      void seat;
    },
    [users, seats, selectedSeatIds, onUsersChange, onSeatsChange]
  );

  // --- Unassign a user ---
  const handleUnassignUser = useCallback(
    (userId: string) => {
      const user = users.find((u) => u.id === userId);
      if (!user?.assignedSeatId) return;
      const seatId = user.assignedSeatId;
      onUsersChange(users.map((u) => u.id === userId ? { ...u, assignedSeatId: undefined } : u));
      onSeatsChange(seats.map((s) => s.id === seatId ? { ...s, person: undefined } : s));
    },
    [users, seats, onUsersChange, onSeatsChange]
  );

  // --- Remove a user entirely ---
  const handleRemoveUser = useCallback(
    (userId: string) => {
      const user = users.find((u) => u.id === userId);
      if (user?.assignedSeatId) {
        onSeatsChange(seats.map((s) => s.id === user.assignedSeatId ? { ...s, person: undefined } : s));
      }
      onUsersChange(users.filter((u) => u.id !== userId));
    },
    [users, seats, onUsersChange, onSeatsChange]
  );

  // --- Add user manually ---
  const handleAddUser = useCallback(() => {
    if (!newName.trim()) return;
    const user: SalleUser = {
      id: generateUserId(),
      name: newName.trim(),
      category: newCategory.trim() || undefined,
    };
    onUsersChange([...users, user]);
    setNewName("");
    setNewCategory("");
    setShowAddForm(false);
  }, [newName, newCategory, users, onUsersChange]);

  // --- Import CSV ---
  const handleImportCsv = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const newUsers: SalleUser[] = [];
        // Skip header if first line looks like a header
        const startIdx =
          lines[0]?.toLowerCase().includes("nom") ? 1 : 0;
        for (let i = startIdx; i < lines.length; i++) {
          const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
          const name = parts[0];
          const category = parts[1];
          if (name) {
            newUsers.push({
              id: generateUserId(),
              name,
              category: category || undefined,
            });
          }
        }
        if (newUsers.length > 0) {
          onUsersChange([...users, ...newUsers]);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [users, onUsersChange]
  );

  // --- Auto-assign: assign unassigned users to empty seats ---
  const handleAutoAssign = useCallback(() => {
    const emptySeats = seats.filter((s) => !s.person);
    const unassignedUsers = users.filter((u) => !u.assignedSeatId);
    if (emptySeats.length === 0 || unassignedUsers.length === 0) return;

    const count = Math.min(emptySeats.length, unassignedUsers.length);
    const updatedSeats = [...seats];
    const updatedUsers = [...users];

    for (let i = 0; i < count; i++) {
      const seatIdx = updatedSeats.findIndex((s) => !s.person);
      const userIdx = updatedUsers.findIndex((u) => !u.assignedSeatId);
      if (seatIdx === -1 || userIdx === -1) break;
      updatedSeats[seatIdx] = { ...updatedSeats[seatIdx], person: updatedUsers[userIdx].name };
      updatedUsers[userIdx] = { ...updatedUsers[userIdx], assignedSeatId: updatedSeats[seatIdx].id };
    }

    onSeatsChange(updatedSeats);
    onUsersChange(updatedUsers);
  }, [seats, users, onSeatsChange, onUsersChange]);

  // --- Unassign all ---
  const handleUnassignAll = useCallback(() => {
    onUsersChange(users.map((u) => ({ ...u, assignedSeatId: undefined })));
    onSeatsChange(seats.map((s) => ({ ...s, person: undefined })));
  }, [users, seats, onUsersChange, onSeatsChange]);

  const selectedOneSeat = selectedSeatIds.size === 1;

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-l border-white/[0.06] bg-[#0a0a10]/80 px-1.5 py-3 w-9">
        <button
          onClick={() => setCollapsed(false)}
          className="text-zinc-500 hover:text-white transition-colors"
          title="Ouvrir le panel utilisateurs"
        >
          <Users className="size-4" />
        </button>
        <div className="text-[9px] font-mono text-zinc-600 [writing-mode:vertical-lr] rotate-180">
          {users.length} utilisateurs
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-64 shrink-0 border-l border-white/[0.06] bg-[#0a0a10]/80 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <Users className="size-3.5 text-primary" />
          <span className="text-xs font-semibold text-white">Utilisateurs</span>
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-zinc-400 font-mono">
            {users.length}
          </span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-zinc-600 hover:text-white transition-colors"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      {/* Stats */}
      {users.length > 0 && (
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-3 py-1.5 shrink-0">
          <span className="text-[10px] text-zinc-500">
            <span className="text-emerald-400 font-medium">{assignedCount}</span> assignés
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-[10px] text-zinc-500">
            <span className="text-amber-400 font-medium">{unassignedCount}</span> libres
          </span>
        </div>
      )}

      {/* Actions */}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.04] px-2 py-1.5 shrink-0">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowAddForm((v) => !v)}
            className="text-zinc-400 hover:text-white gap-1 text-[10px] h-6"
          >
            <UserPlus className="size-3" />
            Ajouter
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => fileInputRef.current?.click()}
            className="text-zinc-400 hover:text-white gap-1 text-[10px] h-6"
          >
            <Upload className="size-3" />
            CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleImportCsv}
          />
          {users.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="xs"
                onClick={handleAutoAssign}
                className="text-zinc-400 hover:text-primary gap-1 text-[10px] h-6"
                title="Assigner automatiquement les utilisateurs aux places libres"
              >
                <Wand2 className="size-3" />
                Auto
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={handleUnassignAll}
                className="text-zinc-400 hover:text-red-400 gap-1 text-[10px] h-6"
                title="Désassigner tous les utilisateurs"
              >
                <UserX className="size-3" />
                Reset
              </Button>
            </>
          )}
        </div>
      )}

      {/* Add form */}
      {showAddForm && canEdit && (
        <div className="border-b border-white/[0.06] px-3 py-2 space-y-2 shrink-0 bg-white/[0.02]">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom complet…"
            className="h-7 text-xs bg-white/5 border-white/10 text-white placeholder:text-zinc-600"
            onKeyDown={(e) => { if (e.key === "Enter") handleAddUser(); if (e.key === "Escape") setShowAddForm(false); }}
            autoFocus
          />
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Catégorie (ex: VIP)…"
            className="h-7 text-xs bg-white/5 border-white/10 text-white placeholder:text-zinc-600"
            onKeyDown={(e) => { if (e.key === "Enter") handleAddUser(); }}
          />
          <div className="flex gap-1.5">
            <Button
              size="xs"
              onClick={handleAddUser}
              disabled={!newName.trim()}
              className="flex-1 h-6 text-[10px] bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Ajouter
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => { setShowAddForm(false); setNewName(""); setNewCategory(""); }}
              className="h-6 text-[10px] text-zinc-500"
            >
              <X className="size-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      {users.length > 0 && (
        <div className="px-2 py-1.5 shrink-0 border-b border-white/[0.04]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-zinc-600" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="h-6 pl-6 text-[10px] bg-white/5 border-white/10 text-white placeholder:text-zinc-600"
            />
          </div>
        </div>
      )}

      {/* User list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4 py-8 text-center">
            <CircleUser className="size-8 text-zinc-700" />
            <p className="text-xs text-zinc-500">Aucun utilisateur</p>
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              Importez un fichier CSV ou ajoutez des utilisateurs manuellement.
            </p>
            {canEdit && (
              <div className="text-[9px] text-zinc-700 font-mono bg-white/5 rounded p-2 text-left w-full">
                <div className="text-zinc-500 mb-1">Format CSV :</div>
                <div>nom,categorie</div>
                <div>Alice,VIP</div>
                <div>Bob,Standard</div>
              </div>
            )}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-6 text-center text-xs text-zinc-600">
            Aucun résultat pour &quot;{search}&quot;
          </div>
        ) : (
          <div className="py-1">
            {filteredUsers.map((user) => {
              const isAssigned = !!user.assignedSeatId;
              const assignedSeat = isAssigned ? seats.find((s) => s.id === user.assignedSeatId) : null;
              const canAssign = selectedOneSeat && canEdit;

              return (
                <div
                  key={user.id}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.04] transition-colors",
                    canAssign && !isAssigned && "cursor-pointer"
                  )}
                  onClick={() => {
                    if (canAssign && !isAssigned) handleAssignUser(user.id);
                  }}
                  title={canAssign && !isAssigned ? "Cliquer pour assigner à la place sélectionnée" : undefined}
                >
                  {/* Color dot */}
                  <div
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: getCategoryColor(user.category) }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-zinc-200 truncate leading-none">
                      {user.name}
                    </div>
                    {(user.category || isAssigned) && (
                      <div className="flex items-center gap-1 mt-0.5">
                        {user.category && (
                          <span className="text-[9px] text-zinc-500 truncate">{user.category}</span>
                        )}
                        {isAssigned && user.category && (
                          <span className="text-zinc-700">·</span>
                        )}
                        {isAssigned && (
                          <span className="text-[9px] text-emerald-500 truncate">
                            {assignedSeat?.label ?? assignedSeat?.id?.slice(-4) ?? "assigné"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isAssigned && canEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUnassignUser(user.id); }}
                        className="rounded p-0.5 text-zinc-600 hover:text-amber-400 hover:bg-white/5 transition-colors"
                        title="Désassigner"
                      >
                        <UserX className="size-3" />
                      </button>
                    )}
                    {!isAssigned && canAssign && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAssignUser(user.id); }}
                        className="rounded p-0.5 text-zinc-600 hover:text-primary hover:bg-white/5 transition-colors"
                        title="Assigner à la place sélectionnée"
                      >
                        <ChevronRight className="size-3" />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveUser(user.id); }}
                        className="rounded p-0.5 text-zinc-600 hover:text-red-400 hover:bg-white/5 transition-colors"
                        title="Supprimer"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      {canEdit && selectedOneSeat && users.some((u) => !u.assignedSeatId) && (
        <div className="border-t border-white/[0.04] px-3 py-2 shrink-0">
          <p className="text-[10px] text-zinc-600 text-center">
            Cliquer sur un utilisateur libre pour l&apos;assigner à la place sélectionnée
          </p>
        </div>
      )}
    </div>
  );
}
