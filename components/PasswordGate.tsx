"use client";

import { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PasswordGateProps {
  children: React.ReactNode;
}

export function PasswordGate({ children }: PasswordGateProps) {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Vérifier si l'utilisateur est déjà authentifié dans cette session
    const authStatus = sessionStorage.getItem("app_authenticated");
    if (authStatus === "true") {
      setIsAuthenticated(true);
    }
    setIsChecking(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password.trim()) {
      setError("Veuillez entrer le mot de passe");
      return;
    }

    setChecking(true);
    const pwd = password.trim();
    try {
      let ok = false;

      // 1) Essayer la route API (uniquement en dev avec next dev — en prod statique / Tauri elle n'existe pas)
      try {
        const res = await fetch("/api/auth/check-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pwd }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok === true) {
          ok = true;
        }
      } catch {
        // Erreur réseau : on passe au fallback
      }

      // 2) Si l'API n'a pas validé (404 en prod, ou mot de passe refusé), fallback build statique / Tauri
      if (!ok) {
        const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SPREADSHEET_ID;
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY;
        const range = process.env.NEXT_PUBLIC_GOOGLE_SHEET_PASS ?? "MDP!A1:B2";
        if (sheetId && apiKey && range) {
          const params = new URLSearchParams({ key: apiKey });
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?${params.toString()}`;
          const res = await fetch(url);
          if (res.ok) {
            const json = await res.json();
            const values = json.values ?? [];
            const stored = (values[0]?.[0] ?? "").toString().trim();
            ok = stored.length > 0 && pwd === stored;
          }
        }
      }

      if (ok) {
        sessionStorage.setItem("app_authenticated", "true");
        setIsAuthenticated(true);
        setPassword("");
      } else {
        setError("Mot de passe incorrect");
        setPassword("");
      }
    } catch {
      setError("Erreur de connexion. Réessayez.");
    } finally {
      setChecking(false);
    }
  };

  // Afficher un loader pendant la vérification initiale
  if (isChecking) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#07070b]">
        <div className="size-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  // Si authentifié, afficher le contenu
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Sinon, afficher le formulaire de connexion
  return (
    <div className="flex h-screen items-center justify-center bg-[#07070b]">
      <div className="w-full max-w-md px-6">
        <div className="rounded-2xl border border-white/10 bg-[#0a0a10]/90 backdrop-blur-xl p-8 shadow-2xl">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-violet-600/20">
              <Lock className="size-8 text-violet-400" />
            </div>
          </div>

          {/* Title */}
          <h1 className="mb-2 text-center text-2xl font-semibold text-white">
            Accès sécurisé
          </h1>
          <p className="mb-6 text-center text-sm text-zinc-400">
            Veuillez entrer le mot de passe pour accéder à l'application
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Mot de passe"
                  className="h-11 border-white/10 bg-white/5 pr-10 text-white placeholder:text-zinc-500 focus-visible:border-violet-500/50 focus-visible:ring-violet-500/40"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={checking}
              className="w-full bg-violet-600 text-white hover:bg-violet-500 h-11"
            >
              {checking ? "Vérification…" : "Se connecter"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
