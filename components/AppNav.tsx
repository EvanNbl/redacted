"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  MapPin,
  LayoutGrid,
  ScrollText,
  Shield,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  { href: "/", label: "Contacts", icon: MapPin, page: "contacts" },
  { href: "/salle", label: "Placement Salle", icon: LayoutGrid, page: "salle" },
  { href: "/journal", label: "Journal", icon: ScrollText, page: "journal" },
] as const;

const COLLAPSED_KEY = "app-nav-collapsed";

function getInitials(name: string | null | undefined, email: string): string {
  if (name && name.trim()) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

export function AppNav() {
  const pathname = usePathname();
  const { profile, permissions, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      if (stored !== null) {
        setCollapsed(stored === "true");
      } else if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, String(next));
    } catch {
      /* ignore */
    }
  };

  const isAdmin = profile?.role === "admin";
  const initials = profile
    ? getInitials(profile.full_name, profile.email)
    : "??";

  return (
    <nav
      className={cn(
        "relative z-40 flex h-screen flex-col shrink-0 border-r border-white/[0.06] bg-[#0a0a10]/80 backdrop-blur-xl transition-all duration-200",
        collapsed ? "w-14" : "w-48"
      )}
    >
      {/* Navigation links */}
      <div className="flex flex-col gap-1 px-2 pt-3 flex-1">
        {NAV_ITEMS.filter(({ page }) => {
          if (isAdmin) return true;
          const perm = permissions.find((p) => p.page === page);
          return perm?.can_read ?? false;
        }).map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-violet-600/20 text-violet-300"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href="/admin"
            title="Administration"
            className={cn(
              "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/admin")
                ? "bg-violet-600/20 text-violet-300"
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
            )}
          >
            <Shield className="size-4 shrink-0" />
            {!collapsed && <span className="truncate">Admin</span>}
          </Link>
        )}
      </div>

      {/* User avatar */}
      {profile && (
        <div className="relative px-2 pb-2" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/5",
              menuOpen && "bg-white/5"
            )}
            title={profile.full_name || profile.email}
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="size-7 min-w-7 min-h-7 aspect-square rounded-full object-cover ring-2 ring-white/10 shrink-0"
              />
            ) : (
              <div className="size-7 min-w-7 min-h-7 aspect-square rounded-full bg-violet-600/30 flex items-center justify-center text-[10px] font-bold text-violet-300 shrink-0">
                {initials}
              </div>
            )}
            {!collapsed && (
              <span className="truncate text-xs text-zinc-400">
                {profile.full_name || profile.email}
              </span>
            )}
          </button>

          {menuOpen && (
            <div className="absolute bottom-full left-2 mb-1 w-44 rounded-lg border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-xl py-1 z-50">
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:bg-violet-600/20 hover:text-violet-100 transition-colors"
              >
                <User className="size-4" />
                Mon profil
              </Link>
              <div className="border-t border-white/[0.06] my-1" />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  void signOut();
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="size-4" />
                Se deconnecter
              </button>
            </div>
          )}
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        className="flex items-center justify-center border-t border-white/[0.06] py-3 text-zinc-600 hover:text-zinc-300 transition-colors"
        aria-label={
          collapsed ? "Deplier la navigation" : "Replier la navigation"
        }
      >
        {collapsed ? (
          <ChevronRight className="size-4" />
        ) : (
          <ChevronLeft className="size-4" />
        )}
      </button>
    </nav>
  );
}
