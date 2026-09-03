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

// `_client` is transport bookkeeping, not planner state — it never reaches the app
const stripClient = ({ _client, ...rest }) => rest;

export async function fetchCloudData(userId) {
  const { data, error } = await supabase
    .from("planner_data")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data, data: stripClient(data.data) } : null;
}

/* Identifies this tab's writes in the realtime stream. Postgres changes are
   broadcast to every subscriber including the one that made them, so without a
   marker a device applies its own push back over itself — and any edit made in
   the 600ms since is silently reverted. Riding inside the JSONB blob keeps this
   out of the table schema. */
export const clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);

/* Returns the updated_at it wrote. The caller records that as the version of the
   cloud row it now agrees with, which is what lets a later reconnect tell "the
   cloud hasn't moved, my local edits are the only new ones" apart from "both
   sides changed" without comparing two machines' clocks. */
export async function pushCloudData(userId, data) {
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from("planner_data")
    .upsert({ user_id: userId, data: { ...data, _client: clientId }, updated_at: updatedAt });
  if (error) throw error;
  return updatedAt;
}

/* ---------------- shared focus rooms ----------------
   A room is a Realtime channel and nothing else — no tables, no schema, no rows
   to clean up. Everything about it is ephemeral: who's in it lives in the
   channel's presence state, and it stops existing when the last person leaves.
   That's why joining needs no migration and costs no storage.

   Presence carries each person's whole payload (name, their queue, and — for
   the host — the timer), so a late joiner is handed the current state on their
   first `sync` without anyone having to re-broadcast it. */

// no I/O/0/1 — these get read aloud and typed by hand
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const newRoomCode = () =>
  Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

export function joinRoom(code, presenceKey, onPeers, onStatus) {
  const channel = supabase.channel(`focusroom:${code}`, {
    config: { presence: { key: presenceKey } },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      // presenceState() is { key: [payload, ...] }; we only ever track one per key
      const state = channel.presenceState();
      onPeers(Object.entries(state).map(([key, entries]) => ({ key, ...entries[0] })));
    })
    .subscribe((status) => {
      onStatus(status);
    });

  return {
    // called on every local change; presence replaces the whole payload
    publish: (payload) => channel.track(payload).catch(() => {}),
    leave: () => { try { channel.untrack(); } catch (e) { /* already gone */ } supabase.removeChannel(channel); },
  };
}

/* Fires cb(newData) when *another* device updates this user's row. Our own
   writes come back down this channel too and are dropped here: applying one
   would overwrite whatever was edited while it was in flight, which reads
   exactly like a task un-completing itself a moment after you tick it. */
export function subscribeToCloudData(userId, cb) {
  const channel = supabase
    .channel(`planner_data:${userId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "planner_data", filter: `user_id=eq.${userId}` },
      (payload) => {
        const next = payload.new?.data;
        if (!next || next._client === clientId) return;
        cb(stripClient(next));
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
