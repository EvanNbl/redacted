/**
 * Parse les contacts Supabase et extrait les membres avec
 * une position géographique approximative (Pays, Ville) pour la carte.
 */

import { COUNTRIES_WITH_CAPITALS } from "./countries-data";
import type { ContactRow } from "./supabase-data";

export type MemberLocation = {
  /** UUID Supabase */
  id: string;
  pseudo: string;
  pays: string;
  region: string;
  ville: string;
  latitude: number;
  longitude: number;
  /** True si lat/lon viennent de la DB ; false = fallback (capitale) */
  hasExactCoords: boolean;
  /** Champs bruts pour compatibilité avec MemberDetailPanel et exports */
  rawRow: Record<string, string>;
};

/** True si la colonne Lock du contact communication est true/oui/1 */
export function isMemberLocked(m: MemberLocation): boolean {
  const v = (m.rawRow["Lock"] ?? "").trim().toLowerCase();
  return v === "true" || v === "oui" || v === "1";
}

/** True si la NDA est signée (Oui). */
export function isNdaSigned(m: MemberLocation): boolean {
  const v = (m.rawRow["NDA Signée"] ?? "").trim().toLowerCase();
  return v === "oui";
}

/** Libellé affiché : commercial = "Nom Prénom - Pseudo / Entreprise", communication = pseudo. */
export function getMemberDisplayName(
  m: MemberLocation,
  contactType: "communication" | "commercial"
): string {
  if (contactType === "commercial") {
    const nom = (m.rawRow["Nom"] ?? "").trim();
    const prenom = (m.rawRow["Prénom"] ?? "").trim();
    const pseudo = (m.pseudo ?? "").trim();
    const entreprise = (m.rawRow["Entreprise"] ?? "").trim();
    const namePart = [nom, prenom].filter(Boolean).join(" ").trim();
    let out = "";
    if (namePart) out = namePart;
    if (pseudo) out = out ? `${out} - ${pseudo}` : pseudo;
    if (entreprise) out = out ? `${out} / ${entreprise}` : entreprise;
    return out || "?";
  }
  return m.pseudo?.trim() || "?";
}

/* ── Geo helpers ─────────────────────────────────────── */

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function buildLookups(): {
  cityLookup: Record<string, [number, number]>;
  countryCenter: Record<string, [number, number]>;
} {
  const cityLookup: Record<string, [number, number]> = {};
  const countryCenter: Record<string, [number, number]> = {};
  for (const { pays, capitale, lat, lon } of COUNTRIES_WITH_CAPITALS) {
    const pNorm = normalize(pays);
    const capNorm = normalize(capitale);
    countryCenter[pNorm] = [lat, lon];
    if (capNorm && pNorm) cityLookup[`${capNorm} ${pNorm}`] = [lat, lon];
  }
  const extra: Array<[string, string, number, number]> = [
    ["Liège", "Belgique", 50.63, 5.57],
    ["Lyon", "France", 45.76, 4.84],
    ["Marseille", "France", 43.3, 5.37],
    ["Montréal", "Canada", 45.5, -73.57],
    ["Toronto", "Canada", 43.65, -79.38],
    ["Genève", "Suisse", 46.2, 6.15],
    ["Zurich", "Suisse", 47.38, 8.54],
  ];
  for (const [ville, pays, lat, lon] of extra) {
    const key = `${normalize(ville)} ${normalize(pays)}`;
    if (!cityLookup[key]) cityLookup[key] = [lat, lon];
  }
  const aliases: Array<[string, string]> = [
    ["belgium", "belgique"],
    ["switzerland", "suisse"],
    ["germany", "allemagne"],
    ["italy", "italie"],
    ["spain", "espagne"],
    ["usa", "etats-unis"],
    ["united kingdom", "royaume-uni"],
    ["uk", "royaume-uni"],
    ["netherlands", "pays-bas"],
  ];
  for (const [alias, pays] of aliases) {
    const pNorm = normalize(pays);
    if (countryCenter[pNorm] && !countryCenter[alias]) {
      countryCenter[alias] = countryCenter[pNorm];
    }
  }
  return { cityLookup, countryCenter };
}

const { cityLookup: CITY_LOOKUP, countryCenter: COUNTRY_CENTER } = buildLookups();

function getCoords(pays: string, ville: string): [number, number] | null {
  const p = normalize(pays);
  const v = normalize(ville);
  if (v && p) {
    const key = `${v} ${p}`;
    if (CITY_LOOKUP[key]) return CITY_LOOKUP[key];
  }
  if (p && COUNTRY_CENTER[p]) return COUNTRY_CENTER[p];
  return null;
}

export function getCoordsForMember(
  pays: string,
  ville: string
): [number, number] | null {
  return getCoords(pays, ville);
}

/**
 * Construit le rawRow (Record<string, string>) à partir d'un ContactRow Supabase.
 * Les clés correspondent aux anciens noms de colonnes Google Sheets
 * pour rester compatible avec MemberDetailPanel et les exports CSV.
 */
