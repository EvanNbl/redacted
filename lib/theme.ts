export type ColorTheme = "neutre" | "violet" | "rouge" | "jaune" | "vert" | "bleu";

export const THEME_CLASSES: ColorTheme[] = ["neutre", "violet", "rouge", "jaune", "vert", "bleu"];

export const THEMES: {
  id: ColorTheme;
  label: string;
  swatch: string;
  className: string;
  ring: string;
}[] = [
  {
    id: "neutre",
    label: "Neutre",
    swatch: "bg-zinc-500",
    className:
      "border-zinc-400/80 bg-zinc-500/15 text-zinc-100 shadow-[0_0_0_1px_rgba(161,161,170,0.5)]",
    ring: "shadow-[0_0_10px_rgba(161,161,170,0.7)]",
  },
  {
    id: "violet",
    label: "Violet",
    swatch: "bg-gradient-to-br from-violet-400 via-violet-500 to-violet-700",
    className:
      "border-violet-400/80 bg-violet-500/15 text-violet-100 shadow-[0_0_0_1px_rgba(167,139,250,0.5)]",
    ring: "shadow-[0_0_10px_rgba(139,92,246,0.7)]",
  },
  {
    id: "rouge",
    label: "Rouge",
    swatch: "bg-gradient-to-br from-red-400 via-red-500 to-red-700",
    className:
      "border-red-400/80 bg-red-500/15 text-red-100 shadow-[0_0_0_1px_rgba(248,113,113,0.5)]",
    ring: "shadow-[0_0_10px_rgba(248,113,113,0.7)]",
  },
  {
    id: "jaune",
    label: "Jaune",
    swatch: "bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600",
    className:
      "border-yellow-400/80 bg-yellow-500/15 text-yellow-100 shadow-[0_0_0_1px_rgba(250,204,21,0.5)]",
    ring: "shadow-[0_0_10px_rgba(234,179,8,0.7)]",
  },
  {
    id: "vert",
    label: "Vert",
    swatch: "bg-gradient-to-br from-green-400 via-green-500 to-green-700",
    className:
      "border-green-400/80 bg-green-500/15 text-green-100 shadow-[0_0_0_1px_rgba(74,222,128,0.5)]",
    ring: "shadow-[0_0_10px_rgba(34,197,94,0.7)]",
  },
  {
    id: "bleu",
    label: "Bleu",
    swatch: "bg-gradient-to-br from-blue-400 via-blue-500 to-blue-700",
    className:
      "border-blue-400/80 bg-blue-500/15 text-blue-100 shadow-[0_0_0_1px_rgba(96,165,250,0.5)]",
    ring: "shadow-[0_0_10px_rgba(59,130,246,0.7)]",
  },
];

export const THEME_STORAGE_KEY = "color-theme";
export const SETUP_COMPLETED_KEY = "setup-completed";

export function applyColorTheme(theme: ColorTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  THEME_CLASSES.forEach((t) => root.classList.remove(`theme-${t}`));
  if (theme !== "neutre") {
    root.classList.add(`theme-${theme}`);
  }
}

export function getSavedTheme(): ColorTheme {
  if (typeof window === "undefined") return "violet";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ColorTheme | null;
    return THEME_CLASSES.includes(stored as ColorTheme) ? (stored as ColorTheme) : "violet";
  } catch {
    return "violet";
  }
}

export function saveTheme(theme: ColorTheme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export function isSetupCompleted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SETUP_COMPLETED_KEY) === "true";
  } catch {
    return false;
  }
}

export function markSetupCompleted() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETUP_COMPLETED_KEY, "true");
  } catch {
    // ignore
  }
}
