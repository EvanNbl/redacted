"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Users,
  Search,
  RefreshCw,
  Loader2,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import {
  fetchAllProfiles,
  updateUserRole,
  updateUserPermission,
  type ProfileWithPermissions,
} from "@/lib/admin-data";
import { appendJournalEntry } from "@/lib/supabase-data";
import { cn } from "@/lib/utils";

const PAGES = ["contacts", "salle", "journal"] as const;
const ROLES = ["admin", "editor", "viewer"] as const;

const ROLE_BADGES: Record<string, string> = {
  admin: "bg-red-500/20 text-red-400 border-red-500/30",
  editor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  viewer: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

function getInitials(name: string | null, email: string): string {
  if (name && name.trim()) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

export default function AdminPage() {
  const { profile: currentProfile } = useAuth();
  const [users, setUsers] = useState<ProfileWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllProfiles();
      setUsers(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isAdmin = currentProfile?.role === "admin";
  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center bg-[#07070b] text-zinc-100">
        <div className="text-center">
          <Shield className="mx-auto size-12 text-zinc-600 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acces restreint</h2>
          <p className="text-zinc-500">
            Seuls les administrateurs peuvent acceder a cette page.
          </p>
        </div>
      </div>
    );
  }

  const filtered = users.filter(
    (u) =>
      !search.trim() ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleRoleChange = async (
    userId: string,
    role: "admin" | "editor" | "viewer"
  ) => {
    await updateUserRole(userId, role);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role } : u))
    );
    const target = users.find((u) => u.id === userId);
    void appendJournalEntry("Modifié", "admin", {
      pseudo: target?.full_name ?? target?.email ?? userId,
      details: `Role changé en "${role}"`,
      userEmail: currentProfile?.email,
    });
  };

  const handlePermToggle = async (
    userId: string,
    page: string,
    field: "can_read" | "can_edit" | "can_delete",
    current: boolean
  ) => {
    await updateUserPermission(userId, page, field, !current);
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        return {
          ...u,
          permissions: u.permissions.map((p) =>
            p.page === page ? { ...p, [field]: !current } : p
          ),
        };
      })
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#07070b] text-zinc-100">
      <header className="shrink-0 border-b border-white/[0.06] bg-[#0a0a10]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-violet-600/20">
              <Shield className="size-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white tracking-tight">
                Administration
              </h1>
              <p className="text-[11px] text-zinc-500">
                Gestion des utilisateurs et permissions
              </p>
            </div>
          </div>

          <div className="flex-1" />

          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
            <Input
              type="search"
              placeholder="Rechercher un utilisateur…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-white/10 bg-white/5 pl-8 text-xs text-white placeholder:text-zinc-500 focus-visible:ring-violet-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs">
            <Users className="size-3.5 text-violet-400" />
            <span className="text-zinc-400">{users.length}</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            className="h-8 px-2.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {loading && users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="size-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            <p className="text-sm text-zinc-500">Chargement…</p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-2">
            {filtered.map((user) => {
              const initials = getInitials(user.full_name, user.email);
              const expanded = expandedIds.has(user.id);
              return (
                <div
                  key={user.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] transition-colors hover:bg-white/[0.04]"
                >
                  {/* User row - always visible */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => toggleExpanded(user.id)}
                      className="text-zinc-500 hover:text-white transition-colors"
                    >
                      <ChevronRight
                        className={cn(
                          "size-4 transition-transform duration-150",
                          expanded && "rotate-90"
                        )}
                      />
                    </button>

                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt=""
                        className="size-9 rounded-full object-cover ring-2 ring-white/10"
                      />
                    ) : (
                      <div className="size-9 rounded-full bg-violet-600/20 flex items-center justify-center text-sm font-semibold text-violet-300">
                        {initials}
                      </div>
                    )}

                    <button
                      onClick={() => toggleExpanded(user.id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="font-medium text-white truncate text-sm">
                        {user.full_name || user.email}
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {user.email}
                      </p>
                    </button>

                    {/* Permission summary pills */}
                    {!expanded && (
                      <div className="hidden sm:flex items-center gap-1">
                        {PAGES.map((page) => {
                          const perm = user.permissions.find((p) => p.page === page);
                          const hasAny = perm && (perm.can_read || perm.can_edit || perm.can_delete);
                          return (
                            <span
                              key={page}
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] capitalize border",
                                hasAny
                                  ? "border-violet-500/20 bg-violet-500/10 text-violet-400"
                                  : "border-white/5 bg-white/[0.02] text-zinc-600"
                              )}
                            >
                              {page}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium cursor-pointer transition-colors ${ROLE_BADGES[user.role]}`}
                        >
                          {user.role}
                          <ChevronDown className="size-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-36 border-white/10 bg-zinc-900/95 backdrop-blur-xl">
                        {ROLES.map((role) => (
                          <DropdownMenuItem
                            key={role}
                            onClick={() => handleRoleChange(user.id, role)}
                            className="focus:bg-violet-600/20 focus:text-violet-100 gap-2"
                          >
                            {user.role === role && (
                              <Check className="size-3.5" />
                            )}
                            <span className={user.role === role ? "" : "ml-5"}>
                              {role}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <span className="text-[11px] text-zinc-600 hidden md:inline">
                      {new Date(user.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>

                  {/* Collapsible permissions table */}
                  {expanded && (
                    <div className="border-t border-white/[0.06] px-4 pb-3 pt-2">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-white/[0.06]">
                              <th className="text-left px-3 py-2 font-medium text-zinc-500 uppercase tracking-wider w-32">
                                Page
                              </th>
                              <th className="px-3 py-2 font-medium text-zinc-500 uppercase tracking-wider text-center">
                                Lecture
                              </th>
                              <th className="px-3 py-2 font-medium text-zinc-500 uppercase tracking-wider text-center">
                                Modification
                              </th>
                              <th className="px-3 py-2 font-medium text-zinc-500 uppercase tracking-wider text-center">
                                Suppression
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {PAGES.map((page) => {
                              const perm = user.permissions.find(
                                (p) => p.page === page
                              ) ?? {
                                page,
                                can_read: false,
                                can_edit: false,
                                can_delete: false,
                              };
                              return (
                                <tr
                                  key={page}
                                  className="border-b border-white/[0.03] last:border-0"
                                >
                                  <td className="px-3 py-2 capitalize text-zinc-300">
                                    {page}
                                  </td>
                                  {(
                                    ["can_read", "can_edit", "can_delete"] as const
                                  ).map((field) => (
                                    <td key={field} className="px-3 py-2 text-center">
                                      <button
                                        onClick={() =>
                                          handlePermToggle(
                                            user.id,
                                            page,
                                            field,
                                            perm[field]
                                          )
                                        }
                                        className={`size-5 rounded border transition-colors ${
                                          perm[field]
                                            ? "bg-violet-600 border-violet-500 text-white"
                                            : "bg-white/5 border-white/10 text-transparent hover:border-white/20"
                                        } inline-flex items-center justify-center`}
                                      >
                                        <Check className="size-3" />
                                      </button>
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