function buildRawRow(row: ContactRow): Record<string, string> {
  return {
    Pseudo: row.pseudo ?? "",
    Entreprise: row.entreprise ?? "",
    "Prénom": row.prenom ?? "",
    Nom: row.nom ?? "",
    "ID Discord": row.id_discord ?? "",
    Email: row.email ?? "",
    Pays: row.pays ?? "",
    "Region/Etat": row.region ?? "",
    Ville: row.ville ?? "",
    "Langue(s) parlée(s)": row.langues ?? "",
    "NDA Signée": row.nda_signee ?? "",
    Referent: row.referent ?? "",
    Notes: row.notes ?? "",
    Lock: row.lock ?? "",
    "Contacté": row.contacter ?? "",
    Twitter: row.twitter ?? "",
    Instagram: row.instagram ?? "",
    Tiktok: row.tiktok ?? "",
    Youtube: row.youtube ?? "",
    Linkedin: row.linkedin ?? "",
    Twitch: row.twitch ?? "",
    Autre: row.autre ?? "",
  };
}

/**
 * Convertit les lignes Supabase (ContactRow[]) en MemberLocation[].
 */
export function contactRowsToMembers(
  rows: ContactRow[],
  contactType: "communication" | "commercial"
): MemberLocation[] {
  const result: MemberLocation[] = [];

  for (const row of rows) {
    let pseudo = (row.pseudo ?? "").trim();

    if (contactType === "commercial") {
      const prenom = (row.prenom ?? "").trim();
      const nom = (row.nom ?? "").trim();
      const entreprise = (row.entreprise ?? "").trim();
      if (!pseudo && (prenom || nom)) {
        pseudo = [prenom, nom].filter(Boolean).join(" ").trim();
      }
      if (!pseudo && entreprise) pseudo = entreprise;
      if (!pseudo) continue;
    } else {
      if (!pseudo) continue;
    }

    const pays = (row.pays ?? "").trim();
    const region = (row.region ?? "").trim();
    const ville = (row.ville ?? "").trim();

    const rawLat = row.latitude;
    const rawLon = row.longitude;

    let latitude: number;
    let longitude: number;
    let hasExactCoords: boolean;

    if (rawLat != null && rawLon != null && !isNaN(rawLat) && !isNaN(rawLon) && (rawLat !== 0 || rawLon !== 0)) {
      latitude = rawLat;
      longitude = rawLon;
      hasExactCoords = true;
    } else {
      if (!pays) continue;
      const coords = getCoords(pays, ville);
      if (!coords) continue;
      latitude = coords[0];
      longitude = coords[1];
      hasExactCoords = false;
    }

    result.push({
      id: row.id,
      pseudo,
      pays,
      region,
      ville,
      latitude,
      longitude,
      hasExactCoords,
      rawRow: buildRawRow(row),
    });
  }

  return result;
}

// Legacy compat: kept for the migration script
export function parseMembersFromTable(
  headers: string[],
  rows: string[][],
  contactType: "communication" | "commercial" = "communication"
): MemberLocation[] {
  if (headers.length === 0 || rows.length === 0) return [];

  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    idx[h.trim().toLowerCase().replace(/\s+/g, " ")] = i;
  });
  const pseudoCol = idx["pseudo"] ?? 0;
  const entrepriseCol = idx["entreprise"] ?? -1;
  const prenomCol = idx["prénom"] ?? idx["prenom"] ?? -1;
  const nomCol = idx["nom"] ?? -1;
  const paysCol = idx["pays"] ?? -1;
  const regionCol = idx["region/etat"] ?? idx["region"] ?? -1;
  const villeCol = idx["ville"] ?? -1;
  const latCol = idx["latitude"] ?? idx["lat"] ?? -1;
  const lonCol = idx["longitude"] ?? idx["lon"] ?? -1;

  const result: MemberLocation[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    let pseudo = (row[pseudoCol] ?? "").trim();

    if (contactType === "commercial") {
      const prenom = prenomCol >= 0 ? (row[prenomCol] ?? "").trim() : "";
      const nom = nomCol >= 0 ? (row[nomCol] ?? "").trim() : "";
      const entreprise = entrepriseCol >= 0 ? (row[entrepriseCol] ?? "").trim() : "";
      if (!pseudo && (prenom || nom)) pseudo = [prenom, nom].filter(Boolean).join(" ").trim();
      if (!pseudo && entreprise) pseudo = entreprise;
      if (!pseudo) continue;
    } else {
      if (!pseudo) continue;
    }

    const pays = paysCol >= 0 ? (row[paysCol] ?? "").trim() : "";
    const region = regionCol >= 0 ? (row[regionCol] ?? "").trim() : "";
    const ville = villeCol >= 0 ? (row[villeCol] ?? "").trim() : "";

    const rawLat = latCol >= 0 ? parseFloat(row[latCol] ?? "") : NaN;
    const rawLon = lonCol >= 0 ? parseFloat(row[lonCol] ?? "") : NaN;

    let latitude: number;
    let longitude: number;
    let hasExactCoords: boolean;

    if (!isNaN(rawLat) && !isNaN(rawLon)) {
      latitude = rawLat;
      longitude = rawLon;
      hasExactCoords = true;
    } else {
      if (!pays) continue;
      const coords = getCoords(pays, ville);
      if (!coords) continue;
      latitude = coords[0];
      longitude = coords[1];
      hasExactCoords = false;
    }

    const rawRow: Record<string, string> = {};
    headers.forEach((h, i) => { rawRow[h.trim()] = row[i] ?? ""; });

    result.push({
      id: `sheet-${rowIndex}`,
      pseudo, pays, region, ville, latitude, longitude, hasExactCoords, rawRow,
    });
  }
  return result;
}
