import { useState, useEffect, useRef, useMemo } from "react";
import {
  supabase, signUp, signIn, signOut, getSession, onAuthChange,
  fetchCloudData, pushCloudData, subscribeToCloudData,
} from "./sync.js";

/* ============================================================
   LORD OF MY LIFE — one planner for the whole research pipeline
   Plan (Gantt) · Week (tasks & 1:1 action items) · Focus (pomodoro)
   Everything is keyed to the ISO week number — the "week spine".
   ============================================================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');

:root{
  --paper:#171C18; --card:#1E2420; --ink:#E8ECE6; --muted:#8DA091;
  --line:#333F36; --line-soft:#262E28;
  --pine:#57B08A; --pine-soft:#1E3329;
  --tomato:#FF6E4A; --tomato-soft:#3B2018;
  --amber:#E0AC5C; --slate:#7C93BE; --plum:#B084A8;
  --radius:10px;
  color-scheme: dark;
}
*{box-sizing:border-box; margin:0;}
.fw{
  font-family:'Inter',system-ui,sans-serif; color:var(--ink);
  background:var(--paper); min-height:100vh; font-size:14px; line-height:1.45;
}
.fw ::selection{background:var(--pine-soft);}
.fw button{font-family:inherit; cursor:pointer;}
.fw input, .fw select{font-family:inherit; font-size:13px; color:var(--ink);}

/* ---------- header ---------- */
.hd{
  display:flex; align-items:center; gap:20px; flex-wrap:wrap;
  padding:14px 22px; border-bottom:1px solid var(--line); background:var(--card);
  position:sticky; top:0; z-index:20;
}
.brand{font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:19px; letter-spacing:-0.02em;}
.brand em{font-style:normal; color:var(--pine);}
.wkchip{
  font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--muted);
  border:1px solid var(--line); border-radius:999px; padding:3px 10px; background:var(--paper);
}
.tabs{display:flex; gap:4px; margin-left:auto;}
.tab{
  border:1px solid transparent; background:none; border-radius:999px;
  padding:6px 16px; font-size:13.5px; font-weight:600; color:var(--muted);
}
.tab:hover{color:var(--ink);}
.tab.on{background:var(--ink); color:var(--card);}
.todaypomos{font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--tomato); font-weight:600;}

