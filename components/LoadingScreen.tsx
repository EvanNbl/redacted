"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import gsap from "gsap";

interface LoadingScreenProps {
  loading: boolean;
  onFinished?: () => void;
}

const APP_VERSION = "1.1.0";
const MIN_DISPLAY_MS = 2200;

export function LoadingScreen({ loading, onFinished }: LoadingScreenProps) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const barWrapRef = useRef<HTMLDivElement>(null);
  const creditRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(Date.now());
  const doneRef = useRef(false);

  useEffect(() => {
    if (!logoRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(
        ".loader-letter",
        { opacity: 0, y: 24, rotateX: -90 },
        { opacity: 1, y: 0, rotateX: 0, duration: 0.7, stagger: 0.045 }
      )
        .fromTo(
          subtitleRef.current,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.5 },
          "-=0.3"
        )
        .fromTo(
          barWrapRef.current,
          { opacity: 0, scaleX: 0.6 },
          { opacity: 1, scaleX: 1, duration: 0.5 },
          "-=0.2"
        )
        .fromTo(
          creditRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.8 },
          "-=0.1"
        );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) return 100;
        const elapsed = Date.now() - startRef.current;
        const ratio = Math.min(elapsed / MIN_DISPLAY_MS, 1);
        const target = loading ? Math.min(ratio * 80, 80) : 100;
        const step = loading ? 0.6 : 4;
        return Math.min(p + step, target);
      });
    }, 40);
    return () => clearInterval(interval);
  }, [loading]);

  const animateOut = useCallback(() => {
    if (doneRef.current || !containerRef.current) return;
    doneRef.current = true;

    gsap.to(containerRef.current, {
      opacity: 0,
      scale: 1.03,
      filter: "blur(8px)",
      duration: 0.6,
      ease: "power2.inOut",
      onComplete: () => {
        setVisible(false);
        onFinished?.();
      },
    });
  }, [onFinished]);

  useEffect(() => {
    if (doneRef.current) return;
    if (!loading) {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

      const t1 = setTimeout(() => setProgress(100), remaining);
      const t2 = setTimeout(animateOut, remaining + 500);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [loading, animateOut]);

  if (!visible) return null;

  const title = "Projet Paris";

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050508]"
    >
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-1/2 top-[40%] h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.07] blur-[100px] animate-pulse" />
        <div className="absolute left-[30%] top-[60%] h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.05] blur-[80px]" />
        <div className="absolute right-[25%] top-[30%] h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/[0.04] blur-[60px]" />
      </div>

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative flex flex-col items-center" ref={logoRef}>
        {/* Title with per-letter animation */}
        <h1
          className="text-5xl font-bold tracking-tight text-white sm:text-6xl mb-2"
          style={{ perspective: "600px" }}
        >
          {title.split("").map((ch, i) => (
            <span
              key={i}
              className="loader-letter inline-block"
              style={{ opacity: 0 }}
            >
              {ch === " " ? "\u00A0" : ch}
            </span>
          ))}
        </h1>

        {/* Version badge */}
        <p
          ref={subtitleRef}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-mono tracking-widest text-zinc-500"
          style={{ opacity: 0 }}
        >
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          v{APP_VERSION}
        </p>
      </div>

      {/* Progress bar */}
      <div ref={barWrapRef} className="relative mt-10 w-48" style={{ opacity: 0 }}>
        <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full transition-all duration-200 ease-out"
            style={{
              width: `${progress}%`,
              background:
                "linear-gradient(90deg, #7c3aed, #8b5cf6, #a78bfa)",
              boxShadow: "0 0 12px rgba(139, 92, 246, 0.4)",
            }}
          />
        </div>
        <p className="mt-3 text-center text-[10px] font-mono tracking-[0.2em] text-zinc-600">
          {progress < 100 ? "CHARGEMENT" : "PRET"}
        </p>
      </div>

      {/* Credits */}
      <div
        ref={creditRef}
        className="absolute bottom-6 flex flex-col items-center gap-1"
        style={{ opacity: 0 }}
      >
        <p className="text-[10px] tracking-wider text-zinc-600">
          &copy; Made by Evan Noubel
        </p>
      </div>
    </div>
  );
}
