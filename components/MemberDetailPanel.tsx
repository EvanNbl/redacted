"use client";

import React, { useState, useEffect } from "react";
import type { MemberLocation } from "@/lib/member-locations";
import { getCoordsForMember } from "@/lib/member-locations";
import { Save, UserPlus, X, MapPin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PAYS_OPTIONS as PAYS_LIST } from "@/lib/countries-data";
import {
  AddressAutocomplete,
  type AddressSuggestion,
} from "@/components/AddressAutocomplete";
import { LanguageMultiSelect } from "@/components/LanguageMultiSelect";

const PAYS_OPTIONS = ["", ...PAYS_LIST];
const NDA_OPTIONS = ["", "Oui", "Non"] as const;
const REFERENT_OPTIONS = ["", "Orion", "Nextraker", "Aducine", "Thibani"];

export interface MemberDetailPanelProps {
  member: MemberLocation | null;
  open: boolean;
  onClose: () => void;
  onSave: (member: MemberLocation) => void | Promise<void>;
  onAdd: (member: MemberLocation) => void | Promise<void>;
  onDelete?: (member: MemberLocation) => void | Promise<void>;
  saveError?: string | null;
  saving?: boolean;
  deleting?: boolean;
}

function getFromRawRow(
  rawRow: Record<string, string> | undefined,
  keys: string[]
): string {
  if (!rawRow) return "";
  for (const k of keys) {
    const v = rawRow[k];
    if (v !== undefined && v !== null && String(v).trim() !== "")
      return String(v).trim();
  }
  return "";
}

const RAW_ROW_KEYS = {
  pseudo: ["Pseudo"],
  idDiscord: ["ID Discord", "Discord"],
  email: ["Email", "E-mail"],
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
  email: "",
  pays: "",
  region: "",
  ville: "",
  langues: "",
  ndaSignee: "Non",
  referent: "",
  notes: "",
  manualLat: "",
  manualLon: "",
};

const fieldLabel =
  "text-[11px] font-medium uppercase tracking-wider text-zinc-500";
const selectClass = cn(
  "h-8 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white shadow-xs outline-none",
  "focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/40",
  "disabled:opacity-50 [&>option]:bg-zinc-900 [&>option]:text-white"
);
const inputClass =
  "h-8 border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/40";

