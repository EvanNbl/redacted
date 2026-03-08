import { supabase } from "./supabase";
import type { Profile, PagePermission } from "./auth-context";

export interface ProfileWithPermissions extends Profile {
  permissions: PagePermission[];
}

export async function fetchAllProfiles(): Promise<ProfileWithPermissions[]> {
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (pErr) throw new Error(pErr.message);

  const { data: perms, error: permErr } = await supabase
    .from("user_permissions")
    .select("*");

  if (permErr) throw new Error(permErr.message);

  const permsByUser = new Map<string, PagePermission[]>();
  for (const p of perms ?? []) {
    const list = permsByUser.get(p.user_id) ?? [];
    list.push({
      page: p.page,
      can_read: p.can_read,
      can_edit: p.can_edit,
      can_delete: p.can_delete,
    });
    permsByUser.set(p.user_id, list);
  }

  return ((profiles ?? []) as Profile[]).map((p) => ({
    ...p,
    permissions: permsByUser.get(p.id) ?? [],
  }));
}

export async function updateUserRole(
  userId: string,
  role: "admin" | "editor" | "viewer"
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function updateUserPermission(
  userId: string,
  page: string,
  field: "can_read" | "can_edit" | "can_delete",
  value: boolean
): Promise<void> {
  const { data: existing } = await supabase
    .from("user_permissions")
    .select("id")
    .eq("user_id", userId)
    .eq("page", page)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("user_permissions")
      .update({ [field]: value })
      .eq("user_id", userId)
      .eq("page", page);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("user_permissions").insert({
      user_id: userId,
      page,
      can_read: field === "can_read" ? value : true,
      can_edit: field === "can_edit" ? value : false,
      can_delete: field === "can_delete" ? value : false,
    });
    if (error) throw new Error(error.message);
  }
}

export async function deleteUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);
  if (error) throw new Error(error.message);
}
