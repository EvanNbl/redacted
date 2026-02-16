/**
 * Bannière de démarrage et logger dev pour la console.
 */

const IS_DEV =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";

let bannerShown = false;

export function logAppBanner(options?: {
  version?: string;
  sheetRange?: string;
  sheetRangeCom?: string;
  useClientApi?: boolean;
  hasServiceAccountKey?: boolean;
  isTauri?: boolean;
}): void {
  if (typeof window === "undefined" || bannerShown) return;
  bannerShown = true;

  const version = options?.version ?? "1.0.8";
  const styleTitle =
    "font-size: 14px; font-weight: bold; color: #a78bfa; letter-spacing: 0.05em;";
  const styleSub =
    "font-size: 11px; color: #94a3b8;";
  const styleAccent = "color: #8b5cf6;";

  console.log(
    "%c\n  ╭──────────────────────────────────────────╮\n  │  %cContacts Map%c  v" +
      version +
      "%c\n  │  %cPrêt · Tableur connecté%c\n  ╰──────────────────────────────────────────╯\n",
    "color: #64748b; font-size: 10px;",
    styleTitle,
    styleAccent,
    "color: #64748b; font-size: 10px;",
    styleSub,
    "color: #64748b; font-size: 10px;"
  );

  if (IS_DEV && options) {
    console.groupCollapsed("%c⚙ Config", "color: #a78bfa; font-weight: bold;");
    console.log(
      "API écriture (client):",
      options.useClientApi ? "✓ oui" : "→ routes API"
    );
    console.log(
      "Compte de service (client):",
      options.hasServiceAccountKey ? "✓ présent" : "— absent"
    );
    console.log("Plages:", options.sheetRange ?? "—", "|", options.sheetRangeCom ?? "—");
    console.log("Environnement:", options.isTauri ? "Tauri (desktop)" : "Navigateur");
    console.groupEnd();
  }
}

/** Log uniquement en développement. */
export function devLog(tag: string, ...args: unknown[]): void {
  if (IS_DEV) {
    console.log(`%c[${tag}]%c`, "color: #8b5cf6; font-weight: 500;", "color: inherit;", ...args);
  }
}

export function devWarn(tag: string, ...args: unknown[]): void {
  if (IS_DEV) {
    console.warn(`[${tag}]`, ...args);
  }
}
