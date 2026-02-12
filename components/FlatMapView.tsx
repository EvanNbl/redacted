"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import type { MemberLocation } from "@/lib/member-locations";
import { getISO3 } from "@/lib/country-iso-map";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import L from "leaflet";
import "leaflet.markercluster";

/* ── Helpers ─────────────────────────────────────────────── */

/**
 * Corrige les coordonnées si elles sont inversées.
 * Retourne [latitude, longitude] dans le bon ordre pour Leaflet.
 */
function normalizeCoords(latitude: number, longitude: number): [number, number] {
  let lat = latitude;
  let lon = longitude;
  
  const latInRange = lat >= -90 && lat <= 90;
  const lonInRange = lon >= -180 && lon <= 180;
  
  // Si les coordonnées semblent inversées, les corriger
  if ((!latInRange && lonInRange) || (latInRange && !lonInRange)) {
    [lat, lon] = [lon, lat];
  }
  
  return [lat, lon];
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

/** Crée un pin avec le nom complet du membre (pas une seule lettre). */
function createNamePin(member: MemberLocation): L.DivIcon {
  const name = escapeHtml(member.pseudo?.trim() || "?");
  const html = `<div class="name-pin"><span class="name-pin-dot"></span><span class="name-pin-label">${name}</span></div>`;
  return L.divIcon({
    html,
    className: "leaflet-name-pin-custom",
    iconSize: [0, 0],
    iconAnchor: [6, 6],
  });
}

/** Retourne les ISO3 des pays qui ont au moins un membre. */
function getActiveCountryISOs(members: MemberLocation[]): Set<string> {
  const isos = new Set<string>();
  for (const m of members) {
    const iso = getISO3(m.pays);
    if (iso) isos.add(iso);
  }
  return isos;
}

/* ── GeoJSON country borders cache ───────────────────────── */

let geoJsonCache: GeoJSON.FeatureCollection | null = null;

async function loadCountryGeoJSON(): Promise<GeoJSON.FeatureCollection | null> {
  if (geoJsonCache) return geoJsonCache;
  try {
    const res = await fetch(
      "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"
    );
    if (!res.ok) return null;
    const topo = (await res.json()) as Topology;
    const collection = topo.objects.countries as GeometryCollection;
    const geo = topojson.feature(
      topo,
      collection
    ) as unknown as GeoJSON.FeatureCollection;
    geoJsonCache = geo;
    return geo;
  } catch {
    return null;
  }
}

/**
 * Map from numeric ID to ISO alpha-3.
 * world-atlas uses numeric IDs; we need a quick lookup.
 * This is loaded lazily alongside the TopoJSON.
 */
let numericToIso3Cache: Record<string, string> | null = null;

async function loadNumericToISO3(): Promise<Record<string, string>> {
  if (numericToIso3Cache) return numericToIso3Cache;
  try {
    const res = await fetch(
      "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"
    );
    if (!res.ok) return {};
    // We already have the topo in geoJsonCache case, but the numeric IDs
    // are in the feature.id field of the topojson output.
    // The world-atlas numeric IDs correspond to ISO 3166-1 numeric.
    // We'll use a separate small mapping fetched inline.
  } catch {
    // fallback
  }
  // Use a simple built-in mapping for common countries
  numericToIso3Cache = {};
  return numericToIso3Cache;
}

/* ── Component ───────────────────────────────────────────── */

export interface FlatMapViewProps {
  members: MemberLocation[];
  className?: string;
  onMemberClick?: (member: MemberLocation) => void;
  onMapClick?: () => void;
  focusMemberId?: string | null;
}

export function FlatMapView({
  members,
  className = "",
  onMemberClick,
  onMapClick,
  focusMemberId,
}: FlatMapViewProps) {
  const [MapComponent, setMapComponent] = useState<React.ComponentType<
    FlatMapViewProps
  > | null>(null);

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
      onMapClick={onMapClick}
      focusMemberId={focusMemberId}
    />
  );
}

