/**
 * Supabase data layer — replaces sheets-client.ts.
 * All CRUD operations for contacts, journal, salles, and app_config.
 */

import { supabase } from "./supabase";
import { devLog, devWarn } from "./console-banner";
import type { SallePlan, Seat, Zone } from "./salle-types";

/* ── Types ─────────────────────────────────────────────── */

export interface ContactRow {
  id: string;
  contact_type: "communication" | "commercial";
  pseudo: string | null;
  entreprise: string | null;
  prenom: string | null;
  nom: string | null;
  id_discord: string | null;
  email: string | null;
  pays: string | null;
  ville: string | null;
  region: string | null;
  langues: string | null;
  nda_signee: string | null;
  referent: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  lock: string | null;
  contacter: string | null;
  twitter: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  linkedin: string | null;
  twitch: string | null;
  autre: string | null;
  created_at: string;
}

export type ContactInsert = Omit<ContactRow, "id" | "created_at">;
export type ContactUpdate = Partial<Omit<ContactRow, "id" | "created_at" | "contact_type">>;

export interface JournalRow {
  id: number;
  action: string;
  contact_type: string | null;
  member_id: string | null;
  pseudo: string | null;
  details: string | null;
  user_email: string | null;
  created_at: string;
}

/* ── Contacts ──────────────────────────────────────────── */

export async function fetchContacts(
  contactType: "communication" | "commercial"
): Promise<ContactRow[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("contact_type", contactType)
    .order("created_at", { ascending: true });

  if (error) {
    devWarn("supabase-data", "fetchContacts error", error);
    throw new Error(error.message);
  }
  devLog("supabase-data", "fetchContacts", contactType, "→", data?.length ?? 0);
  return (data ?? []) as ContactRow[];
}

export async function insertContact(
  row: ContactInsert
): Promise<ContactRow> {
  const { data, error } = await supabase
    .from("contacts")
    .insert(row)
    .select()
    .single();

  if (error) {
    devWarn("supabase-data", "insertContact error", error);
    throw new Error(error.message);
  }
  devLog("supabase-data", "insertContact OK", data.id);
  return data as ContactRow;
}

export async function updateContact(
  id: string,
  changes: ContactUpdate
): Promise<ContactRow> {
  const { data, error } = await supabase
    .from("contacts")
    .update(changes)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    devWarn("supabase-data", "updateContact error", error);
    throw new Error(error.message);
  }
  devLog("supabase-data", "updateContact OK", id);
  return data as ContactRow;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) {
    devWarn("supabase-data", "deleteContact error", error);
    throw new Error(error.message);
  }
  devLog("supabase-data", "deleteContact OK", id);
}

/* ── Journal ───────────────────────────────────────────── */

export async function fetchJournal(): Promise<JournalRow[]> {
  const { data, error } = await supabase
    .from("journal")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    devWarn("supabase-data", "fetchJournal error", error);
    throw new Error(error.message);
  }
  return (data ?? []) as JournalRow[];
}

export type JournalAction = "Ajouté" | "Modifié" | "Supprimé" | "Connexion" | "Déconnexion" | "Sauvegardé" | "Créé";

export async function appendJournalEntry(
  action: JournalAction,
  contactType: string,
  options: { memberId?: string; pseudo?: string; details?: string; userEmail?: string }
): Promise<void> {
  const { error } = await supabase.from("journal").insert({
    action,
    contact_type: contactType,
    member_id: options.memberId ?? null,
    pseudo: options.pseudo ?? null,
    details: options.details ?? null,
    user_email: options.userEmail ?? null,
  });
  if (error) {
    devWarn("supabase-data", "appendJournalEntry error", error);
  } else {
    devLog("supabase-data", "journal OK", action, options.pseudo ?? options.memberId);
  }
}

/* ── App Config (password etc.) ────────────────────────── */

export async function getAppConfig(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", key)
    .single();

  if (error) {
    devWarn("supabase-data", "getAppConfig error", key, error);
    return null;
  }
  return data?.value ?? null;
}

/* ── Salles ────────────────────────────────────────────── */

interface SalleRow {
  id: string;
  nom: string;
  description: string | null;
  zones: Zone[];
}

interface SallePlaceRow {
  id: string;
  salle_id: string;
  pos_x: number;
  pos_y: number;
  largeur: number;
  hauteur: number;
  rotation: number;
  zone: string | null;
  personne: string | null;
}

export async function fetchSallePlans(): Promise<SallePlan[]> {
  const { data: salles, error: sErr } = await supabase
    .from("salles")
    .select("*")
    .order("created_at", { ascending: true });

  if (sErr) {
    devWarn("supabase-data", "fetchSallePlans salles error", sErr);
    return [];
  }

  const { data: places, error: pErr } = await supabase
    .from("salle_places")
    .select("*");

  if (pErr) {
    devWarn("supabase-data", "fetchSallePlans places error", pErr);
  }

  const placesList = (places ?? []) as SallePlaceRow[];

  return ((salles ?? []) as SalleRow[]).map((s) => ({
    name: s.nom,
    zones: Array.isArray(s.zones) ? s.zones : [],
    seats: placesList
      .filter((p) => p.salle_id === s.id)
      .map((p) => ({
        id: p.id,
        x: p.pos_x,
        y: p.pos_y,
        width: p.largeur,
        height: p.hauteur,
        rotation: p.rotation,
        zone: p.zone ?? undefined,
        person: p.personne ?? undefined,
      })),
  }));
}

export async function saveSallePlan(
  plan: SallePlan
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Upsert the salle row
    const { data: salleData, error: salleErr } = await supabase
      .from("salles")
      .upsert({ nom: plan.name, zones: plan.zones }, { onConflict: "nom" })
      .select("id")
      .single();

    if (salleErr) throw new Error(salleErr.message);
    const salleId = salleData.id;

    // Delete existing places for this salle, then insert new ones
    await supabase.from("salle_places").delete().eq("salle_id", salleId);

    if (plan.seats.length > 0) {
      const rows = plan.seats.map((s) => ({
        id: s.id,
        salle_id: salleId,
        pos_x: Math.round(s.x),
        pos_y: Math.round(s.y),
        largeur: Math.round(s.width),
        hauteur: Math.round(s.height),
        rotation: Math.round(s.rotation),
        zone: s.zone ?? null,
        personne: s.person ?? null,
      }));
      const { error: pErr } = await supabase.from("salle_places").insert(rows);
      if (pErr) throw new Error(pErr.message);
    }

    devLog("supabase-data", "saveSallePlan OK", plan.name, plan.seats.length, "places");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    devWarn("supabase-data", "saveSallePlan error", e);
    return { ok: false, error: msg };
  }
}

export async function deleteSallePlan(
  planName: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("salles").delete().eq("nom", planName);
    if (error) throw new Error(error.message);
    devLog("supabase-data", "deleteSallePlan OK", planName);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    devWarn("supabase-data", "deleteSallePlan error", e);
    return { ok: false, error: msg };
  }
}
