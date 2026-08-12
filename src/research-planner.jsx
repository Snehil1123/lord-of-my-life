import { useState, useEffect, useRef, useMemo } from "react";
import {
  supabase, signUp, signIn, signOut, getSession, onAuthChange,
  fetchCloudData, pushCloudData, subscribeToCloudData,
} from "./sync.js";

/* ============================================================
   LORD OF MY LIFE — one planner for the whole research pipeline
   Gantt Chart (big-picture timeline) · Work (Research / Fellowships /
   Classwork / TA) · Session (pomodoro focus) · Personal (everything else)
   ============================================================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Cinzel:wght@400;600;700;800&family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Space+Mono:wght@400;700&display=swap');

:root{
  --paper:#171C18; --card:#1E2420; --ink:#E8ECE6; --muted:#8DA091;
  --line:#333F36; --line-soft:#262E28;
  --pine:#57B08A; --pine-soft:#1E3329;
  --tomato:#FF6E4A; --tomato-soft:#3B2018;
  --amber:#E0AC5C; --slate:#7C93BE; --plum:#B084A8;
  --font-display:'Bricolage Grotesque',sans-serif;
  --font-body:'Inter',system-ui,sans-serif;
  --font-mono:'IBM Plex Mono',monospace;
  --radius:10px;
  color-scheme: dark;
}

/* ---------- fantasy theme ---------- */
.fw[data-theme="fantasy"]{
  --paper:#1C140B; --card:#2A2013; --ink:#EDE0C0; --muted:#A6906B;
  --line:#5A4426; --line-soft:#3E301B;
  --pine:#7C9A5C; --pine-soft:#2A331C;
  --tomato:#B33A2A; --tomato-soft:#3D1B14;
  --amber:#D8A62A; --slate:#5E7A93; --plum:#8C5A96;
  --font-display:'Cinzel',serif;
  --font-body:'EB Garamond',Georgia,serif;
  --font-mono:'Space Mono',monospace;
  --radius:3px;
  font-size:16.5px;
  background:
    radial-gradient(ellipse 900px 500px at 10% -10%, rgba(216,166,42,.07), transparent 60%),
    radial-gradient(ellipse 700px 500px at 105% 15%, rgba(124,154,92,.07), transparent 55%),
    var(--paper);
}
.fw[data-theme="fantasy"] .card{
  background:
    radial-gradient(circle at 6% 12%, rgba(0,0,0,.10), transparent 24%),
    radial-gradient(circle at 94% 88%, rgba(0,0,0,.08), transparent 26%),
    var(--card);
  box-shadow:0 4px 14px rgba(0,0,0,.35);
}
.fw[data-theme="fantasy"] .brand{
  letter-spacing:.05em; text-transform:uppercase; font-size:17.5px;
  animation:emberglow 4s ease-in-out infinite;
}
.fw[data-theme="fantasy"] .brand em{color:var(--amber); font-style:normal;}
@keyframes emberglow{
  0%,100%{text-shadow:0 0 6px rgba(216,166,42,.25);}
  50%{text-shadow:0 0 15px rgba(216,166,42,.6);}
}
.fw[data-theme="fantasy"] .h2, .fw[data-theme="fantasy"] .projname{letter-spacing:.03em;}
.fw[data-theme="fantasy"] .h2::before{content:"✦ "; color:var(--amber);}
.fw[data-theme="fantasy"] .tab.on{box-shadow:0 0 10px rgba(216,166,42,.4);}
.fw[data-theme="fantasy"] .btn{
  border-radius:4px; position:relative; overflow:hidden;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 5px rgba(0,0,0,.35);
}
.fw[data-theme="fantasy"] .btn::after{
  content:""; position:absolute; top:0; left:-60%; width:40%; height:100%;
  background:linear-gradient(120deg, transparent, rgba(255,255,255,.16), transparent);
  transform:skewX(-20deg); transition:left .55s ease;
}
.fw[data-theme="fantasy"] .btn:hover::after{left:130%;}
.fw[data-theme="fantasy"] .btn.primary{
  background:linear-gradient(180deg,#8a6a1f,#6b4f16); border-color:#4a3610; color:#F5E9C8;
}
.fw[data-theme="fantasy"] .btn.primary:hover{background:linear-gradient(180deg,#9c7a28,#7c5c1c);}
.fw[data-theme="fantasy"] .field{border-radius:4px;}
.fw[data-theme="fantasy"] .check.on{box-shadow:0 0 0 3px rgba(216,166,42,.22), 0 0 12px rgba(216,166,42,.45);}
.fw[data-theme="fantasy"] .todayline{
  background:var(--amber); box-shadow:0 0 8px 1px var(--amber);
  animation:wardpulse 2.4s ease-in-out infinite;
}
.fw[data-theme="fantasy"] .todayflag{background:var(--amber); color:#241a10;}
@keyframes wardpulse{
  0%,100%{opacity:.7; box-shadow:0 0 6px 1px var(--amber);}
  50%{opacity:1; box-shadow:0 0 15px 3px var(--amber);}
}
.fw[data-theme="fantasy"] .timerring.running{animation:runeglow 2.6s ease-in-out infinite;}
@keyframes runeglow{
  0%,100%{filter:drop-shadow(0 0 6px rgba(216,166,42,.3));}
  50%{filter:drop-shadow(0 0 16px rgba(216,166,42,.65));}
}

*{box-sizing:border-box; margin:0;}
.fw{
  font-family:var(--font-body); color:var(--ink);
  background:var(--paper); min-height:100vh; font-size:15px; line-height:1.45;
}
.fw ::selection{background:var(--pine-soft);}
.fw button{font-family:inherit; cursor:pointer;}
.fw input, .fw select{font-family:inherit; font-size:14px; color:var(--ink);}

/* ---------- header ---------- */
.hd{
  display:flex; align-items:center; gap:20px; flex-wrap:wrap;
  padding:14px 22px; border-bottom:1px solid var(--line); background:var(--card);
  position:sticky; top:0; z-index:20;
}
.brand{font-family:var(--font-display); font-weight:800; font-size:20px; letter-spacing:-0.02em;}
.brand em{font-style:normal; color:var(--pine);}
.wkchip{
  font-family:var(--font-mono); font-size:13px; color:var(--muted);
  border:1px solid var(--line); border-radius:999px; padding:3px 10px; background:var(--paper);
}
.tabs{display:flex; gap:4px; margin-left:auto;}
.tab{
  border:1px solid transparent; background:none; border-radius:999px;
  padding:6px 16px; font-size:14.5px; font-weight:600; color:var(--muted);
}
.tab:hover{color:var(--ink);}
.tab.on{background:var(--ink); color:var(--card);}
.todaypomos{font-family:var(--font-mono); font-size:13px; color:var(--tomato); font-weight:600;}

/* ---------- shared ---------- */
.wrap{max-width:1060px; margin:0 auto; padding:26px 22px 80px;}
.h2{font-family:var(--font-display); font-weight:700; font-size:24px; letter-spacing:-0.02em;}
.sub{color:var(--muted); font-size:14px; margin-top:2px;}
.card{background:var(--card); border:1px solid var(--line); border-radius:var(--radius);}
.btn{
  border:1px solid var(--line); background:var(--card); border-radius:8px;
  padding:6px 12px; font-size:14px; font-weight:600; color:var(--ink);
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
.mono{font-family:var(--font-mono);}
.xbtn{border:none; background:none; color:var(--muted); font-size:15px; padding:2px 6px; border-radius:6px; opacity:0; transition:opacity .12s;}
.xbtn:hover{color:var(--tomato); background:var(--tomato-soft);}
tr:hover .xbtn, .taskrow:hover .xbtn, .phaserow:hover .xbtn{opacity:1;}

/* ---------- plan / gantt ---------- */
.proj{margin-top:18px; overflow:hidden;}
.projhead{display:flex; align-items:center; gap:10px; padding:14px 16px; border-bottom:1px solid var(--line-soft);}
.projdot{width:10px; height:10px; border-radius:3px; flex:none;}
.projname{font-family:var(--font-display); font-weight:700; font-size:17px;}
.projmeta{font-family:var(--font-mono); font-size:12.5px; color:var(--muted);}
.gantt{position:relative; padding:10px 16px 16px; overflow-x:auto;}
.ggrid{display:grid; gap:0; position:relative; min-width:520px; grid-auto-rows:34px;}
.gwk{
  font-family:var(--font-mono); font-size:11.5px; color:var(--muted);
  grid-row:1; padding:2px 0 6px 4px; white-space:nowrap; overflow:hidden;
}
.gbar{
  position:relative; z-index:2; height:26px; margin:4px 3px; border-radius:6px;
  display:flex; align-items:center; padding:0 8px; gap:6px;
  font-size:13px; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden;
  cursor:pointer; transition:filter .12s;
}
.gbar:hover{filter:brightness(1.08);}
.gbar.done{opacity:.45; text-decoration:line-through;}
.gbar.due-today{box-shadow:0 0 0 2px var(--amber), 0 0 12px 1px var(--amber);}
.gbar.overdue{animation:overdueglow 1.3s ease-in-out infinite;}
.todayline{position:absolute; top:0; bottom:0; width:2px; background:var(--tomato); z-index:3;}
.todayflag{
  position:absolute; top:-2px; transform:translateX(-50%); background:var(--tomato); color:#fff;
  font-family:var(--font-mono); font-size:10.5px; padding:1px 5px; border-radius:4px; z-index:4;
}
.addrow{display:flex; gap:8px; flex-wrap:wrap; align-items:center; padding:12px 16px; border-top:1px solid var(--line-soft); background:var(--paper);}

/* ---------- work / personal (shared task list) ---------- */
.catblock{margin-top:18px;}
.cathead{display:flex; align-items:center; gap:8px; margin-bottom:8px;}
.catdot{width:9px; height:9px; border-radius:50%;}
.catname{font-weight:700; font-size:14px; text-transform:uppercase; letter-spacing:.06em;}
.catcount{font-family:var(--font-mono); font-size:12.5px; color:var(--muted);}
.taskrow{
  display:flex; align-items:center; gap:10px; padding:9px 12px;
  border-bottom:1px solid var(--line-soft); position:relative; background:var(--card);
}
.taskrow:last-child{border-bottom:none;}
.taskrow.done .tasktitle{color:var(--muted); text-decoration:line-through; text-decoration-color:var(--pine);}
.taskrow.due-today{border-radius:6px; box-shadow:inset 0 0 0 1px var(--amber), 0 0 10px -2px var(--amber);}
.taskrow.overdue{border-radius:6px; animation:overdueglow 1.3s ease-in-out infinite;}
@keyframes overdueglow{
  0%,100%{box-shadow:inset 0 0 0 1px var(--tomato), 0 0 6px -2px var(--tomato);}
  50%{box-shadow:inset 0 0 0 1px var(--tomato), 0 0 16px 2px var(--tomato);}
}
.checkwrap{position:relative; flex:none; width:22px; height:22px;}
.check{
  width:22px; height:22px; border-radius:50%; border:2px solid var(--line);
  background:var(--card); display:flex; align-items:center; justify-content:center;
  color:transparent; font-size:13px; transition:all .15s; padding:0;
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
.tasktitle{font-size:15px; font-weight:500;}
.tag11{
  font-family:var(--font-mono); font-size:11px; font-weight:600;
  background:var(--pine-soft); color:var(--pine); padding:1px 6px; border-radius:4px; flex:none;
}
.tagdue{font-family:var(--font-mono); font-size:11px; font-weight:600; flex:none;}
.tagproj{font-size:12px; color:var(--muted); flex:none;}
.pomodots{display:flex; gap:3px; margin-left:auto; flex:none; align-items:center;}
.pdot{width:8px; height:8px; border-radius:50%; border:1.5px solid var(--tomato); background:transparent;}
.pdot.f{background:var(--tomato);}
.pcount{font-family:var(--font-mono); font-size:12px; color:var(--muted); margin-left:2px;}
.emptystate{color:var(--muted); font-size:14px; padding:18px 4px;}

/* ---------- focus / session ---------- */
.focuswrap{display:flex; flex-direction:column; align-items:center; padding-top:16px;}
.modebtns{display:flex; gap:6px; margin-bottom:22px;}
.modebtn{border:1px solid var(--line); background:var(--card); border-radius:999px; padding:6px 16px; font-size:13.5px; font-weight:600; color:var(--muted);}
.modebtn.on{background:var(--tomato); border-color:var(--tomato); color:#fff;}
.timerring{position:relative; width:270px; height:270px;}
.timertext{
  position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
}
.timerdigits{font-family:var(--font-mono); font-size:62px; font-weight:600; letter-spacing:-0.02em; font-variant-numeric:tabular-nums;}
.timerlabel{font-size:13px; text-transform:uppercase; letter-spacing:.12em; color:var(--muted); margin-top:2px;}
.timerctl{display:flex; gap:10px; margin-top:24px;}
.bigbtn{border-radius:999px; padding:11px 34px; font-size:16px; font-weight:700; border:1px solid var(--line); background:var(--card);}
.bigbtn.go{background:var(--tomato); border-color:var(--tomato); color:#fff;}
.bigbtn.go:hover{background:#e0552f;}
.focustask{margin-top:26px; width:100%; max-width:460px;}
.sessrow{display:flex; gap:14px; justify-content:center; margin-top:18px; font-family:var(--font-mono); font-size:13px; color:var(--muted);}
.durs{display:flex; gap:14px; margin-top:22px; align-items:center; color:var(--muted); font-size:13px;}
.durs input{width:52px; text-align:center;}

@media (max-width:640px){
  .wrap{padding:18px 12px 70px;}
  .tabs{margin-left:0; width:100%; justify-content:space-between;}
  .timerring{width:220px; height:220px;}
  .timerdigits{font-size:48px;}
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
const wkLabel = (d) => `W${String(isoWeek(d).week).padStart(2, "0")}`;
// local calendar day, not UTC — toISOString() would roll over a day early for
// negative UTC offsets in the evening (e.g. 7pm CDT is already after midnight UTC)
const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const fmtDue = (iso) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

// null | "due-today" (gold) | "overdue" (pulsing red) — never fires for checked or date-less tasks.
// "overdue" covers both a due date already in the past, and a due date of today once it's past 11pm.
function taskUrgency(t, now) {
  if (!t.dueDate || t.checked) return null;
  const todayKey = dateKey(now);
  if (t.dueDate < todayKey) return "overdue";
  if (t.dueDate === todayKey) return now.getHours() >= 23 ? "overdue" : "due-today";
  return null;
}

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
const WORK_CATS = [
  { id: "research", name: "Research", color: "var(--pine)" },
  { id: "fellowships", name: "Fellowships", color: "var(--amber)" },
  { id: "classwork", name: "Classwork", color: "var(--slate)" },
  { id: "ta", name: "TA", color: "var(--plum)" },
];
const PERSONAL_CATS = [
  { id: "exercise", name: "Exercise", color: "var(--pine)" },
  { id: "music", name: "Music", color: "var(--plum)" },
  { id: "other", name: "Other", color: "var(--slate)" },
];
const ALL_CATS = [...WORK_CATS, ...PERSONAL_CATS];
const catColorFor = (catId) => ALL_CATS.find((c) => c.id === catId)?.color || "var(--slate)";
const PROJ_COLORS = ["#2F5D4A", "#56688A", "#7A5474", "#B8862B", "#3E7C8A", "#8A5A3E"];

// Built-in Exercise habits that reopen every day — seeded once (see ensureRecurringSeeds),
// never re-added if the user deletes one on purpose.
const RECURRING_SEEDS = [
  { key: "ex-stretch", title: "Stretching (15 minutes)", minutes: 15 },
  { key: "ex-pushups", title: "20 push-ups", minutes: 5 },
  { key: "ex-situps", title: "20 sit-ups", minutes: 5 },
  { key: "ex-pullups", title: "20 pull-ups", minutes: 5 },
  { key: "ex-handstand", title: "Hand Stand (1 minute air time)", minutes: 5 },
];
const recurringSeedTasks = () => RECURRING_SEEDS.map((s) => ({
  id: uid(), title: s.title, cat: "exercise", minutes: s.minutes,
  est: Math.max(1, Math.ceil(s.minutes / 25)), done: 0, checked: false,
  oneOnOne: false, recurring: true, seedKey: s.key, completedDate: null,
}));

function sampleData() {
  const m0 = monday(new Date());
  const iso = (d) => d.toISOString().slice(0, 10);
  return {
    settings: { work: 25, short: 5, long: 15 },
    pomoLog: {},
    seededRecurring: true,
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
      { id: uid(), title: "Rerun pilot with corrected buffer concentration", cat: "research", minutes: 75, est: 3, done: 0, checked: false, oneOnOne: true },
      { id: uid(), title: "Send PI the updated figure 2 draft", cat: "research", minutes: 50, est: 2, done: 1, checked: false, oneOnOne: true },
      { id: uid(), title: "Draft NSF fellowship personal statement", cat: "fellowships", minutes: 50, est: 2, done: 0, checked: false, oneOnOne: false },
      { id: uid(), title: "Problem set 4", cat: "classwork", minutes: 75, est: 3, done: 0, checked: false, oneOnOne: false },
      { id: uid(), title: "Grade lab reports", cat: "ta", minutes: 50, est: 2, done: 0, checked: false, oneOnOne: false },
      { id: uid(), title: "Book flights for October conference", cat: "other", minutes: 25, est: 1, done: 0, checked: false, oneOnOne: false },
      ...recurringSeedTasks(),
    ],
  };
}

// One-time backfill for existing users so the built-in Exercise habits show up
// without wiping anything they've already added. Never re-adds a seed the user deleted.
function ensureRecurringSeeds(data) {
  if (data.seededRecurring) return data;
  return { ...data, seededRecurring: true, tasks: [...data.tasks, ...recurringSeedTasks()] };
}

// Recurring tasks reopen the day after they were completed.
function resetRecurringTasks(data) {
  const today = dateKey(new Date());
  let changed = false;
  const tasks = data.tasks.map((t) => {
    if (t.recurring && t.checked && t.completedDate !== today) {
      changed = true;
      return { ...t, checked: false, done: 0, completedDate: null };
    }
    return t;
  });
  return changed ? { ...data, tasks } : data;
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

const THEME_KEY = "lordofmylife:theme";
const THEMES = { dark: "fantasy", fantasy: "dark" }; // maps a theme to "what toggling gives you"
const THEME_LABEL = { dark: "📜 Fantasy", fantasy: "🌲 Modern" }; // label shows the theme you'd switch TO

/* ================================================================ */
export default function LordOfMyLife() {
  const [data, setData] = useState(() => resetRecurringTasks(ensureRecurringSeeds(loadData() || sampleData())));
  const [view, setView] = useState("work");
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || "dark"; } catch (e) { return "dark"; }
  });
  const [now, setNow] = useState(() => new Date()); // ticks so due-date glows (esp. the 11pm overdue cutoff) update live
  const saveTimer = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* storage full or unavailable */ }
  }, [theme]);

  // debounced save
  useEffect(() => {
    if (!data) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveData(data), 500);
    return () => clearTimeout(saveTimer.current);
  }, [data]);

  // catch day rollover while the app stays open: on refocus and every few minutes
  useEffect(() => {
    const check = () => setData((d) => resetRecurringTasks(d));
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      clearInterval(interval);
    };
  }, []);

  const sessionEmoji = theme === "fantasy" ? "🕯️" : "🍅";
  const todayPomos = data.pomoLog[dateKey(new Date())] || 0;

  return (
    <div className="fw" data-theme={theme}>
      <style>{CSS}</style>
      <header className="hd">
        <div className="brand">Lord of <em>my Life</em></div>
        <span className="wkchip">{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
        {todayPomos > 0 && <span className="todaypomos">{sessionEmoji} ×{todayPomos} today</span>}
        <nav className="tabs">
          {[["gantt", "Gantt Chart"], ["work", "Work"], ["session", "Session"], ["personal", "Personal"]].map(([k, label]) => (
            <button key={k} className={`tab ${view === k ? "on" : ""}`} onClick={() => setView(k)}>{label}</button>
          ))}
        </nav>
        <button className="btn ghost" title="Switch theme" onClick={() => setTheme(THEMES[theme])}>{THEME_LABEL[theme]}</button>
        <SyncBar data={data} setData={setData} />
      </header>
      <main className="wrap">
        {view === "gantt" && <GanttView data={data} setData={setData} now={now} />}
        {view === "work" && <WorkView data={data} setData={setData} now={now} />}
        {view === "session" && <SessionView data={data} setData={setData} sessionEmoji={sessionEmoji} />}
        {view === "personal" && <PersonalView data={data} setData={setData} now={now} />}
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
        {authError && <span style={{ color: "var(--tomato)", fontSize: 13 }}>{authError}</span>}
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

/* ================= GANTT CHART ================= */
function GanttView({ data, setData, now }) {
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
          <div className="sub">Each project is a timeline of phases. Click a bar to mark a phase complete.</div>
        </div>
        <input className="field" placeholder="New project name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addProject()} />
        <button className="btn primary" onClick={addProject}>Add project</button>
      </div>

      <DeadlinesGantt tasks={data.tasks} now={now} />

      {data.projects.length === 0 && <div className="emptystate">No projects yet — add one above to start your plan.</div>}
      {data.projects.map((p) => <ProjectGantt key={p.id} project={p} data={data} setData={setData} onDelete={() => delProject(p.id)} />)}
    </div>
  );
}

// Any task (Work or Personal) with a due date shows up here as a single-week marker,
// snapped to its due week the same way ProjectGantt snaps phases.
function DeadlinesGantt({ tasks, now }) {
  const due = tasks.filter((t) => t.dueDate);
  if (!due.length) return null;

  const weekStarts = due.map((t) => monday(new Date(t.dueDate + "T00:00:00")));
  const min = new Date(Math.min(...weekStarts));
  const max = new Date(Math.max(...weekStarts));
  const nWeeks = Math.round((max - min) / (7 * DAY)) + 1;
  const weeks = Array.from({ length: nWeeks }, (_, i) => addDays(min, i * 7));
  const today = new Date();
  const todayPct = today >= min && today < addDays(min, nWeeks * 7)
    ? ((today - min) / (nWeeks * 7 * DAY)) * 100 : null;
  const doneCt = due.filter((t) => t.checked).length;

  return (
    <section className="card proj" style={{ marginTop: 18 }}>
      <div className="projhead">
        <span className="projdot" style={{ background: "var(--amber)" }} />
        <span className="projname">Deadlines</span>
        <span className="projmeta">{doneCt}/{due.length} done</span>
      </div>
      <div className="gantt">
        <div
          className="ggrid"
          style={{
            gridTemplateColumns: `repeat(${nWeeks}, minmax(46px,1fr))`,
            backgroundImage: "linear-gradient(to right, var(--line-soft) 1px, transparent 1px)",
            backgroundSize: `${100 / nWeeks}% 100%`,
          }}
        >
          {weeks.map((w, i) => <div key={i} className="gwk">{wkLabel(w)}</div>)}
          {due.map((t, idx) => {
            const col = Math.round((monday(new Date(t.dueDate + "T00:00:00")) - min) / (7 * DAY)) + 1;
            const urgency = taskUrgency(t, now);
            return (
              <div
                key={t.id}
                className={`gbar ${t.checked ? "done" : ""} ${urgency === "due-today" ? "due-today" : ""} ${urgency === "overdue" ? "overdue" : ""}`}
                style={{ gridColumn: `${col} / span 1`, gridRow: idx + 2, background: catColorFor(t.cat) }}
                title={`due ${t.dueDate}`}
              >
                {t.checked ? "✓ " : ""}{t.title}
              </div>
            );
          })}
          {todayPct !== null && (
            <>
              <div className="todayline" style={{ left: `${todayPct}%` }} />
              <div className="todayflag" style={{ left: `${todayPct}%` }}>today</div>
            </>
          )}
        </div>
      </div>
    </section>
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
        <div className="emptystate" style={{ padding: "14px 16px" }}>No phases yet — add the first one below.</div>
      )}

      <div className="addrow">
        <input className="field" style={{ flex: 1, minWidth: 160 }} placeholder="Phase name (e.g. Data collection)"
          value={ph.name} onChange={(e) => setPh({ ...ph, name: e.target.value })} />
        <label style={{ fontSize: 13, color: "var(--muted)" }}>from <input type="date" className="field" value={ph.start} onChange={(e) => setPh({ ...ph, start: e.target.value })} /></label>
        <label style={{ fontSize: 13, color: "var(--muted)" }}>to <input type="date" className="field" value={ph.end} onChange={(e) => setPh({ ...ph, end: e.target.value })} /></label>
        <button className="btn" onClick={addPhase}>Add phase</button>
      </div>
    </section>
  );
}

/* ================= SHARED TASK LIST PIECES ================= */
function TaskRow({ t, burstId, onToggle, onDelete, now }) {
  const urgency = taskUrgency(t, now);
  return (
    <div className={`taskrow ${t.checked ? "done" : ""} ${urgency === "due-today" ? "due-today" : ""} ${urgency === "overdue" ? "overdue" : ""}`}>
      <span className="checkwrap">
        <button className={`check ${t.checked ? "on" : ""}`} aria-label={t.checked ? "Mark not done" : "Mark done"} onClick={() => onToggle(t)}>✓</button>
        {burstId === t.id && Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2;
          const r = 22 + (i % 3) * 8;
          const colors = ["var(--tomato)", "var(--pine)", "var(--amber)"];
          return <span key={i} className="particle" style={{ background: colors[i % 3], "--dx": `${Math.cos(a) * r}px`, "--dy": `${Math.sin(a) * r}px` }} />;
        })}
      </span>
      <span className="tasktitle">{t.title}</span>
      {t.oneOnOne && <span className="tag11">1:1</span>}
      {t.recurring && <span className="tag11" title="Reopens tomorrow">↻ daily</span>}
      {t.dueDate && (
        <span className="tagdue" style={{ color: urgency === "overdue" ? "var(--tomato)" : urgency === "due-today" ? "var(--amber)" : "var(--muted)" }}>
          due {fmtDue(t.dueDate)}
        </span>
      )}
      <span className="pomodots" title={`${t.done}/${t.est} sessions · ${t.minutes || t.est * 25} min`}>
        {Array.from({ length: Math.min(t.est, 8) }, (_, i) => <span key={i} className={`pdot ${i < t.done ? "f" : ""}`} />)}
        {t.est > 8 && <span className="pcount">{t.done}/{t.est}</span>}
      </span>
      <button className="xbtn" onClick={() => onDelete(t.id)} title="Delete task">✕</button>
    </div>
  );
}