function FlatMapInner({
  members,
  className = "",
  onMemberClick,
  onMapClick,
  focusMemberId,
}: FlatMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const countryLayerRef = useRef<L.GeoJSON | null>(null);
  const onMemberClickRef = useRef(onMemberClick);
  const onMapClickRef = useRef(onMapClick);
  const membersRef = useRef(members);
  const colorCountriesRef = useRef<((members: MemberLocation[]) => void) | null>(null);
  const prevFocusMemberIdRef = useRef<string | null | undefined>(null);

  useEffect(() => {
    onMemberClickRef.current = onMemberClick;
  }, [onMemberClick]);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  // Helper function to extract ISO3 from GeoJSON feature
  const getFeatureISO3 = useCallback((feature: GeoJSON.Feature): string | undefined => {
    if (!feature) return undefined;
    
    const props = feature.properties || {};
    const featureId = feature.id;
    
    // Try multiple methods to get ISO3:
    // 1. From numeric ID (world-atlas format)
    // Handle both string and number IDs, and remove leading zeros
    if (featureId !== undefined && featureId !== null) {
      // Convert to string, handling both number and string IDs
      let idStr = typeof featureId === 'number' ? String(featureId) : String(featureId);
      // Remove leading zeros (e.g., "056" -> "56")
      idStr = idStr.replace(/^0+/, '') || '0';
      const numericISO3 = numericToISO3(idStr);
      if (numericISO3) return numericISO3;
    }
    
    // 2. From properties (various possible property names)
    const possibleProps = [
      props.ISO_A3,
      props.ISO_A3_EH,
      props.iso_a3,
      props.ISO3,
      props.iso3,
      props.ADM0_A3,
      props.adm0_a3,
    ];
    
    for (const prop of possibleProps) {
      if (prop && typeof prop === 'string' && prop.length === 3) {
        return prop.toUpperCase();
      }
    }
    
    // 3. If feature.id is already an ISO3 code (3 letters)
    if (featureId && typeof featureId === 'string' && featureId.length === 3) {
      return featureId.toUpperCase();
    }
    
    return undefined;
  }, []);

  // Function to color countries based on active members
  const colorCountries = useCallback((membersToUse: MemberLocation[]) => {
    const geoLayer = countryLayerRef.current;
    if (!geoLayer) return;
    
    const activeISOs = getActiveCountryISOs(membersToUse);
    
    // Debug: log active ISOs
    if (activeISOs.size > 0) {
      console.log("Active ISO3 codes:", Array.from(activeISOs));
    }
    
    geoLayer.eachLayer((layer) => {
      const feature = (layer as L.GeoJSON & { feature?: GeoJSON.Feature })
        .feature;
      if (!feature) return;
      
      const featureISO3 = getFeatureISO3(feature);
      
      // Debug: log Belgium specifically to see what's happening
      const props = feature.properties || {};
      const name = props.name || props.NAME || props.NAME_EN || '';
      if (name && (name.toLowerCase().includes('belgium') || name.toLowerCase().includes('belgique'))) {
        console.log(`Belgium feature found:`, {
          id: feature.id,
          idType: typeof feature.id,
          featureISO3,
          props: feature.properties,
          isActive: featureISO3 && activeISOs.has(featureISO3),
          activeISOs: Array.from(activeISOs),
        });
      }
      
      // Debug: log features that match active countries
      if (featureISO3 && activeISOs.has(featureISO3)) {
        console.log(`Coloring country: ${featureISO3}`, {
          id: feature.id,
          props: feature.properties,
        });
      }
      
      const isActive = featureISO3 && activeISOs.has(featureISO3);

      (layer as L.Path).setStyle({
        fillColor: isActive ? "#8b5cf6" : "transparent",
        fillOpacity: isActive ? 0.2 : 0,
        color: isActive
          ? "rgba(139,92,246,0.4)"
          : "rgba(255,255,255,0.05)",
        weight: isActive ? 1 : 0.5,
      });
    });
  }, [getFeatureISO3]);

  useEffect(() => {
    colorCountriesRef.current = (membersToUse: MemberLocation[]) => colorCountries(membersToUse);
  }, [colorCountries]);

  // Initialize map (once)
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !mapRef.current ||
      mapInstanceRef.current
    )
      return;

    const map = L.map(mapRef.current, {
      center: [30, 10],
      zoom: 3,
      zoomControl: false,
      maxBounds: [
        [-85, -180],
        [85, 180],
      ],
      maxBoundsViscosity: 1.0,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 18,
        minZoom: 2,
      }
    ).addTo(map);

    // Click on map (not on a marker) → close panel
    map.on("click", () => {
      onMapClickRef.current?.();
    });

    // Marker cluster group
    const cluster = L.markerClusterGroup({
      maxClusterRadius: (zoom: number) => {
        if (zoom <= 3) return 80;
        if (zoom <= 5) return 60;
        if (zoom <= 8) return 40;
        return 30;
      },
      iconCreateFunction: (c: L.MarkerCluster) => {
        const count = c.getChildCount();
        const size =
          count < 5 ? 40 : count < 15 ? 48 : count < 50 ? 56 : 64;
        return L.divIcon({
          html: `<div class="cluster-bubble" style="width:${size}px;height:${size}px;font-size:${size < 48 ? 13 : 15}px"><span>${count}</span></div>`,
          className: "cluster-icon",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 13,
      animate: true,
      animateAddingMarkers: false,
      chunkedLoading: true,
    });

    cluster.addTo(map);
    clusterRef.current = cluster;
    mapInstanceRef.current = map;

    // Load GeoJSON borders
    loadCountryGeoJSON().then((geo) => {
      if (!geo || !mapInstanceRef.current) return;
      const geoLayer = L.geoJSON(geo, {
        style: {
          color: "rgba(255,255,255,0.05)",
          weight: 0.5,
          fillColor: "transparent",
          fillOpacity: 0,
          interactive: false,
        },
      }).addTo(mapInstanceRef.current);
      geoLayer.bringToBack();
      countryLayerRef.current = geoLayer;
      // Color countries once GeoJSON is loaded
      colorCountriesRef.current?.(membersRef.current);
    });

    return () => {
      cluster.clearLayers();
      map.remove();
      mapInstanceRef.current = null;
      clusterRef.current = null;
      countryLayerRef.current = null;
    };
  }, []);

  // Update markers & country colors when members change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;

    cluster.clearLayers();

    // ── Color countries with members ──
    colorCountries(members);

    // ── Markers with full name ──
    const markers: L.Marker[] = [];
    for (const member of members) {
      // Leaflet utilise [latitude, longitude]
      const [lat, lon] = normalizeCoords(member.latitude, member.longitude);
      
      const marker = L.marker([lat, lon], {
        icon: createNamePin(member),
      });

      // Click opens panel — no popup
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onMemberClickRef.current?.(member);
      });

      markers.push(marker);
    }

    cluster.addLayers(markers);

    // Fit bounds
    if (members.length === 1) {
      const [lat, lon] = normalizeCoords(members[0].latitude, members[0].longitude);
      map.setView([lat, lon], 6);
    } else if (members.length > 1) {
      const bounds = L.latLngBounds(
        members.map((m) => normalizeCoords(m.latitude, m.longitude))
      );
      map.fitBounds(bounds.pad(0.2), { maxZoom: 6 });
    }
  }, [members, colorCountries]);

  // Focus on specific member when focusMemberId changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !focusMemberId || focusMemberId === prevFocusMemberIdRef.current) {
      prevFocusMemberIdRef.current = focusMemberId;
      return;
    }

    const member = members.find((m) => m.id === focusMemberId);
    if (member) {
      const [lat, lon] = normalizeCoords(member.latitude, member.longitude);
      map.setView([lat, lon], 8, {
        animate: true,
        duration: 0.5,
      });
    }
    prevFocusMemberIdRef.current = focusMemberId;
  }, [focusMemberId, members]);

  return (
    <div ref={mapRef} className={`h-full w-full bg-zinc-900 ${className}`} />
  );
}

