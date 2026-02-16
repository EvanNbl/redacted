"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ScrollText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { devLog, devWarn } from "@/lib/console-banner";

const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SPREADSHEET_ID;
const SHEET_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY;
const JOURNAL_RANGE =
  process.env.NEXT_PUBLIC_GOOGLE_SHEETS_JOURNAL_RANGE ?? "Journal!A1:G500";

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
  // Colonnes attendues : Date, Heure, Action, Type contact, Ligne/ID, Pseudo, Détails (index 0..6)
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

export default function JournalPage() {
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!SHEET_ID || !SHEET_API_KEY) {
      devLog("Journal page", "Config manquante");
      setError("Configuration Google Sheets manquante.");
      setLoading(false);
      return;
    }
    const sheetName = (JOURNAL_RANGE.match(/^([^!]+)!/)?.[1] ?? "Journal").replace(/^'|'$/g, "");
    devLog("Journal page", "Chargement", sheetName, JOURNAL_RANGE);
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ key: SHEET_API_KEY });
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(JOURNAL_RANGE)}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text();
        devWarn("Journal page", "API", res.status, body.slice(0, 200));
        if (res.status === 403) {
          setError("Accès refusé au tableur. Vérifiez le partage et la clé API.");
        } else if (res.status === 404) {
          setError("La feuille \"" + sheetName + "\" n'existe pas. Créez-la dans votre tableur avec les en-têtes: Date, Heure, Action, Type contact, Ligne/ID, Pseudo, Détails.");
        } else if (res.status === 400) {
          setError("La feuille \"" + sheetName + "\" est introuvable ou la plage est invalide. Créez une feuille \"" + sheetName + "\" avec les en-têtes: Date, Heure, Action, Type contact, Ligne/ID, Pseudo, Détails.");
        } else {
          setError(`Erreur ${res.status} lors de la lecture du journal.`);
        }
        setRows([]);
        return;
      }
      const json: { values?: string[][] } = await res.json();
      const values = json.values ?? [];
      const parsed = parseJournalValues(values);
      setRows(parsed);
      if (parsed.length === 0) {
        devLog("Journal page", "Feuille vide", sheetName);
      } else {
        devLog("Journal page", "OK", sheetName, "→", parsed.length, "entrée(s)");
      }
    } catch (e) {
      devWarn("Journal page", "Erreur réseau", e);
      setError("Impossible de charger le journal.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a10] text-white">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0a0a10]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="size-4" />
            Retour
          </Link>
          <div className="flex items-center gap-2">
            <ScrollText className="size-5 text-violet-400" />
            <h1 className="text-lg font-semibold">Journal des modifications</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="ml-auto text-zinc-400 hover:text-white"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span className="ml-1">Rafraîchir</span>
          </Button>
        </div>
      </header>

      <main className="p-4 max-w-6xl mx-auto">
        {error && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        )}

        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            Chargement du journal…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-zinc-500">
            Aucune entrée dans le journal. Les ajouts, modifications et
            suppressions de contacts seront enregistrés ici une fois la feuille
            &quot;Journal&quot; créée dans votre tableur.
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left px-4 py-3 font-medium text-zinc-400">
                      Date
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-400">
                      Heure
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-400">
                      Action
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-400">
                      Type
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-400">
                      Ligne/ID
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-400">
                      Pseudo
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-400">
                      Détails
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows].reverse().map((r, i) => (
                    <tr
                      key={`${r.date}-${r.time}-${i}`}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-2 text-zinc-300">{r.date}</td>
                      <td className="px-4 py-2 text-zinc-300">{r.time}</td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            r.action === "Ajouté"
                              ? "text-emerald-400"
                              : r.action === "Modifié"
                                ? "text-amber-400"
                                : "text-red-400"
                          }
                        >
                          {r.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-zinc-300">
                        {r.typeContact || "—"}
                      </td>
                      <td className="px-4 py-2 font-mono text-zinc-400 text-xs">
                        {r.ligneId || "—"}
                      </td>
                      <td className="px-4 py-2 text-white">{r.pseudo || "—"}</td>
                      <td className="px-4 py-2 text-zinc-500 max-w-xs truncate">
                        {r.details || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
