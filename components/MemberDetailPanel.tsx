"use client";

import React, { useState, useEffect } from "react";
import type { MemberLocation } from "@/lib/member-locations";
import { getCoordsForMember } from "@/lib/member-locations";
import { Save, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PAYS_OPTIONS as PAYS_LIST } from "@/lib/countries-data";

/** Liste pour le select : vide + tous les pays. */
const PAYS_OPTIONS = ["", ...PAYS_LIST];

const NDA_OPTIONS = ["", "OUI", "NON"] as const;

/** Référents proposés (ordre affiché). Une valeur du sheet non listée s’affiche aussi. */
const REFERENT_OPTIONS = ["", "Orion", "Nextraker", "Aducine", "Thibani"];

export interface MemberDetailPanelProps {
  /** null = mode "nouveau contact" */
  member: MemberLocation | null;
  open: boolean;
  onClose: () => void;
  /** Peut être async (ex. enregistrement sur Google Sheet). Le panneau attend avant de fermer. */
  onSave: (member: MemberLocation) => void | Promise<void>;
  /** Ajout d’un nouveau contact (peut être async, ex. écriture dans le Google Sheet). */
  onAdd: (member: MemberLocation) => void | Promise<void>;
  /** Message d'erreur affiché dans le panneau (ex. échec API Sheet). */
  saveError?: string | null;
  /** Désactive le formulaire pendant l'enregistrement. */
  saving?: boolean;
}

