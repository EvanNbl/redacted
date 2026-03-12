"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Loader2, Clock } from "lucide-react";
import { SetupWizard } from "@/components/SetupWizard";
import { isSetupCompleted } from "@/lib/theme";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, profile, permissions, loading, signInWithGoogle, signOut } =
    useAuth();

  const [setupDone, setSetupDone] = useState(true);

  useEffect(() => {
    if (user) {
      setSetupDone(isSetupCompleted());
    }
  }, [user]);

  if (loading) {
    return null;
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050508]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.06] blur-[100px]" />
          <div className="absolute left-1/3 top-2/3 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/[0.04] blur-[80px]" />
        </div>
        <div className="relative w-full max-w-sm px-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a12]/80 backdrop-blur-2xl p-8 shadow-2xl shadow-black/40">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
                Projet Paris
              </h1>
              <p className="text-[13px] text-zinc-500">
                Connectez-vous pour continuer
              </p>
            </div>

            <Button
              onClick={signInWithGoogle}
              className="w-full h-11 bg-white text-zinc-900 hover:bg-zinc-100 font-medium gap-3 rounded-xl shadow-lg shadow-white/5 cursor-pointer"
            >
              <svg
                className="size-[18px]"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Se connecter avec Google
            </Button>

            <p className="mt-6 text-center text-[10px] text-zinc-700">
              &copy; Projet Paris &middot; Evan Noubel
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!setupDone) {
    return <SetupWizard onComplete={() => setSetupDone(true)} />;
  }

  const hasAnyRead =
    profile?.role === "admin" ||
    profile?.role === "editor" ||
    permissions.some((p) => p.can_read);

  if (!profile || !hasAnyRead) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050508]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.04] blur-[100px]" />
        </div>
        <div className="relative w-full max-w-sm px-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a12]/80 backdrop-blur-2xl p-8 shadow-2xl shadow-black/40 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15">
                <Clock className="size-7 text-primary" />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">
              Acces en attente
            </h2>
            <p className="text-[13px] text-zinc-500 mb-6 leading-relaxed">
              Votre compte a ete cree. Un administrateur doit vous attribuer des
              droits d'acces avant que vous puissiez utiliser l'application.
            </p>
            <div className="flex items-center justify-center gap-2 mb-6 text-xs text-zinc-600">
              <Loader2 className="size-3 animate-spin" />
              En attente de validation
            </div>
            <button
              onClick={() => void signOut()}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Se deconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
