"use client";

import { useEffect, useState } from "react";
import { FlaskConical, Sparkles, Check } from "lucide-react";
import { PageGuard } from "@/components/PageGuard";
import { Switch } from "@/components/ui/switch";
import { getSalleBetaEnabled, setSalleBetaEnabled } from "@/lib/beta-flags";
import { cn } from "@/lib/utils";
import {
  THEMES,
  THEME_CLASSES,
  type ColorTheme,
  applyColorTheme,
  getSavedTheme,
  saveTheme,
} from "@/lib/theme";

export { applyColorTheme };

export default function SettingsPage() {
  const [salleBetaEnabled, setSalleBetaEnabledState] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [colorTheme, setColorTheme] = useState<ColorTheme>("violet");

  useEffect(() => {
    setSalleBetaEnabledState(getSalleBetaEnabled());
    const saved = getSavedTheme();
    setColorTheme(saved);
    applyColorTheme(saved);
    setLoaded(true);
  }, []);

  const handleToggleSalleBeta = (value: boolean) => {
    setSalleBetaEnabledState(value);
    setSalleBetaEnabled(value);
  };

  const handleChangeColorTheme = (theme: ColorTheme) => {
    setColorTheme(theme);
    saveTheme(theme);
    applyColorTheme(theme);
  };

  return (
    <PageGuard page="contacts">
      <div className="flex h-full flex-col overflow-hidden bg-[#07070b] text-zinc-100">
        <header className="shrink-0 border-b border-white/[0.06] bg-[#0a0a10]/90 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/20">
                <FlaskConical className="size-5 text-primary" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-white tracking-tight">
                  Paramètres
                </h1>
                <p className="text-[11px] text-zinc-500">
                  Gestion des préférences de l&apos;application.
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">

            {/* Thème de couleur */}
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-start gap-4">
                <div className="mt-1 flex size-9 items-center justify-center rounded-full bg-primary/15">
                  <Sparkles className="size-4 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-white">
                    Thème de couleur
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    Choisis la palette principale de l&apos;application. Le mode sombre reste géré séparément.
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
                    {THEMES.map((theme) => {
                      const isActive = colorTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => handleChangeColorTheme(theme.id)}
                          className={cn(
                            "relative flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-xs font-medium transition-all",
                            isActive
                              ? theme.className
                              : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:bg-white/5"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-flex size-6 rounded-full",
                              theme.swatch,
                              isActive ? theme.ring : ""
                            )}
                          />
                          <span>{theme.label}</span>
                          {isActive && (
                            <span className="absolute top-1.5 right-1.5">
                              <Check className="size-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* Fonctionnalités bêta */}
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-start gap-4">
                <div className="mt-1 flex size-9 items-center justify-center rounded-full bg-primary/15">
                  <Sparkles className="size-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-white">
                        Fonctionnalités bêta
                      </h2>
                      <p className="mt-1 text-xs text-zinc-400">
                        Active ou désactive les fonctionnalités bêta, comme la page plan de salle.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-500">
                        {salleBetaEnabled ? "Activées" : "Désactivées"}
                      </span>
                      <Switch
                        checked={salleBetaEnabled}
                        disabled={!loaded}
                        onCheckedChange={handleToggleSalleBeta}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>
        </main>
      </div>
    </PageGuard>
  );
}
