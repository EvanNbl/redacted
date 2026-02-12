"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
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

  useEffect(() => {
    // Vérifier si l'utilisateur est déjà authentifié dans cette session
    const authStatus = sessionStorage.getItem("app_authenticated");
    if (authStatus === "true") {
      setIsAuthenticated(true);
    }
    setIsChecking(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const correctPassword = process.env.NEXT_PUBLIC_APP_PASSWORD;
    
    if (!correctPassword) {
      setError("Configuration manquante. Veuillez contacter l'administrateur.");
      return;
    }

    if (password === correctPassword) {
      sessionStorage.setItem("app_authenticated", "true");
      setIsAuthenticated(true);
      setPassword("");
    } else {
      setError("Mot de passe incorrect");
      setPassword("");
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
              className="w-full bg-violet-600 text-white hover:bg-violet-500 h-11"
            >
              Se connecter
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
