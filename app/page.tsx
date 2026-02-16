"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { parseMembersFromTable, isMemberLocked, getMemberDisplayName } from "@/lib/member-locations";
import { enrichMembersWithNominatim } from "@/lib/geocode";
import { MemberDetailPanel } from "@/components/MemberDetailPanel";
import { UpdateChecker } from "@/components/UpdateChecker";
import { LoadingScreen } from "@/components/LoadingScreen";
import { LanguageMultiSelect } from "@/components/LanguageMultiSelect";
import { CountryMultiSelect } from "@/components/CountryMultiSelect";
import { ReferentMultiSelect } from "@/components/ReferentMultiSelect";
import { PasswordGate } from "@/components/PasswordGate";
import {
  isClientSheetsAvailable,
  appendRowToSheet,
  updateRowInSheet,
  deleteRowInSheet,
  appendJournalEntry,
} from "@/lib/sheets-client";
import { getCachedSheet, setCachedSheet, isTauriEnv } from "@/lib/sheet-cache";
import { logAppBanner, devLog } from "@/lib/console-banner";

const MemberMap = dynamic(
  () => import("@/components/MemberMap").then((m) => ({ default: m.MemberMap })),
  { ssr: false }
);

import type { MemberLocation } from "@/lib/member-locations";
import Link from "next/link";
import {
  RefreshCw,
  Users,
  Search,
  AlertCircle,
  Plus,
  UserPlus,
  Download,
  Filter,
  X,
  ChevronDown,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

/* ── Types ───────────────────────────────────────────────── */

type ContactsTable = { headers: string[]; rows: string[][] };

interface Filters {
  pays: string[]; // Tableau de pays sélectionnés
  nda: string;
  referents: string[]; // Tableau de référents sélectionnés
  langues: string[]; // Tableau de langues sélectionnées
}

const emptyFilters: Filters = { pays: [], nda: "", referents: [], langues: [] };

export type SortOption = "name" | "pays" | "nda" | "date" | "recent";

const SIDEBAR_ROW_HEIGHT = 52;
const SIDEBAR_SECTION_HEIGHT = 28;
const VIRTUALIZE_THRESHOLD = 100;

type SidebarRow =
  | { kind: "section"; id: string; label: string; count: number }
  | { kind: "member"; member: MemberLocation; section: "actif" | "refus" };

/** Valeur de tri "date ajout" depuis rawRow (colonnes courantes). */
function getMemberDateAdded(m: MemberLocation): number {
  const raw =
    m.rawRow["Date ajout"] ??
    m.rawRow["Date d'ajout"] ??
    m.rawRow["Date"] ??
    "";
  if (!raw.trim()) return 0;
  const d = new Date(raw.trim());
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/** Index de ligne (sheet-N) pour tri "récent en premier". */
function getMemberRowIndex(m: MemberLocation): number {
  const match = m.id.match(/^sheet-(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function sortMembersList(
  list: MemberLocation[],
  sortBy: SortOption,
  contactType: ContactType
): MemberLocation[] {
  if (list.length === 0) return list;
  const locale = "fr";
  const cmp = (a: MemberLocation, b: MemberLocation): number => {
    switch (sortBy) {
      case "name":
        return (a.pseudo ?? "").localeCompare(b.pseudo ?? "", locale);
      case "pays":
        return (a.pays ?? "").localeCompare(b.pays ?? "", locale);
      case "nda": {
        const ndaA = (a.rawRow["NDA Signée"] ?? a.rawRow["NDA Signee"] ?? "").trim().toLowerCase();
        const ndaB = (b.rawRow["NDA Signée"] ?? b.rawRow["NDA Signee"] ?? "").trim().toLowerCase();
        if (ndaA === ndaB) return 0;
        return ndaA === "oui" ? 1 : ndaB === "oui" ? -1 : 0;
      }
      case "date": {
        const tA = getMemberDateAdded(a);
        const tB = getMemberDateAdded(b);
        return tA - tB;
      }
      case "recent": {
        const iA = getMemberRowIndex(a);
        const iB = getMemberRowIndex(b);
        return iB - iA; // plus récent (index plus grand) en premier
      }
      default:
        return 0;
    }
  };
  return [...list].sort(cmp);
}

/* ── Config ──────────────────────────────────────────────── */

const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SPREADSHEET_ID;
const SHEET_RANGE =
  process.env.NEXT_PUBLIC_GOOGLE_SHEETS_RANGE ?? "Tableau!A1:Z1000";
const SHEET_RANGE_COM =
  process.env.NEXT_PUBLIC_GOOGLE_SHEETS_RANGE_COM ?? "Commercial!A1:Z1000";
const SHEET_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY;
const useClientApi = isClientSheetsAvailable();
const SHEET_CACHE_TTL_MS = 2 * 60 * 1000; // 2 min

type ContactType = "communication" | "commercial";

/* ── Filter logic ────────────────────────────────────────── */

function applyFilters(
  members: MemberLocation[],
  query: string,
  filters: Filters
): MemberLocation[] {
  let result = members;

  // Text search
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    result = result.filter(
      (m) =>
        m.pseudo.toLowerCase().includes(q) ||
        m.ville?.toLowerCase().includes(q) ||
        m.pays?.toLowerCase().includes(q) ||
        m.region?.toLowerCase().includes(q)
    );
  }

  // Country filter (multiple countries)
  if (filters.pays.length > 0) {
    result = result.filter((m) =>
      filters.pays.some((p) => m.pays?.toLowerCase() === p.toLowerCase())
    );
  }

  // NDA filter
  if (filters.nda) {
    const nda = filters.nda.trim().toLowerCase();
    result = result.filter(
      (m) =>
        (m.rawRow["NDA Signée"] ?? m.rawRow["NDA Signee"] ?? "")
          .trim()
          .toLowerCase() === nda
    );
  }

  // Referent filter (multiple referents)
  if (filters.referents.length > 0) {
    result = result.filter((m) => {
      const memberReferent = (m.rawRow["Referent"] ?? m.rawRow["Référent"] ?? "")
        .trim()
        .toLowerCase();
      return filters.referents.some(
        (r) => memberReferent === r.toLowerCase()
      );
    });
  }

  // Language filter (multiple languages)
  if (filters.langues.length > 0) {
    result = result.filter((m) => {
      const memberLangues = (m.rawRow["Langue(s) parlée(s)"] ?? m.rawRow["Langues"] ?? "")
        .toLowerCase();
      // Le membre doit avoir au moins une des langues sélectionnées
      return filters.langues.some((langue) =>
        memberLangues.includes(langue.toLowerCase())
      );
    });
  }

  return result;
}

/** Get unique sorted values for a field from all members. */
function uniqueValues(
  members: MemberLocation[],
  getter: (m: MemberLocation) => string
): string[] {
  const set = new Set<string>();
  for (const m of members) {
    const v = getter(m).trim();
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
}

/* ── Component ───────────────────────────────────────────── */

export default function Home() {
  const [data, setData] = useState<ContactsTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [members, setMembers] = useState<MemberLocation[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberLocation | null>(
    null
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isTauri, setIsTauri] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [contactType, setContactType] = useState<ContactType>("communication");

  // Filters
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("name");

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTauriApp = !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    setIsTauri(isTauriApp);
    logAppBanner({
      sheetRange: SHEET_RANGE,
      sheetRangeCom: SHEET_RANGE_COM,
      useClientApi,
      hasServiceAccountKey: !!process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_KEY,
      isTauri: isTauriApp,
    });
  }, []);

  /* ── Cache sheet (1–2 min) ────────────────────────────── */
  const sheetCacheRef = useRef<{
    contactType: ContactType;
    data: ContactsTable;
    members: MemberLocation[];
    fetchedAt: number;
  } | null>(null);

  const loadFromSheet = useCallback(
    async (forceRefresh = false): Promise<MemberLocation[]> => {
      if (!SHEET_ID || !SHEET_API_KEY) {
        setError(
          "Configuration Google Sheets manquante. Vérifiez les variables d'environnement."
        );
        setLoading(false);
        return [];
      }

      const cache = sheetCacheRef.current;
      const now = Date.now();
      const useMemoryCache =
        !forceRefresh &&
        cache &&
        cache.contactType === contactType &&
        now - cache.fetchedAt < SHEET_CACHE_TTL_MS;

      if (useMemoryCache && cache) {
        devLog("loadFromSheet", "Cache mémoire", contactType, "→", cache.members.length, "membres");
        setData(cache.data);
        setMembers(cache.members);
        setError(null);
        setLoading(false);
        return cache.members;
      }

      // En mode Tauri : afficher tout de suite le cache SQLite si dispo (ouverture instantanée hors-ligne)
      let usedLocalCache = false;
      if (isTauriEnv() && !forceRefresh) {
        try {
          const cached = await getCachedSheet(contactType);
          if (cached?.data_json) {
            const parsed = JSON.parse(cached.data_json) as {
              headers: string[];
              rows: string[][];
            };
            if (parsed.headers && Array.isArray(parsed.rows)) {
              const table = { headers: parsed.headers, rows: parsed.rows };
              const members = parseMembersFromTable(
                parsed.headers,
                parsed.rows,
                contactType
              );
              devLog("loadFromSheet", "Cache SQLite", contactType, "→", members.length, "membres");
              setData(table);
              setMembers(members);
              setError(null);
              sheetCacheRef.current = {
                contactType,
                data: table,
                members,
                fetchedAt: cached.fetched_at,
              };
              usedLocalCache = true;
            }
          }
        } catch (_) {
          // Ignorer les erreurs de cache local
        }
      }

      setLoading(true);
      if (!usedLocalCache) setError(null);

      try {
        const range = contactType === "commercial" ? SHEET_RANGE_COM : SHEET_RANGE;
        const params = new URLSearchParams({ key: SHEET_API_KEY });
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(
          range
        )}?${params.toString()}`;
        devLog("loadFromSheet", "Fetch réseau", contactType, forceRefresh ? "(force)" : "");

        const res = await fetch(url);

        if (!res.ok) {
          const text = await res.text();
          if (res.status === 403) {
            setError(
              "Accès refusé (403). Vérifiez : 1) L'API Google Sheets est activée. 2) Le tableur est partagé. 3) La clé API est correcte."
            );
            if (!usedLocalCache) setLoading(false);
            return usedLocalCache ? (sheetCacheRef.current?.members ?? []) : [];
          }
          throw new Error(
            `Erreur API Google Sheets (${res.status}): ${text}`
          );
        }

        const json: { values?: string[][] } = await res.json();
        const values = json.values ?? [];

        if (values.length === 0) {
          const empty = { headers: [] as string[], rows: [] as string[][] };
          setData(empty);
          setMembers([]);
          sheetCacheRef.current = { contactType, data: empty, members: [], fetchedAt: Date.now() };
          if (isTauriEnv()) {
            setCachedSheet(contactType, JSON.stringify(empty), Date.now());
          }
          setLoading(false);
          return [];
        }

        const [headers, ...rows] = values;
        const parsed = parseMembersFromTable(headers, rows, contactType);
        const table = { headers, rows };
        setData(table);
        setMembers(parsed);
        const fetchedAt = Date.now();
        sheetCacheRef.current = { contactType, data: table, members: parsed, fetchedAt };
        if (isTauriEnv()) {
          setCachedSheet(contactType, JSON.stringify(table), fetchedAt);
        }
        devLog("loadFromSheet", "Réseau OK", contactType, "→", parsed.length, "membres");
        setLoading(false);
        return parsed;
      } catch (e) {
        devLog("loadFromSheet", "Erreur réseau", e);
        if (!usedLocalCache) {
          setError("Impossible de charger les contacts depuis Google Sheets.");
        } else {
          devLog("loadFromSheet", "Affichage depuis le cache local");
        }
        setLoading(false);
        return usedLocalCache ? (sheetCacheRef.current?.members ?? []) : [];
      }
    },
    [contactType]
  );

  /** Force le rechargement en ignorant le cache. */
  const refreshFromSheet = useCallback(() => {
    return loadFromSheet(true);
  }, [loadFromSheet]);

  useEffect(() => {
    void loadFromSheet();
  }, [loadFromSheet]);

  // Recharger les données quand le type de contact change
  useEffect(() => {
    setPanelOpen(false);
    setSelectedMember(null);
    setMembers([]); // Réinitialiser les membres pour éviter l'affichage des anciens membres
    setSearchQuery(""); // Réinitialiser la recherche
    setFilters(emptyFilters); // Réinitialiser les filtres
    void loadFromSheet();
  }, [contactType]);

  /* ── Enrichissement géocodage (ville/pays → coordonnées réelles) ── */
  const enrichingRef = useRef(false);
  useEffect(() => {
    const needsEnrich = members.some((m) => !m.hasExactCoords && m.pays.trim());
    if (!needsEnrich || enrichingRef.current || members.length === 0) return;
    enrichingRef.current = true;
    enrichMembersWithNominatim(members)
      .then((enriched) => {
        setMembers(enriched);
      })
      .catch(() => {
        /* garde les membres tels quels (capitale) */
      })
      .finally(() => {
        enrichingRef.current = false;
      });
  }, [members]);

  /* ── Derived state ────────────────────────────────────── */

  const filteredMembers = useMemo(
    () => applyFilters(members, searchQuery, filters),
    [members, searchQuery, filters]
  );

  /** Pour communication : contacts actifs vs REFUS (Lock = true). Pour commercial : tout dans actifs. */
  const { membersActifs, membersRefus } = useMemo(() => {
    if (contactType !== "communication") {
      return { membersActifs: filteredMembers, membersRefus: [] };
    }
    const actifs = filteredMembers.filter((m) => !isMemberLocked(m));
    const refus = filteredMembers.filter((m) => isMemberLocked(m));
    return { membersActifs: actifs, membersRefus: refus };
  }, [contactType, filteredMembers]);

  /** Listes triées pour la sidebar. */
  const { sortedActifs, sortedRefus, sortedCommercial } = useMemo(() => {
    return {
      sortedActifs: sortMembersList(membersActifs, sortBy, contactType),
      sortedRefus: sortMembersList(membersRefus, sortBy, contactType),
      sortedCommercial: sortMembersList(
        contactType === "commercial" ? filteredMembers : [],
        sortBy,
        contactType
      ),
    };
  }, [membersActifs, membersRefus, filteredMembers, contactType, sortBy]);

  /** Liste plate pour virtualisation (sections + membres). */
  const flatSidebarRows = useMemo((): SidebarRow[] => {
    if (contactType === "communication") {
      const rows: SidebarRow[] = [];
      if (sortedActifs.length > 0) {
        rows.push({ kind: "section", id: "contacts", label: "Contacts", count: sortedActifs.length });
        sortedActifs.forEach((m) => rows.push({ kind: "member", member: m, section: "actif" }));
      }
      if (sortedRefus.length > 0) {
        rows.push({ kind: "section", id: "refus", label: "REFUS", count: sortedRefus.length });
        sortedRefus.forEach((m) => rows.push({ kind: "member", member: m, section: "refus" }));
      }
      return rows;
    }
    const rows: SidebarRow[] = [];
    if (sortedCommercial.length > 0) {
      rows.push({ kind: "section", id: "contacts", label: "Contacts", count: sortedCommercial.length });
      sortedCommercial.forEach((m) => rows.push({ kind: "member", member: m, section: "actif" }));
    }
    return rows;
  }, [contactType, sortedActifs, sortedRefus, sortedCommercial]);

  const sidebarListRef = useRef<HTMLDivElement>(null);
  const useVirtualizedList = flatSidebarRows.length >= VIRTUALIZE_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: flatSidebarRows.length,
    getScrollElement: () => sidebarListRef.current,
    estimateSize: (index) =>
      flatSidebarRows[index]?.kind === "section" ? SIDEBAR_SECTION_HEIGHT : SIDEBAR_ROW_HEIGHT,
    overscan: 8,
    enabled: useVirtualizedList,
  });

  const uniqueCountries = useMemo(
    () => uniqueValues(members, (m) => m.pays),
    [members]
  );
  const uniqueReferents = useMemo(
    () =>
      uniqueValues(
        members,
        (m) => m.rawRow["Referent"] ?? m.rawRow["Référent"] ?? ""
      ),
    [members]
  );

  // Extraire toutes les langues uniques des membres
  const uniqueLangues = useMemo(() => {
    const languesSet = new Set<string>();
    for (const m of members) {
      const languesStr = m.rawRow["Langue(s) parlée(s)"] ?? m.rawRow["Langues"] ?? "";
      if (languesStr.trim()) {
        // Séparer les langues par virgule, point-virgule, ou autre séparateur
        const langues = languesStr
          .split(/[,;]/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        langues.forEach((langue) => languesSet.add(langue));
      }
    }
    return Array.from(languesSet).sort((a, b) => a.localeCompare(b, "fr"));
  }, [members]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.pays.length > 0) c++;
    if (filters.nda) c++;
    if (filters.referents.length > 0) c++;
    if (filters.langues.length > 0) c++;
    return c;
  }, [filters]);

  const hasData = data && data.headers.length > 0;
  const showMap = hasData && !error;
  const isEmpty = hasData && members.length === 0;
  const noResults =
    hasData && members.length > 0 && filteredMembers.length === 0;

  /* ── Handlers ─────────────────────────────────────────── */

  const handleMemberClick = useCallback((member: MemberLocation) => {
    setSelectedMember(member);
    setPanelOpen(true);
  }, []);

  const handleOpenAdd = useCallback(() => {
    setSelectedMember(null);
    setPanelOpen(true);
  }, []);

  const handlePanelClose = useCallback(() => {
    setPanelOpen(false);
    setSelectedMember(null);
    setSaveError(null);
  }, []);

  /** Clic sur la carte (pas sur un marqueur) → ferme le panneau. */
  const handleMapClick = useCallback(() => {
    if (panelOpen) {
      setPanelOpen(false);
      setSelectedMember(null);
      setSaveError(null);
    }
  }, [panelOpen]);

  const handleSaveMember = useCallback(
    async (updated: MemberLocation) => {
      if (updated.id.startsWith("sheet-")) {
        setSaving(true);
        setSaveError(null);
        try {
          const memberData = {
            pseudo: updated.pseudo,
            entreprise: updated.rawRow["Entreprise"] ?? "",
            prenom: updated.rawRow["Prénom"] ?? "",
            nom: updated.rawRow["Nom"] ?? "",
            idDiscord: updated.rawRow["ID Discord"] ?? "",
            email: updated.rawRow["Email"] ?? "",
            pays: updated.pays,
            ville: updated.ville,
            region: updated.region,
            langues: updated.rawRow["Langue(s) parlée(s)"] ?? "",
            ndaSignee: updated.rawRow["NDA Signée"] ?? "",
            referent: updated.rawRow["Referent"] ?? "",
            notes: updated.rawRow["Notes"] ?? "",
            latitude: String(updated.latitude),
            longitude: String(updated.longitude),
            lock: updated.rawRow["Lock"] ?? updated.rawRow["lock"] ?? "",
            twitter: updated.rawRow["Twitter"] ?? "",
            instagram: updated.rawRow["Instagram"] ?? "",
            tiktok: updated.rawRow["Tiktok"] ?? "",
            youtube: updated.rawRow["Youtube"] ?? "",
            linkedin: updated.rawRow["Linkedin"] ?? "",
            twitch: updated.rawRow["Twitch"] ?? "",
            autre: updated.rawRow["Autre"] ?? "",
          };

          if (useClientApi) {
            // Client-side direct API call
            const result = await updateRowInSheet(updated.id, memberData, contactType);
            if (!result.ok) {
              setSaveError(
                result.error ?? "Erreur lors de l'enregistrement."
              );
              throw new Error(result.error);
            }
          } else {
            // Dev server API route fallback
            const res = await fetch("/api/sheets/update", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                memberId: updated.id,
                contactType,
                ...memberData,
              }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              setSaveError(
                json.error ??
                  `Erreur ${res.status} lors de l'enregistrement.`
              );
              throw new Error(json.error);
            }
          }
          devLog("handleSaveMember", "Mise à jour OK → journal + refresh");
          if (useClientApi) {
            void appendJournalEntry("Modifié", contactType, {
              memberId: updated.id,
              pseudo: getMemberDisplayName(updated, contactType),
            });
          }

          setMembers((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
          setSelectedMember(updated);
          const freshMembers = await loadFromSheet(true);
          setSelectedMember((prev) =>
            prev && freshMembers.length
              ? (freshMembers.find((m) => m.id === prev!.id) ?? prev)
              : prev
          );
        } catch {
          /* saveError déjà positionné — actualiser pour que le switch reflète l'état réel et permettre de réessayer */
          const savedId = updated.id;
          devLog("handleSaveMember", "Erreur → rechargement sheet");
          const freshMembers = await loadFromSheet(true);
          setSelectedMember((prev) =>
            prev?.id === savedId && freshMembers?.length
              ? (freshMembers.find((m) => m.id === savedId) ?? prev)
              : prev
          );
        } finally {
          setSaving(false);
        }
      } else {
        setMembers((prev) =>
          prev.map((m) => (m.id === updated.id ? updated : m))
        );
      }
    },
    [contactType, loadFromSheet]
  );

  const handleAddMember = useCallback(
    async (newMember: MemberLocation) => {
      setSaving(true);
      setSaveError(null);
      try {
        const memberData = {
          pseudo: newMember.pseudo,
          entreprise: newMember.rawRow["Entreprise"] ?? "",
          prenom: newMember.rawRow["Prénom"] ?? "",
          nom: newMember.rawRow["Nom"] ?? "",
          idDiscord: newMember.rawRow["ID Discord"] ?? "",
          email: newMember.rawRow["Email"] ?? "",
          pays: newMember.pays,
          ville: newMember.ville,
          region: newMember.region,
          langues: newMember.rawRow["Langue(s) parlée(s)"] ?? "",
          ndaSignee: newMember.rawRow["NDA Signée"] ?? "",
          referent: newMember.rawRow["Referent"] ?? "",
          notes: newMember.rawRow["Notes"] ?? "",
          latitude: String(newMember.latitude),
          longitude: String(newMember.longitude),
          twitter: newMember.rawRow["Twitter"] ?? "",
          instagram: newMember.rawRow["Instagram"] ?? "",
          tiktok: newMember.rawRow["Tiktok"] ?? "",
          youtube: newMember.rawRow["Youtube"] ?? "",
          linkedin: newMember.rawRow["Linkedin"] ?? "",
          twitch: newMember.rawRow["Twitch"] ?? "",
          autre: newMember.rawRow["Autre"] ?? "",
        };

        if (useClientApi) {
          const result = await appendRowToSheet(memberData, contactType);
          if (!result.ok) {
            setSaveError(
              result.error ?? "Erreur lors de l'ajout au tableur."
            );
            throw new Error(result.error);
          }
          devLog("handleAddMember", "Ajout OK (client API)");
        } else {
          const res = await fetch("/api/sheets/append", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...memberData, contactType }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            setSaveError(
              json.error ??
                `Erreur ${res.status} lors de l'ajout au tableur.`
            );
            throw new Error(json.error);
          }
          devLog("handleAddMember", "Ajout OK (API route)");
        }
        if (useClientApi) {
          void appendJournalEntry("Ajouté", contactType, {
            pseudo: newMember.pseudo,
            details: newMember.ville || newMember.pays ? `${newMember.ville || ""} ${newMember.pays || ""}`.trim() : undefined,
          });
        }
        devLog("handleAddMember", "Refresh liste (force)");
        await loadFromSheet(true);
      } finally {
        setSaving(false);
      }
    },
    [loadFromSheet, contactType]
  );

  const handleDeleteMember = useCallback(
    async (member: MemberLocation) => {
      if (!member.id.startsWith("sheet-")) {
        // Local member, just remove from state
        setMembers((prev) => prev.filter((m) => m.id !== member.id));
        return;
      }

      setDeleting(true);
      setSaveError(null);
      try {
        if (useClientApi) {
          const result = await deleteRowInSheet(member.id, contactType);
          if (!result.ok) {
            setSaveError(
              result.error ?? "Erreur lors de la suppression."
            );
            throw new Error(result.error);
          }
          devLog("handleDeleteMember", "Suppression OK (client API)");
        } else {
          const res = await fetch("/api/sheets/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memberId: member.id, contactType }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            const errorMsg = json.error ?? `Erreur ${res.status} lors de la suppression.`;
            console.error("[handleDeleteMember] Erreur serveur:", json);
            setSaveError(errorMsg);
            throw new Error(errorMsg);
          }
          devLog("handleDeleteMember", "Suppression OK (API route)");
        }
        if (useClientApi) {
          void appendJournalEntry("Supprimé", contactType, {
            memberId: member.id,
            pseudo: getMemberDisplayName(member, contactType),
          });
        }
        devLog("handleDeleteMember", "Refresh liste (force)");
        await loadFromSheet(true);
      } finally {
        setDeleting(false);
      }
    },
    [loadFromSheet, contactType]
  );

  const clearFilters = useCallback(() => {
    setFilters(emptyFilters);
    setSearchQuery("");
  }, []);

  /** Exporte la liste filtrée en CSV ; demande toujours où enregistrer (Tauri = dialogue natif, navigateur = showSaveFilePicker ou téléchargement). */
  const handleExportCsv = useCallback(async () => {
    if (!data?.headers?.length || filteredMembers.length === 0) return;
    const headers = data.headers;
    const rows = filteredMembers.map((m) =>
      headers.map((h) => {
        const v = m.rawRow[h.trim()] ?? "";
        const escaped = /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        return escaped;
      }).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\r\n");
    const suggestedName = `contacts_${contactType}_${new Date().toISOString().slice(0, 10)}.csv`;
    const contentWithBom = "\uFEFF" + csv;

    // App Tauri : dialogue natif "Enregistrer sous" (toujours demander où enregistrer)
    if (isTauri) {
      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const path = await save({
          defaultPath: suggestedName,
          filters: [{ name: "Fichier CSV", extensions: ["csv"] }],
        });
        if (path) {
          const { writeTextFile } = await import("@tauri-apps/plugin-fs");
          await writeTextFile(path, contentWithBom);
        }
      } catch {
        // Annulé par l'utilisateur ou erreur d'écriture
      }
      return;
    }

    // Navigateur : "Enregistrer sous" si l'API est disponible (Chrome, Edge)
    if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
      try {
        const handle = await (window as Window & { showSaveFilePicker: (o?: { suggestedName?: string; types?: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileSystemFileHandle> })
          .showSaveFilePicker({
            suggestedName,
            types: [
              { description: "Fichier CSV", accept: { "text/csv": [".csv"] } },
              { description: "Tous les fichiers", accept: { "application/octet-stream": [".*"] } },
            ],
          });
        const writable = await handle.createWritable();
        await writable.write(new Blob([contentWithBom], { type: "text/csv;charset=utf-8" }));
        await writable.close();
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    // Fallback navigateur : téléchargement vers le dossier par défaut
    const blob = new Blob([contentWithBom], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, filteredMembers, contactType, isTauri]);

  const handleLoadingFinished = useCallback(() => {
    setFirstLoad(false);
  }, []);

  /* ── Filter select classes ────────────────────────────── */
  const selectCls =
    "h-8 w-full rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white outline-none focus-visible:border-violet-500/50 focus-visible:ring-1 focus-visible:ring-violet-500/40 [&>option]:bg-zinc-900 [&>option]:text-white";

  /* ── Render ───────────────────────────────────────────── */

  return (
    <PasswordGate>
      <div className="flex h-screen flex-col overflow-hidden bg-[#07070b] text-zinc-100">
      {/* Loading Screen */}
      <LoadingScreen loading={loading && firstLoad} onFinished={handleLoadingFinished} />

      {/* ── Header ─────────────────────────────────────── */}
      <header className="relative z-20 shrink-0 border-b border-white/[0.06] bg-[#0a0a10]/90 backdrop-blur-xl">
        <div className="flex items-center gap-2 px-3 py-2">
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="flex size-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={sidebarOpen ? "Fermer le panneau" : "Ouvrir le panneau"}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </button>

          {/* App title */}
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-violet-600/20">
              <MapPin className="size-3.5 text-violet-400" />
            </div>
            <span className="hidden text-sm font-semibold tracking-tight text-white sm:inline">
              Contacts Map
            </span>
          </div>

          {/* Contact type switch */}
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-1">
            <button
              onClick={() => setContactType("communication")}
              className={`px-3 py-1 text-xs font-medium transition-colors rounded ${
                contactType === "communication"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Communication
            </button>
            <button
              onClick={() => setContactType("commercial")}
              className={`px-3 py-1 text-xs font-medium transition-colors rounded ${
                contactType === "commercial"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Commercial
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
            <Input
              ref={searchInputRef}
              type="search"
              placeholder="Rechercher…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 border-white/10 bg-white/5 pl-8 text-xs text-white placeholder:text-zinc-500 focus-visible:ring-violet-500/50"
            />
          </div>

          {/* Counter */}
          {showMap && (
            <div className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs sm:flex">
              <Users className="size-3.5 text-violet-400" />
              <span className="text-zinc-400">
                {filteredMembers.length === members.length
                  ? `${members.length}`
                  : `${filteredMembers.length}/${members.length}`}
              </span>
            </div>
          )}

          {/* Rafraîchir (visible) */}
          {showMap && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refreshFromSheet()}
              disabled={loading}
              className="h-8 px-2.5 text-xs text-zinc-400 hover:text-white"
              title="Rafraîchir les données du tableur"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline ml-1">Rafraîchir</span>
            </Button>
          )}

          {/* Journal des modifications */}
          <Link
            href="/journal"
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Voir le journal des modifications"
          >
            <ScrollText className="size-3.5" />
            <span className="hidden sm:inline">Journal</span>
          </Link>

          {/* Filter toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters((f) => !f)}
            className={`relative h-8 px-2.5 text-xs ${
              showFilters || activeFilterCount > 0
                ? "bg-violet-600/20 text-violet-300"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Filter className="size-3.5" />
            <span className="hidden sm:inline">Filtres</span>
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {/* Add button */}
          {showMap && (
            <Button
              onClick={handleOpenAdd}
              size="sm"
              className="h-8 bg-violet-600 px-3 text-xs text-white hover:bg-violet-500"
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">Ajouter</span>
            </Button>
          )}

          {/* More actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-zinc-400 hover:text-white"
              >
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 border-white/10 bg-zinc-900/95 backdrop-blur-xl"
            >
              <DropdownMenuLabel className="text-zinc-400">
                Actions
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              {showMap && (
                <DropdownMenuItem
                  onClick={handleOpenAdd}
                  className="focus:bg-violet-600/20 focus:text-violet-100"
                >
                  <UserPlus className="size-4" />
                  Ajouter un contact
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => void refreshFromSheet()}
                disabled={loading}
                className="focus:bg-violet-600/20 focus:text-violet-100"
              >
                <RefreshCw
                  className={`size-4 ${loading ? "animate-spin" : ""}`}
                />
                {loading ? "Chargement…" : "Rafraîchir les données"}
              </DropdownMenuItem>
              {showMap && filteredMembers.length > 0 && (
                <DropdownMenuItem
                  onClick={handleExportCsv}
                  className="focus:bg-violet-600/20 focus:text-violet-100"
                >
                  <Download className="size-4" />
                  Exporter en CSV
                </DropdownMenuItem>
              )}
              {isTauri && (
                <DropdownMenuItem
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("projet-paris:check-update")
                    )
                  }
                  className="focus:bg-violet-600/20 focus:text-violet-100"
                >
                  <Download className="size-4" />
                  Vérifier les mises à jour
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Filter bar ──────────────────────────────── */}
        {showFilters && (
          <div className="border-t border-white/[0.04] bg-white/[0.02] px-3 py-2">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-0.5">
                <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Pays
                </label>
                <div className="w-48">
                  <CountryMultiSelect
                    selected={filters.pays}
                    onChange={(selected) =>
                      setFilters((f) => ({ ...f, pays: selected }))
                    }
                    options={uniqueCountries}
                    placeholder="Sélectionner des pays"
                  />
                </div>
              </div>

              <div className="space-y-0.5">
                <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  NDA
                </label>
                <select
                  value={filters.nda}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, nda: e.target.value }))
                  }
                  className={selectCls}
                >
                  <option value="">Tous</option>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </div>

              <div className="space-y-0.5">
                <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Referent
                </label>
                <div className="w-48">
                  <ReferentMultiSelect
                    selected={filters.referents}
                    onChange={(selected) =>
                      setFilters((f) => ({ ...f, referents: selected }))
                    }
                    options={uniqueReferents}
                    placeholder="Sélectionner des référents"
                  />
                </div>
              </div>

              <div className="space-y-0.5">
                <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Langue(s)
                </label>
                <div className="w-48">
                  <LanguageMultiSelect
                    value={filters.langues.join(", ")}
                    onChange={(value) => {
                      // Convertir la chaîne séparée par virgules en tableau
                      const languesArray = value
                        .split(",")
                        .map((l) => l.trim())
                        .filter((l) => l.length > 0);
                      setFilters((f) => ({ ...f, langues: languesArray }));
                    }}
                    placeholder="Sélectionner des langues"
                  />
                </div>
              </div>

              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 text-xs text-zinc-400 hover:text-white"
                >
                  <X className="size-3" />
                  Effacer
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Error bar */}
        {error && (
          <div className="border-t border-red-500/20 bg-red-500/5 px-3 py-2">
            <div className="flex items-start gap-2 text-xs text-red-300">
              <AlertCircle className="size-4 shrink-0 text-red-400" />
              <p>{error}</p>
            </div>
          </div>
        )}
      </header>

      {/* ── Main content ───────────────────────────────── */}
      <div className="relative flex min-h-0 flex-1">
        {/* Tauri updater */}
        {isTauri && <UpdateChecker />}

        {/* ── Sidebar ──────────────────────────────────── */}
        <aside
          className={`shrink-0 border-r border-white/[0.06] bg-[#0a0a10]/80 backdrop-blur-sm transition-all duration-300 ${
            sidebarOpen ? "w-64" : "w-0 overflow-hidden border-r-0"
          }`}
        >
          <div className="flex h-full w-64 flex-col">
            {/* Contact list header + tri */}
            <div className="border-b border-white/[0.04] px-3 py-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Contacts
                </span>
                <span className="rounded-md bg-violet-600/20 px-1.5 py-0.5 text-[10px] font-semibold text-violet-400">
                  {filteredMembers.length}
                </span>
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full h-7 rounded border border-white/10 bg-white/5 px-2 text-[11px] text-zinc-300 focus:border-violet-500/50 focus:outline-none [&>option]:bg-zinc-900"
              >
                <option value="name">Tri : Nom</option>
                <option value="pays">Tri : Pays</option>
                <option value="nda">Tri : NDA</option>
                <option value="date">Tri : Date ajout</option>
                <option value="recent">Récent en premier</option>
              </select>
            </div>

            {/* Contact list : virtualisée si 100+ contacts, sinon liste classique */}
            <div ref={sidebarListRef} className="flex-1 overflow-y-auto">
              {filteredMembers.length === 0 && !loading && (
                <div className="px-3 py-8 text-center text-xs text-zinc-600">
                  Aucun contact trouvé
                </div>
              )}
              {filteredMembers.length > 0 && useVirtualizedList && (
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    position: "relative",
                    width: "100%",
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const row = flatSidebarRows[virtualRow.index];
                    if (!row) return null;
                    if (row.kind === "section") {
                      const isRefus = row.label === "REFUS";
                      return (
                        <div
                          key={row.id}
                          className="border-b border-white/[0.04] px-2 pt-2 flex items-center gap-1.5"
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${isRefus ? "text-red-400/90" : "text-zinc-500"}`}>
                            {row.label}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] ${isRefus ? "bg-red-500/20 text-red-400" : "bg-violet-600/20 text-violet-400"}`}>
                            {row.count}
                          </span>
                        </div>
                      );
                    }
                    const { member: m, section } = row;
                    const isRefus = section === "refus";
                    const displayName = contactType === "commercial" ? getMemberDisplayName(m, "commercial") : m.pseudo;
                    const ndaOui = ((m.rawRow["NDA Signée"] ?? m.rawRow["NDA Signee"] ?? "").trim().toLowerCase() === "oui");
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleMemberClick(m)}
                        className={`group flex w-full items-start gap-2.5 border-b border-white/[0.03] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03] ${
                          selectedMember?.id === m.id
                            ? isRefus ? "bg-red-600/10 border-l-2 border-l-red-500" : "bg-violet-600/10 border-l-2 border-l-violet-500"
                            : ""
                        }`}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${isRefus ? "bg-red-600/20 text-red-300" : "bg-violet-600/20 text-violet-300"}`}>
                          {(displayName?.[0] ?? "?").toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-200 group-hover:text-white">
                            {displayName}
                          </p>
                          <p className="truncate text-[11px] text-zinc-500">
                            {[m.ville, m.pays].filter(Boolean).join(", ")}
                          </p>
                        </div>
                        {isRefus ? (
                          <span className="mt-0.5 shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-red-400">
                            REFUS
                          </span>
                        ) : ndaOui ? (
                          <span className="mt-0.5 shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-400">
                            NDA
                          </span>
                        ) : (
                          <span className="mt-0.5 shrink-0 rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-rose-400">
                            NDA
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {filteredMembers.length > 0 && !useVirtualizedList && (
                <>
                  {contactType === "communication" && (
                    <>
                      {sortedActifs.length > 0 && (
                        <div className="border-b border-white/[0.04] px-2 pt-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                            Contacts
                          </span>
                          <span className="ml-1.5 rounded bg-violet-600/20 px-1.5 py-0.5 text-[10px] text-violet-400">
                            {sortedActifs.length}
                          </span>
                        </div>
                      )}
                      {sortedActifs.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleMemberClick(m)}
                          className={`group flex w-full items-start gap-2.5 border-b border-white/[0.03] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03] ${
                            selectedMember?.id === m.id
                              ? "bg-violet-600/10 border-l-2 border-l-violet-500"
                              : ""
                          }`}
                        >
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-600/20 text-xs font-bold text-violet-300">
                            {(m.pseudo?.[0] ?? "?").toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-zinc-200 group-hover:text-white">
                              {m.pseudo}
                            </p>
                            <p className="truncate text-[11px] text-zinc-500">
                              {[m.ville, m.pays].filter(Boolean).join(", ")}
                            </p>
                          </div>
                          {((m.rawRow["NDA Signée"] ?? "").trim().toLowerCase() === "oui" ||
                            (m.rawRow["NDA Signee"] ?? "").trim().toLowerCase() === "oui") ? (
                            <span className="mt-0.5 shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-400">
                              NDA
                            </span>
                          ) : (
                            <span className="mt-0.5 shrink-0 rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-rose-400">
                              NDA
                            </span>
                          )}
                        </button>
                      ))}
                      {sortedRefus.length > 0 && (
                        <div className="border-b border-white/[0.04] px-2 pt-3">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400/90">
                            REFUS
                          </span>
                          <span className="ml-1.5 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400">
                            {sortedRefus.length}
                          </span>
                        </div>
                      )}
                      {sortedRefus.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleMemberClick(m)}
                          className={`group flex w-full items-start gap-2.5 border-b border-white/[0.03] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03] ${
                            selectedMember?.id === m.id
                              ? "bg-red-600/10 border-l-2 border-l-red-500"
                              : ""
                          }`}
                        >
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-600/20 text-xs font-bold text-red-300">
                            {(m.pseudo?.[0] ?? "?").toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-zinc-200 group-hover:text-white">
                              {m.pseudo}
                            </p>
                            <p className="truncate text-[11px] text-zinc-500">
                              {[m.ville, m.pays].filter(Boolean).join(", ")}
                            </p>
                          </div>
                          <span className="mt-0.5 shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-red-400">
                            REFUS
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                  {contactType === "commercial" &&
                    sortedCommercial.map((m) => {
                      const displayName = getMemberDisplayName(m, "commercial");
                      return (
                        <button
                          key={m.id}
                          onClick={() => handleMemberClick(m)}
                          className={`group flex w-full items-start gap-2.5 border-b border-white/[0.03] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03] ${
                            selectedMember?.id === m.id
                              ? "bg-violet-600/10 border-l-2 border-l-violet-500"
                              : ""
                          }`}
                        >
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-600/20 text-xs font-bold text-violet-300">
                            {(displayName?.[0] ?? "?").toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-zinc-200 group-hover:text-white">
                              {displayName}
                            </p>
                            <p className="truncate text-[11px] text-zinc-500">
                              {[m.ville, m.pays].filter(Boolean).join(", ")}
                            </p>
                          </div>
                          {((m.rawRow["NDA Signée"] ?? "").trim().toLowerCase() === "oui" ||
                            (m.rawRow["NDA Signee"] ?? "").trim().toLowerCase() === "oui") ? (
                            <span className="mt-0.5 shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-400">
                              NDA
                            </span>
                          ) : (
                            <span className="mt-0.5 shrink-0 rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-rose-400">
                              NDA
                            </span>
                          )}
                        </button>
                      );
                    })}
                </>
              )}
            </div>

            {/* Sidebar footer */}
            {showMap && (
              <div className="border-t border-white/[0.04] p-2">
                <Button
                  onClick={handleOpenAdd}
                  size="sm"
                  className="w-full bg-violet-600/20 text-xs text-violet-300 hover:bg-violet-600/30"
                >
                  <UserPlus className="size-3.5" />
                  Nouveau contact
                </Button>
              </div>
            )}
          </div>
        </aside>

        {/* ── Map area ─────────────────────────────────── */}
        <main className="relative min-h-0 flex-1">
          {/* Empty states */}
          {!showMap && !loading && !error && (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
              <div className="rounded-2xl bg-zinc-800/80 p-6 shadow-xl">
                <Users className="size-12 text-zinc-500" />
              </div>
              <p className="text-zinc-400">
                En attente des données du Google Sheet…
              </p>
              <p className="text-xs text-zinc-600">
                Vérifiez que les variables d&apos;environnement sont définies.
              </p>
            </div>
          )}

          {showMap && isEmpty && (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
              <div className="rounded-2xl bg-amber-500/10 p-6">
                <Users className="size-12 text-amber-500/80" />
              </div>
              <p className="text-zinc-300">
                Aucun contact avec pays/ville reconnu.
              </p>
              <p className="max-w-md text-sm text-zinc-500">
                Ajoutez des colonnes « Pays » et « Ville » dans votre Google
                Sheet pour afficher les contacts sur la carte.
              </p>
            </div>
          )}

          {showMap && noResults && (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
              <Search className="size-12 text-zinc-500" />
              <p className="text-zinc-300">
                Aucun résultat pour « {searchQuery} »
              </p>
              <Button
                variant="link"
                onClick={clearFilters}
                className="text-violet-400 hover:text-violet-300"
              >
                Effacer les filtres
              </Button>
            </div>
          )}

          {/* Map */}
          {showMap && filteredMembers.length > 0 && (
            <section className="absolute inset-0 z-0">
              <MemberMap
                members={filteredMembers}
                className="h-full w-full"
                onMemberClick={handleMemberClick}
                onMapClick={handleMapClick}
                focusMemberId={selectedMember?.id ?? null}
                contactType={contactType}
              />
            </section>
          )}

          {/* Detail panel */}
          <MemberDetailPanel
            member={selectedMember}
            open={panelOpen}
            onClose={handlePanelClose}
            onSave={handleSaveMember}
            onAdd={handleAddMember}
            onDelete={handleDeleteMember}
            saveError={saveError}
            saving={saving}
            deleting={deleting}
            contactType={contactType}
          />

          {/* Loading overlay (after first load) */}
          {loading && !firstLoad && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/90 px-8 py-6 shadow-2xl">
                <div className="size-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                <span className="text-xs text-zinc-400">
                  Actualisation…
                </span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
    </PasswordGate>
  );
}
