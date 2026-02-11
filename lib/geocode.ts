/**
 * Géocodage Nominatim (OSM) pour obtenir des coordonnées réelles
 * quand le Sheet n'a pas de colonnes Latitude/Longitude remplies.
 * Respecte la politique d'utilisation (1 req/s, User-Agent).
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const CACHE_KEY = "nominatim-geocode-cache";
const MIN_DELAY_MS = 1100;

let lastRequestTime = 0;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getCache(): Record<string, { lat: number; lon: number }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, { lat: number; lon: number }>;
  } catch {
    /* ignore */
  }
  return {};
}

function setCache(key: string, lat: number, lon: number): void {
  if (typeof window === "undefined") return;
  try {
    const cache = getCache();
    cache[key] = { lat, lon };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

function cacheKey(ville: string, pays: string): string {
  const v = ville.trim().toLowerCase();
  const p = pays.trim().toLowerCase();
  return `${v}|${p}`;
}

/**
 * Géocode "ville, pays" ou "pays" via Nominatim.
 * Retourne les coordonnées ou null en cas d'échec.
 */
export async function geocodePlace(
  ville: string,
  pays: string
): Promise<{ lat: number; lon: number } | null> {
  const key = cacheKey(ville, pays);
  const cached = getCache()[key];
  if (cached) return cached;

  const query = ville.trim() ? `${ville.trim()}, ${pays.trim()}` : pays.trim();
  if (!query) return null;

  const now = Date.now();
  const wait = Math.max(0, MIN_DELAY_MS - (now - lastRequestTime));
  if (wait > 0) await delay(wait);
  lastRequestTime = Date.now();

  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: "1",
      "accept-language": "fr",
    });
    const res = await fetch(`${NOMINATIM}?${params}`, {
      headers: { "User-Agent": "ProjetParisContacts/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : null;
    if (!first || first.lat == null || first.lon == null) return null;
    const lat = parseFloat(first.lat);
    const lon = parseFloat(first.lon);
    if (isNaN(lat) || isNaN(lon)) return null;
    setCache(key, lat, lon);
    return { lat, lon };
  } catch {
    return null;
  }
}

export type MemberWithCoords = {
  id: string;
  pseudo: string;
  pays: string;
  region: string;
  ville: string;
  latitude: number;
  longitude: number;
  hasExactCoords: boolean;
  rawRow: Record<string, string>;
};

/**
 * Enrichit les membres sans coordonnées exactes en géocodant "ville, pays" via Nominatim.
 * Retourne une nouvelle liste avec lat/lon mises à jour (et hasExactCoords à true pour les géocodés).
 */
export async function enrichMembersWithNominatim(
  members: MemberWithCoords[]
): Promise<MemberWithCoords[]> {
  const toEnrich = members.filter((m) => !m.hasExactCoords && m.pays.trim());
  if (toEnrich.length === 0) return members;

  const updated = new Map<string, MemberWithCoords>();
  for (const m of members) {
    updated.set(m.id, { ...m });
  }

  for (const m of toEnrich) {
    const coords = await geocodePlace(m.ville, m.pays);
    updated.set(m.id, {
      ...m,
      ...(coords
        ? { latitude: coords.lat, longitude: coords.lon, hasExactCoords: true }
        : { hasExactCoords: true }),
    });
  }

  return members.map((m) => updated.get(m.id) ?? m);
}
