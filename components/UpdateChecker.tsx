"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Download, RefreshCw, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

/* ─── Types ─── */

type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | {
      state: "available";
      version: string;
      currentVersion: string;
      notes?: string;
    }
  | { state: "downloading"; progress: number }
  | { state: "ready" }
  | { state: "error"; message: string }
  | { state: "upToDate" };

/* ─── Helpers ─── */

/** Compare deux versions semver. Retourne true si remote > local. */
function isNewerVersion(remote: string, local: string): boolean {
  const r = remote.replace(/^v/, "").split(".").map(Number);
  const l = local.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] ?? 0;
    const lv = l[i] ?? 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

/** Headers pour repo privé (optionnel). */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  const token = process.env.NEXT_PUBLIC_UPDATER_TOKEN ?? "";
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/* ═══════════════════════════════════════════════════ */
/*  Component                                          */
/* ═══════════════════════════════════════════════════ */

export function UpdateChecker() {
  const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });
  const [dismissed, setDismissed] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const downloadProgress = useRef({ downloaded: 0, contentLength: 0 });

  /* ─── Vérification via commande Tauri (get_app_versions = API GitHub côté Rust) ─── */
  const checkForUpdate = useCallback(async () => {
    if (typeof window === "undefined") return;

    try {
      const tauri = (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
      if (!tauri) return;

      setStatus({ state: "checking" });

      const { invoke } = await import("@tauri-apps/api/core");
      const v = (await invoke("get_app_versions", {})) as {
        current: string;
        latest: string | null;
        latest_notes: string | null;
        api_error?: string | null;
      };

      setCurrentVersion(v.current);

      const githubVersion = v.latest ?? "(indisponible)";
      console.log(
        "[Projet Paris] Version actuelle:",
        v.current,
        "| Version GitHub (latest):",
        githubVersion
      );
      if (v.api_error) {
        console.warn("[Projet Paris] API GitHub:", v.api_error);
      }

      if (!v.latest) {
        setStatus({ state: "upToDate" });
        return;
      }

      if (isNewerVersion(v.latest, v.current)) {
        setStatus({
          state: "available",
          version: v.latest,
          currentVersion: v.current,
          notes: v.latest_notes ?? undefined,
        });
      } else {
        setStatus({ state: "upToDate" });
      }
    } catch (err) {
      console.error("[Updater] Check failed:", err);
      setStatus({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  /* ─── Installation via plugin Tauri (avec progression) ─── */
  const installUpdate = useCallback(async () => {
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check({ headers: getAuthHeaders() });
      if (!update) return;

      downloadProgress.current = { downloaded: 0, contentLength: 0 };
      setStatus({ state: "downloading", progress: 0 });

      await update.downloadAndInstall(
        (event) => {
          switch (event.event) {
            case "Started":
              downloadProgress.current.contentLength = event.data.contentLength ?? 0;
              break;
            case "Progress":
              downloadProgress.current.downloaded += event.data.chunkLength ?? 0;
              if (downloadProgress.current.contentLength > 0) {
                const pct = Math.round(
                  (downloadProgress.current.downloaded / downloadProgress.current.contentLength) * 100
                );
                setStatus({ state: "downloading", progress: Math.min(99, pct) });
              }
              break;
            case "Finished":
              setStatus({ state: "ready" });
              break;
          }
        },
        { headers: getAuthHeaders() }
      );

      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (err) {
      console.error("[Updater] Install failed:", err);
      setStatus({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  /* ─── Auto-check au démarrage ─── */
  useEffect(() => {
    const timer = setTimeout(checkForUpdate, 3000);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  /* ─── Écouter l’événement pour re-vérifier depuis le menu ─── */
  useEffect(() => {
    const handler = () => {
      setDismissed(false);
      checkForUpdate();
    };
    window.addEventListener("projet-paris:check-update", handler);
    return () => window.removeEventListener("projet-paris:check-update", handler);
  }, [checkForUpdate]);

  /* ─── Auto-dismiss "à jour" ─── */
  useEffect(() => {
    if (status.state === "upToDate") {
      const timer = setTimeout(() => setDismissed(true), 4000);
      return () => clearTimeout(timer);
    }
  }, [status.state]);

  if (dismissed || status.state === "idle" || status.state === "checking") {
    return null;
  }

  const displayVersion = currentVersion || (status.state === "available" ? status.currentVersion : "");

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-80 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-900/95 shadow-2xl shadow-black/50 backdrop-blur-md">
        {/* ═══ À jour ═══ */}
        {status.state === "upToDate" && (
          <div className="flex items-center gap-3 px-4 py-3">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
            <span className="text-sm text-zinc-300">
              v{displayVersion} — à jour
            </span>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="ml-auto rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
              aria-label="Fermer"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* ═══ Mise à jour disponible ═══ */}
        {status.state === "available" && (
          <div className="space-y-3 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
                  <Download className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    Mise à jour v{status.version} disponible
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    Version actuelle : v{status.currentVersion}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
                aria-label="Fermer"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {status.notes && (
              <div className="max-h-20 overflow-y-auto rounded-lg bg-zinc-800/60 px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
                {status.notes}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={installUpdate}
                className="flex-1 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:from-violet-500 hover:to-violet-400"
              >
                Installer
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300"
              >
                Plus tard
              </button>
              <button
                type="button"
                onClick={checkForUpdate}
                className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300"
                title="Revérifier"
              >
                <RefreshCw className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ═══ Téléchargement ═══ */}
        {status.state === "downloading" && (
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-violet-400" />
              <p className="text-sm font-medium text-white">
                Téléchargement en cours…
              </p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-300"
                style={{ width: `${status.progress}%` }}
              />
            </div>
            <p className="text-right text-[10px] font-medium tabular-nums text-violet-300">
              {status.progress}%
            </p>
          </div>
        )}

        {/* ═══ Prêt (redémarrage) ═══ */}
        {status.state === "ready" && (
          <div className="flex items-center gap-3 p-4">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
            <p className="text-sm font-medium text-emerald-300">
              Installation terminée, redémarrage…
            </p>
          </div>
        )}

        {/* ═══ Erreur ═══ */}
        {status.state === "error" && (
          <div className="space-y-3 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-400">
                  Erreur de mise à jour
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                  {status.message}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={checkForUpdate}
                className="flex-1 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300"
              >
                Réessayer
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="flex-1 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
