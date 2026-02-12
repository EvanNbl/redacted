"use client";

import React, { useState, useEffect } from "react";
import type { MemberLocation } from "@/lib/member-locations";
import { getCoordsForMember } from "@/lib/member-locations";
import { Save, UserPlus, X, MapPin, Trash2, Copy, Mail, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PAYS_OPTIONS as PAYS_LIST } from "@/lib/countries-data";
import {
  AddressAutocomplete,
  type AddressSuggestion,
} from "@/components/AddressAutocomplete";
import { LanguageMultiSelect } from "@/components/LanguageMultiSelect";
import { ReseauMultiSelect } from "@/components/ReseauMultiSelect";
import { CountrySelect } from "@/components/CountrySelect";

const PAYS_OPTIONS = ["", ...PAYS_LIST];
const NDA_OPTIONS = ["", "Oui", "Non"] as const;
const REFERENT_OPTIONS = ["", "Orion", "Nextraker", "Aducine", "Thibani"];

// Réseaux sociaux disponibles
const RESEAUX_SOCIAUX = [
  "Twitter",
  "Instagram",
  "Tiktok",
  "Youtube",
  "Linkedin",
  "Autre",
] as const;

type ReseauSocial = (typeof RESEAUX_SOCIAUX)[number];

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
  contactType?: "communication" | "commercial";
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
  prenom: ["Prénom", "Prenom"],
  nom: ["Nom"],
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
  prenom: "",
  nom: "",
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
  contactType = "communication",
}: MemberDetailPanelProps) {
  const isNew = member === null;
  const [form, setForm] = useState(emptyForm);
  const [coordsError, setCoordsError] = useState<string | null>(null);
  const [geocodedCoords, setGeocodedCoords] = useState<
    [number, number] | null
  >(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reseaux, setReseaux] = useState<Record<string, string>>({});
  const [reseauxSelectionnes, setReseauxSelectionnes] = useState<string[]>([]);

  useEffect(() => {
    if (member) {
      const raw = member.rawRow ?? {};
      setForm({
        pseudo:
          member.pseudo || getFromRawRow(raw, [...RAW_ROW_KEYS.pseudo]),
        prenom: getFromRawRow(raw, [...RAW_ROW_KEYS.prenom]),
        nom: getFromRawRow(raw, [...RAW_ROW_KEYS.nom]),
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
      
      // Charger les réseaux sociaux depuis rawRow
      const reseauxData: Record<string, string> = {};
      RESEAUX_SOCIAUX.forEach((reseau) => {
        const value = raw[reseau]?.trim();
        if (value) {
          reseauxData[reseau] = value;
        }
      });
      // Charger les "Autre" multiples (Autre 1, Autre 2, etc.)
      Object.keys(raw).forEach((key) => {
        if (key.startsWith("Autre ") && raw[key]?.trim()) {
          reseauxData[key] = raw[key].trim();
        }
      });
      setReseaux(reseauxData);
      
      // Initialiser les réseaux sélectionnés avec ceux qui sont déjà présents
      const reseauxPresents = Object.keys(reseauxData).filter(
        (key) => RESEAUX_SOCIAUX.includes(key as ReseauSocial)
      );
      setReseauxSelectionnes(reseauxPresents);
      
      setCoordsError(null);
      setGeocodedCoords(null);
    } else {
      setForm(emptyForm);
      setReseaux({});
      setReseauxSelectionnes([]);
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

    // Validation pour les commerciaux : au moins Prénom ou Nom doit être rempli si pas de pseudo
    if (contactType === "commercial") {
      const hasPseudo = form.pseudo.trim().length > 0;
      const hasPrenomOrNom = form.prenom.trim().length > 0 || form.nom.trim().length > 0;
      if (!hasPseudo && !hasPrenomOrNom) {
        setCoordsError("Pour les commerciaux, veuillez remplir au moins le Prénom ou le Nom (ou le Pseudo).");
        return;
      }
    } else {
      // Pour les contacts communication, le pseudo est obligatoire
      if (!form.pseudo.trim()) {
        setCoordsError("Le pseudo est obligatoire.");
        return;
      }
    }

    if (!form.pays.trim()) {
      setCoordsError("Le pays est obligatoire.");
      return;
    }

    // Use geocoded coords from autocomplete if available, otherwise fallback
    let finalCoords = geocodedCoords;
    if (!finalCoords) {
      // Si c'est une modification et que le membre a déjà des coordonnées valides,
      // et que le pays/ville n'a pas changé, utiliser les coordonnées existantes
      if (!isNew && member && member.latitude && member.longitude) {
        const paysUnchanged = member.pays === form.pays.trim();
        const villeUnchanged = member.ville === form.ville.trim();
        if (paysUnchanged && villeUnchanged) {
          finalCoords = [member.latitude, member.longitude];
        }
      }
      
      // Sinon, essayer de récupérer les coordonnées depuis la base de données
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
    }

    setCoordsError(null);

    const rawRow: Record<string, string> = { ...(member?.rawRow ?? {}) };
    
    // Pour les commerciaux, construire le pseudo à partir de Prénom et Nom si nécessaire
    let finalPseudo = form.pseudo.trim();
    if (contactType === "commercial") {
      rawRow["Prénom"] = form.prenom.trim();
      rawRow["Nom"] = form.nom.trim();
      // Si pas de pseudo mais Prénom ou Nom remplis, construire le pseudo
      if (!finalPseudo && (form.prenom.trim() || form.nom.trim())) {
        finalPseudo = [form.prenom.trim(), form.nom.trim()].filter(Boolean).join(" ").trim();
      }
    }
    rawRow["Pseudo"] = finalPseudo;
    rawRow["ID Discord"] = form.idDiscord.trim();
    rawRow["Email"] = form.email.trim();
    rawRow["Pays"] = form.pays.trim();
    rawRow["Region/Etat"] = form.region.trim();
    rawRow["Ville"] = form.ville.trim();
    rawRow["Langue(s) parlée(s)"] = form.langues.trim();
    rawRow["NDA Signée"] = form.ndaSignee.trim();
    rawRow["Referent"] = form.referent.trim();
    rawRow["Notes"] = form.notes.trim();
    
    // Sauvegarder les réseaux sociaux
    RESEAUX_SOCIAUX.forEach((reseau) => {
      if (reseaux[reseau]?.trim()) {
        rawRow[reseau] = reseaux[reseau].trim();
      } else {
        delete rawRow[reseau];
      }
    });
    // Sauvegarder les "Autre" multiples
    Object.keys(reseaux).forEach((key) => {
      if (key.startsWith("Autre ") && reseaux[key]?.trim()) {
        rawRow[key] = reseaux[key].trim();
      } else if (key.startsWith("Autre ") && !reseaux[key]?.trim()) {
        delete rawRow[key];
      }
    });

    const updated: MemberLocation = {
      id: member?.id ?? `local-${Date.now()}`,
      pseudo: finalPseudo || form.pseudo.trim(),
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

  const handleAddReseau = (reseau: ReseauSocial) => {
    if (reseau === "Autre") {
      // Pour "Autre", trouver le prochain numéro disponible
      const autresKeys = Object.keys(reseaux).filter((k) => k.startsWith("Autre "));
      let num = 1;
      while (reseaux[`Autre ${num}`]) {
        num++;
      }
      setReseaux((prev) => ({ ...prev, [`Autre ${num}`]: "" }));
    } else {
      // Pour les autres réseaux, un seul par type
      if (!reseaux[reseau]) {
        setReseaux((prev) => ({ ...prev, [reseau]: "" }));
      }
    }
  };

  const handleReseauxSelectionChange = (selected: string[]) => {
    setReseauxSelectionnes(selected);
    
    setReseaux((prev) => {
      const newReseaux = { ...prev };
      
      // Supprimer les réseaux qui ne sont plus sélectionnés
      const reseauxASupprimer = reseauxSelectionnes.filter(
        (reseau) => !selected.includes(reseau)
      );
      
      reseauxASupprimer.forEach((reseau) => {
        if (reseau === "Autre") {
          // Pour "Autre", supprimer tous les "Autre X"
          Object.keys(newReseaux)
            .filter((key) => key.startsWith("Autre "))
            .forEach((key) => delete newReseaux[key]);
        } else {
          // Pour les autres réseaux, supprimer directement
          delete newReseaux[reseau];
        }
      });
      
      // Ajouter les nouveaux réseaux sélectionnés qui ne sont pas encore dans reseaux
      selected.forEach((reseau) => {
        if (!newReseaux[reseau]) {
          if (reseau === "Autre") {
            // Pour "Autre", trouver le prochain numéro disponible
            const autresKeys = Object.keys(newReseaux).filter((k) => k.startsWith("Autre "));
            let num = 1;
            while (newReseaux[`Autre ${num}`]) {
              num++;
            }
            newReseaux[`Autre ${num}`] = "";
          } else {
            // Pour les autres réseaux, ajouter directement
            newReseaux[reseau] = "";
          }
        }
      });
      
      return newReseaux;
    });
  };

  const handleRemoveReseau = (reseau: string) => {
    setReseaux((prev) => {
      const newReseaux = { ...prev };
      delete newReseaux[reseau];
      return newReseaux;
    });
    // Retirer aussi de la sélection si c'est un réseau standard
    if (RESEAUX_SOCIAUX.includes(reseau as ReseauSocial)) {
      setReseauxSelectionnes((prev) => prev.filter((r) => r !== reseau));
    }
  };

  const handleReseauChange = (reseau: string, value: string) => {
    setReseaux((prev) => ({ ...prev, [reseau]: value }));
  };

  const handleCopyEmail = async () => {
    if (form.email) {
      try {
        await navigator.clipboard.writeText(form.email);
      } catch (err) {
        // Fallback pour les navigateurs qui ne supportent pas clipboard API
        const textArea = document.createElement("textarea");
        textArea.value = form.email;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
    }
  };

  const handleOpenGmail = async () => {
    if (form.email && form.email.trim()) {
      const email = form.email.trim();
      // Essayer d'abord le format Gmail avec tous les paramètres nécessaires
      // Format recommandé par Google : view=cm pour compose, tf=cm pour to field
      const encodedEmail = encodeURIComponent(email);
      // Format complet avec tous les paramètres pour forcer l'ouverture de la fenêtre de composition
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=cm&to=${encodedEmail}`;
      
      console.log("Opening Gmail URL:", gmailUrl);
      
      // Utiliser la commande Tauri pour ouvrir dans le navigateur par défaut
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("open_url", { url: gmailUrl });
      } catch (error) {
        console.error("Error opening URL with Tauri:", error);
        // Fallback pour le navigateur web
        window.open(gmailUrl, "_blank");
      }
    }
  };

  const getReseauUrl = (reseau: string, value: string): string | null => {
    if (!value.trim()) return null;
    
    const url = value.trim();
    // Si c'est déjà une URL complète, la retourner telle quelle
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    
    // Sinon, construire l'URL selon le réseau
    const urlMap: Record<string, (val: string) => string> = {
      Twitter: (val) => `https://twitter.com/${val.replace(/^@/, "").replace(/^https?:\/\/(www\.)?twitter\.com\//, "")}`,
      Instagram: (val) => `https://instagram.com/${val.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "")}`,
      Tiktok: (val) => `https://tiktok.com/@${val.replace(/^@/, "").replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, "")}`,
      Youtube: (val) => {
        // Peut être une chaîne ou une URL de chaîne
        if (val.includes("youtube.com/channel/") || val.includes("youtube.com/c/") || val.includes("youtube.com/@")) {
          return val.startsWith("http") ? val : `https://${val}`;
        }
        return `https://youtube.com/@${val.replace(/^@/, "").replace(/^https?:\/\/(www\.)?youtube\.com\//, "")}`;
      },
      Linkedin: (val) => `https://linkedin.com/in/${val.replace(/^@/, "").replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "")}`,
      Twitch: (val) => `https://twitch.tv/${val.replace(/^@/, "").replace(/^https?:\/\/(www\.)?twitch\.tv\//, "")}`,
    };
    
    // Si c'est un "Autre", retourner tel quel (doit être une URL complète)
    if (reseau.startsWith("Autre ")) {
      return url;
    }
    
    const builder = urlMap[reseau];
    return builder ? builder(url) : url;
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
                {contactType === "commercial" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="panel-prenom" className={fieldLabel}>
                        Prénom
                      </label>
                      <Input
                        id="panel-prenom"
                        type="text"
                        value={form.prenom}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, prenom: e.target.value }))
                        }
                        className={inputClass}
                        placeholder="Prénom"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="panel-nom" className={fieldLabel}>
                        Nom
                      </label>
                      <Input
                        id="panel-nom"
                        type="text"
                        value={form.nom}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, nom: e.target.value }))
                        }
                        className={inputClass}
                        placeholder="Nom"
                      />
                    </div>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="panel-pseudo" className={fieldLabel}>
                      {contactType === "commercial" ? "Pseudo" : "Pseudo"}
                    </label>
                    <Input
                      id="panel-pseudo"
                      type="text"
                      value={form.pseudo}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, pseudo: e.target.value }))
                      }
                      className={inputClass}
                      placeholder={contactType === "commercial" ? "Pseudo (optionnel)" : "Nom ou pseudo"}
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
                  <div className="flex gap-2">
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
                      className={cn(inputClass, "flex-1")}
                      placeholder="exemple@email.com"
                    />
                    {form.email && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleCopyEmail}
                          className="h-8 px-2 text-zinc-400 hover:text-white hover:bg-white/10"
                          title="Copier l'email"
                        >
                          <Copy className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleOpenGmail}
                          className="h-8 px-2 text-zinc-400 hover:text-white hover:bg-white/10"
                          title="Ouvrir Gmail"
                        >
                          <Mail className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
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
                    <CountrySelect
                      id="panel-pays"
                      value={form.pays}
                      onChange={(value) => {
                        setForm((f) => ({ ...f, pays: value }));
                        setCoordsError(null);
                        setGeocodedCoords(null);
                      }}
                      placeholder="Sélectionner"
                    />
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
                      {NDA_OPTIONS.filter((opt) => opt !== "").map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
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
                      <option value="">Sélectionner</option>
                      {form.referent &&
                        !REFERENT_OPTIONS.includes(form.referent) && (
                          <option value={form.referent}>{form.referent}</option>
                        )}
                      {REFERENT_OPTIONS.filter((r) => r !== "").map((r) => (
                        <option key={r} value={r}>
                          {r}
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

              {/* ── Réseaux sociaux ── */}
              <fieldset className="space-y-2.5">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-widest text-violet-400/80">
                  Réseaux sociaux
                </legend>
                
                {/* Sélecteur multiple de réseaux sociaux */}
                <div className="space-y-1">
                  <label htmlFor="panel-add-reseau" className={fieldLabel}>
                    Ajouter des réseaux
                  </label>
                  <ReseauMultiSelect
                    id="panel-add-reseau"
                    selected={reseauxSelectionnes}
                    onChange={handleReseauxSelectionChange}
                    placeholder="Sélectionner des réseaux sociaux"
                  />
                </div>

                {/* Inputs pour les réseaux sélectionnés */}
                {Object.entries(reseaux)
                  .sort(([a], [b]) => {
                    // Trier : réseaux standards d'abord, puis "Autre" par numéro
                    if (a.startsWith("Autre ") && b.startsWith("Autre ")) {
                      const numA = parseInt(a.replace("Autre ", "")) || 0;
                      const numB = parseInt(b.replace("Autre ", "")) || 0;
                      return numA - numB;
                    }
                    if (a.startsWith("Autre ")) return 1;
                    if (b.startsWith("Autre ")) return -1;
                    return a.localeCompare(b);
                  })
                  .map(([reseau, value]) => (
                    <div key={reseau} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor={`panel-reseau-${reseau}`}
                          className={fieldLabel}
                        >
                          {reseau}
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveReseau(reseau)}
                          className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          Supprimer
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          id={`panel-reseau-${reseau}`}
                          type="text"
                          value={value}
                          onChange={(e) =>
                            handleReseauChange(reseau, e.target.value)
                          }
                          className={cn(inputClass, "flex-1")}
                          placeholder={
                            reseau.startsWith("Autre ")
                              ? "URL complète (ex: https://...)"
                              : `URL ou identifiant ${reseau}`
                          }
                        />
                        {getReseauUrl(reseau, value) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              const url = getReseauUrl(reseau, value);
                              if (url) {
                                // Utiliser la commande Tauri pour ouvrir dans le navigateur par défaut
                                try {
                                  const { invoke } = await import("@tauri-apps/api/core");
                                  await invoke("open_url", { url });
                                } catch {
                                  // Fallback pour le navigateur web
                                  window.open(url, "_blank");
                                }
                              }
                            }}
                            className="h-8 px-2 text-zinc-400 hover:text-white hover:bg-white/10"
                            title="Ouvrir le lien"
                          >
                            <ExternalLink className="size-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                {/* Affichage des liens directs */}
                {Object.keys(reseaux).length > 0 && (
                  <div className="mt-3 space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Liens directs
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(reseaux)
                        .filter(([_, value]) => value.trim())
                        .sort(([a], [b]) => {
                          // Trier : réseaux standards d'abord, puis "Autre" par numéro
                          if (a.startsWith("Autre ") && b.startsWith("Autre ")) {
                            const numA = parseInt(a.replace("Autre ", "")) || 0;
                            const numB = parseInt(b.replace("Autre ", "")) || 0;
                            return numA - numB;
                          }
                          if (a.startsWith("Autre ")) return 1;
                          if (b.startsWith("Autre ")) return -1;
                          return a.localeCompare(b);
                        })
                        .map(([reseau, value]) => {
                          const url = getReseauUrl(reseau, value);
                          return url ? (
                            <button
                              key={reseau}
                              type="button"
                              onClick={async () => {
                                // Utiliser la commande Tauri pour ouvrir dans le navigateur par défaut
                                try {
                                  const { invoke } = await import("@tauri-apps/api/core");
                                  await invoke("open_url", { url });
                                } catch {
                                  // Fallback pour le navigateur web
                                  window.open(url, "_blank");
                                }
                              }}
                              className="inline-flex items-center gap-1.5 rounded-md bg-violet-600/20 px-2.5 py-1 text-xs text-violet-300 hover:bg-violet-600/30 transition-colors cursor-pointer"
                            >
                              {reseau}
                              <ExternalLink className="size-3" />
                            </button>
                          ) : null;
                        })}
                    </div>
                  </div>
                )}
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
