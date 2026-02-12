"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PAYS_OPTIONS } from "@/lib/countries-data";

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

/**
 * Composant de sélection de pays avec recherche.
 * Permet de rechercher et sélectionner un pays depuis une liste complète.
 */
export function CountrySelect({
  value,
  onChange,
  placeholder = "Sélectionner un pays",
  id,
  className,
}: CountrySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filtrer les pays disponibles selon la recherche
  // Inclure aussi la valeur actuelle si elle n'est pas dans la liste (pays personnalisé)
  const allCountries = [
    ...(value && !PAYS_OPTIONS.includes(value) ? [value] : []),
    ...PAYS_OPTIONS.filter((c) => c !== ""), // Exclure les chaînes vides
  ];
  const filteredCountries = allCountries.filter((country) =>
    country.toLowerCase().includes(searchQuery.toLowerCase())
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

  const selectCountry = (country: string) => {
    onChange(country);
    setIsOpen(false);
    setSearchQuery("");
    setActiveIndex(-1);
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
        Math.min(i + 1, filteredCountries.length - 1)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectCountry(filteredCountries[activeIndex]);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Zone de sélection principale */}
      <div
        className={cn(
          "flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white shadow-xs outline-none transition-colors",
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
        {/* Pays sélectionné */}
        <span className={cn("flex-1", !value && "text-zinc-600")}>
          {value || placeholder}
        </span>

        {/* Icône chevron */}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-zinc-500 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-white/10 bg-zinc-900/98 py-1 shadow-2xl backdrop-blur-xl">
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
                placeholder="Rechercher un pays…"
                className="h-7 border-white/10 bg-white/[0.04] pl-8 pr-2 text-xs text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/40"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="absolute left-3 top-0 bottom-0 flex items-center pointer-events-none">
                <Search className="size-3.5 text-zinc-500" />
              </div>
            </div>
          </div>

          {/* Liste des pays */}
          <div className="max-h-52 overflow-auto">
            {filteredCountries.length > 0 ? (
              filteredCountries.map((country, index) => {
                const isSelected = value === country;
                return (
                  <div
                    key={country}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors",
                      index === activeIndex
                        ? "bg-violet-600/20 text-white"
                        : "text-zinc-300 hover:bg-white/5",
                      isSelected && "bg-violet-500/10"
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectCountry(country)}
                  >
                    <div className="flex size-4 shrink-0 items-center justify-center">
                      {isSelected && (
                        <Check className="size-3.5 text-violet-400" />
                      )}
                    </div>
                    <span className="flex-1">{country}</span>
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-2 text-sm text-zinc-500">
                Aucun pays trouvé
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
