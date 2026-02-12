"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, ChevronDown, Search, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ReferentMultiSelectProps {
  selected: string[]; // Liste des référents sélectionnés
  onChange: (selected: string[]) => void;
  options: string[]; // Liste des référents disponibles
  placeholder?: string;
  id?: string;
  className?: string;
}

/**
 * Composant de sélection multiple de référents avec recherche.
 * Affiche les référents sélectionnés comme des tags et permet de rechercher/filtrer.
 */
export function ReferentMultiSelect({
  selected,
  onChange,
  options,
  placeholder = "Sélectionner des référents",
  id,
  className,
}: ReferentMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filtrer les référents disponibles selon la recherche
  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchQuery.toLowerCase())
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

  // Focus sur le champ de recherche quand le dropdown s'ouvre
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const toggleOption = (option: string) => {
    const isSelected = selected.includes(option);
    let newSelected: string[];

    if (isSelected) {
      newSelected = selected.filter((o) => o !== option);
    } else {
      newSelected = [...selected, option];
    }

    onChange(newSelected);
  };

  const removeOption = (option: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = selected.filter((o) => o !== option);
    onChange(newSelected);
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
      setActiveIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      toggleOption(filteredOptions[activeIndex]);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Zone de sélection principale */}
      <div
        className={cn(
          "flex min-h-8 h-8 w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-sm text-white shadow-xs outline-none transition-colors overflow-hidden",
          "focus-within:border-violet-500/50 focus-within:ring-2 focus-within:ring-violet-500/40",
          isOpen && "border-violet-500/50 ring-2 ring-violet-500/40"
        )}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={0}
      >
        {/* Tags des référents sélectionnés */}
        {selected.length > 0 ? (
          selected.map((option) => (
            <span
              key={option}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-700/50 px-2 py-0.5 text-xs text-white"
            >
              {option}
              <button
                type="button"
                onClick={(e) => removeOption(option, e)}
                className="flex items-center rounded hover:bg-zinc-600/50"
                aria-label={`Retirer ${option}`}
              >
                <X className="size-3" />
              </button>
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
      {isOpen && (
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
                placeholder="Rechercher un référent…"
                className="h-7 border-white/10 bg-white/[0.04] pl-8 pr-2 text-xs text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/40"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="absolute left-3 top-0 bottom-0 flex items-center pointer-events-none">
                <Search className="size-3.5 text-zinc-500" />
              </div>
            </div>
          </div>

          {/* Liste des référents */}
          <div className="max-h-52 overflow-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const isSelected = selected.includes(option);
                return (
                  <div
                    key={option}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors",
                      index === activeIndex
                        ? "bg-violet-600/20 text-white"
                        : "text-zinc-300 hover:bg-white/5",
                      isSelected && "bg-violet-500/10"
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => toggleOption(option)}
                  >
                    <div className="flex size-4 shrink-0 items-center justify-center">
                      {isSelected && (
                        <Check className="size-3.5 text-violet-400" />
                      )}
                    </div>
                    <span className="flex-1">{option}</span>
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-2 text-sm text-zinc-500">
                Aucun référent trouvé
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