// shared by WorkView/PersonalView — stamps completedDate so recurring tasks know when they were last finished
function toggleTask(data, setData, t, setBurst) {
  const nowChecked = !t.checked;
  setData({
    ...data,
    tasks: data.tasks.map((x) => (x.id === t.id
      ? { ...x, checked: nowChecked, completedDate: nowChecked ? dateKey(new Date()) : x.completedDate }
      : x)),
  });
  if (nowChecked) { setBurst(t.id); popSound(); setTimeout(() => setBurst(null), 700); }
}

function AddTaskRow({ onAdd }) {
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(25);
  const [oneOnOne, setOneOnOne] = useState(false);
  const [dueDate, setDueDate] = useState("");

  const submit = () => {
    if (!title.trim()) return;
    onAdd(title.trim(), Math.max(5, +minutes || 25), oneOnOne, dueDate || null);
    setTitle(""); setMinutes(25); setOneOnOne(false); setDueDate("");
  };

  return (
    <div className="addrow">
      <input className="field" style={{ flex: 1, minWidth: 160 }} placeholder="Add a task…"
        value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      <label style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
        <input type="number" min="5" step="5" className="field" style={{ width: 64 }} value={minutes} onChange={(e) => setMinutes(e.target.value)} /> min
      </label>
      <label style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
        due <input type="date" className="field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </label>
      <label style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
        <input type="checkbox" checked={oneOnOne} onChange={(e) => setOneOnOne(e.target.checked)} /> 1:1 action item
      </label>
      <button className="btn" onClick={submit}>Add</button>
    </div>
  );
}

