"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, FlaskConical, Palette, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
  THEMES,
  type ColorTheme,
  applyColorTheme,
  saveTheme,
  markSetupCompleted,
} from "@/lib/theme";
import { setSalleBetaEnabled } from "@/lib/beta-flags";

interface SetupWizardProps {
  onComplete: () => void;
}

const STEPS = [
  { id: "theme", icon: <Palette className="size-5" />, label: "Thème" },
  { id: "beta", icon: <FlaskConical className="size-5" />, label: "Bêta" },
  { id: "done", icon: <Sparkles className="size-5" />, label: "Prêt" },
];

const variants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? -60 : 60,
    opacity: 0,
  }),
};

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [colorTheme, setColorTheme] = useState<ColorTheme>("violet");
  const [betaEnabled, setBetaEnabled] = useState(false);

  const goNext = () => {
    if (step < STEPS.length - 1) {
      setDir(1);
      setStep((s) => s + 1);
    } else {
      saveTheme(colorTheme);
      applyColorTheme(colorTheme);
      setSalleBetaEnabled(betaEnabled);
      markSetupCompleted();
      onComplete();
    }
  };

  const handleThemeChange = (theme: ColorTheme) => {
    setColorTheme(theme);
    applyColorTheme(theme);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#050508]">
      {/* Ambient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.07] blur-[120px] transition-all duration-700" />
        <div className="absolute left-1/4 top-2/3 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.04] blur-[80px]" />
      </div>

      <div className="relative w-full max-w-md px-6">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border text-xs font-medium transition-all duration-300",
                  i < step
                    ? "border-primary bg-primary text-primary-foreground"
                    : i === step
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-white/10 bg-white/[0.03] text-zinc-600"
                )}
              >
                {i < step ? <Check className="size-3.5" /> : <span>{i + 1}</span>}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-px w-8 transition-all duration-500",
                    i < step ? "bg-primary/60" : "bg-white/[0.08]"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a12]/80 backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden">
          <AnimatePresence custom={dir} mode="wait">
            <motion.div
              key={step}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              {step === 0 && (
                <StepTheme
                  colorTheme={colorTheme}
                  onChange={handleThemeChange}
                  onNext={goNext}
                />
              )}
              {step === 1 && (
                <StepBeta
                  betaEnabled={betaEnabled}
                  onChange={setBetaEnabled}
                  onNext={goNext}
                />
              )}
              {step === 2 && <StepDone onNext={goNext} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ---------- Step 1 : Thème ---------- */

function StepTheme({
  colorTheme,
  onChange,
  onNext,
}: {
  colorTheme: ColorTheme;
  onChange: (t: ColorTheme) => void;
  onNext: () => void;
}) {
  return (
    <div className="p-8">
      <div className="mb-6 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/20">
            <Palette className="size-7 text-primary" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white mb-1.5">Choisis ton thème</h2>
        <p className="text-[13px] text-zinc-500 leading-relaxed">
          Sélectionne la palette de couleurs de l&apos;application. Tu pourras la modifier à tout moment dans les paramètres.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-8">
        {THEMES.map((theme) => {
          const isActive = colorTheme === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onChange(theme.id)}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-xs font-medium transition-all duration-200",
                isActive
                  ? theme.className
                  : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:bg-white/[0.04]"
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 rounded-full transition-all duration-200",
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

      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2.5 transition-colors cursor-pointer"
      >
        Continuer
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

/* ---------- Step 2 : Bêta ---------- */

function StepBeta({
  betaEnabled,
  onChange,
  onNext,
}: {
  betaEnabled: boolean;
  onChange: (v: boolean) => void;
  onNext: () => void;
}) {
  return (
    <div className="p-8">
      <div className="mb-6 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/20">
            <FlaskConical className="size-7 text-primary" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white mb-1.5">Fonctionnalités bêta</h2>
        <p className="text-[13px] text-zinc-500 leading-relaxed">
          Certaines fonctionnalités sont encore en développement. Active-les pour y accéder en avant-première.
        </p>
      </div>

      <div className="mb-8 space-y-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onChange(!betaEnabled)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onChange(!betaEnabled)}
          className={cn(
            "w-full flex items-start gap-4 rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer select-none",
            betaEnabled
              ? "border-primary/40 bg-primary/[0.08]"
              : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
          )}
        >
          <div
            className={cn(
              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
              betaEnabled ? "bg-primary/20" : "bg-white/[0.05]"
            )}
          >
            <FlaskConical
              className={cn("size-5 transition-colors", betaEnabled ? "text-primary" : "text-zinc-500")}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <p className={cn("text-sm font-medium transition-colors", betaEnabled ? "text-white" : "text-zinc-300")}>
                Placement Salle
              </p>
              <Switch checked={betaEnabled} onCheckedChange={onChange} onClick={(e) => e.stopPropagation()} />
            </div>
            <p className="mt-0.5 text-[12px] text-zinc-500 leading-relaxed">
              Crée des plans de salle, gère les zones et assigne les places aux membres.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2.5 transition-colors cursor-pointer"
      >
        Continuer
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

/* ---------- Step 3 : Done ---------- */

function StepDone({ onNext }: { onNext: () => void }) {
  return (
    <div className="p-8 text-center">
      <div className="mb-6">
        <div className="mb-4 flex justify-center">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/20"
          >
            <Sparkles className="size-8 text-primary" />
          </motion.div>
        </div>
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl font-bold text-white mb-1.5"
        >
          Tout est prêt !
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-[13px] text-zinc-500 leading-relaxed"
        >
          Tes préférences ont été enregistrées. Tu peux les modifier à tout moment depuis les paramètres.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-3"
      >
        <button
          onClick={onNext}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2.5 transition-colors cursor-pointer"
        >
          <Sparkles className="size-4" />
          Accéder à l&apos;application
        </button>
      </motion.div>
    </div>
  );
}
