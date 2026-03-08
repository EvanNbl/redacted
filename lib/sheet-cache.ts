/**
 * Tauri environment detection utility.
 * (Ancien module de cache SQLite pour Google Sheets, simplifié.)
 */

function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

export { isTauri as isTauriEnv };
