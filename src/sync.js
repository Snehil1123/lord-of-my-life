import { createClient } from "@supabase/supabase-js";

/* ============================================================
   Cloud sync data layer — talks to Supabase so the same planner
   data shows up on every device you're signed into.
   Kept separate from research-planner.jsx (which stays local-only
   and storage-agnostic): this file owns the client, auth, and the
   one `planner_data` row per user.
   ============================================================ */

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// null when env vars aren't set — app falls back to localStorage-only.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export const signUp = (email, password) => supabase.auth.signUp({ email, password });
export const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });
export const signOut = () => supabase.auth.signOut();
export const getSession = async () => (await supabase.auth.getSession()).data.session;
export const onAuthChange = (cb) => supabase.auth.onAuthStateChange((_event, session) => cb(session));

export async function fetchCloudData(userId) {
  const { data, error } = await supabase
    .from("planner_data")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data; // null if no row yet
}

export async function pushCloudData(userId, data) {
  const { error } = await supabase
    .from("planner_data")
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Fires cb(newData) whenever another device updates this user's row.
export function subscribeToCloudData(userId, cb) {
  const channel = supabase
    .channel(`planner_data:${userId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "planner_data", filter: `user_id=eq.${userId}` },
      (payload) => cb(payload.new.data)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
