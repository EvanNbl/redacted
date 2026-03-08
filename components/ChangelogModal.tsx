"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Bug, Wrench, Shield } from "lucide-react";

const APP_VERSION = "1.1.0";
const CHANGELOG_SEEN_KEY = "changelog-seen-version";

interface ChangelogEntry {
  icon: React.ReactNode;
  title: string;
  items: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    icon: <Sparkles className="size-4 text-violet-400" />,
    title: "Nouvelles fonctionnalites",
    items: [
      "Connexion avec Google (remplacement du mot de passe)",
      "Page Placement Salle : creation de plans, zones, assignation de places",
      "Previsualisation en temps reel des lignes et arcs (carres fantomes)",
      "Systeme de grille avec snap pour le placement",
      "Page Administration : gestion des utilisateurs, roles et permissions",
      "Page Profil : gestion du nom, avatar, vue des permissions",
      "Devblog : affichage des nouveautes apres chaque mise a jour",
    ],
  },
  {
    icon: <Wrench className="size-4 text-amber-400" />,
    title: "Ameliorations",
    items: [
      "Migration complete de Google Sheets vers Supabase",
      "Animations de transition entre les pages (Framer Motion)",
      "Ecran de chargement ameliore avec animations GSAP",
      "Journal enrichi : suivi des actions salle, admin et connexions",
      "Navigation laterale avec avatar utilisateur et menu contextuel",
      "Scrollbar personnalisee et transitions globales fluides",
      "Optimisation des performances (React.memo, lazy loading)",
    ],
  },
  {
    icon: <Shield className="size-4 text-emerald-400" />,
    title: "Securite",
    items: [
      "Systeme de roles (admin, editeur, viewer) avec permissions granulaires",
      "Row Level Security (RLS) sur toutes les tables Supabase",
      "Permissions par page : lecture, modification, suppression",
    ],
  },
  {
    icon: <Bug className="size-4 text-red-400" />,
    title: "Corrections",
    items: [
      "Correction de la creation automatique des profils a l'inscription",
      "Correction du CSP Tauri pour l'authentification Google",
    ],
  },
];

export function ChangelogModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(CHANGELOG_SEEN_KEY);
      if (seen !== APP_VERSION) {
        const timer = setTimeout(() => setOpen(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(CHANGELOG_SEEN_KEY, APP_VERSION);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={dismiss}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border border-white/[0.08] bg-[#0c0c14]/95 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-hidden"
          >
            {/* Header */}
            <div className="shrink-0 px-6 pt-6 pb-4 border-b border-white/[0.06]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-mono text-violet-400">
                      v{APP_VERSION}
                    </span>
                    <span className="text-[11px] text-zinc-600">Mise a jour</span>
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    Quoi de neuf ?
                  </h2>
                </div>
                <button
                  onClick={dismiss}
                  className="flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {CHANGELOG.map((section, si) => (
                <div key={si}>
                  <div className="flex items-center gap-2 mb-2.5">
                    {section.icon}
                    <h3 className="text-sm font-semibold text-white">
                      {section.title}
                    </h3>
                  </div>
                  <ul className="space-y-1.5 pl-6">
                    {section.items.map((item, ii) => (
                      <li
                        key={ii}
                        className="text-[13px] text-zinc-400 leading-relaxed list-disc marker:text-zinc-700"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-white/[0.06]">
              <button
                onClick={dismiss}
                className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2.5 transition-colors"
              >
                C'est compris !
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