/* ---------- shared ---------- */
.wrap{max-width:1060px; margin:0 auto; padding:26px 22px 80px;}
.h2{font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:22px; letter-spacing:-0.02em;}
.sub{color:var(--muted); font-size:13px; margin-top:2px;}
.card{background:var(--card); border:1px solid var(--line); border-radius:var(--radius);}
.btn{
  border:1px solid var(--line); background:var(--card); border-radius:8px;
  padding:6px 12px; font-size:13px; font-weight:600; color:var(--ink);
}
.btn:hover{border-color:var(--muted);}
.btn.primary{background:var(--pine); border-color:var(--pine); color:#fff;}
.btn.primary:hover{background:#439774;}
.btn.ghost{border-color:transparent; color:var(--muted);}
.btn.ghost:hover{color:var(--ink);}
.field{
  border:1px solid var(--line); border-radius:8px; padding:6px 10px; background:var(--card);
}
.field:focus{outline:2px solid var(--pine-soft); border-color:var(--pine);}
.mono{font-family:'IBM Plex Mono',monospace;}
.xbtn{border:none; background:none; color:var(--muted); font-size:14px; padding:2px 6px; border-radius:6px; opacity:0; transition:opacity .12s;}
.xbtn:hover{color:var(--tomato); background:var(--tomato-soft);}
tr:hover .xbtn, .taskrow:hover .xbtn, .phaserow:hover .xbtn{opacity:1;}

/* ---------- plan / gantt ---------- */
.proj{margin-top:18px; overflow:hidden;}
.projhead{display:flex; align-items:center; gap:10px; padding:14px 16px; border-bottom:1px solid var(--line-soft);}
.projdot{width:10px; height:10px; border-radius:3px; flex:none;}
.projname{font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:16px;}
.projmeta{font-family:'IBM Plex Mono',monospace; font-size:11.5px; color:var(--muted);}
.gantt{position:relative; padding:10px 16px 16px; overflow-x:auto;}
.ggrid{display:grid; gap:0; position:relative; min-width:520px; grid-auto-rows:34px;}
.gwk{
  font-family:'IBM Plex Mono',monospace; font-size:10.5px; color:var(--muted);
  grid-row:1; padding:2px 0 6px 4px; white-space:nowrap; overflow:hidden;
}
.gbar{
  position:relative; z-index:2; height:26px; margin:4px 3px; border-radius:6px;
  display:flex; align-items:center; padding:0 8px; gap:6px;
  font-size:12px; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden;
  cursor:pointer; transition:filter .12s;
}
.gbar:hover{filter:brightness(1.08);}
.gbar.done{opacity:.45; text-decoration:line-through;}
.todayline{position:absolute; top:0; bottom:0; width:2px; background:var(--tomato); z-index:3;}
.todayflag{
  position:absolute; top:-2px; transform:translateX(-50%); background:var(--tomato); color:#fff;
  font-family:'IBM Plex Mono',monospace; font-size:9.5px; padding:1px 5px; border-radius:4px; z-index:4;
}
.addrow{display:flex; gap:8px; flex-wrap:wrap; align-items:center; padding:12px 16px; border-top:1px solid var(--line-soft); background:var(--paper);}

/* ---------- week ---------- */
.weeknav{display:flex; align-items:center; gap:10px; margin:4px 0 18px;}
.weektitle{font-family:'IBM Plex Mono',monospace; font-size:14px; font-weight:600;}
.catblock{margin-top:18px;}
.cathead{display:flex; align-items:center; gap:8px; margin-bottom:8px;}
.catdot{width:9px; height:9px; border-radius:50%;}
.catname{font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:.06em;}
.catcount{font-family:'IBM Plex Mono',monospace; font-size:11.5px; color:var(--muted);}
.taskrow{
  display:flex; align-items:center; gap:10px; padding:9px 12px;
  border-bottom:1px solid var(--line-soft); position:relative; background:var(--card);
}
.taskrow:last-child{border-bottom:none;}
.taskrow.done .tasktitle{color:var(--muted); text-decoration:line-through; text-decoration-color:var(--pine);}
.checkwrap{position:relative; flex:none; width:22px; height:22px;}
.check{
  width:22px; height:22px; border-radius:50%; border:2px solid var(--line);
  background:var(--card); display:flex; align-items:center; justify-content:center;
  color:transparent; font-size:12px; transition:all .15s; padding:0;
}
.check:hover{border-color:var(--pine);}
.check.on{background:var(--pine); border-color:var(--pine); color:#fff; animation:popin .3s cubic-bezier(.2,1.6,.4,1);}
@keyframes popin{0%{transform:scale(.6);}60%{transform:scale(1.25);}100%{transform:scale(1);}}
.particle{
  position:absolute; left:9px; top:9px; width:5px; height:5px; border-radius:50%;
  pointer-events:none; animation:fly .65s ease-out forwards;
}
@keyframes fly{
  0%{transform:translate(0,0) scale(1); opacity:1;}
  100%{transform:translate(var(--dx),var(--dy)) scale(.3); opacity:0;}
}
.tasktitle{font-size:14px; font-weight:500;}
.tag11{
  font-family:'IBM Plex Mono',monospace; font-size:10px; font-weight:600;
  background:var(--pine-soft); color:var(--pine); padding:1px 6px; border-radius:4px; flex:none;
}
.tagproj{font-size:11px; color:var(--muted); flex:none;}
.pomodots{display:flex; gap:3px; margin-left:auto; flex:none; align-items:center;}
.pdot{width:8px; height:8px; border-radius:50%; border:1.5px solid var(--tomato); background:transparent;}
.pdot.f{background:var(--tomato);}
.pcount{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); margin-left:2px;}
.addtask{display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top:20px; padding:14px; }
.emptyweek{color:var(--muted); font-size:13px; padding:18px 4px;}

/* ---------- focus ---------- */
.focuswrap{display:flex; flex-direction:column; align-items:center; padding-top:16px;}
.modebtns{display:flex; gap:6px; margin-bottom:22px;}
.modebtn{border:1px solid var(--line); background:var(--card); border-radius:999px; padding:6px 16px; font-size:12.5px; font-weight:600; color:var(--muted);}
.modebtn.on{background:var(--tomato); border-color:var(--tomato); color:#fff;}
.timerring{position:relative; width:270px; height:270px;}
.timertext{
  position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
}
.timerdigits{font-family:'IBM Plex Mono',monospace; font-size:58px; font-weight:600; letter-spacing:-0.02em; font-variant-numeric:tabular-nums;}
.timerlabel{font-size:12px; text-transform:uppercase; letter-spacing:.12em; color:var(--muted); margin-top:2px;}
.timerctl{display:flex; gap:10px; margin-top:24px;}
.bigbtn{border-radius:999px; padding:11px 34px; font-size:15px; font-weight:700; border:1px solid var(--line); background:var(--card);}
.bigbtn.go{background:var(--tomato); border-color:var(--tomato); color:#fff;}
.bigbtn.go:hover{background:#e0552f;}
.focustask{margin-top:26px; width:100%; max-width:460px;}
.sessrow{display:flex; gap:14px; justify-content:center; margin-top:18px; font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--muted);}
.durs{display:flex; gap:14px; margin-top:22px; align-items:center; color:var(--muted); font-size:12px;}
.durs input{width:52px; text-align:center;}

@media (max-width:640px){
  .wrap{padding:18px 12px 70px;}
  .tabs{margin-left:0; width:100%; justify-content:space-between;}
  .timerring{width:220px; height:220px;}
  .timerdigits{font-size:46px;}
}
@media (prefers-reduced-motion: reduce){
  .fw *{animation:none !important; transition:none !important;}
}
`;

/* ---------------- date / week helpers ---------------- */
const DAY = 86400000;
const monday = (d) => { const m = new Date(d); m.setHours(0,0,0,0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };
const addDays = (d, n) => new Date(d.getTime() + n * DAY);
const isoWeek = (d) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const fd = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - fd + 3);
  return { year: date.getUTCFullYear(), week: 1 + Math.round((date - firstThu) / (7 * DAY)) };
};
const weekKeyOf = (d) => { const { year, week } = isoWeek(d); return `${year}-W${String(week).padStart(2, "0")}`; };
const wkLabel = (d) => `W${String(isoWeek(d).week).padStart(2, "0")}`;
const fmtRange = (m) => {
  const opts = { month: "short", day: "numeric" };
  return `${m.toLocaleDateString(undefined, opts)} – ${addDays(m, 6).toLocaleDateString(undefined, opts)}`;
};
const dateKey = (d) => d.toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

/* ---------------- sounds ---------------- */
function tone(freqA, freqB, dur = 0.28, vol = 0.12) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = (window.__fwAudio = window.__fwAudio || new Ctx());
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freqA, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(freqB, ctx.currentTime + dur * 0.4);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur + 0.05);
  } catch (e) {}
}
const popSound = () => tone(620, 940, 0.25);
const chime = () => { tone(520, 520, 0.4, 0.1); setTimeout(() => tone(780, 780, 0.55, 0.1), 180); };

/* ---------------- default data ---------------- */
const CATS = [
  { id: "research", name: "Research", color: "var(--pine)" },
  { id: "writing", name: "Writing", color: "var(--slate)" },
  { id: "admin", name: "Admin", color: "var(--plum)" },
  { id: "personal", name: "Personal", color: "var(--amber)" },
];
const PROJ_COLORS = ["#2F5D4A", "#56688A", "#7A5474", "#B8862B", "#3E7C8A", "#8A5A3E"];

function sampleData() {
  const m0 = monday(new Date());
  const iso = (d) => d.toISOString().slice(0, 10);
  const wk = weekKeyOf(new Date());
  return {
    settings: { work: 25, short: 5, long: 15 },
    pomoLog: {},
    projects: [
      {
        id: uid(), name: "Dissertation — Aim 2", color: PROJ_COLORS[0],
        phases: [
          { id: uid(), name: "Pilot experiments", start: iso(addDays(m0, -21)), end: iso(addDays(m0, 6)), done: false },
          { id: uid(), name: "Full data collection", start: iso(addDays(m0, 7)), end: iso(addDays(m0, 41)), done: false },
          { id: uid(), name: "Analysis", start: iso(addDays(m0, 35)), end: iso(addDays(m0, 55)), done: false },
          { id: uid(), name: "Draft manuscript", start: iso(addDays(m0, 49)), end: iso(addDays(m0, 76)), done: false },
        ],
      },
    ],
    tasks: [
      { id: uid(), title: "Rerun pilot with corrected buffer concentration", cat: "research", week: wk, est: 3, done: 0, checked: false, oneOnOne: true },
      { id: uid(), title: "Send PI the updated figure 2 draft", cat: "writing", week: wk, est: 2, done: 1, checked: false, oneOnOne: true },
      { id: uid(), title: "Order reagents before Thursday", cat: "admin", week: wk, est: 1, done: 0, checked: false, oneOnOne: false },
      { id: uid(), title: "Book flights for October conference", cat: "personal", week: wk, est: 1, done: 0, checked: false, oneOnOne: false },
    ],
  };
}

/* ---------------- storage ---------------- */
const KEY = "lordofmylife:data";
function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* first run — no key yet, or corrupt JSON */ }
  return null;
}
function saveData(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage full or unavailable */ }
}

function exportData(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lord-of-my-life-backup-${dateKey(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function importData(file, onLoaded) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.projects) && Array.isArray(parsed.tasks)) {
        onLoaded(parsed);
      } else {
        alert("That file doesn't look like a Lord of My Life backup.");
      }
    } catch (e) {
      alert("Couldn't read that file — is it a valid Lord of My Life JSON export?");
    }
  };
  reader.readAsText(file);
}

/* ================================================================ */
export default function LordOfMyLife() {
  const [data, setData] = useState(() => loadData() || sampleData());
  const [view, setView] = useState("week");
  const saveTimer = useRef(null);
  const fileInputRef = useRef(null);

  // debounced save
  useEffect(() => {
    if (!data) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveData(data), 500);
    return () => clearTimeout(saveTimer.current);
  }, [data]);

  const handleImportFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) importData(file, setData);
    e.target.value = "";
  };

  const todayPomos = data.pomoLog[dateKey(new Date())] || 0;

  return (
    <div className="fw">
      <style>{CSS}</style>
      <header className="hd">
        <div className="brand">Lord of <em>my Life</em></div>
        <span className="wkchip">{weekKeyOf(new Date())} · {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
        {todayPomos > 0 && <span className="todaypomos">🍅 ×{todayPomos} today</span>}
        <nav className="tabs">
          {[["plan", "Plan"], ["week", "Week"], ["focus", "Focus"]].map(([k, label]) => (
            <button key={k} className={`tab ${view === k ? "on" : ""}`} onClick={() => setView(k)}>{label}</button>
          ))}
        </nav>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn ghost" title="Download a JSON backup of all your data" onClick={() => exportData(data)}>Export</button>
          <button className="btn ghost" title="Restore data from a JSON backup" onClick={() => fileInputRef.current?.click()}>Import</button>
          <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={handleImportFile} />
        </div>
        <SyncBar data={data} setData={setData} />
      </header>
      <main className="wrap">
        {view === "plan" && <PlanView data={data} setData={setData} />}
        {view === "week" && <WeekView data={data} setData={setData} />}
        {view === "focus" && <FocusView data={data} setData={setData} />}
      </main>
    </div>
  );
}

/* ================= CLOUD SYNC ================= */
function SyncBar({ data, setData }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("offline"); // offline | connecting | synced | error
  const [form, setForm] = useState({ email: "", password: "", mode: "signin" });
  const [authError, setAuthError] = useState("");
  const pushTimer = useRef(null);
  const skipNextPush = useRef(false); // true while applying a remote update, so we don't echo it straight back

  useEffect(() => {
    if (!supabase) return;
    getSession().then(setSession);
    const { data: sub } = onAuthChange(setSession);
    return () => sub.subscription.unsubscribe();
  }, []);

  // on sign-in: pull the cloud row (or seed it from local data), then listen for remote changes
  useEffect(() => {
    if (!supabase || !session) return;
    let unsubRealtime;
    setStatus("connecting");
    (async () => {
      try {
        const row = await fetchCloudData(session.user.id);
        if (row) {
          skipNextPush.current = true;
          setData(row.data);
        } else {
          await pushCloudData(session.user.id, data);
        }
        setStatus("synced");
        unsubRealtime = subscribeToCloudData(session.user.id, (remoteData) => {
          skipNextPush.current = true;
          setData(remoteData);
        });
      } catch (e) {
        setStatus("error");
      }
    })();
    return () => unsubRealtime && unsubRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // push local edits up, debounced — skipped once right after applying a remote update
  useEffect(() => {
    if (!supabase || !session) return;
    if (skipNextPush.current) { skipNextPush.current = false; return; }
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      try { await pushCloudData(session.user.id, data); setStatus("synced"); }
      catch (e) { setStatus("error"); }
    }, 600);
    return () => clearTimeout(pushTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!supabase) return null; // no Supabase env vars — cloud sync UI stays hidden

  const submit = async () => {
    setAuthError("");
    try {
      if (form.mode === "signin") { const { error } = await signIn(form.email, form.password); if (error) throw error; }
      else { const { error } = await signUp(form.email, form.password); if (error) throw error; }
    } catch (e) { setAuthError(e.message); }
  };

  if (!session) {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input className="field" style={{ width: 130 }} type="email" placeholder="email"
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="field" style={{ width: 110 }} type="password" placeholder="password"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && submit()} />
        <button className="btn" onClick={submit}>{form.mode === "signin" ? "Sign in" : "Sign up"}</button>
        <button className="btn ghost" onClick={() => setForm({ ...form, mode: form.mode === "signin" ? "signup" : "signin" })}>
          {form.mode === "signin" ? "New? Sign up" : "Have an account?"}
        </button>
        {authError && <span style={{ color: "var(--tomato)", fontSize: 12 }}>{authError}</span>}
      </div>
    );
  }

  const statusLabel = { connecting: "Syncing…", synced: "Synced", error: "Sync error" }[status] || "Offline";
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span className="wkchip" style={{ color: status === "error" ? "var(--tomato)" : "var(--muted)" }}>{statusLabel}</span>
      <button className="btn ghost" onClick={signOut}>Sign out</button>
    </div>
  );
}

/* ================= PLAN (Gantt) ================= */
function PlanView({ data, setData }) {
  const [name, setName] = useState("");

  const addProject = () => {
    if (!name.trim()) return;
    setData({
      ...data,
      projects: [...data.projects, { id: uid(), name: name.trim(), color: PROJ_COLORS[data.projects.length % PROJ_COLORS.length], phases: [] }],
    });
    setName("");
  };
  const delProject = (id) => setData({ ...data, projects: data.projects.filter((p) => p.id !== id) });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="h2">Big picture</div>
          <div className="sub">Each project is a timeline of phases on the week spine. Click a bar to mark a phase complete.</div>
        </div>
        <input className="field" placeholder="New project name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addProject()} />
        <button className="btn primary" onClick={addProject}>Add project</button>
      </div>

      {data.projects.length === 0 && <div className="emptyweek">No projects yet — add one above to start your plan.</div>}
      {data.projects.map((p) => <ProjectGantt key={p.id} project={p} data={data} setData={setData} onDelete={() => delProject(p.id)} />)}
    </div>
  );
}

function ProjectGantt({ project, data, setData, onDelete }) {
  const [ph, setPh] = useState({ name: "", start: "", end: "" });

  const update = (proj) => setData({ ...data, projects: data.projects.map((p) => (p.id === proj.id ? proj : p)) });
  const addPhase = () => {
    if (!ph.name.trim() || !ph.start || !ph.end || ph.end < ph.start) return;
    update({ ...project, phases: [...project.phases, { id: uid(), ...ph, name: ph.name.trim(), done: false }] });
    setPh({ name: "", start: "", end: "" });
  };
  const togglePhase = (id) => update({ ...project, phases: project.phases.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) });
  const delPhase = (id) => update({ ...project, phases: project.phases.filter((x) => x.id !== id) });

  // timeline math
  const phases = project.phases;
  let grid = null;
  if (phases.length) {
    const starts = phases.map((x) => monday(new Date(x.start + "T00:00:00")));
    const ends = phases.map((x) => monday(new Date(x.end + "T00:00:00")));
    const min = new Date(Math.min(...starts));
    const max = new Date(Math.max(...ends));
    const nWeeks = Math.round((max - min) / (7 * DAY)) + 1;
    const weeks = Array.from({ length: nWeeks }, (_, i) => addDays(min, i * 7));
    const today = new Date();
    const todayPct = today >= min && today < addDays(min, nWeeks * 7)
      ? ((today - min) / (nWeeks * 7 * DAY)) * 100 : null;
    grid = { min, nWeeks, weeks, todayPct };
  }
  const doneCt = phases.filter((x) => x.done).length;

  return (
    <section className="card proj">
      <div className="projhead">
        <span className="projdot" style={{ background: project.color }} />
        <span className="projname">{project.name}</span>
        <span className="projmeta">{doneCt}/{phases.length} phases done</span>
        <span style={{ marginLeft: "auto" }} className="phaserow">
          <button className="xbtn" style={{ opacity: 1 }} title="Delete project" onClick={onDelete}>✕</button>
        </span>
      </div>

      {grid ? (
        <div className="gantt">
          <div
            className="ggrid"
            style={{
              gridTemplateColumns: `repeat(${grid.nWeeks}, minmax(46px,1fr))`,
              backgroundImage: "linear-gradient(to right, var(--line-soft) 1px, transparent 1px)",
              backgroundSize: `${100 / grid.nWeeks}% 100%`,
            }}
          >
            {grid.weeks.map((w, i) => <div key={i} className="gwk">{wkLabel(w)}</div>)}
            {phases.map((x, idx) => {
              const s = monday(new Date(x.start + "T00:00:00"));
              const e = monday(new Date(x.end + "T00:00:00"));
              const col = Math.round((s - grid.min) / (7 * DAY)) + 1;
              const span = Math.round((e - s) / (7 * DAY)) + 1;
              return (
                <div
                  key={x.id}
                  className={`gbar phaserow ${x.done ? "done" : ""}`}
                  style={{ gridColumn: `${col} / span ${span}`, gridRow: idx + 2, background: project.color }}
                  title={`${x.start} → ${x.end} · click to toggle done`}
                  onClick={() => togglePhase(x.id)}
                >
                  {x.done ? "✓ " : ""}{x.name}
                  <button className="xbtn" style={{ color: "#fff", marginLeft: "auto" }} onClick={(e2) => { e2.stopPropagation(); delPhase(x.id); }}>✕</button>
                </div>
              );
            })}
            {grid.todayPct !== null && (
              <>
                <div className="todayline" style={{ left: `${grid.todayPct}%` }} />
                <div className="todayflag" style={{ left: `${grid.todayPct}%` }}>today</div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="emptyweek" style={{ padding: "14px 16px" }}>No phases yet — add the first one below.</div>
      )}

      <div className="addrow">
        <input className="field" style={{ flex: 1, minWidth: 160 }} placeholder="Phase name (e.g. Data collection)"
          value={ph.name} onChange={(e) => setPh({ ...ph, name: e.target.value })} />
        <label style={{ fontSize: 12, color: "var(--muted)" }}>from <input type="date" className="field" value={ph.start} onChange={(e) => setPh({ ...ph, start: e.target.value })} /></label>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>to <input type="date" className="field" value={ph.end} onChange={(e) => setPh({ ...ph, end: e.target.value })} /></label>
        <button className="btn" onClick={addPhase}>Add phase</button>
      </div>
    </section>
  );
}

/* ================= WEEK ================= */
function WeekView({ data, setData }) {
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState({ title: "", cat: "research", est: 2, oneOnOne: false });
  const [burst, setBurst] = useState(null); // task id currently bursting

  const wkMonday = addDays(monday(new Date()), offset * 7);
  const wk = weekKeyOf(wkMonday);
  const tasks = data.tasks.filter((t) => t.week === wk);
  const prevWk = weekKeyOf(addDays(wkMonday, -7));
  const carryable = offset === 0 ? data.tasks.filter((t) => t.week === prevWk && !t.checked) : [];

  const addTask = () => {
    if (!form.title.trim()) return;
    setData({ ...data, tasks: [...data.tasks, { id: uid(), title: form.title.trim(), cat: form.cat, week: wk, est: Math.max(1, +form.est || 1), done: 0, checked: false, oneOnOne: form.oneOnOne }] });
    setForm({ ...form, title: "" });
  };
  const toggle = (t) => {
    const nowChecked = !t.checked;
    setData({ ...data, tasks: data.tasks.map((x) => (x.id === t.id ? { ...x, checked: nowChecked } : x)) });
    if (nowChecked) { setBurst(t.id); popSound(); setTimeout(() => setBurst(null), 700); }
  };
  const delTask = (id) => setData({ ...data, tasks: data.tasks.filter((x) => x.id !== id) });
  const carryOver = () => setData({ ...data, tasks: data.tasks.map((t) => (t.week === prevWk && !t.checked ? { ...t, week: wk } : t)) });

  const doneCt = tasks.filter((t) => t.checked).length;

  return (
    <div>
      <div className="h2">This week's field notes</div>
      <div className="sub">Weekly tasks and 1:1 action items, grouped by category. Estimate each task in pomodoros — Focus fills the dots.</div>

      <div className="weeknav" style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => setOffset(offset - 1)}>←</button>
        <span className="weektitle">{wk} · {fmtRange(wkMonday)}</span>
        <button className="btn" onClick={() => setOffset(offset + 1)}>→</button>
        {offset !== 0 && <button className="btn ghost" onClick={() => setOffset(0)}>Back to today</button>}
        <span className="catcount" style={{ marginLeft: "auto" }}>{doneCt}/{tasks.length} done</span>
        {carryable.length > 0 && <button className="btn" onClick={carryOver}>Pull {carryable.length} unfinished from last week</button>}
      </div>

      {CATS.map((c) => {
        const list = tasks.filter((t) => t.cat === c.id);
        if (!list.length) return null;
        return (
          <div className="catblock" key={c.id}>
            <div className="cathead">
              <span className="catdot" style={{ background: c.color }} />
              <span className="catname" style={{ color: c.color }}>{c.name}</span>
              <span className="catcount">{list.filter((t) => t.checked).length}/{list.length}</span>
            </div>
            <div className="card">
              {list.map((t) => (
                <div key={t.id} className={`taskrow ${t.checked ? "done" : ""}`}>
                  <span className="checkwrap">
                    <button className={`check ${t.checked ? "on" : ""}`} aria-label={t.checked ? "Mark not done" : "Mark done"} onClick={() => toggle(t)}>✓</button>
                    {burst === t.id && Array.from({ length: 10 }, (_, i) => {
                      const a = (i / 10) * Math.PI * 2;
                      const r = 22 + (i % 3) * 8;
                      const colors = ["var(--tomato)", "var(--pine)", "var(--amber)"];
                      return <span key={i} className="particle" style={{ background: colors[i % 3], "--dx": `${Math.cos(a) * r}px`, "--dy": `${Math.sin(a) * r}px` }} />;
                    })}
                  </span>
                  <span className="tasktitle">{t.title}</span>
                  {t.oneOnOne && <span className="tag11">1:1</span>}
                  <span className="pomodots" title={`${t.done}/${t.est} pomodoros`}>
                    {Array.from({ length: Math.min(t.est, 8) }, (_, i) => <span key={i} className={`pdot ${i < t.done ? "f" : ""}`} />)}
                    {t.est > 8 && <span className="pcount">{t.done}/{t.est}</span>}
                  </span>
                  <button className="xbtn" onClick={() => delTask(t.id)} title="Delete task">✕</button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {tasks.length === 0 && <div className="emptyweek">A clean slate. Add the first task for {wk} below.</div>}

      <div className="card addtask">
        <input className="field" style={{ flex: 1, minWidth: 200 }} placeholder="Add a task…"
          value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addTask()} />
        <select className="field" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>
          {CATS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
          <input type="number" min="1" max="20" className="field" style={{ width: 56 }} value={form.est} onChange={(e) => setForm({ ...form, est: e.target.value })} /> 🍅 est.
        </label>
        <label style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
          <input type="checkbox" checked={form.oneOnOne} onChange={(e) => setForm({ ...form, oneOnOne: e.target.checked })} /> 1:1 action item
        </label>
        <button className="btn primary" onClick={addTask}>Add</button>
      </div>
    </div>
  );
}

/* ================= FOCUS ================= */
function FocusView({ data, setData }) {
  const s = data.settings;
  const [mode, setMode] = useState("work"); // work | short | long
  const durFor = (m) => (m === "work" ? s.work : m === "short" ? s.short : s.long) * 60;
  const [left, setLeft] = useState(durFor("work"));
  const [running, setRunning] = useState(false);
  const [cycle, setCycle] = useState(0); // completed work sessions in current set
  const [taskId, setTaskId] = useState("");
  const taskRef = useRef("");
  useEffect(() => { taskRef.current = taskId; }, [taskId]);
  const endRef = useRef(null);
  const tickRef = useRef(null);

  const wk = weekKeyOf(new Date());
  const openTasks = data.tasks.filter((t) => t.week === wk && !t.checked);

  const switchMode = (m) => { setMode(m); setRunning(false); setLeft(durFor(m)); };

  useEffect(() => {
    if (!running) { clearInterval(tickRef.current); return; }
    endRef.current = Date.now() + left * 1000;
    tickRef.current = setInterval(() => {
      const remain = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setLeft(remain);
      if (remain === 0) { clearInterval(tickRef.current); onComplete(); }
    }, 250);
    return () => clearInterval(tickRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const onComplete = () => {
    setRunning(false);
    chime();
    if (mode === "work") {
      const dk = dateKey(new Date());
      const nextCycle = cycle + 1;
      setCycle(nextCycle);
      setData((prev) => ({
        ...prev,
        pomoLog: { ...prev.pomoLog, [dk]: (prev.pomoLog[dk] || 0) + 1 },
        tasks: taskRef.current ? prev.tasks.map((t) => (t.id === taskRef.current ? { ...t, done: t.done + 1 } : t)) : prev.tasks,
      }));
      const nm = nextCycle % 4 === 0 ? "long" : "short";
      setMode(nm); setLeft(durFor(nm));
    } else {
      setMode("work"); setLeft(durFor("work"));
    }
  };

  const total = durFor(mode);
  const pct = 1 - left / total;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const ringColor = mode === "work" ? "var(--tomato)" : "var(--pine)";
  const R = 120, C = 2 * Math.PI * R;
  const task = data.tasks.find((t) => t.id === taskId);

  const setDur = (k, v) => {
    const val = Math.max(1, Math.min(120, +v || 1));
    setData({ ...data, settings: { ...s, [k]: val } });
    if (!running) setLeft((k === "work" && mode === "work") || (k === "short" && mode === "short") || (k === "long" && mode === "long") ? val * 60 : left);
  };

  return (
    <div className="focuswrap">
      <div className="modebtns">
        <button className={`modebtn ${mode === "work" ? "on" : ""}`} onClick={() => switchMode("work")}>Focus</button>
        <button className={`modebtn ${mode === "short" ? "on" : ""}`} onClick={() => switchMode("short")}>Short break</button>
        <button className={`modebtn ${mode === "long" ? "on" : ""}`} onClick={() => switchMode("long")}>Long break</button>
      </div>

      <div className="timerring">
        <svg width="100%" height="100%" viewBox="0 0 270 270">
          <circle cx="135" cy="135" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
          <circle cx="135" cy="135" r={R} fill="none" stroke={ringColor} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
            transform="rotate(-90 135 135)" style={{ transition: "stroke-dashoffset .3s linear" }} />
        </svg>
        <div className="timertext">
          <div className="timerdigits">{mm}:{ss}</div>
          <div className="timerlabel">{mode === "work" ? (task ? "on task" : "focus") : "break"}</div>
        </div>
      </div>

      <div className="timerctl">
        <button className={`bigbtn ${running ? "" : "go"}`} onClick={() => setRunning(!running)}>{running ? "Pause" : "Start"}</button>
        <button className="bigbtn" onClick={() => { setRunning(false); setLeft(durFor(mode)); }}>Reset</button>
      </div>

      <div className="focustask">
        <div className="sub" style={{ marginBottom: 6 }}>Working on (finished pomodoros fill this task's dots):</div>
        <select className="field" style={{ width: "100%" }} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
          <option value="">— free focus, no task —</option>
          {openTasks.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.done}/{t.est} 🍅)</option>)}
        </select>
        {task && (
          <div className="pomodots" style={{ marginTop: 10, marginLeft: 0 }}>
            {Array.from({ length: Math.min(task.est, 12) }, (_, i) => <span key={i} className={`pdot ${i < task.done ? "f" : ""}`} />)}
            <span className="pcount">{task.done}/{task.est}</span>
          </div>
        )}
      </div>

      <div className="sessrow">
        <span>today 🍅 ×{data.pomoLog[dateKey(new Date())] || 0}</span>
        <span>set {cycle % 4}/4 until long break</span>
      </div>

      <div className="durs">
        <label>focus <input type="number" className="field" value={s.work} onChange={(e) => setDur("work", e.target.value)} /> min</label>
        <label>short <input type="number" className="field" value={s.short} onChange={(e) => setDur("short", e.target.value)} /> min</label>
        <label>long <input type="number" className="field" value={s.long} onChange={(e) => setDur("long", e.target.value)} /> min</label>
      </div>
    </div>
  );
}
