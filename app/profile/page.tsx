"use client";

import { useState, useCallback } from "react";
import { User, Mail, Shield, LogOut, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { FadeIn } from "@/components/FadeIn";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  editor: "Editeur",
  viewer: "Lecteur",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/20 text-red-400 border-red-500/30",
  editor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  viewer: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

export default function ProfilePage() {
  const { user, profile, permissions, signOut, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    try {
      await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", profile.id);
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [profile, fullName, refreshProfile]);

  if (!user || !profile) return null;

  const initials = profile.full_name
    ? profile.full_name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : profile.email.slice(0, 2).toUpperCase();

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#07070b] text-zinc-100">
      <header className="shrink-0 border-b border-white/[0.06] bg-[#0a0a10]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/20">
              <User className="size-5 text-primary" />
            </div>
            <h1 className="text-base font-semibold text-white tracking-tight">
              Mon profil
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Avatar + Name */}
          <FadeIn delay={0.1}>
          <div className="flex flex-col items-center gap-4 py-6">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="size-20 rounded-full object-cover ring-4 ring-primary/20"
              />
            ) : (
              <div className="size-20 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary/80">
                {initials}
              </div>
            )}
            <div className="text-center">
              <p className="text-lg font-semibold text-white">
                {profile.full_name || profile.email}
              </p>
              <span
                className={`mt-1 inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium ${ROLE_COLORS[profile.role]}`}
              >
                {ROLE_LABELS[profile.role] ?? profile.role}
              </span>
            </div>
          </div>
          </FadeIn>

          {/* Form */}
          <FadeIn delay={0.2}>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Nom complet
              </label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-10 border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus-visible:ring-primary/50"
                placeholder="Votre nom"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                <Mail className="inline size-3 mr-1" />
                Email
              </label>
              <div className="h-10 flex items-center rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm text-zinc-400">
                {profile.email}
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || fullName.trim() === (profile.full_name ?? "")}
              className="w-full h-10 bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : saved ? (
                <>
                  <Save className="size-4" />
                  Enregistre !
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
          </FadeIn>

          {/* Permissions */}
          <FadeIn delay={0.3}>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
              <Shield className="size-4 text-primary" />
              Mes permissions
            </h3>
            <div className="space-y-2">
              {permissions.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Aucune permission configuree.
                </p>
              ) : (
                permissions.map((p) => (
                  <div
                    key={p.page}
                    className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"
                  >
                    <span className="text-sm capitalize text-zinc-300">
                      {p.page}
                    </span>
                    <div className="flex gap-2 text-[11px]">
                      {p.can_read && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-400">
                          Lecture
                        </span>
                      )}
                      {p.can_edit && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-400">
                          Modification
                        </span>
                      )}
                      {p.can_delete && (
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-red-400">
                          Suppression
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          </FadeIn>

          {/* Sign Out */}
          <FadeIn delay={0.4}>
          <Button
            onClick={signOut}
            variant="ghost"
            className="w-full h-10 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
          >
            <LogOut className="size-4" />
            Se deconnecter
          </Button>
          </FadeIn>
        </div>
      </main>
    </div>
  );
}
