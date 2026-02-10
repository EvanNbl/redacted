"use client";

import React, { useEffect, useState } from "react";
import type { MemberLocation } from "@/lib/member-locations";

// Leaflet CSS (obligatoire pour les contrôles et popups)
import "leaflet/dist/leaflet.css";

import L from "leaflet";

const PIN_SIZE = 36;
const PIN_ANCHOR_X = PIN_SIZE / 2;
const PIN_ANCHOR_Y = PIN_SIZE;

function createPinIcon(member: MemberLocation): L.DivIcon {
  const letter = (member.pseudo?.trim()?.[0] ?? "?").toUpperCase();
  const html = `
    <div class="marker-pin">
      <span class="marker-pin-letter">${escapeHtml(letter)}</span>
    </div>
  `;
  return L.divIcon({
    html,
    className: "leaflet-marker-pin-custom",
    iconSize: [PIN_SIZE, PIN_SIZE],
    iconAnchor: [PIN_ANCHOR_X, PIN_ANCHOR_Y],
    popupAnchor: [0, -PIN_ANCHOR_Y + 4],
  });
}

function escapeHtml(s: string): string {
  const div =
    typeof document !== "undefined" ? document.createElement("div") : null;
  if (div) {
    div.textContent = s;
    return div.innerHTML;
  }
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface FlatMapViewProps {
  members: MemberLocation[];
  className?: string;
  onMemberClick?: (member: MemberLocation) => void;
}

export function FlatMapView({
  members,
  className = "",
  onMemberClick,
}: FlatMapViewProps) {
  const [MapComponent, setMapComponent] = useState<React.ComponentType<{
    members: MemberLocation[];
    className?: string;
    onMemberClick?: (member: MemberLocation) => void;
  }> | null>(null);

  useEffect(() => {
    setMapComponent(() => FlatMapInner);
  }, []);

  if (!MapComponent) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-900 ${className}`}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <MapComponent
      members={members}
      className={className}
      onMemberClick={onMemberClick}
    />
  );
}

function FlatMapInner({
  members,
  className = "",
  onMemberClick,
}: FlatMapViewProps) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<L.Map | null>(null);
  const markersRef = React.useRef<L.Marker[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [20, 0],
      zoom: 2,
      zoomControl: false,
    });

    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const member of members) {
      const marker = L.marker([member.latitude, member.longitude], {
        icon: createPinIcon(member),
      });

      const lines = [
        member.pseudo && `<strong>${escapeHtml(member.pseudo)}</strong>`,
        member.ville && `Ville : ${escapeHtml(member.ville)}`,
        member.region && `Région : ${escapeHtml(member.region)}`,
        member.pays && `Pays : ${escapeHtml(member.pays)}`,
      ].filter(Boolean);

      marker.bindPopup(lines.join("<br/>"), {
        maxWidth: 280,
        className: "member-popup-wrapper",
      });

      if (onMemberClick) {
        marker.on("click", () => onMemberClick(member));
      }

      marker.addTo(map);
      markersRef.current.push(marker);
    }

    if (members.length === 1) {
      map.setView([members[0].latitude, members[0].longitude], 6);
    } else if (members.length > 1) {
      const group = L.featureGroup(markersRef.current.map((m) => m as L.Layer));
      map.fitBounds(group.getBounds().pad(0.2));
    }
  }, [members, onMemberClick]);

  return (
    <div
      ref={mapRef}
      className={`h-full w-full rounded-lg bg-zinc-900 ${className}`}
    />
  );
}

