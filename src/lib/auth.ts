import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./supabase";

/** The signed-in user, or null. Tracks auth state changes so the
 * header updates on sign-in and sign-out without a reload. */
export function useSession(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setUser(data.session?.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUser(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

/** Sign in with email + password. Throws with the Supabase message. */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Sign-in is not connected yet");
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

/** Sign out the current user. */
export async function signOut(): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  await supabase.auth.signOut();
}

/**
 * Whether the signed-in user is an admin (has a row in public.admins).
 * Checked via the SECURITY DEFINER is_admin() RPC — the admins table
 * itself is never read directly. Returns false when signed out or
 * unconfigured. This is a UI convenience only: RLS enforces writes
 * server-side regardless of what the UI shows.
 */
export async function fetchIsAdmin(): Promise<boolean> {
  if (!supabaseConfigured || !supabase) return false;
  const { data, error } = await supabase.rpc("is_admin");
  if (error) return false;
  return data === true;
}
