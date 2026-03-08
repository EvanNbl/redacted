"use client";

import { usePermission } from "@/hooks/usePermission";
import { ShieldOff } from "lucide-react";
import Link from "next/link";

interface PageGuardProps {
  page: string;
  children: React.ReactNode;
}

export function PageGuard({ page, children }: PageGuardProps) {
  const { canRead } = usePermission(page);

  if (!canRead) {
    return (
      <div className="flex h-full items-center justify-center bg-[#07070b]">
        <div className="w-full max-w-sm px-6 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-red-500/10">
              <ShieldOff className="size-7 text-red-400" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">
            Acces restreint
          </h2>
          <p className="text-[13px] text-zinc-500 mb-6 leading-relaxed">
            Vous n'avez pas la permission d'acceder a cette page.
            Contactez un administrateur pour obtenir les droits necessaires.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 transition-colors"
          >
            Retour a l'accueil
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
