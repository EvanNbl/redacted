"use client";

import React, { useState } from "react";
import type { MemberLocation } from "@/lib/member-locations";
import { GlobeView } from "@/components/GlobeView";
import { FlatMapView } from "@/components/FlatMapView";
import { Button } from "@/components/ui/button";

export type MapMode = "3d" | "flat";

export interface MemberMapProps {
  members: MemberLocation[];
  className?: string;
  onMemberClick?: (member: MemberLocation) => void;
  onMapClick?: () => void;
  focusMemberId?: string | null;
  contactType?: "communication" | "commercial";
}

export function MemberMap({
  members,
  className = "",
  onMemberClick,
  onMapClick,
  focusMemberId,
  contactType = "communication",
}: MemberMapProps) {
  const [mode, setMode] = useState<MapMode>("flat");

  return (
    <div className={`relative h-full min-h-[400px] w-full overflow-hidden bg-black ${className}`}>
      {/* Toggle 3D / Carte plate */}
      <div className="absolute left-4 top-4 z-[1000] flex overflow-hidden rounded-xl border border-white/10 bg-black/60 shadow-xl backdrop-blur-md">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setMode("3d")}
          className={`rounded-none border-0 px-4 py-2.5 text-sm font-medium transition ${
            mode === "3d"
              ? "bg-violet-600 text-white shadow-inner hover:bg-violet-600 hover:text-white"
              : "text-zinc-400 hover:bg-white/10 hover:text-white"
          }`}
        >
          Globe 3D
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setMode("flat")}
          className={`rounded-none border-0 px-4 py-2.5 text-sm font-medium transition ${
            mode === "flat"
              ? "bg-violet-600 text-white shadow-inner hover:bg-violet-600 hover:text-white"
              : "text-zinc-400 hover:bg-white/10 hover:text-white"
          }`}
        >
          Carte plate
        </Button>
      </div>

      {members.length === 0 ? (
        <div className="flex h-full min-h-[400px] items-center justify-center text-zinc-500">
          <p className="text-center text-sm">
            Aucun contact à afficher sur la carte pour le moment.
          </p>
        </div>
      ) : mode === "3d" ? (
        <GlobeView
          members={members}
          className="absolute inset-0 z-0 rounded-lg"
          onMemberClick={onMemberClick}
          onMapClick={onMapClick}
          focusMemberId={focusMemberId}
          contactType={contactType}
        />
      ) : (
        <FlatMapView
          members={members}
          className="absolute inset-0 z-0 rounded-lg"
          onMemberClick={onMemberClick}
          onMapClick={onMapClick}
          focusMemberId={focusMemberId}
          contactType={contactType}
        />
      )}
    </div>
  );
}
