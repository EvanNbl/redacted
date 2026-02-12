"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, ChevronDown, Search, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const AVAILABLE_LANGUAGES = [
  "Français",
  "Anglais",
  "Espagnol",
  "Italien",
  "Allemand",
  "Portugais",
  "Langues scandinaves",
  "Arabe",
  "Chinois",
  "Japonais",
  "Russe",
  "Néerlandais",
  "Polonais",
  "Turc",
  "Hindi",
  "Autre",
] as const;

interface LanguageMultiSelectProps {
  value: string; // Chaîne séparée par des virgules, ex: "Français, Anglais"
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Composant de sélection multiple de langues avec recherche.
 * Affiche les langues sélectionnées comme des tags et permet de rechercher/filtrer.
 */
export function LanguageMultiSelect({
  value,
  onChange,
  placeholder = "Sélectionner",
  id,
  className,
  disabled,
}: LanguageMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Parse les langues sélectionnées depuis la chaîne
  const selectedLanguages = value
    ? value
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  // Filtrer les langues disponibles selon la recherche
  const filteredLanguages = AVAILABLE_LANGUAGES.filter((lang) =>
    lang.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fermer le dropdown quand disabled
  useEffect(() => {
    if (disabled && isOpen) setIsOpen(false);
  }, [disabled, isOpen]);

  // Focus sur le champ de recherche quand le dropdown s'ouvre
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const toggleLanguage = (lang: string) => {
    const isSelected = selectedLanguages.includes(lang);
    let newSelected: string[];

    if (isSelected) {
      newSelected = selectedLanguages.filter((l) => l !== lang);
    } else {
      newSelected = [...selectedLanguages, lang];
    }

    onChange(newSelected.join(", "));
  };

  const removeLanguage = (lang: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = selectedLanguages.filter((l) => l !== lang);
    onChange(newSelected.join(", "));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
      setActiveIndex(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) =>
        Math.min(i + 1, filteredLanguages.length - 1)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      toggleLanguage(filteredLanguages[activeIndex]);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Zone de sélection principale */}
      <div
        className={cn(
          "flex min-h-8 h-8 w-full flex-wrap items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-sm text-white shadow-xs outline-none transition-colors overflow-hidden",
          "focus-within:border-violet-500/50 focus-within:ring-2 focus-within:ring-violet-500/40",
          isOpen && "border-violet-500/50 ring-2 ring-violet-500/40",
          disabled && "cursor-not-allowed opacity-50 pointer-events-none",
          !disabled && "cursor-pointer"
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={0}
      >
        {/* Tags des langues sélectionnées */}
        {selectedLanguages.length > 0 ? (
          selectedLanguages.map((lang) => (
            <span
              key={lang}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-700/50 px-2 py-0.5 text-xs text-white"
            >
              {lang}
              {!disabled && (
              <button
                type="button"
                onClick={(e) => removeLanguage(lang, e)}
                className="flex items-center rounded hover:bg-zinc-600/50"
                aria-label={`Retirer ${lang}`}
              >
                <X className="size-3" />
              </button>
              )}
            </span>
          ))
        ) : (
          <span className="text-zinc-600">{placeholder}</span>
        )}

        {/* Icône chevron */}
        <ChevronDown
          className={cn(
            "ml-auto size-4 shrink-0 text-zinc-500 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 z-[100] mt-1 w-full rounded-lg border border-white/10 bg-zinc-900/98 py-1 shadow-2xl backdrop-blur-xl">
          {/* Barre de recherche */}
          <div className="px-2 pb-2">
            <div className="relative">
              <Input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Rechercher une langue…"
                className="h-7 border-white/10 bg-white/[0.04] pl-8 pr-2 text-xs text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/40"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="absolute left-3 top-0 bottom-0 flex items-center pointer-events-none">
                <Search className="size-3.5 text-zinc-500" />
              </div>
            </div>
          </div>

          {/* Liste des langues */}
          <div className="max-h-52 overflow-auto">
            {filteredLanguages.length > 0 ? (
              filteredLanguages.map((lang, index) => {
                const isSelected = selectedLanguages.includes(lang);
                return (
                  <div
                    key={lang}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors",
                      index === activeIndex
                        ? "bg-violet-600/20 text-white"
                        : "text-zinc-300 hover:bg-white/5",
                      isSelected && "bg-violet-500/10"
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => toggleLanguage(lang)}
                  >
                    <div className="flex size-4 shrink-0 items-center justify-center">
                      {isSelected && (
                        <Check className="size-3.5 text-violet-400" />
                      )}
                    </div>
                    <span className="flex-1">{lang}</span>
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-2 text-sm text-zinc-500">
                Aucune langue trouvée
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
