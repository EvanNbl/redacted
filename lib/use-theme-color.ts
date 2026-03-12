"use client";

import { useState, useEffect } from "react";

/**
 * Lit la valeur calculée de --primary et la retourne en hex.
 * Utilise un canvas 2D pour convertir n'importe quel format CSS
 * (oklch, hsl, rgb...) en hex de façon fiable dans tous les navigateurs.
 * Se met à jour automatiquement quand le thème change.
 */
export function useThemePrimaryColor(): string {
  const [color, setColor] = useState("#8b5cf6");

  useEffect(() => {
    setColor(readPrimaryHex());

    const observer = new MutationObserver(() => {
      setColor(readPrimaryHex());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return color;
}

/**
 * Version impérative (non-hook) — utilisable dans des callbacks.
 */
export function getThemePrimaryColor(): string {
  if (typeof document === "undefined") return "#8b5cf6";
  return readPrimaryHex();
}

/** Éclaircit une couleur hex d'un facteur 0–1 (1 = blanc). */
export function lightenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(g + (255 - g) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return toHex(lr, lg, lb);
}

/** Assombrit une couleur hex d'un facteur 0–1 (1 = noir). */
export function darkenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return toHex(
    Math.max(0, Math.round(r * (1 - amount))),
    Math.max(0, Math.round(g * (1 - amount))),
    Math.max(0, Math.round(b * (1 - amount)))
  );
}

// ── helpers internes ──────────────────────────────────────

/**
 * Lit --primary depuis document.documentElement via un canvas 2D.
 * Le canvas force la conversion de n'importe quel espace couleur en RGBA,
 * ce qui fonctionne avec oklch, hsl, rgb, hex, etc.
 */
function readPrimaryHex(): string {
  try {
    // 1. Récupère la valeur brute de la variable CSS (ex: "oklch(0.541 0.281 293.009)")
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--primary")
      .trim();

    if (!raw) return "#8b5cf6";

    // 2. Canvas 2D : ctx.fillStyle accepte tout format CSS et normalise en RGBA
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "#8b5cf6";

    ctx.fillStyle = raw;
    ctx.fillRect(0, 0, 1, 1);

    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return toHex(r, g, b);
  } catch {
    return "#8b5cf6";
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
