/**
 * Parse le tableau Contacts (Google Sheets) et extrait les membres avec
 * une position géographique approximative (Pays, Ville) pour la carte.
 */

import { COUNTRIES_WITH_CAPITALS } from "./countries-data";

export type MemberLocation = {
  /** Identifiant unique (généré ou sheet-{index}) */
  id: string;
  pseudo: string;
  pays: string;
  region: string;
  ville: string;
  latitude: number;
  longitude: number;
  /** True si lat/lon viennent du Sheet ; false = fallback (capitale) à améliorer par géocodage */
  hasExactCoords: boolean;
  /** Ligne brute pour tooltip (langues, référent, etc.) */
  rawRow: Record<string, string>;
};

/** True si la colonne Lock du contact communication est true/oui/1 (case insensitive). */
export function isMemberLocked(m: MemberLocation): boolean {
  const v = (m.rawRow["Lock"] ?? m.rawRow["lock"] ?? "").trim().toLowerCase();
  return v === "true" || v === "oui" || v === "1";
}

/** True si la NDA est signée (Oui). */
export function isNdaSigned(m: MemberLocation): boolean {
  const v = (m.rawRow["NDA Signée"] ?? m.rawRow["NDA Signee"] ?? "").trim().toLowerCase();
  return v === "oui";
}

/** Libellé affiché sur la carte/globe : commercial = "Nom Prénom - Pseudo / Entreprise" (s'adapte aux champs remplis), communication = pseudo. */
export function getMemberDisplayName(
  m: MemberLocation,
  contactType: "communication" | "commercial"
): string {
  if (contactType === "commercial") {
    const nom = (m.rawRow["Nom"] ?? "").trim();
    const prenom = (m.rawRow["Prénom"] ?? m.rawRow["Prenom"] ?? "").trim();
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

/** Index des colonnes par nom d’en-tête (normalisé minuscule). */
function getHeaderIndices(headers: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  headers.forEach((h, i) => {
    const key = h.trim().toLowerCase().replace(/\s+/g, " ");
    out[key] = i;
  });
  return out;
}

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

/** Export pour créer un membre avec coordonnées (pays + ville). */
export function getCoordsForMember(
  pays: string,
  ville: string
): [number, number] | null {
  return getCoords(pays, ville);
}

/**
 * À partir du tableau renvoyé par Google Sheets (headers + rows),
 * retourne la liste des membres avec coordonnées quand on peut les déduire.
 */
export function parseMembersFromTable(
  headers: string[],
  rows: string[][],
  contactType: "communication" | "commercial" = "communication"
): MemberLocation[] {
  if (headers.length === 0 || rows.length === 0) return [];

  const idx = getHeaderIndices(headers);
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
    
    // Pour les commerciaux, construire le pseudo à partir de Prénom, Nom ou Entreprise si besoin
    if (contactType === "commercial") {
      const prenom = prenomCol >= 0 ? (row[prenomCol] ?? "").trim() : "";
      const nom = nomCol >= 0 ? (row[nomCol] ?? "").trim() : "";
      const entreprise = entrepriseCol >= 0 ? (row[entrepriseCol] ?? "").trim() : "";
      if (!pseudo && (prenom || nom)) {
        pseudo = [prenom, nom].filter(Boolean).join(" ").trim();
      }
      if (!pseudo && entreprise) pseudo = entreprise;
      if (!pseudo) continue; // Skip si pas de pseudo/prénom/nom/entreprise
    } else {
      if (!pseudo) continue; // Skip si pas de pseudo pour communication
    }
    
    const pays = paysCol >= 0 ? (row[paysCol] ?? "").trim() : "";
    const region = regionCol >= 0 ? (row[regionCol] ?? "").trim() : "";
    const ville = villeCol >= 0 ? (row[villeCol] ?? "").trim() : "";

    // Priorité : coordonnées exactes du Sheet, sinon géocodage
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
    headers.forEach((h, i) => {
      rawRow[h.trim()] = row[i] ?? "";
    });

    result.push({
      id: `sheet-${rowIndex}`,
      pseudo,
      pays,
      region,
      ville,
      latitude,
      longitude,
      hasExactCoords,
      rawRow,
    });
  }

  return result;
}
