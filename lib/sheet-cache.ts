/**
 * Cache local SQLite (Tauri) pour les données Google Sheets.
 * Permet d'ouvrir l'app instantanément hors-ligne avec les dernières données.
 */

import { devLog, devWarn } from "./console-banner";

const DB_NAME = "sqlite:contacts_cache.db";

export interface CachedSheet {
  data_json: string;
  fetched_at: number;
}

function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

/** Type minimal pour éviter de dépendre des exports TypeScript de @tauri-apps/plugin-sql (incompatibles en build). */
interface TauriSqlDb {
  select<T>(query: string, bindings?: unknown[]): Promise<T[]>;
  execute(query: string, bindings?: unknown[]): Promise<unknown>;
}

let dbPromise: Promise<TauriSqlDb> | null = null;

function getDb(): Promise<TauriSqlDb> | null {
  if (!dbPromise && isTauri()) {
    try {
      const { Database } = require("@tauri-apps/plugin-sql") as { Database: { load: (path: string) => Promise<TauriSqlDb> } };
      dbPromise = Database.load(DB_NAME);
    } catch {
      dbPromise = null;
    }
  }
  return dbPromise ?? null;
}

/** Récupère le cache pour un type de contact (communication | commercial). */
export async function getCachedSheet(
  contactType: string
): Promise<CachedSheet | null> {
  const p = getDb();
  if (!p) {
    devLog("sheet-cache", "Pas Tauri → pas de cache SQLite");
    return null;
  }
  try {
    const db = await p;
    const rows = await db.select<CachedSheet[]>(
      "SELECT data_json, fetched_at FROM sheet_cache WHERE contact_type = $1",
      [contactType]
    );
    if (rows?.length && rows[0]) {
      const cached = {
        data_json: rows[0].data_json,
        fetched_at: Number(rows[0].fetched_at),
      };
      devLog("sheet-cache", "HIT", contactType, new Date(cached.fetched_at).toISOString());
      return cached;
    }
    devLog("sheet-cache", "MISS", contactType);
  } catch (e) {
    devWarn("sheet-cache", "getCachedSheet error", e);
  }
  return null;
}

/** Enregistre le cache pour un type de contact. */
export async function setCachedSheet(
  contactType: string,
  dataJson: string,
  fetchedAt: number
): Promise<void> {
  const p = getDb();
  if (!p) return;
  try {
    const db = await p;
    await db.execute(
      "INSERT OR REPLACE INTO sheet_cache (contact_type, data_json, fetched_at) VALUES ($1, $2, $3)",
      [contactType, dataJson, fetchedAt]
    );
    devLog("sheet-cache", "setCachedSheet OK", contactType);
  } catch (e) {
    devWarn("sheet-cache", "setCachedSheet error", e);
  }
}

export { isTauri as isTauriEnv };
