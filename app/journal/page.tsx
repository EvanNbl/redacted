"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ScrollText, RefreshCw, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchJournal, type JournalRow } from "@/lib/supabase-data";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/FadeIn";
import { PageGuard } from "@/components/PageGuard";

function formatRelativeTime(fetchedAt: number): string {
  const s = Math.floor((Date.now() - fetchedAt) / 1000);
  if (s < 60) return "À l'instant";
  if (s < 120) return "Il y a 1 min";
  if (s < 3600) return `Il y a ${Math.floor(s / 60)} min`;
  if (s < 7200) return "Il y a 1 h";
  return `Il y a ${Math.floor(s / 3600)} h`;
}

function ActionBadge({ action }: { action: string }) {
  const STYLES: Record<string, string> = {
    "Ajouté": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    "Créé": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    "Modifié": "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "Sauvegardé": "bg-blue-500/20 text-blue-400 border-blue-500/30",
    "Supprimé": "bg-red-500/20 text-red-400 border-red-500/30",
    "Connexion": "bg-violet-500/20 text-violet-400 border-violet-500/30",
    "Déconnexion": "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  };
  const style = STYLES[action] ?? "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {action}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function JournalPage() {
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setError(null);
      if (rows.length === 0) setLoading(true);
      else setRefreshing(true);
    }
    try {
      const data = await fetchJournal();
      if (!mounted.current) return;
      setRows(data);
      setLastFetchedAt(Date.now());
    } catch (e) {
      if (!mounted.current) return;
      if (!silent) {
        setError("Impossible de charger le journal.");
        setRows([]);
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [rows.length]);

  useEffect(() => {
    mounted.current = true;
    void load(false);
    return () => { mounted.current = false; };
  }, []);

  const displayRows = [...rows].reverse();
  const byDate = displayRows.reduce<Record<string, JournalRow[]>>((acc, r) => {
    const d = formatDate(r.created_at) || "Sans date";
    if (!acc[d]) acc[d] = [];
    acc[d].push(r);
    return acc;
  }, {});

  return (
    <PageGuard page="journal">
    <div className="flex h-full flex-col overflow-hidden bg-[#07070b] text-zinc-100">
      <header className="shrink-0 border-b border-white/[0.06] bg-[#0a0a10]/95 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-violet-600/20">
              <ScrollText className="size-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white tracking-tight">
                Journal des modifications
              </h1>
              {lastFetchedAt != null && rows.length > 0 && (
                <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                  <Calendar className="size-3" />
                  {formatRelativeTime(lastFetchedAt)}
                </p>
              )}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {rows.length > 0 && (
              <span className="hidden sm:inline text-xs text-zinc-500">
                {rows.length} entrée{rows.length !== 1 ? "s" : ""}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void load(false)}
              disabled={loading && rows.length === 0}
              className="h-8 px-2.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5"
            >
              {refreshing || (loading && rows.length > 0) ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              <span className="ml-1.5">Rafraîchir</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 max-w-6xl mx-auto">
        {error && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex items-start gap-3">
            <span className="shrink-0 mt-0.5">⚠</span>
            <p>{error}</p>
          </div>
        )}

        {loading && rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="size-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            <p className="text-sm text-zinc-500">Chargement du journal…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
            <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-violet-600/10 mb-4">
              <ScrollText className="size-7 text-violet-400/80" />
            </div>
            <p className="text-zinc-400 font-medium">Aucune entrée dans le journal</p>
            <p className="mt-2 text-sm text-zinc-500 max-w-md mx-auto">
              Les ajouts, modifications et suppressions de contacts seront enregistrés ici.
            </p>
          </div>
        ) : (
          <StaggerContainer staggerDelay={0.08} className="space-y-6">
            {Object.entries(byDate).map(([date, dateRows]) => (
              <StaggerItem key={date} className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-2 py-2">
                  <Calendar className="size-3.5" />
                  {date}
                </h2>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.04]">
                          <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wider w-20">
                            Heure
                          </th>
                          <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wider w-24">
                            Action
                          </th>
                          <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wider w-28">
                            Type
                          </th>
                          <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wider">
                            Pseudo
                          </th>
                          <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wider">
                            Utilisateur
                          </th>
                          <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wider min-w-[200px]">
                            Détails
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dateRows.map((r, i) => (
                          <tr
                            key={r.id ?? `${date}-${i}`}
                            className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors"
                          >
                            <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs">
                              {formatTime(r.created_at) || "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <ActionBadge action={r.action} />
                            </td>
                            <td className="px-4 py-2.5 text-zinc-400 capitalize">
                              {r.contact_type || "—"}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-white">
                              {r.pseudo || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-zinc-400 text-xs">
                              {r.user_email || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-zinc-500 text-xs leading-relaxed max-w-md">
                              {r.details ? (
                                <span className="whitespace-pre-wrap break-words">
                                  {r.details}
                                </span>
                              ) : (
                                <span className="text-zinc-600">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </main>
    </div>
    </PageGuard>
  );
}
