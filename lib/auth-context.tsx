"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "admin" | "editor" | "viewer";
  created_at: string;
}

export interface PagePermission {
  page: string;
  can_read: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  permissions: PagePermission[];
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data as Profile;
}

async function fetchPermissions(userId: string): Promise<PagePermission[]> {
  const { data, error } = await supabase
    .from("user_permissions")
    .select("page, can_read, can_edit, can_delete")
    .eq("user_id", userId);
  if (error) return [];
  return (data ?? []) as PagePermission[];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<PagePermission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfileData = useCallback(async (uid: string) => {
    const [p, perms] = await Promise.all([
      fetchProfile(uid),
      fetchPermissions(uid),
    ]);
    setProfile(p);
    setPermissions(perms);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfileData(user.id);
  }, [user, loadProfileData]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadProfileData(s.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadProfileData(s.user.id).finally(() => mounted && setLoading(false));
      } else {
        setProfile(null);
        setPermissions([]);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfileData]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setPermissions([]);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        permissions,
        loading,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
