/* ============================================================
   Google Calendar — renderer half. The OAuth flow and the tokens live in the
   main process (electron/gcal.cjs); this is the seam, plus the mapping from
   Google's shape onto the planner's own event shape.

   Desktop-only for the same reason as the assistant: an installed-app OAuth
   flow needs a loopback listener, which a browser tab doesn't have.
   ============================================================ */

const bridge = () => (typeof window !== "undefined" ? window.lolCal : null);

// Both ship in the build. Neither is really a secret — PKCE is what protects the
// exchange — but Google's desktop clients reject the exchange without the secret.
const CONFIG = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
  clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || "",
};

export const calAvailable = () => !!bridge();
export const calConfigured = () => !!CONFIG.clientId;

export const calStatus = () => bridge()?.status() ?? Promise.resolve({ connected: false });
export const calConnect = () => bridge()?.connect(CONFIG) ?? Promise.resolve({ error: "Desktop app only." });
export const calDisconnect = () => bridge()?.disconnect() ?? Promise.resolve({ connected: false });

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
  if (!api || !CONFIG.clientId) return { connected: false, events: [] };
  const res = await api.list(CONFIG);
  if (res.error) return { connected: false, error: res.error, events: [] };
  return {
    connected: !!res.connected,
    email: res.email || null,
    events: (res.events || []).map(toPlannerEvent),
  };
}