/** Récupère la première valeur trouvée dans rawRow pour une des clés (en-têtes possibles). */
function getFromRawRow(rawRow: Record<string, string> | undefined, keys: string[]): string {
  if (!rawRow) return "";
  for (const k of keys) {
    const v = rawRow[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

const RAW_ROW_KEYS = {
  pseudo: ["Pseudo"],
  idDiscord: ["ID Discord", "Discord"],
  pays: ["Pays"],
  region: ["Region/Etat", "Région", "Region/État"],
  ville: ["Ville"],
  langues: ["Langue(s) parlée(s)", "Langues", "Langues parlées"],
  ndaSignee: ["NDA Signée", "NDA Signee", "NDA"],
  referent: ["Referent", "Réferent", "Référent"],
  notes: ["Notes"],
} as const;

const emptyForm = {
  pseudo: "",
  idDiscord: "",
  pays: "",
  region: "",
  ville: "",
  langues: "",
  ndaSignee: "",
  referent: "",
  notes: "",
};

export function MemberDetailPanel({
  member,
  open,
  onClose,
  onSave,
  onAdd,
  saveError = null,
  saving = false,
}: MemberDetailPanelProps) {
  const isNew = member === null;
  const [form, setForm] = useState(emptyForm);
  const [coordsError, setCoordsError] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      const raw = member.rawRow ?? {};
      setForm({
        pseudo: member.pseudo || getFromRawRow(raw, [...RAW_ROW_KEYS.pseudo]),
        idDiscord: getFromRawRow(raw, [...RAW_ROW_KEYS.idDiscord]),
        pays: member.pays || getFromRawRow(raw, [...RAW_ROW_KEYS.pays]),
        region: member.region || getFromRawRow(raw, [...RAW_ROW_KEYS.region]),
        ville: member.ville || getFromRawRow(raw, [...RAW_ROW_KEYS.ville]),
        langues: getFromRawRow(raw, [...RAW_ROW_KEYS.langues]),
        ndaSignee: getFromRawRow(raw, [...RAW_ROW_KEYS.ndaSignee]),
        referent: getFromRawRow(raw, [...RAW_ROW_KEYS.referent]),
        notes: getFromRawRow(raw, [...RAW_ROW_KEYS.notes]),
      });
      setCoordsError(null);
    } else {
      setForm(emptyForm);
      setCoordsError(null);
    }
  }, [member, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const coords = getCoordsForMember(form.pays.trim(), form.ville.trim());
    if (!form.pays.trim()) {
      setCoordsError("Le pays est obligatoire.");
      return;
    }
    if (!coords) {
      setCoordsError(
        "Pays ou ville non reconnu. Utilisez un pays de la liste (ex. France, Belgique, Suisse)."
      );
      return;
    }
    setCoordsError(null);

    const rawRow: Record<string, string> = { ...(member?.rawRow ?? {}) };
    rawRow["Pseudo"] = form.pseudo.trim();
    rawRow["ID Discord"] = form.idDiscord.trim();
    rawRow["Pays"] = form.pays.trim();
    rawRow["Region/Etat"] = form.region.trim();
    rawRow["Ville"] = form.ville.trim();
    rawRow["Langue(s) parlée(s)"] = form.langues.trim();
    rawRow["NDA Signée"] = form.ndaSignee.trim();
    rawRow["Referent"] = form.referent.trim();
    rawRow["Notes"] = form.notes.trim();

    const updated: MemberLocation = {
      id: member?.id ?? `local-${Date.now()}`,
      pseudo: form.pseudo.trim(),
      pays: form.pays.trim(),
      region: form.region.trim(),
      ville: form.ville.trim(),
      latitude: coords[0],
      longitude: coords[1],
      rawRow,
    };

    if (isNew) {
      try {
        await Promise.resolve(onAdd(updated));
        onClose();
      } catch {
        // Erreur affichée par le parent (saveError)
      }
      return;
    }

    try {
      await Promise.resolve(onSave(updated));
      onClose();
    } catch {
      // Erreur gérée par le parent (saveError)
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity"
        aria-hidden
        onClick={onClose}
      />
      <aside
        className="fixed right-0 top-0 z-40 flex h-full w-full max-w-[420px] flex-col bg-[#0c0c12] shadow-[-8px_0_32px_rgba(0,0,0,0.5)]"
        role="dialog"
        aria-labelledby="panel-title"
        aria-modal="true"
      >

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* En-tête */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <h2
              id="panel-title"
              className="text-base font-semibold tracking-tight text-white"
            >
              {isNew ? "Nouveau contact" : "Modifier le contact"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Fermer"
            >
              <X className="size-5" />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                <div className="space-y-1">
                  <label htmlFor="panel-pseudo" className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Pseudo
                  </label>
                  <Input
                    id="panel-pseudo"
                    type="text"
                    value={form.pseudo}
                    onChange={(e) => setForm((f) => ({ ...f, pseudo: e.target.value }))}
                    className="h-8 border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/40"
                    placeholder="Nom ou pseudo"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="panel-idDiscord" className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    ID Discord
                  </label>
                  <Input
                    id="panel-idDiscord"
                    type="text"
                    value={form.idDiscord}
                    onChange={(e) => setForm((f) => ({ ...f, idDiscord: e.target.value }))}
                    className="h-8 border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/40"
                    placeholder="Optionnel"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="panel-pays" className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Pays <span className="text-red-400/90">*</span>
                  </label>
                  <select
                    id="panel-pays"
                    value={form.pays}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, pays: e.target.value }));
                      setCoordsError(null);
                    }}
                    className={cn(
                      "h-8 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white shadow-xs outline-none",
                      "focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/40",
                      "disabled:opacity-50 [&>option]:bg-zinc-900 [&>option]:text-white"
                    )}
                  >
                    {form.pays && !PAYS_OPTIONS.includes(form.pays) && (
                      <option value={form.pays}>{form.pays}</option>
                    )}
                    {PAYS_OPTIONS.map((p) => (
                      <option key={p || "__vide"} value={p}>
                        {p || "— Choisir —"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="panel-ville" className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Ville
                  </label>
                  <Input
                    id="panel-ville"
                    type="text"
                    value={form.ville}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, ville: e.target.value }));
                      setCoordsError(null);
                    }}
                    className="h-8 border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/40"
                    placeholder="ex. Paris, Liège"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="panel-region" className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Région / État
                  </label>
                  <Input
                    id="panel-region"
                    type="text"
                    value={form.region}
                    onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                    className="h-8 border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/40"
                    placeholder="ex. Wallonie"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="panel-langues" className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Langue(s)
                  </label>
                  <Input
                    id="panel-langues"
                    type="text"
                    value={form.langues}
                    onChange={(e) => setForm((f) => ({ ...f, langues: e.target.value }))}
                    className="h-8 border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/40"
                    placeholder="Français, Anglais"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="panel-ndaSignee" className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    NDA Signée
                  </label>
                  <select
                    id="panel-ndaSignee"
                    value={form.ndaSignee}
                    onChange={(e) => setForm((f) => ({ ...f, ndaSignee: e.target.value }))}
                    className={cn(
                      "h-8 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white shadow-xs outline-none",
                      "focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/40",
                      "disabled:opacity-50 [&>option]:bg-zinc-900 [&>option]:text-white"
                    )}
                  >
                    {NDA_OPTIONS.map((opt) => (
                      <option key={opt || "__vide"} value={opt}>
                        {opt || "—"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="panel-referent" className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Referent
                  </label>
                  <select
                    id="panel-referent"
                    value={form.referent}
                    onChange={(e) => setForm((f) => ({ ...f, referent: e.target.value }))}
                    className={cn(
                      "h-8 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white shadow-xs outline-none",
                      "focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/40",
                      "disabled:opacity-50 [&>option]:bg-zinc-900 [&>option]:text-white"
                    )}
                  >
                    {form.referent && !REFERENT_OPTIONS.includes(form.referent) && (
                      <option value={form.referent}>{form.referent}</option>
                    )}
                    {REFERENT_OPTIONS.map((r) => (
                      <option key={r || "__vide"} value={r}>
                        {r || "— Choisir —"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-2.5 space-y-1">
                <label htmlFor="panel-notes" className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Notes
                </label>
                <textarea
                  id="panel-notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className={cn(
                    "w-full resize-none rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none",
                    "focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/40",
                    "placeholder:opacity-70"
                  )}
                  placeholder="Optionnel"
                />
              </div>

              {(coordsError || saveError) && (
                <div className="mt-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
                  {saveError ?? coordsError}
                </div>
              )}

              {!isNew && member && (
                <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-zinc-500">
                  Coordonnées : {member.latitude.toFixed(4)}, {member.longitude.toFixed(4)}
                </div>
              )}
            </div>

            {/* Pied fixe avec boutons */}
            <div className="shrink-0 border-t border-white/[0.06] bg-black/20 px-4 py-3">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  disabled={saving}
                  className="flex-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-70"
                >
                  {saving ? (
                    "Enregistrement…"
                  ) : isNew ? (
                    <>
                      <UserPlus className="size-4" />
                      Ajouter
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Enregistrer
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </aside>
    </>
  );
}
