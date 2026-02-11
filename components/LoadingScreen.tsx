"use client";

import { useEffect, useState, useRef } from "react";

interface LoadingScreenProps {
  loading: boolean;
  onFinished?: () => void;
}

const MIN_DISPLAY_MS = 1000;

export function LoadingScreen({ loading, onFinished }: LoadingScreenProps) {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const startRef = useRef(Date.now());
  const doneRef = useRef(false);

  // Fake progress that advances smoothly
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) return 100;
        // Quick at first, slow near the end, don't reach 100 until data loaded
        const elapsed = Date.now() - startRef.current;
        const ratio = Math.min(elapsed / MIN_DISPLAY_MS, 1);
        const target = loading ? Math.min(ratio * 85, 85) : 100;
        const step = loading ? 0.8 : 5;
        return Math.min(p + step, target);
      });
    }, 50);
    return () => clearInterval(interval);
  }, [loading]);

  // Handle completion
  useEffect(() => {
    if (doneRef.current) return;
    if (!loading) {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

      const t1 = setTimeout(() => {
        setProgress(100);
      }, remaining);

      const t2 = setTimeout(() => {
        setFadeOut(true);
      }, remaining + 600);

      const t3 = setTimeout(() => {
        doneRef.current = true;
        setVisible(false);
        onFinished?.();
      }, remaining + 1200);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [loading, onFinished]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050508] transition-opacity duration-700 ${
        fadeOut ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/[0.04] blur-[120px]" />
      </div>

      {/* Title */}
      <div className="relative mb-12">
        <h1 className=" text-5xl font-bold tracking-tight sm:text-6xl">
          <span className="text-white">
            Projet
            Paris
          </span>
        </h1>
      </div>

      {/* Progress bar */}
      <div className="relative w-56">
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-4 text-center text-[11px] tracking-widest text-zinc-600">
          {progress < 100 ? "CHARGEMENT" : "PRÊT"}
        </p>
      </div>
    </div>
  );
}