/* ================= WORK ================= */
function WorkView({ data, setData, now }) {
  const [burst, setBurst] = useState(null); // task id currently bursting

  const tasks = data.tasks.filter((t) => WORK_CATS.some((c) => c.id === t.cat));

  const addTask = (catId, title, minutes, oneOnOne, dueDate) => {
    const est = Math.max(1, Math.ceil(minutes / 25));
    setData({ ...data, tasks: [...data.tasks, { id: uid(), title, cat: catId, minutes, est, done: 0, checked: false, oneOnOne, dueDate }] });
  };
  const toggle = (t) => toggleTask(data, setData, t, setBurst);
  const delTask = (id) => setData({ ...data, tasks: data.tasks.filter((x) => x.id !== id) });

  const doneCt = tasks.filter((t) => t.checked).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="h2">Work</div>
          <div className="sub">Research, fellowships, classwork, and TA duties. Add a task under any section, give it a length in minutes, and an optional due date — sessions fill in automatically.</div>
        </div>
        <span className="catcount">{doneCt}/{tasks.length} done</span>
      </div>

      {WORK_CATS.map((c) => {
        const list = tasks.filter((t) => t.cat === c.id);
        return (
          <div className="catblock" key={c.id}>
            <div className="cathead">
              <span className="catdot" style={{ background: c.color }} />
              <span className="catname" style={{ color: c.color }}>{c.name}</span>
              <span className="catcount">{list.filter((t) => t.checked).length}/{list.length}</span>
            </div>
            <div className="card">
              {list.map((t) => <TaskRow key={t.id} t={t} burstId={burst} onToggle={toggle} onDelete={delTask} now={now} />)}
              {list.length === 0 && <div className="emptystate" style={{ padding: "14px 16px" }}>No tasks yet.</div>}
              <AddTaskRow onAdd={(title, minutes, oneOnOne, dueDate) => addTask(c.id, title, minutes, oneOnOne, dueDate)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================= PERSONAL ================= */
function PersonalView({ data, setData, now }) {
  const [burst, setBurst] = useState(null);

  const tasks = data.tasks.filter((t) => PERSONAL_CATS.some((c) => c.id === t.cat));

  const addTask = (catId, title, minutes, oneOnOne, dueDate) => {
    const est = Math.max(1, Math.ceil(minutes / 25));
    setData({ ...data, tasks: [...data.tasks, { id: uid(), title, cat: catId, minutes, est, done: 0, checked: false, oneOnOne, dueDate }] });
  };
  const toggle = (t) => toggleTask(data, setData, t, setBurst);
  const delTask = (id) => setData({ ...data, tasks: data.tasks.filter((x) => x.id !== id) });

  const doneCt = tasks.filter((t) => t.checked).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="h2">Personal</div>
          <div className="sub">Exercise, music, and everything else. The Exercise habits marked "↻ daily" reopen automatically each day.</div>
        </div>
        <span className="catcount">{doneCt}/{tasks.length} done</span>
      </div>

      {PERSONAL_CATS.map((c) => {
        const list = tasks.filter((t) => t.cat === c.id);
        return (
          <div className="catblock" key={c.id}>
            <div className="cathead">
              <span className="catdot" style={{ background: c.color }} />
              <span className="catname" style={{ color: c.color }}>{c.name}</span>
              <span className="catcount">{list.filter((t) => t.checked).length}/{list.length}</span>
            </div>
            <div className="card">
              {list.map((t) => <TaskRow key={t.id} t={t} burstId={burst} onToggle={toggle} onDelete={delTask} now={now} />)}
              {list.length === 0 && <div className="emptystate" style={{ padding: "14px 16px" }}>No tasks yet.</div>}
              <AddTaskRow onAdd={(title, minutes, oneOnOne, dueDate) => addTask(c.id, title, minutes, oneOnOne, dueDate)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================= SESSION ================= */
function SessionView({ data, setData, sessionEmoji }) {
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

  const openTasks = data.tasks.filter((t) => !t.checked);

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

      <div className={`timerring ${running ? "running" : ""}`}>
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
        <div className="sub" style={{ marginBottom: 6 }}>Working on (finished sessions fill this task's dots):</div>
        <select className="field" style={{ width: "100%" }} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
          <option value="">— free focus, no task —</option>
          {openTasks.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.done}/{t.est} {sessionEmoji})</option>)}
        </select>
        {task && (
          <div className="pomodots" style={{ marginTop: 10, marginLeft: 0 }}>
            {Array.from({ length: Math.min(task.est, 12) }, (_, i) => <span key={i} className={`pdot ${i < task.done ? "f" : ""}`} />)}
            <span className="pcount">{task.done}/{task.est}</span>
          </div>
        )}
      </div>

      <div className="sessrow">
        <span>today {sessionEmoji} ×{data.pomoLog[dateKey(new Date())] || 0}</span>
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