export function MemberDetailPanel({
  member,
  open,
  onClose,
  onSave,
  onAdd,
  onDelete,
  saveError = null,
  saving = false,
  deleting = false,
}: MemberDetailPanelProps) {
  const isNew = member === null;
  const [form, setForm] = useState(emptyForm);
  const [coordsError, setCoordsError] = useState<string | null>(null);
  const [geocodedCoords, setGeocodedCoords] = useState<
    [number, number] | null
  >(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (member) {
      const raw = member.rawRow ?? {};
      setForm({
        pseudo:
          member.pseudo || getFromRawRow(raw, [...RAW_ROW_KEYS.pseudo]),
        idDiscord: getFromRawRow(raw, [...RAW_ROW_KEYS.idDiscord]),
        email: getFromRawRow(raw, [...RAW_ROW_KEYS.email]),
        pays: member.pays || getFromRawRow(raw, [...RAW_ROW_KEYS.pays]),
        region:
          member.region || getFromRawRow(raw, [...RAW_ROW_KEYS.region]),
        ville:
          member.ville || getFromRawRow(raw, [...RAW_ROW_KEYS.ville]),
        langues: getFromRawRow(raw, [...RAW_ROW_KEYS.langues]),
        ndaSignee: getFromRawRow(raw, [...RAW_ROW_KEYS.ndaSignee]) || "Non",
        referent: getFromRawRow(raw, [...RAW_ROW_KEYS.referent]),
        notes: getFromRawRow(raw, [...RAW_ROW_KEYS.notes]),
        manualLat: "",
        manualLon: "",
      });
      setCoordsError(null);
      setGeocodedCoords(null);
    } else {
      setForm(emptyForm);
      setCoordsError(null);
      setGeocodedCoords(null);
    }
    setShowDeleteConfirm(false);
  }, [member, open]);

  const handleAddressSelect = (suggestion: AddressSuggestion) => {
    setForm((f) => ({
      ...f,
      ville: suggestion.city || f.ville,
      region: suggestion.state || f.region,
      pays: suggestion.country || f.pays,
    }));
    setGeocodedCoords([suggestion.lat, suggestion.lon]);
    setCoordsError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.pays.trim()) {
      setCoordsError("Le pays est obligatoire.");
      return;
    }

    // Use geocoded coords from autocomplete if available, otherwise fallback
    let finalCoords = geocodedCoords;
    if (!finalCoords) {
      const fallback = getCoordsForMember(
        form.pays.trim(),
        form.ville.trim()
      );
      if (!fallback) {
        setCoordsError(
          "Pays ou ville non reconnu. Utilisez la recherche d'adresse pour un placement précis."
        );
        return;
      }
      finalCoords = fallback;
    }

    setCoordsError(null);

    const rawRow: Record<string, string> = { ...(member?.rawRow ?? {}) };
    rawRow["Pseudo"] = form.pseudo.trim();
    rawRow["ID Discord"] = form.idDiscord.trim();
    rawRow["Email"] = form.email.trim();
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
      latitude: finalCoords[0],
      longitude: finalCoords[1],
      hasExactCoords: true,
      rawRow,
    };

    if (isNew) {
      try {
        await Promise.resolve(onAdd(updated));
        onClose();
      } catch {
        /* error shown via saveError */
      }
      return;
    }

    try {
      await Promise.resolve(onSave(updated));
      onClose();
    } catch {
      /* error shown via saveError */
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!member || !onDelete) return;
    try {
      await Promise.resolve(onDelete(member));
      setShowDeleteConfirm(false);
      onClose();
    } catch {
      /* error shown via saveError */
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  if (!open) return null;

  return (
      <aside
        className="absolute right-0 top-0 z-40 flex h-full w-full max-w-[380px] flex-col border-l border-white/[0.06] bg-[#0b0b12]/98 shadow-[-12px_0_40px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        role="dialog"
        aria-labelledby="panel-title"
      >
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-violet-600/20">
                {isNew ? (
                  <UserPlus className="size-4 text-violet-400" />
                ) : (
                  <Save className="size-4 text-violet-400" />
                )}
              </div>
              <h2
                id="panel-title"
                className="text-base font-semibold tracking-tight text-white"
              >
                {isNew ? "Nouveau contact" : "Modifier le contact"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Fermer"
            >
              <X className="size-4" />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {/* ── Identité ── */}
              <fieldset className="space-y-2.5">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-widest text-violet-400/80">
                  Identité
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="panel-pseudo" className={fieldLabel}>
                      Pseudo
                    </label>
                    <Input
                      id="panel-pseudo"
                      type="text"
                      value={form.pseudo}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, pseudo: e.target.value }))
                      }
                      className={inputClass}
                      placeholder="Nom ou pseudo"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="panel-idDiscord" className={fieldLabel}>
                      ID Discord
                    </label>
                    <Input
                      id="panel-idDiscord"
                      type="text"
                      value={form.idDiscord}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          idDiscord: e.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="Optionnel"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor="panel-email" className={fieldLabel}>
                    Email
                  </label>
                  <Input
                    id="panel-email"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        email: e.target.value,
                      }))
                    }
                    className={inputClass}
                    placeholder="exemple@email.com"
                  />
                </div>
              </fieldset>

              {/* ── Localisation ── */}
              <fieldset className="space-y-2.5">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-widest text-violet-400/80">
                  <MapPin className="mr-1 -mt-0.5 inline size-3" />
                  Localisation
                </legend>

                {/* Address autocomplete */}
                <div className="space-y-1">
                  <label htmlFor="panel-address-search" className={fieldLabel}>
                    Recherche d&apos;adresse
                  </label>
                  <AddressAutocomplete
                    id="panel-address-search"
                    value={form.ville}
                    onChange={(v) => {
                      setForm((f) => ({ ...f, ville: v }));
                      setCoordsError(null);
                    }}
                    onSelect={handleAddressSelect}
                    placeholder="Tapez une adresse, ville…"
                  />
                  <p className="text-[10px] text-zinc-600">
                    Sélectionnez une suggestion pour un placement précis sur la carte.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="panel-pays" className={fieldLabel}>
                      Pays <span className="text-red-400/90">*</span>
                    </label>
                    <select
                      id="panel-pays"
                      value={form.pays}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, pays: e.target.value }));
                        setCoordsError(null);
                        setGeocodedCoords(null);
                      }}
                      className={selectClass}
                    >
                      {form.pays &&
                        !PAYS_OPTIONS.includes(form.pays) && (
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
                    <label htmlFor="panel-region" className={fieldLabel}>
                      Région / État
                    </label>
                    <Input
                      id="panel-region"
                      type="text"
                      value={form.region}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, region: e.target.value }))
                      }
                      className={inputClass}
                      placeholder="ex. Wallonie"
                    />
                  </div>
                </div>

                {/* Geocoded coords display */}
                {geocodedCoords && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                    <MapPin className="size-3" />
                    Position GPS : {geocodedCoords[0].toFixed(4)},{" "}
                    {geocodedCoords[1].toFixed(4)}
                  </div>
                )}
              </fieldset>

              {/* ── Informations ── */}
              <fieldset className="space-y-2.5">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-widest text-violet-400/80">
                  Informations
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="panel-langues" className={fieldLabel}>
                      Langue(s)
                    </label>
                    <LanguageMultiSelect
                      id="panel-langues"
                      value={form.langues}
                      onChange={(value) =>
                        setForm((f) => ({
                          ...f,
                          langues: value,
                        }))
                      }
                      placeholder="Sélectionner"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="panel-ndaSignee" className={fieldLabel}>
                      NDA Signée
                    </label>
                    <select
                      id="panel-ndaSignee"
                      value={form.ndaSignee}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          ndaSignee: e.target.value,
                        }))
                      }
                      className={selectClass}
                    >
                      {NDA_OPTIONS.map((opt) => (
                        <option key={opt || "__vide"} value={opt}>
                          {opt || "—"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="panel-referent" className={fieldLabel}>
                      Referent
                    </label>
                    <select
                      id="panel-referent"
                      value={form.referent}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          referent: e.target.value,
                        }))
                      }
                      className={selectClass}
                    >
                      {form.referent &&
                        !REFERENT_OPTIONS.includes(form.referent) && (
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

                <div className="space-y-1">
                  <label htmlFor="panel-notes" className={fieldLabel}>
                    Notes
                  </label>
                  <textarea
                    id="panel-notes"
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    rows={2}
                    className={cn(
                      "w-full resize-none rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none",
                      "focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/40"
                    )}
                    placeholder="Optionnel"
                  />
                </div>
              </fieldset>

              {/* Errors */}
              {(coordsError || saveError) && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
                  {saveError ?? coordsError}
                </div>
              )}

              {/* Existing coords display */}
              {!isNew && member && !geocodedCoords && (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-zinc-500">
                  Coordonnées actuelles : {member.latitude.toFixed(4)},{" "}
                  {member.longitude.toFixed(4)}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-white/[0.06] bg-black/30 px-5 py-3">
              <div className="flex gap-3">
                {!isNew && onDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleDeleteClick}
                    disabled={saving || deleting}
                    className="text-red-400 hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  disabled={saving || deleting}
                  className="flex-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={saving || deleting}
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

        {/* Confirmation de suppression */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-sm rounded-xl border border-red-500/20 bg-zinc-900 p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/20">
                  <Trash2 className="size-5 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  Supprimer le contact
                </h3>
              </div>
              <p className="mb-6 text-sm text-zinc-400">
                Êtes-vous sûr de vouloir supprimer{" "}
                <span className="font-medium text-white">
                  {member?.pseudo || "ce contact"}
                </span>
                ? Cette action est irréversible.
              </p>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDeleteCancel}
                  disabled={deleting}
                  className="flex-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex flex-1 items-center justify-center gap-2 bg-red-600 text-white hover:bg-red-500 disabled:opacity-70"
                >
                  {deleting ? (
                    "Suppression…"
                  ) : (
                    <>
                      <Trash2 className="size-4" />
                      Supprimer
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </aside>
  );
}
