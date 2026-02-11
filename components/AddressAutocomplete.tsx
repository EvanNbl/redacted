"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface AddressSuggestion {
  displayName: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lon: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

/**
 * Composant d'autocomplétion d'adresse utilisant Nominatim (OpenStreetMap).
 * Fournit des suggestions en temps réel lors de la saisie.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Rechercher une adresse…",
  id,
  className,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        format: "json",
        addressdetails: "1",
        limit: "5",
        "accept-language": "fr",
      });

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: {
            "User-Agent": "ContactsMapApp/1.0",
          },
        }
      );

      if (!res.ok) {
        setSuggestions([]);
        return;
      }

      const data = await res.json();

      const results: AddressSuggestion[] = data
        .map(
          (item: {
            display_name: string;
            lat: string;
            lon: string;
            address?: {
              city?: string;
              town?: string;
              village?: string;
              municipality?: string;
              state?: string;
              region?: string;
              country?: string;
            };
          }) => ({
            displayName: item.display_name,
            city:
              item.address?.city ||
              item.address?.town ||
              item.address?.village ||
              item.address?.municipality ||
              "",
            state: item.address?.state || item.address?.region || "",
            country: item.address?.country || "",
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
          })
        )
        .filter((s: AddressSuggestion) => s.country);

      setSuggestions(results);
      setShowDropdown(results.length > 0);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  };

  const handleSelect = (suggestion: AddressSuggestion) => {
    onChange(suggestion.city || suggestion.displayName.split(",")[0]);
    onSelect(suggestion);
    setShowDropdown(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
        <Input
          id={id}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={`h-8 border-white/10 bg-white/[0.04] pl-8 text-sm text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/40 ${className ?? ""}`}
        />
        {loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <div className="size-3.5 animate-spin rounded-full border border-violet-500 border-t-transparent" />
          </div>
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-white/10 bg-zinc-900/98 py-1 shadow-2xl backdrop-blur-xl">
          {suggestions.map((s, i) => (
            <li
              key={`${s.lat}-${s.lon}-${i}`}
              className={`flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm transition-colors ${
                i === activeIndex
                  ? "bg-violet-600/20 text-white"
                  : "text-zinc-300 hover:bg-white/5"
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => handleSelect(s)}
            >
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-violet-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {s.city || s.displayName.split(",")[0]}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {s.state ? `${s.state}, ` : ""}
                  {s.country}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