/* ── ISO numeric → ISO3 mapping (common countries from world-atlas) ── */

function numericToISO3(numId: string): string | undefined {
  return NUMERIC_ISO3[numId];
}

const NUMERIC_ISO3: Record<string, string> = {
  "4": "AFG", "8": "ALB", "12": "DZA", "20": "AND", "24": "AGO",
  "28": "ATG", "32": "ARG", "51": "ARM", "36": "AUS", "40": "AUT",
  "31": "AZE", "44": "BHS", "48": "BHR", "50": "BGD", "52": "BRB",
  "112": "BLR", "56": "BEL", "84": "BLZ", "204": "BEN", "64": "BTN",
  "68": "BOL", "70": "BIH", "72": "BWA", "76": "BRA", "96": "BRN",
  "100": "BGR", "854": "BFA", "108": "BDI", "116": "KHM", "120": "CMR",
  "124": "CAN", "132": "CPV", "140": "CAF", "148": "TCD", "152": "CHL",
  "156": "CHN", "170": "COL", "174": "COM", "178": "COG", "180": "COD",
  "188": "CRI", "384": "CIV", "191": "HRV", "192": "CUB", "196": "CYP",
  "203": "CZE", "208": "DNK", "262": "DJI", "212": "DMA", "214": "DOM",
  "218": "ECU", "818": "EGY", "222": "SLV", "226": "GNQ", "232": "ERI",
  "233": "EST", "231": "ETH", "242": "FJI", "246": "FIN", "250": "FRA",
  "266": "GAB", "270": "GMB", "268": "GEO", "276": "DEU", "288": "GHA",
  "300": "GRC", "308": "GRD", "320": "GTM", "324": "GIN", "624": "GNB",
  "328": "GUY", "332": "HTI", "340": "HND", "348": "HUN", "352": "ISL",
  "356": "IND", "360": "IDN", "364": "IRN", "368": "IRQ", "372": "IRL",
  "376": "ISR", "380": "ITA", "388": "JAM", "392": "JPN", "400": "JOR",
  "398": "KAZ", "404": "KEN", "417": "KGZ", "414": "KWT", "418": "LAO",
  "428": "LVA", "422": "LBN", "426": "LSO", "430": "LBR", "434": "LBY",
  "438": "LIE", "440": "LTU", "442": "LUX", "807": "MKD", "450": "MDG",
  "454": "MWI", "458": "MYS", "462": "MDV", "466": "MLI", "470": "MLT",
  "504": "MAR", "478": "MRT", "480": "MUS", "484": "MEX", "498": "MDA",
  "492": "MCO", "496": "MNG", "499": "MNE", "508": "MOZ", "104": "MMR",
  "516": "NAM", "524": "NPL", "528": "NLD", "554": "NZL", "558": "NIC",
  "562": "NER", "566": "NGA", "408": "PRK", "578": "NOR", "512": "OMN",
  "586": "PAK", "275": "PSE", "591": "PAN", "598": "PNG", "600": "PRY",
  "604": "PER", "608": "PHL", "616": "POL", "620": "PRT", "634": "QAT",
  "410": "KOR", "642": "ROU", "643": "RUS", "646": "RWA", "682": "SAU",
  "686": "SEN", "688": "SRB", "694": "SLE", "702": "SGP", "703": "SVK",
  "705": "SVN", "706": "SOM", "710": "ZAF", "724": "ESP", "144": "LKA",
  "736": "SDN", "740": "SUR", "748": "SWZ", "752": "SWE", "756": "CHE",
  "760": "SYR", "762": "TJK", "834": "TZA", "764": "THA", "626": "TLS",
  "768": "TGO", "780": "TTO", "788": "TUN", "792": "TUR", "795": "TKM",
  "800": "UGA", "804": "UKR", "784": "ARE", "826": "GBR", "840": "USA",
  "858": "URY", "860": "UZB", "862": "VEN", "704": "VNM", "887": "YEM",
  "894": "ZMB", "716": "ZWE", "728": "SSD",
};
