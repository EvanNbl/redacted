export const BETA_SALLE_KEY = "beta-salle-enabled";

export function getSalleBetaEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(BETA_SALLE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setSalleBetaEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BETA_SALLE_KEY, String(enabled));
    window.dispatchEvent(
      new CustomEvent("beta-flags:update", {
        detail: { salle: enabled },
      })
    );
  } catch {
    // ignore
  }
}

