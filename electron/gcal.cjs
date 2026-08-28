/* ============================================================
   Google Calendar — OAuth and fetching. Read-only.

   Runs in the main process because an installed-app OAuth flow needs a loopback
   listener and somewhere durable to keep a refresh token, neither of which a
   renderer has. Knows nothing about Electron: opening the browser and reading
   and writing the token are injected, which is what makes it testable without
   launching a window.

   Authorization Code + PKCE, per Google's "installed app" guidance. The client
   id ships in the app and is not a secret; PKCE is what stops an intercepted
   redirect from being redeemable by anyone else.
   ============================================================ */
const http = require("node:http");
const crypto = require("node:crypto");

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const API = "https://www.googleapis.com/calendar/v3";

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const verifier = () => b64url(crypto.randomBytes(48));
const challenge = (v) => b64url(crypto.createHash("sha256").update(v).digest());

async function tokenRequest(body) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description || json.error || `Token request failed (${res.status})`);
  return json;
}

/* Opens the consent screen and exchanges the code. Returns the token bundle;
   the caller persists it. */
async function connect({ clientId, clientSecret, openUrl, store }) {
  if (!clientId) throw new Error("No Google client id is configured in this build.");
  const v = verifier();

  // start listening first so the redirect can never arrive before we're ready.
  // Google allows any loopback port for desktop clients, so take what the OS gives.
  const server = http.createServer();
  await new Promise((ok, no) => { server.once("error", no); server.listen(0, "127.0.0.1", ok); });
  const redirectUri = `http://127.0.0.1:${server.address().port}`;

  const codePromise = new Promise((resolve, reject) => {
    server.on("request", (req, res) => {
      const url = new URL(req.url, redirectUri);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><meta charset="utf-8"><title>Lord of My Life</title>
        <body style="font-family:system-ui;background:#171C18;color:#E8ECE6;display:grid;place-items:center;height:100vh;margin:0">
        <div style="text-align:center"><h2>${error ? "Not connected" : "Calendar connected"}</h2>
        <p style="color:#8DA091">${error || "You can close this tab and go back to the app."}</p></div></body>`);
      server.close();
      error ? reject(new Error(error)) : code ? resolve(code) : reject(new Error("No authorization code came back."));
    });
    setTimeout(() => { try { server.close(); } catch (e) { /* already closed */ } reject(new Error("Timed out waiting for Google.")); }, 5 * 60 * 1000);
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    code_challenge: challenge(v),
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent", // force a refresh_token even on a repeat connect
  });
  await openUrl(`${AUTH_URL}?${params}`);

  const code = await codePromise;
  const tok = await tokenRequest({
    code,
    client_id: clientId,
    ...(clientSecret ? { client_secret: clientSecret } : {}),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: v,
  });

  const saved = {
    refresh_token: tok.refresh_token,
    access_token: tok.access_token,
    expires_at: Date.now() + (tok.expires_in - 60) * 1000,
    email: await whoami(tok.access_token).catch(() => null),
  };
  store.set(saved);
  return { email: saved.email };
}

async function whoami(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return (await res.json()).email || null;
}

async function accessToken({ clientId, clientSecret, store }) {
  const saved = store.get();
  if (!saved?.refresh_token) return null;
  if (saved.access_token && Date.now() < saved.expires_at) return saved.access_token;
  const tok = await tokenRequest({
    client_id: clientId,
    ...(clientSecret ? { client_secret: clientSecret } : {}),
    refresh_token: saved.refresh_token,
    grant_type: "refresh_token",
  });
  const next = { ...saved, access_token: tok.access_token, expires_at: Date.now() + (tok.expires_in - 60) * 1000 };
  store.set(next);
  return next.access_token;
}

/* A window of events rather than an incremental sync token: `singleEvents`
   expands recurring meetings into real instances, which is the whole reason a
   standing lab meeting shows up correctly even though this app's own events
   have no notion of repeats. The window is small enough that refetching it is
   cheaper than maintaining sync state. */
async function listEvents({ clientId, clientSecret, store, daysBack = 7, daysAhead = 45 }) {
  const token = await accessToken({ clientId, clientSecret, store });
  if (!token) return { connected: false, events: [] };
  const timeMin = new Date(Date.now() - daysBack * 86400000).toISOString();
  const timeMax = new Date(Date.now() + daysAhead * 86400000).toISOString();
  const q = new URLSearchParams({
    singleEvents: "true", orderBy: "startTime", maxResults: "500", timeMin, timeMax,
  });
  const res = await fetch(`${API}/calendars/primary/events?${q}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 401) { store.set(null); throw new Error("Google sign-in expired — connect again."); }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || `Calendar request failed (${res.status})`);
  return {
    connected: true,
    email: store.get()?.email || null,
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

const status = ({ store }) => {
  const s = store.get();
  return { connected: !!s?.refresh_token, email: s?.email || null };
};
const disconnect = ({ store }) => { store.set(null); return { connected: false }; };

module.exports = { connect, listEvents, status, disconnect };
