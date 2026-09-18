/* ============================================================
   Google Calendar — renderer half. Two ways in, behind one set of functions,
   so research-planner.jsx never learns which one it got:

   desktop — electron/gcal.cjs owns an Authorization Code + PKCE flow with a
   loopback redirect, and keeps a refresh token encrypted on disk.
   browser — a tab has no loopback listener, so the hosted version uses Google
   Identity Services' token client instead: a popup that hands back an access
   token and nothing else.

   That difference is visible to the user and worth knowing: the desktop
   connection survives for days, the browser one is an hour long and renews
   itself quietly while the tab is open.
   ============================================================ */

const bridge = () => (typeof window !== "undefined" ? window.lolCal : null);

// Both ship in the build. Neither is really a secret — PKCE is what protects the
// exchange — but Google's desktop clients reject the exchange without the secret.
const CONFIG = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
  clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || "",
};

/* A *separate* OAuth client of type "Web application", whose authorized
   JavaScript origins list the sites this app is served from. A desktop client
   id is rejected outright by the browser flow, so the two can't be shared. */
const WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || "";
const inBrowser = typeof window !== "undefined" && !bridge();
const webOk = () => inBrowser && !!WEB_CLIENT_ID;

export const calAvailable = () => !!bridge() || webOk();
export const calConfigured = () => (bridge() ? !!CONFIG.clientId : !!WEB_CLIENT_ID);

/* ---------------- browser: Google Identity Services ---------------- */

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const API = "https://www.googleapis.com/calendar/v3";
/* Per-device, like the theme and the panel widths — a token belongs to this
   browser, not to the planner, and must never ride along in the synced row. */
const TOKEN_KEY = "lordofmylife:gcal";

const loadToken = () => {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
  } catch (e) {
    return null;
  }
};
const saveToken = (t) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) { /* private mode — the connection just won't outlive the tab */ }
};

let gisPromise = null;
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = "https://accounts.google.com/gsi/client";
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => { gisPromise = null; reject(new Error("Couldn't reach Google to sign in.")); };
    document.head.appendChild(el);
  });
  return gisPromise;
}

/* The token client takes its result through a callback set at construction, so
   one client is made per request and the callbacks resolve that request. */
function requestToken({ silent, hint }) {
  return loadGis().then(() => new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: WEB_CLIENT_ID,
      scope: SCOPE,
      callback: (res) => (res.access_token
        ? resolve(res)
        : reject(new Error(res.error_description || res.error || "Google didn't return a token."))),
      error_callback: (err) => reject(new Error(err?.type === "popup_closed"
        ? "The Google window was closed before finishing."
        : "Google's sign-in window couldn't open — check your popup blocker.")),
    });
    // prompt "" asks Google to reuse the grant silently; anything else needs a click
    client.requestAccessToken(silent ? { prompt: "", hint: hint || undefined } : {});
  }));
}

/* Whose calendar this is. `primary`'s id is the account's own address, so the
   email costs nothing rather than a second scope just to read a profile. */
async function primaryEmail(token) {
  try {
    const res = await fetch(`${API}/calendars/primary`, { headers: { authorization: `Bearer ${token}` } });
    return res.ok ? (await res.json()).id || null : null;
  } catch (e) {
    return null;
  }
}

/* True once a silent renewal has failed. Renewal opens a popup, and a popup
   outside a click is blocked — so after one failure we stop trying on the
   5-minute poll and wait for the user to press Connect, rather than throwing a
   blocked window at them every five minutes for the rest of the day. */
let needsClick = false;

async function webToken() {
  const saved = loadToken();
  if (!saved) return null;
  if (saved.expiresAt > Date.now()) return saved.token;
  if (needsClick) return null;
  try {
    const res = await requestToken({ silent: true, hint: saved.email });
    const next = { token: res.access_token, expiresAt: Date.now() + (res.expires_in - 60) * 1000, email: saved.email };
    saveToken(next);
    return next.token;
  } catch (e) {
    needsClick = true;
    return null;
  }
}

const webStatus = () => {
  const saved = loadToken();
  return { connected: !!saved, email: saved?.email || null };
};

