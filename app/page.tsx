"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseMembersFromTable } from "@/lib/member-locations";
import { MemberMap } from "@/components/MemberMap";
import { MemberDetailPanel } from "@/components/MemberDetailPanel";
import type { MemberLocation } from "@/lib/member-locations";
import {
  RefreshCw,
  Users,
  Search,
  AlertCircle,
  Plus,
  ChevronDown,
  UserPlus,
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

type ContactsTable = {
  headers: string[];
  rows: string[][];
};

const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SPREADSHEET_ID;
const SHEET_RANGE =
  process.env.NEXT_PUBLIC_GOOGLE_SHEETS_RANGE ?? "Contacts!A1:Z1000";
const SHEET_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY;

function filterMembers(
  members: MemberLocation[],
  query: string
): MemberLocation[] {
  if (!query.trim()) return members;
  const q = query.trim().toLowerCase();
  return members.filter(
    (m) =>
      m.pseudo.toLowerCase().includes(q) ||
      m.ville?.toLowerCase().includes(q) ||
      m.pays?.toLowerCase().includes(q) ||
      m.region?.toLowerCase().includes(q)
  );
}

export default function Home() {
  const [data, setData] = useState<ContactsTable | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [members, setMembers] = useState<MemberLocation[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberLocation | null>(
    null
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadFromSheet = useCallback(async () => {
    if (!SHEET_ID || !SHEET_API_KEY) {
      setError(
        "Configuration Google Sheets manquante. Vérifiez les variables d'environnement."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ key: SHEET_API_KEY });
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(
        SHEET_RANGE
      )}?${params.toString()}`;

      const res = await fetch(url);

      if (!res.ok) {
        const text = await res.text();
        if (res.status === 403) {
          setError(
            "Accès refusé (403). Vérifiez : 1) L'API Google Sheets est activée. 2) Le tableur est partagé « Toute personne disposant du lien peut voir ». 3) Référents autorisés si la clé API est restreinte."
          );
          return;
        }
        throw new Error(`Erreur API Google Sheets (${res.status}): ${text}`);
      }

      const json: { values?: string[][] } = await res.json();
      const values = json.values ?? [];

      if (values.length === 0) {
        setData({ headers: [], rows: [] });
        setMembers([]);
        return;
      }

      const [headers, ...rows] = values;
      setData({ headers, rows });
      setMembers(parseMembersFromTable(headers, rows));
    } catch (e) {
      console.error(e);
      setError("Impossible de charger les contacts depuis Google Sheets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFromSheet();
  }, [loadFromSheet]);

  const mapMembers = useMemo(
    () => filterMembers(members, searchQuery),
    [members, searchQuery]
  );

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

  const handleSaveMember = useCallback(
    async (updated: MemberLocation) => {
      if (updated.id.startsWith("sheet-")) {
        setSaving(true);
        setSaveError(null);
        try {
          const res = await fetch("/api/sheets/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              memberId: updated.id,
              pseudo: updated.pseudo,
              idDiscord: updated.rawRow["ID Discord"] ?? "",
              pays: updated.pays,
              ville: updated.ville,
              region: updated.region,
              langues: updated.rawRow["Langue(s) parlée(s)"] ?? "",
              ndaSignee: updated.rawRow["NDA Signée"] ?? "",
              referent: updated.rawRow["Referent"] ?? "",
              notes: updated.rawRow["Notes"] ?? "",
            }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            setSaveError(
              json.error ?? `Erreur ${res.status} lors de l'enregistrement.`
            );
            throw new Error(json.error);
          }
          setMembers((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
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
    []
  );

  const handleAddMember = useCallback(
    async (newMember: MemberLocation) => {
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch("/api/sheets/append", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pseudo: newMember.pseudo,
            idDiscord: newMember.rawRow["ID Discord"] ?? "",
            pays: newMember.pays,
            ville: newMember.ville,
            region: newMember.region,
            langues: newMember.rawRow["Langue(s) parlée(s)"] ?? "",
            ndaSignee: newMember.rawRow["NDA Signée"] ?? "",
            referent: newMember.rawRow["Referent"] ?? "",
            notes: newMember.rawRow["Notes"] ?? "",
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSaveError(
            json.error ?? `Erreur ${res.status} lors de l'ajout au tableur.`
          );
          throw new Error(json.error);
        }
        await loadFromSheet();
      } finally {
        setSaving(false);
      }
    },
    [loadFromSheet]
  );

  const hasData = data && data.headers.length > 0;
  const showMap = hasData && !error;
  const isEmpty = hasData && members.length === 0;
  const noResults = hasData && members.length > 0 && mapMembers.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0f] text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0a0a0f]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3">

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:gap-3">
            {/* Recherche */}
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
              <Input
                type="search"
                placeholder="Pseudo, ville, pays…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 border-white/10 bg-white/5 pl-9 text-white placeholder:text-zinc-500 focus-visible:ring-violet-500/50"
              />
            </div>

            {/* Compteur */}
            {showMap && (
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <Users className="size-4 text-violet-400" />
                <span className="text-zinc-400">
                  {mapMembers.length === members.length
                    ? `${members.length} contact${members.length > 1 ? "s" : ""}`
                    : `${mapMembers.length} / ${members.length}`}
                </span>
              </div>
            )}

            {/* Menu Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="border-violet-500/30 bg-violet-600/10 text-violet-200 hover:bg-violet-600/20 hover:text-violet-100"
                >
                  Actions
                  <ChevronDown className="size-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 border-white/10 bg-zinc-900/95 backdrop-blur-xl"
              >
                <DropdownMenuLabel className="text-zinc-400">
                  Contacts
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
                  onClick={loadFromSheet}
                  disabled={loading}
                  className="focus:bg-violet-600/20 focus:text-violet-100"
                >
                  <RefreshCw
                    className={`size-4 ${loading ? "animate-spin" : ""}`}
                  />
                  {loading ? "Chargement…" : "Rafraîchir les données"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {showMap && (
              <Button
                onClick={handleOpenAdd}
                variant="default"
                className="bg-violet-600 text-white hover:bg-violet-500"
              >
                <Plus className="size-4" />
                Ajouter
              </Button>
            )}

            <Button
              onClick={loadFromSheet}
              disabled={loading}
              className="bg-violet-600 text-white hover:bg-violet-500"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Chargement…" : "Rafraîchir"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mx-auto max-w-7xl px-3 pb-3 sm:px-4 sm:pb-4">
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              <AlertCircle className="size-5 shrink-0 text-red-400" />
              <p>{error}</p>
            </div>
          </div>
        )}
      </header>

      {/* Zone principale : carte plein écran */}
      <main className="relative flex-1">
        {!showMap && !loading && !error && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
            <div className="rounded-2xl bg-zinc-800/80 p-6 shadow-xl">
              <Users className="size-12 text-zinc-500" />
            </div>
            <p className="text-zinc-400">
              En attente des données du Google Sheet…
            </p>
            <p className="text-xs text-zinc-600">
              Vérifiez que les variables d'environnement sont définies.
            </p>
          </div>
        )}

        {showMap && isEmpty && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
            <div className="rounded-2xl bg-amber-500/10 p-6">
              <Users className="size-12 text-amber-500/80" />
            </div>
            <p className="text-zinc-300">
              Aucun contact avec pays/ville reconnu.
            </p>
            <p className="max-w-md text-sm text-zinc-500">
              Ajoutez des colonnes « Pays » et « Ville » dans votre Google Sheet
              pour afficher les contacts sur la carte.
            </p>
          </div>
        )}

        {showMap && noResults && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
            <Search className="size-12 text-zinc-500" />
            <p className="text-zinc-300">Aucun résultat pour « {searchQuery} »</p>
            <Button
              variant="link"
              onClick={() => setSearchQuery("")}
              className="text-violet-400 hover:text-violet-300"
            >
              Effacer la recherche
            </Button>
          </div>
        )}

        {showMap && mapMembers.length > 0 && (
          <section className="absolute inset-0 z-0">
            <MemberMap
              members={mapMembers}
              className="h-full w-full"
              onMemberClick={handleMemberClick}
            />
          </section>
        )}

        <MemberDetailPanel
          member={selectedMember}
          open={panelOpen}
          onClose={handlePanelClose}
          onSave={handleSaveMember}
          onAdd={handleAddMember}
          saveError={saveError}
          saving={saving}
        />

        {/* Overlay chargement global */}
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/90 px-8 py-6 shadow-2xl">
              <div className="size-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
              <span className="text-sm text-zinc-400">
                Chargement des contacts…
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
