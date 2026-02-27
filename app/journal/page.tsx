"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ScrollText, RefreshCw, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { devLog, devWarn } from "@/lib/console-banner";

const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SPREADSHEET_ID;
const SHEET_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY;
const JOURNAL_RANGE =
  process.env.NEXT_PUBLIC_GOOGLE_SHEETS_JOURNAL_RANGE ?? "Journal!A1:G500";

const JOURNAL_CACHE_KEY = "journal-cache";
const JOURNAL_CACHE_TTL_MS = 2 * 60 * 1000; // 2 min

export type JournalRow = {
  date: string;
  time: string;
  action: string;
  typeContact: string;
  ligneId: string;
  pseudo: string;
  details: string;
};

function parseJournalValues(values: string[][]): JournalRow[] {
  if (!values?.length) return [];
  const [_, ...rows] = values;
  return rows.map((row) => ({
    date: row[0] ?? "",
    time: row[1] ?? "",
    action: row[2] ?? "",
    typeContact: row[3] ?? "",
    ligneId: row[4] ?? "",
    pseudo: row[5] ?? "",
    details: row[6] ?? "",
  }));
}

function getCachedJournal(): { rows: JournalRow[]; fetchedAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(JOURNAL_CACHE_KEY);
    if (!raw) return null;
    const { rows, fetchedAt } = JSON.parse(raw) as {
      rows: JournalRow[];
      fetchedAt: number;
    };
    if (!Array.isArray(rows) || !fetchedAt) return null;
    if (Date.now() - fetchedAt > JOURNAL_CACHE_TTL_MS) return null;
    return { rows, fetchedAt };
  } catch {
    return null;
  }
}

function setCachedJournal(rows: JournalRow[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      JOURNAL_CACHE_KEY,
      JSON.stringify({ rows, fetchedAt: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

function formatRelativeTime(fetchedAt: number): string {
  const s = Math.floor((Date.now() - fetchedAt) / 1000);
  if (s < 60) return "À l'instant";
  if (s < 120) return "Il y a 1 min";
  if (s < 3600) return `Il y a ${Math.floor(s / 60)} min`;
  if (s < 7200) return "Il y a 1 h";
  return `Il y a ${Math.floor(s / 3600)} h`;
}

function ActionBadge({ action }: { action: string }) {
  const style =
    action === "Ajouté"
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : action === "Modifié"
        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
        : "bg-red-500/20 text-red-400 border-red-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {action}
    </span>
  );
}

export default function JournalPage() {
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!SHEET_ID || !SHEET_API_KEY) {
      devLog("Journal page", "Config manquante");
      setError("Configuration Google Sheets manquante.");
      setLoading(false);
      return;
    }
    const sheetName = (JOURNAL_RANGE.match(/^([^!]+)!/)?.[1] ?? "Journal").replace(
      /^'|'$/g,
      ""
    );
    if (!silent) {
      setError(null);
      if (rows.length === 0) setLoading(true);
      else setRefreshing(true);
    }
    try {
      const params = new URLSearchParams({ key: SHEET_API_KEY });
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(JOURNAL_RANGE)}?${params.toString()}`;
      const res = await fetch(url);
      if (!mounted.current) return;
      if (!res.ok) {
        const body = await res.text();
        devWarn("Journal page", "API", res.status, body.slice(0, 200));
        if (res.status === 403) {
          setError("Accès refusé au tableur. Vérifiez le partage et la clé API.");
        } else if (res.status === 404) {
          setError(
            'La feuille "' +
              sheetName +
              '" n\'existe pas. Créez-la dans votre tableur avec les en-têtes: Date, Heure, Action, Type contact, Ligne/ID, Pseudo, Détails.'
          );
        } else if (res.status === 400) {
          setError(
            'La feuille "' +
              sheetName +
              '" est introuvable ou la plage est invalide. Créez une feuille "' +
              sheetName +
              '" avec les en-têtes: Date, Heure, Action, Type contact, Ligne/ID, Pseudo, Détails.'
          );
        } else {
          setError(`Erreur ${res.status} lors de la lecture du journal.`);
        }
        if (!silent) setRows([]);
        return;
      }
      const json: { values?: string[][] } = await res.json();
      const values = json.values ?? [];
      const parsed = parseJournalValues(values);
      if (!mounted.current) return;
      setRows(parsed);
      setLastFetchedAt(Date.now());
      setCachedJournal(parsed);
      if (parsed.length === 0) {
        devLog("Journal page", "Feuille vide", sheetName);
      } else {
        devLog("Journal page", "OK", sheetName, "→", parsed.length, "entrée(s)");
      }
    } catch (e) {
      if (!mounted.current) return;
      devWarn("Journal page", "Erreur réseau", e);
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
    const cached = getCachedJournal();
    if (cached?.rows.length) {
      setRows(cached.rows);
      setLastFetchedAt(cached.fetchedAt);
      setLoading(false);
      setError(null);
      void load(true);
    } else {
      void load(false);
    }
    return () => {
      mounted.current = false;
    };
  }, []);

  const displayRows = [...rows].reverse();
  const byDate = displayRows.reduce<Record<string, JournalRow[]>>((acc, r) => {
    const d = r.date || "Sans date";
    if (!acc[d]) acc[d] = [];
    acc[d].push(r);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#07070b] text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0a0a10]/95 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 max-w-6xl mx-auto">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors rounded-lg px-2 py-1.5 -ml-2 hover:bg-white/5"
          >
            <ArrowLeft className="size-4" />
            Retour
          </Link>
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

      <main className="p-4 max-w-6xl mx-auto">
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
              Les ajouts, modifications et suppressions de contacts seront enregistrés
              ici une fois la feuille &quot;Journal&quot; créée dans votre tableur.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 mt-6 text-sm text-violet-400 hover:text-violet-300"
            >
              <ArrowLeft className="size-4" />
              Retour à la carte
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(byDate).map(([date, dateRows]) => (
              <section key={date} className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-2 sticky top-[57px] z-[1] py-2 bg-[#07070b]/90 backdrop-blur-sm -mx-1 px-2">
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
                          <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wider w-24">
                            Ligne
                          </th>
                          <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wider">
                            Pseudo
                          </th>
                          <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wider min-w-[200px]">
                            Détails
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dateRows.map((r, i) => (
                          <tr
                            key={`${r.date}-${r.time}-${i}`}
                            className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors"
                          >
                            <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs">
                              {r.time || "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <ActionBadge action={r.action} />
                            </td>
                            <td className="px-4 py-2.5 text-zinc-400 capitalize">
                              {r.typeContact || "—"}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-zinc-500 text-xs">
                              {r.ligneId || "—"}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-white">
                              {r.pseudo || "—"}
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
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