async function webConnect() {
  try {
    const res = await requestToken({ silent: false });
    needsClick = false;
    const email = await primaryEmail(res.access_token);
    saveToken({ token: res.access_token, expiresAt: Date.now() + (res.expires_in - 60) * 1000, email });
    return { connected: true, email };
  } catch (e) {
    return { error: e.message };
  }
}

function webDisconnect() {
  const saved = loadToken();
  // revoking matters: without it the grant stays on the account and "connect"
  // silently reuses it, so disconnecting would look like it did nothing
  if (saved?.token) { try { window.google?.accounts?.oauth2?.revoke(saved.token); } catch (e) { /* already gone */ } }
  saveToken(null);
  needsClick = false;
  return { connected: false };
}

/* The same window and the same shape electron/gcal.cjs returns — singleEvents
   expands a recurring meeting into real instances, which is the whole reason a
   standing lab meeting appears at all in an app whose own events never repeat. */
async function webList({ daysBack = 7, daysAhead = 45 } = {}) {
  const token = await webToken();
  if (!token) {
    const saved = loadToken();
    return saved
      ? { connected: false, error: "Google sign-in expired — connect again.", events: [] }
      : { connected: false, events: [] };
  }
  const q = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "500",
    timeMin: new Date(Date.now() - daysBack * 86400000).toISOString(),
    timeMax: new Date(Date.now() + daysAhead * 86400000).toISOString(),
  });
  const res = await fetch(`${API}/calendars/primary/events?${q}`, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) {
    saveToken(null);
    return { connected: false, error: "Google sign-in expired — connect again.", events: [] };
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { connected: true, error: json.error?.message || `Calendar request failed (${res.status})`, events: [] };
  return {
    connected: true,
    email: loadToken()?.email || null,
    events: (json.items || [])
      .filter((e) => e.status !== "cancelled")
      .map((e) => ({
        id: `g:${e.id}`,
        title: e.summary || "(no title)",
        // all-day events carry `date`; timed ones carry `dateTime`
        allDay: !e.start?.dateTime,
        startISO: e.start?.dateTime || e.start?.date || null,
        endISO: e.end?.dateTime || e.end?.date || null,
      }))
      .filter((e) => e.startISO && e.endISO),
  };
}

/* ---------------- one surface over both ---------------- */

export const calStatus = () => {
  if (bridge()) return bridge().status();
  return Promise.resolve(webOk() ? webStatus() : { connected: false });
};
export const calConnect = () => {
  if (bridge()) return bridge().connect(CONFIG);
  return webOk() ? webConnect() : Promise.resolve({ error: "Google Calendar isn't configured in this build." });
};
export const calDisconnect = () => {
  if (bridge()) return bridge().disconnect();
  return Promise.resolve(webOk() ? webDisconnect() : { connected: false });
};

/* Google returns RFC3339 with an offset; the planner stores local wall-clock
   date + HH:MM, so the conversion happens here and nowhere else. */
const pad = (n) => String(n).padStart(2, "0");
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function toPlannerEvent(e) {
  if (e.allDay) {
    // all-day events are context, not a busy block — they must not push the
    // session plan around, so they're flagged and excluded from scheduling
    return { id: e.id, title: e.title, date: e.startISO.slice(0, 10), allDay: true, source: "google" };
  }
  const start = new Date(e.startISO), end = new Date(e.endISO);
  const date = localDate(start);
  return {
    id: e.id, title: e.title, date,
    start: localTime(start),
    // an event running past midnight is clamped so it stays inside its own day
    end: localDate(end) === date ? localTime(end) : "23:59",
    source: "google",
  };
}

export async function calFetch() {
  const api = bridge();
  let res;
  if (api) {
    if (!CONFIG.clientId) return { connected: false, events: [] };
    res = await api.list(CONFIG);
  } else {
    if (!webOk()) return { connected: false, events: [] };
    res = await webList().catch((e) => ({ connected: false, error: e.message, events: [] }));
  }
  if (res.error) return { connected: !!res.connected, error: res.error, events: [] };
  return {
    connected: !!res.connected,
    email: res.email || null,
    events: (res.events || []).map(toPlannerEvent),
  };
}
