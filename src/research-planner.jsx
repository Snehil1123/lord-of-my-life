import { useState, useEffect, useRef, useMemo } from "react";
import {
  supabase, signUp, signIn, signOut, getSession, onAuthChange,
  fetchCloudData, pushCloudData, subscribeToCloudData,
} from "./sync.js";
import { agentAvailable, onToolCall, onEvent, runQuery, cancelQuery } from "./ai.js";

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
  --amber:#E0AC5C; --slate:#7C93BE; --plum:#B084A8; --teal:#4FB0A6;
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
  --amber:#D8A62A; --slate:#5E7A93; --plum:#8C5A96; --teal:#5E8C82;
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
tr:hover .xbtn, .taskrow:hover .xbtn, .phaserow:hover .xbtn, .budgetrow:hover .xbtn, .subtaskrow:hover .xbtn{opacity:1;}

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
/* section band sits behind the bars (which are z-index 2) but above the grid lines */
.gband{position:relative; z-index:1; border-radius:8px; margin:1px 0;}
.gseclabel{
  position:relative; z-index:2; display:flex; align-items:center; gap:8px;
  padding:0 10px; font-family:var(--font-display); font-weight:700; font-size:13.5px;
  white-space:nowrap; overflow:hidden;
}
.secform{margin:0 16px 12px; border-radius:var(--radius); background:var(--paper); overflow:hidden;}
.secform .addrow{border-top:none; padding:8px 12px; background:none;}
.secform .addrow + .addrow{padding-top:0;}
.secformname{font-family:var(--font-display); font-weight:700; font-size:13px; padding:9px 12px 2px; letter-spacing:.02em;}

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
.taskmin{font-family:var(--font-mono); font-size:12px; color:var(--muted); flex:none; margin-left:auto;}
.pomodots{display:flex; gap:3px; flex:none; align-items:center;}
.taskrow-editing{gap:8px; flex-wrap:wrap;}
.pdot{width:8px; height:8px; border-radius:50%; border:1.5px solid var(--tomato); background:transparent;}
.pdot.f{background:var(--tomato);}
.pcount{font-family:var(--font-mono); font-size:12px; color:var(--muted); margin-left:2px;}
.emptystate{color:var(--muted); font-size:14px; padding:18px 4px;}
.subprogress{font-family:var(--font-mono); font-size:11.5px; color:var(--muted); flex:none;}
.subtoggle{border:none; background:none; color:var(--muted); font-size:11px; padding:2px 4px; flex:none;}
.subtoggle:hover{color:var(--ink);}
.subtasks{background:var(--paper); border-bottom:1px solid var(--line-soft); padding:2px 12px 6px 44px;}
.subtaskrow{display:flex; align-items:center; gap:8px; padding:5px 0;}
.subtaskrow.done .subtasktitle{color:var(--muted); text-decoration:line-through; text-decoration-color:var(--pine);}
.subtaskrow.due-today{border-radius:6px; box-shadow:inset 0 0 0 1px var(--amber), 0 0 8px -3px var(--amber);}
.subtaskrow.overdue{border-radius:6px; animation:overdueglow 1.3s ease-in-out infinite;}
.subtasktitle{font-size:13px; flex:1; min-width:0;}
.check.small{width:17px; height:17px; font-size:10px; flex:none;}
.subaddrow{padding:6px 0 2px; border-top:none; background:none;}

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

/* ---------- budget ---------- */
.budgetrow{
  display:flex; align-items:center; gap:10px; padding:9px 12px;
  border-bottom:1px solid var(--line-soft); background:var(--card);
}
.budgetrow:last-child{border-bottom:none;}
.budgetname-input, .budgetamt-input{
  border:1px solid transparent; background:none; color:var(--ink); border-radius:6px; padding:4px 6px;
}
.budgetname-input:hover, .budgetamt-input:hover{border-color:var(--line-soft);}
.budgetname-input:focus, .budgetamt-input:focus{border-color:var(--pine); outline:none; background:var(--paper);}
.budgetname-input{font-size:15px; font-weight:500; flex:1; min-width:0;}
.budgetamt-wrap{display:flex; align-items:center; gap:0; flex:none;}
.budgetdollar{font-family:var(--font-mono); font-size:14px; color:var(--muted);}
.budgetamt-input{font-family:var(--font-mono); font-size:14px; font-weight:600; width:74px; text-align:right; padding-left:1px;}
.budgetoverview{display:flex; gap:28px; align-items:center; flex-wrap:wrap; padding:22px;}
.budgetlegend{flex:1; min-width:220px; display:flex; flex-direction:column; gap:9px;}
.legendrow{display:flex; align-items:center; gap:9px;}
.legendname{flex:1; font-size:14px; font-weight:500;}
.legendamt{font-family:var(--font-mono); font-size:13px; color:var(--muted);}
.legendpct{font-family:var(--font-mono); font-size:12px; color:var(--muted); width:36px; text-align:right;}
.segbar{display:flex; height:9px; border-radius:999px; overflow:hidden; background:var(--line-soft); margin:2px 0 12px;}
.segbar > div{height:100%;}
.gaugerow{display:flex; gap:20px; flex-wrap:wrap; align-items:center; padding:16px 16px 6px;}
.gaugewrap{position:relative; width:140px; height:140px; flex:none;}
.gaugetext{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;}
.gaugebig{font-size:19px; font-weight:700;}
.gaugesub{font-size:10.5px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin-top:2px;}
.gaugemeta{flex:1; min-width:160px; font-size:13px; color:var(--muted);}

/* ---------- ai assistant ---------- */
/* The panel is fixed to the right edge and the whole app is padded out of its way,
   so the sticky header reflows with everything else instead of sliding underneath. */
/* --aiw lives on the .fw root so the panel and the padding that clears space
   for it can never disagree about the width the user dragged to. */
.fw.aiopen{padding-right:var(--aiw);}
.aipanel{
  position:fixed; top:0; right:0; bottom:0; width:var(--aiw); z-index:40;
  display:flex; flex-direction:column;
  background:var(--card); border-left:1px solid var(--line);
}
.aigrip{
  position:absolute; left:-3px; top:0; bottom:0; width:7px; z-index:41;
  cursor:col-resize; background:transparent; border:none; padding:0;
}
.aigrip:hover, .aigrip.dragging{background:var(--pine); opacity:.5;}
.aihead{
  display:flex; align-items:center; gap:4px; flex:none;
  padding:12px 10px 12px 16px; border-bottom:1px solid var(--line);
}
.aititle{font-family:var(--font-display); font-weight:700; font-size:16px; flex:1;}
.aimini{padding:4px 8px; font-size:13px;}
.aiscroll{flex:1; overflow-y:auto; padding:14px 16px; display:flex; flex-direction:column; gap:10px;}
.aiempty{display:flex; flex-direction:column; gap:8px; align-items:flex-start;}
.aisuggest{
  border:1px solid var(--line); background:var(--paper); border-radius:var(--radius);
  padding:8px 10px; font-size:13px; color:var(--muted); text-align:left; line-height:1.35;
  white-space:normal; max-width:100%;
}
.aisuggest:hover{border-color:var(--pine); color:var(--ink);}
.aimsg{font-size:14px; line-height:1.5; white-space:pre-wrap; overflow-wrap:anywhere;}
.aimsg.user{
  background:var(--pine-soft); border:1px solid var(--line-soft);
  border-radius:var(--radius); padding:8px 11px; align-self:flex-end; max-width:88%;
}
.aimsg.assistant{color:var(--ink);}
.aitool{font-family:var(--font-mono); font-size:12px; color:var(--muted);}
.aithinking{animation:aipulse 1.4s ease-in-out infinite;}
@keyframes aipulse{0%,100%{opacity:.45;}50%{opacity:1;}}
.aierror{
  font-size:13px; color:var(--tomato); background:var(--tomato-soft);
  border-radius:var(--radius); padding:8px 11px;
}
.aicompose{flex:none; display:flex; gap:8px; align-items:flex-end; padding:12px 16px; border-top:1px solid var(--line); background:var(--paper);}
.aiinput{flex:1; min-width:0; resize:vertical; line-height:1.45; min-height:96px; background:var(--card);}
.aiinput:disabled{opacity:.5;}

@media (max-width:900px){
  .fw.aiopen{padding-right:0;}
  .aipanel{width:100%;}
  .aigrip{display:none;}
}
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
// Gantt column header: the date the column's week starts on. The month is only
// repeated when it changes, so a long timeline reads "Aug 10 / 17 / 24 / Sep 1".
const colLabel = (d, prev) => {
  const day = d.getDate();
  if (prev && prev.getMonth() === d.getMonth()) return String(day);
  return `${d.toLocaleDateString(undefined, { month: "short" })} ${day}`;
};
// local calendar day, not UTC — toISOString() would roll over a day early for
// negative UTC offsets in the evening (e.g. 7pm CDT is already after midnight UTC)
const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const fmtDue = (iso) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const fmtMoney = (n) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });
// sessions needed for a task of this length, given the current focus-session length (data.settings.work)
const estFor = (minutes, sessionMin) => Math.max(1, Math.ceil(minutes / sessionMin));
// re-derives every task's est (and clamps done) when the focus-session length itself
// changes, so existing tasks' dot counts track the new length instead of staying stuck at
// whatever they were computed under. Tasks without a stored `minutes` (pre-redesign relics)
// are left alone — there's no reliable way to recover their original length.
const recomputeSessions = (tasks, sessionMin) => tasks.map((t) => {
  if (t.minutes === undefined) return t;
  const est = estFor(t.minutes, sessionMin);
  return { ...t, est, done: Math.min(t.done, est) };
});

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
const recurringSeedTasks = (sessionMin = 25) => RECURRING_SEEDS.map((s) => ({
  id: uid(), title: s.title, cat: "exercise", minutes: s.minutes,
  est: estFor(s.minutes, sessionMin), done: 0, checked: false,
  oneOnOne: false, recurring: true, seedKey: s.key, completedDate: null,
}));

// Housing/Loans/Investments/Monthly Fees are fixed line items — their total *is* the
// budget, no separate spending to track. Food/Free are the opposite: a monthly cap
// (Free's is computed, not stored) that purchases logged during the month draw down.
const BUDGET_CAT_META = {
  housing: { color: "var(--slate)" },
  loans: { color: "var(--plum)" },
  investments: { color: "var(--pine)" },
  fees: { color: "var(--amber)" },
  food: { color: "var(--tomato)" },
  free: { color: "var(--teal)" },
};
function defaultBudget() {
  return {
    monthlyIncome: 3000,
    categories: [
      { id: "housing", name: "Housing", type: "fixed", items: [
        { id: uid(), name: "Rent", amount: 400 },
        { id: uid(), name: "Utilities", amount: 200 },
      ] },
      { id: "loans", name: "Loans", type: "fixed", items: [
        { id: uid(), name: "Loans", amount: 300 },
      ] },
      { id: "investments", name: "Investments", type: "fixed", items: [
        { id: uid(), name: "Roth", amount: 200 },
        { id: uid(), name: "Savings", amount: 200 },
      ] },
      { id: "fees", name: "Monthly Fees", type: "fixed", items: [
        { id: uid(), name: "Claude", amount: 17 },
        { id: uid(), name: "Spotify", amount: 23.58 },
        { id: uid(), name: "Gym", amount: 76.86 },
      ] },
      { id: "food", name: "Food", type: "budget", budget: 400, items: [] },
      { id: "free", name: "Free", type: "budget", budget: null, items: [] }, // budget computed at render time
    ],
  };
}
// One-time backfill for existing users, same pattern as ensureRecurringSeeds.
function ensureBudgetSeed(data) {
  if (data.budget) return data;
  return { ...data, budget: defaultBudget() };
}

function sampleData() {
  const m0 = monday(new Date());
  const iso = (d) => d.toISOString().slice(0, 10);
  return {
    settings: { work: 25, short: 5, long: 15 },
    pomoLog: {},
    seededRecurring: true,
    budget: defaultBudget(),
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
  return { ...data, seededRecurring: true, tasks: [...data.tasks, ...recurringSeedTasks(data.settings.work)] };
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

// Backfills missing fields (recurring seeds, budget) and reopens recurring tasks.
// Applied to local loads AND cloud pulls — a cloud row can predate a field that was
// added after sync already existed, so this can't just run once on initial load.
function hydrate(d) {
  return resetRecurringTasks(ensureBudgetSeed(ensureRecurringSeeds(d)));
}

// Assistant panel width — a per-device UI preference like the theme, not synced data.
const AIW_KEY = "lordofmylife:aiwidth";
const AIW_MIN = 300, AIW_MAX = 860;

const THEME_KEY = "lordofmylife:theme";
const THEMES = { dark: "fantasy", fantasy: "dark" }; // maps a theme to "what toggling gives you"
const THEME_LABEL = { dark: "📜 Fantasy", fantasy: "🌲 Modern" }; // label shows the theme you'd switch TO

/* ================================================================ */
export default function LordOfMyLife() {
  const [data, setData] = useState(() => hydrate(loadData() || sampleData()));
  const [view, setView] = useState("work");
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || "dark"; } catch (e) { return "dark"; }
  });
  const [now, setNow] = useState(() => new Date()); // ticks so due-date glows (esp. the 11pm overdue cutoff) update live
  const [aiOpen, setAiOpen] = useState(false);
  const [aiWidth, setAiWidth] = useState(() => {
    const n = Number(localStorage.getItem(AIW_KEY));
    return n >= AIW_MIN && n <= AIW_MAX ? n : 380;
  });
  const saveTimer = useRef(null);
  // AiPanel's tool loop spans several awaits and several writes; reading `data` from its
  // closure would hand the second tool call a snapshot from before the first one landed.
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

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

  useEffect(() => {
    try { localStorage.setItem(AIW_KEY, String(aiWidth)); } catch (e) { /* storage full or unavailable */ }
  }, [aiWidth]);

  const sessionEmoji = theme === "fantasy" ? "🕯️" : "🍅";
  const assistantLabel = theme === "fantasy" ? "Wizard" : "Assistant";
  const todayPomos = data.pomoLog[dateKey(new Date())] || 0;

  return (
    <div className={`fw ${aiOpen ? "aiopen" : ""}`} data-theme={theme} style={{ "--aiw": `${aiWidth}px` }}>
      <style>{CSS}</style>
      <header className="hd">
        <div className="brand">Lord of <em>my Life</em></div>
        <span className="wkchip">{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
        {todayPomos > 0 && <span className="todaypomos">{sessionEmoji} ×{todayPomos} today</span>}
        <nav className="tabs">
          {[["gantt", "Gantt Chart"], ["work", "Work"], ["session", "Session"], ["personal", "Personal"], ["budget", "Budget"]].map(([k, label]) => (
            <button key={k} className={`tab ${view === k ? "on" : ""}`} onClick={() => setView(k)}>{label}</button>
          ))}
        </nav>
        <button className="btn ghost" title="Switch theme" onClick={() => setTheme(THEMES[theme])}>{THEME_LABEL[theme]}</button>
        {!aiOpen && <button className="btn ghost" title={`Open the ${assistantLabel.toLowerCase()}`} onClick={() => setAiOpen(true)}>✦ {assistantLabel}</button>}
        <SyncBar data={data} setData={setData} />
      </header>
      <main className="wrap">
        {view === "gantt" && <GanttView data={data} setData={setData} now={now} />}
        {view === "work" && <WorkView data={data} setData={setData} now={now} />}
        {view === "session" && <SessionView data={data} setData={setData} sessionEmoji={sessionEmoji} />}
        {view === "personal" && <PersonalView data={data} setData={setData} now={now} />}
        {view === "budget" && <BudgetView data={data} setData={setData} now={now} />}
      </main>
      {aiOpen && (
        <AiPanel dataRef={dataRef} setData={setData} onClose={() => setAiOpen(false)}
          label={assistantLabel} width={aiWidth} setWidth={setAiWidth} />
      )}
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
          setData(hydrate(row.data));
        } else {
          await pushCloudData(session.user.id, data);
        }
        setStatus("synced");
        unsubRealtime = subscribeToCloudData(session.user.id, (remoteData) => {
          skipNextPush.current = true;
          setData(hydrate(remoteData));
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
      {data.projects.map((p) => <ProjectGantt key={p.id} project={p} data={data} setData={setData} onDelete={() => delProject(p.id)} now={now} />)}
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
          {weeks.map((w, i) => <div key={i} className="gwk">{colLabel(w, weeks[i - 1])}</div>)}
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

/* A project can be split into named sections (e.g. NDSEG and GEM inside a
   Fellowships project). A section owns its own phases and its own tasks, and
   gets a tinted band across the whole timeline so it reads as one block.
   `project.phases` stays as the ungrouped list, so projects made before
   sections existed keep rendering exactly as they did. */
function ProjectGantt({ project, data, setData, onDelete, now }) {
  const [ph, setPh] = useState({ name: "", start: "", end: "" });
  const [secName, setSecName] = useState("");

  const sections = project.sections || [];
  const update = (proj) => setData({ ...data, projects: data.projects.map((p) => (p.id === proj.id ? proj : p)) });
  const sectionTasks = (secId) => data.tasks.filter((t) => t.sectionId === secId && t.dueDate);

  const addPhase = () => {
    if (!ph.name.trim() || !ph.start || !ph.end || ph.end < ph.start) return;
    update({ ...project, phases: [...project.phases, { id: uid(), ...ph, name: ph.name.trim(), done: false }] });
    setPh({ name: "", start: "", end: "" });
  };
  const togglePhase = (id) => update({ ...project, phases: project.phases.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) });
  const delPhase = (id) => update({ ...project, phases: project.phases.filter((x) => x.id !== id) });

  const addSection = () => {
    if (!secName.trim()) return;
    update({
      ...project,
      sections: [...sections, {
        id: uid(), name: secName.trim(),
        // offset so a section never lands on the project's own color
        color: PROJ_COLORS[(sections.length + 1) % PROJ_COLORS.length],
        phases: [],
      }],
    });
    setSecName("");
  };
  const updateSection = (id, fn) => update({ ...project, sections: sections.map((s) => (s.id === id ? fn(s) : s)) });
  // one setData, not two — deleting the section and unlinking its tasks are the
  // same edit, and a second setData off the same `data` would discard the first
  const delSection = (id) => setData({
    ...data,
    projects: data.projects.map((p) => (p.id === project.id ? { ...p, sections: sections.filter((s) => s.id !== id) } : p)),
    tasks: data.tasks.map((t) => (t.sectionId === id ? { ...t, sectionId: null } : t)),
  });
  const addSectionPhase = (secId, p) => updateSection(secId, (s) => ({ ...s, phases: [...s.phases, { id: uid(), ...p, done: false }] }));
  const toggleSecPhase = (secId, id) => updateSection(secId, (s) => ({ ...s, phases: s.phases.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) }));
  const delSecPhase = (secId, id) => updateSection(secId, (s) => ({ ...s, phases: s.phases.filter((x) => x.id !== id) }));
  const addSectionTask = (secId, { title, minutes, dueDate, cat }) => {
    const est = estFor(minutes, data.settings.work);
    setData({ ...data, tasks: [...data.tasks, {
      id: uid(), title, cat, minutes, est, done: 0, checked: false,
      oneOnOne: false, dueDate, sectionId: secId,
    }] });
  };

  // One shared timeline across ungrouped phases, every section's phases, and
  // every section task's due date, so all of it lines up on the same columns.
  const allPhases = [...project.phases, ...sections.flatMap((s) => s.phases)];
  const stamps = [
    ...allPhases.flatMap((x) => [x.start, x.end]),
    ...sections.flatMap((s) => sectionTasks(s.id).map((t) => t.dueDate)),
  ].map((d) => monday(new Date(d + "T00:00:00")));

  let grid = null;
  if (stamps.length) {
    const min = new Date(Math.min(...stamps));
    const max = new Date(Math.max(...stamps));
    const nWeeks = Math.round((max - min) / (7 * DAY)) + 1;
    const weeks = Array.from({ length: nWeeks }, (_, i) => addDays(min, i * 7));
    const todayPct = now >= min && now < addDays(min, nWeeks * 7)
      ? ((now - min) / (nWeeks * 7 * DAY)) * 100 : null;
    grid = { min, nWeeks, weeks, todayPct };
  }
  const doneCt = allPhases.filter((x) => x.done).length;

  const colOf = (iso) => Math.round((monday(new Date(iso + "T00:00:00")) - grid.min) / (7 * DAY)) + 1;
  const phaseBar = (x, row, color, onToggle, onDel) => {
    const col = colOf(x.start);
    const span = Math.round((monday(new Date(x.end + "T00:00:00")) - monday(new Date(x.start + "T00:00:00"))) / (7 * DAY)) + 1;
    return (
      <div key={x.id} className={`gbar phaserow ${x.done ? "done" : ""}`}
        style={{ gridColumn: `${col} / span ${span}`, gridRow: row, background: color }}
        title={`${x.start} → ${x.end} · click to toggle done`}
        onClick={onToggle}>
        {x.done ? "✓ " : ""}{x.name}
        <button className="xbtn" style={{ color: "#fff", marginLeft: "auto" }} onClick={(e2) => { e2.stopPropagation(); onDel(); }}>✕</button>
      </div>
    );
  };

  // Rows are laid out top to bottom with a running counter: ungrouped phases
  // first, then each section as a band (label row + its phases + its tasks).
  const rows = [];
  let row = 2; // row 1 is the date header
  project.phases.forEach((x) => {
    rows.push(phaseBar(x, row, project.color, () => togglePhase(x.id), () => delPhase(x.id)));
    row++;
  });
  sections.forEach((sec) => {
    const tasks = sectionTasks(sec.id);
    const span = 1 + sec.phases.length + tasks.length;
    rows.push(
      <div key={`band-${sec.id}`} className="gband"
        style={{ gridColumn: "1 / -1", gridRow: `${row} / span ${span}`, background: `${sec.color}24`, boxShadow: `inset 0 0 0 1px ${sec.color}55` }} />
    );
    rows.push(
      <div key={`lab-${sec.id}`} className="gseclabel phaserow" style={{ gridColumn: "1 / -1", gridRow: row }}>
        <span className="projdot" style={{ background: sec.color }} />
        {sec.name}
        <span className="projmeta">{sec.phases.filter((p) => p.done).length}/{sec.phases.length} phases · {tasks.length} task{tasks.length === 1 ? "" : "s"}</span>
        <button className="xbtn" style={{ marginLeft: "auto" }} title="Delete section" onClick={() => delSection(sec.id)}>✕</button>
      </div>
    );
    row++;
    sec.phases.forEach((x) => {
      rows.push(phaseBar(x, row, sec.color, () => toggleSecPhase(sec.id, x.id), () => delSecPhase(sec.id, x.id)));
      row++;
    });
    tasks.forEach((t) => {
      const urgency = taskUrgency(t, now);
      rows.push(
        <div key={t.id}
          className={`gbar ${t.checked ? "done" : ""} ${urgency === "due-today" ? "due-today" : ""} ${urgency === "overdue" ? "overdue" : ""}`}
          style={{ gridColumn: `${colOf(t.dueDate)} / span 1`, gridRow: row, background: catColorFor(t.cat) }}
          title={`task · due ${t.dueDate}`}>
          {t.checked ? "✓ " : ""}{t.title}
        </div>
      );
      row++;
    });
  });

  return (
    <section className="card proj">
      <div className="projhead">
        <span className="projdot" style={{ background: project.color }} />
        <span className="projname">{project.name}</span>
        <span className="projmeta">{doneCt}/{allPhases.length} phases done</span>
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
            {grid.weeks.map((w, i) => <div key={i} className="gwk">{colLabel(w, grid.weeks[i - 1])}</div>)}
            {rows}
            {grid.todayPct !== null && (
              <>
                <div className="todayline" style={{ left: `${grid.todayPct}%` }} />
                <div className="todayflag" style={{ left: `${grid.todayPct}%` }}>today</div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="emptystate" style={{ padding: "14px 16px" }}>Nothing scheduled yet — add a phase or a section below.</div>
      )}

      <div className="addrow">
        <input className="field" style={{ flex: 1, minWidth: 160 }} placeholder="Phase name (e.g. Data collection)"
          value={ph.name} onChange={(e) => setPh({ ...ph, name: e.target.value })} />
        <label style={{ fontSize: 13, color: "var(--muted)" }}>from <input type="date" className="field" value={ph.start} onChange={(e) => setPh({ ...ph, start: e.target.value })} /></label>
        <label style={{ fontSize: 13, color: "var(--muted)" }}>to <input type="date" className="field" value={ph.end} onChange={(e) => setPh({ ...ph, end: e.target.value })} /></label>
        <button className="btn" onClick={addPhase}>Add phase</button>
      </div>

      {sections.map((sec) => (
        <SectionEditor key={sec.id} section={sec}
          onAddPhase={(p) => addSectionPhase(sec.id, p)}
          onAddTask={(t) => addSectionTask(sec.id, t)} />
      ))}

      <div className="addrow">
        <input className="field" style={{ flex: 1, minWidth: 160 }} placeholder="New section (e.g. NDSEG)"
          value={secName} onChange={(e) => setSecName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSection()} />
        <button className="btn" onClick={addSection}>Add section</button>
      </div>
    </section>
  );
}

/* ================= SHARED TASK LIST PIECES ================= */
/* The add-phase / add-task forms for one section, kept out of the grid itself.
   A section task needs a due date — it's placed on a timeline, so an undated
   one would have nowhere to sit. It's a normal task otherwise: it also shows
   up under its category in Work or Personal. */
function SectionEditor({ section, onAddPhase, onAddTask }) {
  const [ph, setPh] = useState({ name: "", start: "", end: "" });
  const [tk, setTk] = useState({ title: "", minutes: 25, dueDate: "", cat: WORK_CATS[1].id });

  const submitPhase = () => {
    if (!ph.name.trim() || !ph.start || !ph.end || ph.end < ph.start) return;
    onAddPhase({ name: ph.name.trim(), start: ph.start, end: ph.end });
    setPh({ name: "", start: "", end: "" });
  };
  const submitTask = () => {
    if (!tk.title.trim() || !tk.dueDate) return;
    onAddTask({ title: tk.title.trim(), minutes: Math.max(5, +tk.minutes || 25), dueDate: tk.dueDate, cat: tk.cat });
    setTk({ ...tk, title: "", minutes: 25, dueDate: "" });
  };

  return (
    <div className="secform" style={{ borderLeft: `3px solid ${section.color}` }}>
      <div className="secformname" style={{ color: section.color }}>{section.name}</div>
      <div className="addrow">
        <input className="field" style={{ flex: 1, minWidth: 140 }} placeholder="Phase name"
          value={ph.name} onChange={(e) => setPh({ ...ph, name: e.target.value })} />
        <label style={{ fontSize: 13, color: "var(--muted)" }}>from <input type="date" className="field" value={ph.start} onChange={(e) => setPh({ ...ph, start: e.target.value })} /></label>
        <label style={{ fontSize: 13, color: "var(--muted)" }}>to <input type="date" className="field" value={ph.end} onChange={(e) => setPh({ ...ph, end: e.target.value })} /></label>
        <button className="btn" onClick={submitPhase}>Add phase</button>
      </div>
      <div className="addrow">
        <input className="field" style={{ flex: 1, minWidth: 140 }} placeholder="Task name"
          value={tk.title} onChange={(e) => setTk({ ...tk, title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && submitTask()} />
        <select className="field" value={tk.cat} onChange={(e) => setTk({ ...tk, cat: e.target.value })}>
          {ALL_CATS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
          <input type="number" min="5" step="5" className="field" style={{ width: 58 }} value={tk.minutes} onChange={(e) => setTk({ ...tk, minutes: e.target.value })} /> min
        </label>
        <label style={{ fontSize: 13, color: "var(--muted)" }}>due <input type="date" className="field" value={tk.dueDate} onChange={(e) => setTk({ ...tk, dueDate: e.target.value })} /></label>
        <button className="btn" onClick={submitTask} disabled={!tk.title.trim() || !tk.dueDate}>Add task</button>
      </div>
    </div>
  );
}

function TaskRow({ t, burstId, onToggle, onToggleAll, onDelete, onEdit, onAddSubtask, onToggleSubtask, onDeleteSubtask, now, sessionMin }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(t.title);
  const [minutes, setMinutes] = useState(t.minutes || t.est * sessionMin);
  const [dueDate, setDueDate] = useState(t.dueDate || "");

  const hasSubs = t.subtasks && t.subtasks.length > 0;

  const startEdit = () => {
    setTitle(t.title); setMinutes(t.minutes || t.est * sessionMin); setDueDate(t.dueDate || "");
    setEditing(true);
  };
  const commit = () => {
    if (!title.trim()) return;
    onEdit(t.id, hasSubs ? { title: title.trim() } : { title: title.trim(), minutes: Math.max(5, +minutes || 25), dueDate: dueDate || null });
    setEditing(false);
  };

  const urgency = taskUrgency(t, now);

  if (editing) {
    return (
      <div className="taskrow taskrow-editing">
        <input className="field" style={{ flex: 1, minWidth: 140 }} value={title}
          onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commit()} autoFocus />
        {hasSubs ? (
          <span className="sub" style={{ fontSize: 12 }}>{t.subtasks.length} subtasks — time & due date follow them</span>
        ) : (
          <>
            <label style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
              <input type="number" min="5" step="5" className="field" style={{ width: 64 }} value={minutes}
                onChange={(e) => setMinutes(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commit()} /> min
            </label>
            <label style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
              due <input type="date" className="field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
          </>
        )}
        <button className="btn primary" onClick={commit}>Save</button>
        <button className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <>
      <div className={`taskrow ${t.checked ? "done" : ""} ${urgency === "due-today" ? "due-today" : ""} ${urgency === "overdue" ? "overdue" : ""}`}>
        <span className="checkwrap">
          <button className={`check ${t.checked ? "on" : ""}`} aria-label={t.checked ? "Mark not done" : "Mark done"}
            onClick={() => (hasSubs ? onToggleAll() : onToggle(t))}>✓</button>
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
        <span className="taskmin">{t.minutes || t.est * sessionMin} min</span>
        <span className="pomodots" title={`${t.done}/${t.est} sessions · ${t.minutes || t.est * sessionMin} min`}>
          {Array.from({ length: Math.min(t.est, 8) }, (_, i) => <span key={i} className={`pdot ${i < t.done ? "f" : ""}`} />)}
          {t.est > 8 && <span className="pcount">{t.done}/{t.est}</span>}
        </span>
        {hasSubs && (
          <span className="subprogress" title="Subtasks complete">
            {t.subtasks.filter((s) => s.checked).length}/{t.subtasks.length}
          </span>
        )}
        <button className="subtoggle" onClick={() => setExpanded((e) => !e)} title={expanded ? "Hide subtasks" : "Subtasks"}>
          {expanded ? "▾" : "▸"}
        </button>
        <button className="xbtn" onClick={startEdit} title="Edit task">✎</button>
        <button className="xbtn" onClick={() => onDelete(t.id)} title="Delete task">✕</button>
      </div>
      {expanded && (
        <div className="subtasks">
          {(t.subtasks || []).map((s) => (
            <SubtaskRow key={s.id} sub={s} onToggle={() => onToggleSubtask(s.id)} onDelete={() => onDeleteSubtask(s.id)} now={now} />
          ))}
          <AddSubtaskRow onAdd={(title2, minutes2, dueDate2) => onAddSubtask(title2, minutes2, dueDate2)} />
        </div>
      )}
    </>
  );
}

// shared by WorkView/PersonalView — recomputes est from the edited minutes (using the
// current focus-session length), clamps done so it never exceeds the new est. A task with
// subtasks only ever sends a title-only patch (minutes/dueDate follow the subtasks).
function editTask(data, setData, id, patch) {
  setData({
    ...data,
    tasks: data.tasks.map((x) => {
      if (x.id !== id) return x;
      if (patch.minutes === undefined) return { ...x, title: patch.title };
      const est = estFor(patch.minutes, data.settings.work);
      return { ...x, title: patch.title, minutes: patch.minutes, dueDate: patch.dueDate, est, done: Math.min(x.done, est) };
    }),
  });
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

// A task with subtasks no longer controls its own minutes/dueDate/checked — they're
// recomputed from the subtask list every time it changes. Time is a plain sum; due date
// is the latest subtask due date (you're not done until the last one is); checked is
// true only once every subtask is checked. est uses the current focus-session length.
function deriveFromSubtasks(t, sessionMin) {
  if (!t.subtasks || t.subtasks.length === 0) return t;
  const minutes = t.subtasks.reduce((s, x) => s + x.minutes, 0);
  const est = estFor(minutes, sessionMin);
  const dueDates = t.subtasks.map((x) => x.dueDate).filter(Boolean).sort();
  const dueDate = dueDates.length ? dueDates[dueDates.length - 1] : null;
  const checked = t.subtasks.every((x) => x.checked);
  return { ...t, minutes, est, dueDate, checked, done: Math.min(t.done, est) };
}

// shared by WorkView/PersonalView — runs any subtask mutation through deriveFromSubtasks,
// and fires the same completion burst/completedDate stamp as toggleTask when the parent
// transitions to fully done as a side effect (e.g. checking the last remaining subtask).
function updateSubtasks(data, setData, taskId, fn, setBurst) {
  const task = data.tasks.find((t) => t.id === taskId);
  const wasChecked = task.checked;
  let updated = deriveFromSubtasks(fn(task), data.settings.work);
  if (!wasChecked && updated.checked) {
    updated = { ...updated, completedDate: dateKey(new Date()) };
    if (setBurst) { setBurst(taskId); popSound(); setTimeout(() => setBurst(null), 700); }
  }
  setData({ ...data, tasks: data.tasks.map((t) => (t.id === taskId ? updated : t)) });
}
const addSubtask = (data, setData, taskId, title, minutes, dueDate, setBurst) => updateSubtasks(
  data, setData, taskId,
  (t) => ({ ...t, subtasks: [...(t.subtasks || []), { id: uid(), title, minutes, checked: false, dueDate }] }),
  setBurst,
);
const toggleSubtask = (data, setData, taskId, subId, setBurst) => updateSubtasks(
  data, setData, taskId,
  (t) => ({ ...t, subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, checked: !s.checked } : s)) }),
  setBurst,
);
const delSubtask = (data, setData, taskId, subId, setBurst) => updateSubtasks(
  data, setData, taskId,
  (t) => ({ ...t, subtasks: t.subtasks.filter((s) => s.id !== subId) }),
  setBurst,
);
// clicking the parent checkbox on a task with subtasks checks/unchecks all of them at once
const toggleAllSubtasks = (data, setData, taskId, setBurst) => {
  const task = data.tasks.find((t) => t.id === taskId);
  const target = !task.checked;
  updateSubtasks(data, setData, taskId, (t) => ({ ...t, subtasks: t.subtasks.map((s) => ({ ...s, checked: target })) }), setBurst);
};

function SubtaskRow({ sub, onToggle, onDelete, now }) {
  const urgency = taskUrgency(sub, now);
  return (
    <div className={`subtaskrow ${sub.checked ? "done" : ""} ${urgency === "due-today" ? "due-today" : ""} ${urgency === "overdue" ? "overdue" : ""}`}>
      <button className={`check small ${sub.checked ? "on" : ""}`} aria-label={sub.checked ? "Mark not done" : "Mark done"} onClick={onToggle}>✓</button>
      <span className="subtasktitle">{sub.title}</span>
      {sub.dueDate && (
        <span className="tagdue" style={{ color: urgency === "overdue" ? "var(--tomato)" : urgency === "due-today" ? "var(--amber)" : "var(--muted)" }}>
          due {fmtDue(sub.dueDate)}
        </span>
      )}
      <span className="taskmin">{sub.minutes} min</span>
      <button className="xbtn" onClick={onDelete} title="Delete subtask">✕</button>
    </div>
  );
}

function AddSubtaskRow({ onAdd }) {
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(25);
  const [dueDate, setDueDate] = useState("");

  const submit = () => {
    if (!title.trim()) return;
    onAdd(title.trim(), Math.max(5, +minutes || 25), dueDate || null);
    setTitle(""); setMinutes(25); setDueDate("");
  };

  return (
    <div className="addrow subaddrow">
      <input className="field" style={{ flex: 1, minWidth: 120 }} placeholder="Add a subtask…"
        value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      <label style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
        <input type="number" min="5" step="5" className="field" style={{ width: 56 }} value={minutes} onChange={(e) => setMinutes(e.target.value)} /> min
      </label>
      <label style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
        due <input type="date" className="field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </label>
      <button className="btn" onClick={submit}>Add</button>
    </div>
  );
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
    const est = estFor(minutes, data.settings.work);
    setData({ ...data, tasks: [...data.tasks, { id: uid(), title, cat: catId, minutes, est, done: 0, checked: false, oneOnOne, dueDate }] });
  };
  const toggle = (t) => toggleTask(data, setData, t, setBurst);
  const delTask = (id) => setData({ ...data, tasks: data.tasks.filter((x) => x.id !== id) });
  const edit = (id, patch) => editTask(data, setData, id, patch);
  const toggleAll = (id) => toggleAllSubtasks(data, setData, id, setBurst);
  const addSub = (id, title, minutes, dueDate) => addSubtask(data, setData, id, title, minutes, dueDate, setBurst);
  const toggleSub = (id, subId) => toggleSubtask(data, setData, id, subId, setBurst);
  const delSub = (id, subId) => delSubtask(data, setData, id, subId, setBurst);

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
              {list.map((t) => (
                <TaskRow key={t.id} t={t} burstId={burst} onToggle={toggle} onToggleAll={() => toggleAll(t.id)}
                  onDelete={delTask} onEdit={edit} now={now} sessionMin={data.settings.work}
                  onAddSubtask={(title, minutes, dueDate) => addSub(t.id, title, minutes, dueDate)}
                  onToggleSubtask={(subId) => toggleSub(t.id, subId)}
                  onDeleteSubtask={(subId) => delSub(t.id, subId)} />
              ))}
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
    const est = estFor(minutes, data.settings.work);
    setData({ ...data, tasks: [...data.tasks, { id: uid(), title, cat: catId, minutes, est, done: 0, checked: false, oneOnOne, dueDate }] });
  };
  const toggle = (t) => toggleTask(data, setData, t, setBurst);
  const delTask = (id) => setData({ ...data, tasks: data.tasks.filter((x) => x.id !== id) });
  const edit = (id, patch) => editTask(data, setData, id, patch);
  const toggleAll = (id) => toggleAllSubtasks(data, setData, id, setBurst);
  const addSub = (id, title, minutes, dueDate) => addSubtask(data, setData, id, title, minutes, dueDate, setBurst);
  const toggleSub = (id, subId) => toggleSubtask(data, setData, id, subId, setBurst);
  const delSub = (id, subId) => delSubtask(data, setData, id, subId, setBurst);

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
              {list.map((t) => (
                <TaskRow key={t.id} t={t} burstId={burst} onToggle={toggle} onToggleAll={() => toggleAll(t.id)}
                  onDelete={delTask} onEdit={edit} now={now} sessionMin={data.settings.work}
                  onAddSubtask={(title, minutes, dueDate) => addSub(t.id, title, minutes, dueDate)}
                  onToggleSubtask={(subId) => toggleSub(t.id, subId)}
                  onDeleteSubtask={(subId) => delSub(t.id, subId)} />
              ))}
              {list.length === 0 && <div className="emptystate" style={{ padding: "14px 16px" }}>No tasks yet.</div>}
              <AddTaskRow onAdd={(title, minutes, oneOnOne, dueDate) => addTask(c.id, title, minutes, oneOnOne, dueDate)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================= BUDGET ================= */
function BudgetRow({ item, onUpdate, onDelete }) {
  // buffered locally so typing "23." or clearing the field to retype doesn't get
  // stomped by a controlled value re-coerced to a number on every keystroke
  const [amountStr, setAmountStr] = useState(String(item.amount));
  useEffect(() => { setAmountStr(String(item.amount)); }, [item.amount]);

  const commitAmount = () => {
    const v = Math.max(0, +amountStr || 0);
    setAmountStr(String(v));
    if (v !== item.amount) onUpdate({ amount: v });
  };

  return (
    <div className="budgetrow">
      <input className="budgetname-input" value={item.name} onChange={(e) => onUpdate({ name: e.target.value })} />
      <span className="budgetamt-wrap">
        <span className="budgetdollar">$</span>
        <input type="number" min="0" step="0.01" className="budgetamt-input" value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)} onBlur={commitAmount}
          onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
      </span>
      <button className="xbtn" onClick={() => onDelete(item.id)} title="Delete">✕</button>
    </div>
  );
}

function AddBudgetItemRow({ onAdd, placeholder }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const submit = () => {
    const amt = +amount;
    if (!name.trim() || !amt || amt <= 0) return;
    onAdd(name.trim(), amt);
    setName(""); setAmount("");
  };

  return (
    <div className="addrow">
      <input className="field" style={{ flex: 1, minWidth: 140 }} placeholder={placeholder || "Add item…"}
        value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      <label style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
        $ <input type="number" min="0" step="0.01" className="field" style={{ width: 80 }}
          value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      </label>
      <button className="btn" onClick={submit}>Add</button>
    </div>
  );
}

// Ring chart of the whole month's split — same stroke-dasharray/offset technique as
// the Focus timer ring, just walked around the circle once per category instead of
// redrawn every second.
function BudgetDonut({ segments, total }) {
  const R = 74, C = 2 * Math.PI * R;
  let cumulative = 0;
  return (
    <div style={{ position: "relative", width: 168, height: 168, flex: "none" }}>
      <svg width="168" height="168" viewBox="0 0 168 168">
        <circle cx="84" cy="84" r={R} fill="none" stroke="var(--line-soft)" strokeWidth="20" />
        {segments.filter((s) => s.amount > 0).map((s) => {
          const frac = total > 0 ? s.amount / total : 0;
          const dash = frac * C;
          const offset = -cumulative * C;
          cumulative += frac;
          return (
            <circle key={s.id} cx="84" cy="84" r={R} fill="none" stroke={s.color} strokeWidth="20"
              strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={offset} transform="rotate(-90 84 84)" />
          );
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{fmtMoney(total)}</div>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginTop: 2 }}>per month</div>
      </div>
    </div>
  );
}

// Composition strip under a fixed category's header — same color, fading per item, so
// e.g. Housing visibly shows Rent as the bigger chunk of the bar than Utilities.
function SegmentBar({ items, color }) {
  const total = items.reduce((s, i) => s + i.amount, 0) || 1;
  return (
    <div className="segbar">
      {items.map((i, idx) => (
        <div key={i.id} style={{ width: `${(i.amount / total) * 100}%`, background: color, opacity: 1 - idx * 0.22 }} title={`${i.name}: ${fmtMoney(i.amount)}`} />
      ))}
    </div>
  );
}

// Spent/remaining ring for Food and Free — deliberately the same visual language as the
// Focus timer ring (progress drains the same way), so "budget" reads as another kind of
// countdown rather than a bolted-on unrelated widget.
function BudgetGauge({ spent, budget, color }) {
  const R = 62, C = 2 * Math.PI * R;
  const pct = budget > 0 ? Math.min(1, spent / budget) : 0;
  const remaining = budget - spent;
  const over = remaining < 0;
  const ringColor = over ? "var(--tomato)" : pct >= 0.75 ? "var(--amber)" : color;
  return (
    <div className="gaugewrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--line)" strokeWidth="11" />
        <circle cx="70" cy="70" r={R} fill="none" stroke={ringColor} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dashoffset .3s ease" }} />
      </svg>
      <div className="gaugetext">
        <div className="gaugebig mono" style={{ color: over ? "var(--tomato)" : "var(--ink)" }}>{fmtMoney(Math.abs(remaining))}</div>
        <div className="gaugesub">{over ? "over budget" : "left"}</div>
      </div>
    </div>
  );
}

function BudgetView({ data, setData, now }) {
  const budget = data.budget;
  const thisMonth = monthKey(now);
  const itemsThisMonth = (items) => items.filter((i) => (i.date || "").slice(0, 7) === thisMonth);

  const catTotal = (cat) => cat.type === "fixed"
    ? cat.items.reduce((s, i) => s + i.amount, 0)
    : itemsThisMonth(cat.items).reduce((s, i) => s + i.amount, 0);

  const fixedCats = budget.categories.filter((c) => c.type === "fixed");
  const fixedTotal = fixedCats.reduce((s, c) => s + catTotal(c), 0);
  const foodCat = budget.categories.find((c) => c.id === "food");
  const freeCat = budget.categories.find((c) => c.id === "free");
  const freeBudget = budget.monthlyIncome - fixedTotal - foodCat.budget;
  const spendCats = [foodCat, { ...freeCat, budget: freeBudget }];

  const updateCat = (catId, fn) => setData({
    ...data,
    budget: { ...budget, categories: budget.categories.map((c) => (c.id === catId ? fn(c) : c)) },
  });
  const addItem = (catId, name, amount) => updateCat(catId, (c) => ({ ...c, items: [...c.items, { id: uid(), name, amount, date: dateKey(now) }] }));
  const updateItem = (catId, itemId, patch) => updateCat(catId, (c) => ({ ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }));
  const delItem = (catId, itemId) => updateCat(catId, (c) => ({ ...c, items: c.items.filter((i) => i.id !== itemId) }));
  const setIncome = (v) => setData({ ...data, budget: { ...budget, monthlyIncome: Math.max(0, +v || 0) } });
  const setFoodBudget = (v) => updateCat("food", (c) => ({ ...c, budget: Math.max(0, +v || 0) }));

  const donutSegments = [
    ...fixedCats.map((c) => ({ id: c.id, name: c.name, color: BUDGET_CAT_META[c.id]?.color, amount: catTotal(c) })),
    { id: "food", name: "Food", color: BUDGET_CAT_META.food.color, amount: foodCat.budget },
    { id: "free", name: "Free", color: BUDGET_CAT_META.free.color, amount: Math.max(0, freeBudget) },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="h2">Budget</div>
          <div className="sub">Food and Free are budgets you draw down as you log purchases — they reset on the 1st. Fixed costs are below.</div>
        </div>
        <label style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
          monthly income $ <input type="number" min="0" className="field" style={{ width: 90 }} value={budget.monthlyIncome} onChange={(e) => setIncome(e.target.value)} />
        </label>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="budgetoverview">
          <BudgetDonut segments={donutSegments} total={budget.monthlyIncome} />
          <div className="budgetlegend">
            {donutSegments.map((s) => (
              <div className="legendrow" key={s.id}>
                <span className="catdot" style={{ background: s.color }} />
                <span className="legendname">{s.name}</span>
                <span className="legendamt">{fmtMoney(s.amount)}</span>
                <span className="legendpct">{budget.monthlyIncome > 0 ? Math.round((s.amount / budget.monthlyIncome) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="catblock" style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        {spendCats.map((c) => {
          const spent = itemsThisMonth(c.items).reduce((s, i) => s + i.amount, 0);
          const monthItems = itemsThisMonth(c.items);
          return (
            <div key={c.id} className="card" style={{ flex: "1 1 320px" }}>
              <div className="cathead" style={{ padding: "14px 16px 0" }}>
                <span className="catdot" style={{ background: BUDGET_CAT_META[c.id]?.color }} />
                <span className="catname" style={{ color: BUDGET_CAT_META[c.id]?.color }}>{c.name}</span>
              </div>
              <div className="gaugerow">
                <BudgetGauge spent={spent} budget={c.budget} color={BUDGET_CAT_META[c.id]?.color} />
                <div className="gaugemeta">
                  spent {fmtMoney(spent)} of{" "}
                  {c.id === "food"
                    ? <input type="number" min="0" className="field" style={{ width: 64, padding: "2px 6px" }} value={c.budget} onChange={(e) => setFoodBudget(e.target.value)} />
                    : <b style={{ color: "var(--ink)" }}>{fmtMoney(c.budget)}</b>}
                </div>
              </div>
              {monthItems.map((i) => <BudgetRow key={i.id} item={i} onUpdate={(patch) => updateItem(c.id, i.id, patch)} onDelete={(id) => delItem(c.id, id)} />)}
              {monthItems.length === 0 && <div className="emptystate" style={{ padding: "14px 16px" }}>Nothing logged this month yet.</div>}
              <AddBudgetItemRow onAdd={(name, amount) => addItem(c.id, name, amount)} placeholder={`Add a ${c.name.toLowerCase()} purchase…`} />
            </div>
          );
        })}
      </div>

      {fixedCats.map((c) => (
        <div className="catblock" key={c.id}>
          <div className="cathead">
            <span className="catdot" style={{ background: BUDGET_CAT_META[c.id]?.color }} />
            <span className="catname" style={{ color: BUDGET_CAT_META[c.id]?.color }}>{c.name}</span>
            <span className="catcount">{fmtMoney(catTotal(c))}/mo</span>
          </div>
          {c.items.length > 0 && <SegmentBar items={c.items} color={BUDGET_CAT_META[c.id]?.color} />}
          <div className="card">
            {c.items.map((i) => <BudgetRow key={i.id} item={i} onUpdate={(patch) => updateItem(c.id, i.id, patch)} onDelete={(id) => delItem(c.id, id)} />)}
            {c.items.length === 0 && <div className="emptystate" style={{ padding: "14px 16px" }}>No items yet.</div>}
            <AddBudgetItemRow onAdd={(name, amount) => addItem(c.id, name, amount)} />
          </div>
        </div>
      ))}
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
    const tasks = k === "work" ? recomputeSessions(data.tasks, val) : data.tasks;
    setData({ ...data, settings: { ...s, [k]: val }, tasks });
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

/* ================= AI ASSISTANT ================= */

// What the model sees of a task. Deliberately not the raw object: `est` is renamed to
// something self-explanatory, and `oneOnOne`/`seedKey`/`completedDate` are dropped so the
// model isn't tempted to reason about internals it can't set.
const aiTask = (t) => ({
  id: t.id, title: t.title, cat: t.cat, minutes: t.minutes,
  sessions: t.est, sessionsDone: t.done, checked: t.checked, dueDate: t.dueDate || null,
  recurring: !!t.recurring,
  subtasks: (t.subtasks || []).map((s) => ({
    id: s.id, title: s.title, minutes: s.minutes, checked: s.checked, dueDate: s.dueDate || null,
  })),
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const cleanMinutes = (m) => Math.max(5, Math.round(+m || 25));
const cleanDue = (d) => (typeof d === "string" && ISO_DATE.test(d) ? d : null);
// Silently dropping a malformed phase would leave a gap the model never learns about,
// so invalid ones come back as a rejection it can retry.
function cleanPhases(raw) {
  const phases = [], rejected = [];
  for (const p of raw || []) {
    if (!p.name || !ISO_DATE.test(p.start || "") || !ISO_DATE.test(p.end || "") || p.end < p.start) {
      rejected.push({ phase: p, reason: "needs a name plus start/end as YYYY-MM-DD, with end on or after start" });
      continue;
    }
    phases.push({ id: uid(), name: p.name, start: p.start, end: p.end, done: false });
  }
  return { phases, rejected };
}

/* Runs one tool call against the planner. Pure: takes `data`, returns the next `data`
   plus the JSON result handed back to the model. Every write goes through the same
   helpers the UI uses (estFor, deriveFromSubtasks) so an AI-made task is indistinguishable
   from a hand-made one. Unknown ids come back as an `error` result rather than throwing —
   the model can then re-read and correct itself instead of the whole turn dying. */
function runPlannerTool(data, name, input) {
  const same = (result) => ({ data, result });
  const withTasks = (tasks, result) => ({ data: { ...data, tasks }, result });
  const findTask = (id) => data.tasks.find((t) => t.id === id);

  switch (name) {
    case "list_tasks": {
      let list = data.tasks.filter((t) => ALL_CATS.some((c) => c.id === t.cat));
      if (input.cat) list = list.filter((t) => t.cat === input.cat);
      if (!input.includeCompleted) list = list.filter((t) => !t.checked);
      return same({ tasks: list.map(aiTask) });
    }

    case "create_task": {
      if (!ALL_CATS.some((c) => c.id === input.cat)) {
        return same({ error: `Unknown category "${input.cat}". Use one of: ${ALL_CATS.map((c) => c.id).join(", ")}.` });
      }
      const minutes = cleanMinutes(input.minutes);
      const task = {
        id: uid(), title: input.title, cat: input.cat, minutes,
        est: estFor(minutes, data.settings.work), done: 0, checked: false,
        oneOnOne: false, dueDate: cleanDue(input.dueDate),
      };
      return withTasks([...data.tasks, task], { created: aiTask(task) });
    }

    case "update_task": {
      const t = findTask(input.taskId);
      if (!t) return same({ error: `No task with id ${input.taskId}. Call list_tasks for current ids.` });
      const hasSubs = (t.subtasks || []).length > 0;
      let next = { ...t, title: input.title ?? t.title };
      if (!hasSubs) {
        if (input.minutes !== undefined) {
          next.minutes = cleanMinutes(input.minutes);
          next.est = estFor(next.minutes, data.settings.work);
          next.done = Math.min(next.done, next.est);
        }
        if (input.dueDate !== undefined) next.dueDate = cleanDue(input.dueDate);
      }
      return withTasks(
        data.tasks.map((x) => (x.id === t.id ? next : x)),
        hasSubs && (input.minutes !== undefined || input.dueDate !== undefined)
          ? { task: aiTask(next), note: "Only the title changed — minutes and due date are derived from this task's subtasks." }
          : { task: aiTask(next) },
      );
    }

    case "delete_task": {
      const t = findTask(input.taskId);
      if (!t) return same({ error: `No task with id ${input.taskId}.` });
      return withTasks(data.tasks.filter((x) => x.id !== t.id), { deleted: t.title });
    }

    case "add_subtasks": {
      const t = findTask(input.taskId);
      if (!t) return same({ error: `No task with id ${input.taskId}. Call list_tasks for current ids.` });
      if (!Array.isArray(input.subtasks) || !input.subtasks.length) return same({ error: "subtasks must be a non-empty array." });
      const subs = input.subtasks.map((s) => ({
        id: uid(), title: s.title, minutes: cleanMinutes(s.minutes), checked: false, dueDate: cleanDue(s.dueDate),
      }));
      const next = deriveFromSubtasks({ ...t, subtasks: [...(t.subtasks || []), ...subs] }, data.settings.work);
      return withTasks(data.tasks.map((x) => (x.id === t.id ? next : x)), { task: aiTask(next) });
    }

    case "list_projects":
      return same({
        projects: data.projects.map((p) => ({
          id: p.id, name: p.name,
          phases: p.phases.map((ph) => ({ id: ph.id, name: ph.name, start: ph.start, end: ph.end, done: ph.done })),
        })),
      });

    case "create_project": {
      if (!input.name) return same({ error: "A project needs a name." });
      const { phases, rejected } = cleanPhases(input.phases);
      const proj = {
        id: uid(), name: input.name,
        color: PROJ_COLORS[data.projects.length % PROJ_COLORS.length],
        phases,
      };
      return {
        data: { ...data, projects: [...data.projects, proj] },
        result: { project: { id: proj.id, name: proj.name, phases: proj.phases.length }, rejected },
      };
    }

    case "add_phases": {
      const proj = data.projects.find((p) => p.id === input.projectId);
      if (!proj) return same({ error: `No project with id ${input.projectId}. Call list_projects for current ids.` });
      const { phases, rejected } = cleanPhases(input.phases);
      const next = { ...proj, phases: [...proj.phases, ...phases] };
      return {
        data: { ...data, projects: data.projects.map((p) => (p.id === proj.id ? next : p)) },
        result: { project: proj.name, added: phases.length, rejected },
      };
    }

    case "get_budget_summary": {
      const b = data.budget;
      const thisMonth = monthKey(new Date());
      const spent = (c) => c.items.filter((i) => (i.date || "").slice(0, 7) === thisMonth).reduce((s, i) => s + i.amount, 0);
      const catTotal = (c) => (c.type === "fixed" ? c.items.reduce((s, i) => s + i.amount, 0) : spent(c));
      const fixed = b.categories.filter((c) => c.type === "fixed");
      const fixedTotal = fixed.reduce((s, c) => s + catTotal(c), 0);
      const food = b.categories.find((c) => c.id === "food");
      const free = b.categories.find((c) => c.id === "free");
      const freeBudget = b.monthlyIncome - fixedTotal - food.budget;
      return same({
        month: thisMonth,
        monthlyIncome: b.monthlyIncome,
        fixed: fixed.map((c) => ({ name: c.name, total: catTotal(c), items: c.items.map((i) => ({ name: i.name, amount: i.amount })) })),
        food: { budget: food.budget, spent: spent(food), remaining: food.budget - spent(food) },
        free: { budget: freeBudget, spent: spent(free), remaining: freeBudget - spent(free) },
      });
    }

    default:
      return same({ error: `Unknown tool "${name}".` });
  }
}

// Label shown in the transcript for each tool call — the panel narrates what the
// assistant is doing to the planner rather than letting it edit things invisibly.
const TOOL_LABEL = {
  list_tasks: "Reading your tasks",
  create_task: "Adding a task",
  update_task: "Updating a task",
  delete_task: "Deleting a task",
  add_subtasks: "Breaking it into subtasks",
  list_projects: "Reading your projects",
  create_project: "Creating a project",
  add_phases: "Adding timeline phases",
  get_budget_summary: "Reading your budget",
};

// Tool names arrive from two directions: the IPC tool call carries our bare name
// (main.cjs relays it), while the streamed event carries the SDK's fully-qualified
// mcp__planner__* name. Unrecognised names (the SDK's own tool-search bookkeeping)
// render nothing rather than leaking internals into the transcript.
function toolLabel(name) {
  if (name === "WebSearch") return "Searching the web";
  return TOOL_LABEL[name.replace(/^mcp__planner__/, "")] || null;
}

function AiPanel({ dataRef, setData, onClose, label, width, setWidth }) {
  const [msgs, setMsgs] = useState([]); // rendered transcript: {role, text} | {role:"tool", label}
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const scrollRef = useRef(null);
  // The Agent SDK owns the conversation transcript; we only carry its session id
  // forward so each message continues the same thread instead of starting fresh.
  const sessionRef = useRef(null);
  const available = agentAvailable();

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy]);

  // Registered once. The executor reads dataRef, never a closed-over `data`, so
  // consecutive tool calls in one turn each see the previous one's writes.
  useEffect(() => onToolCall((name, input) => {
    const { data: next, result } = runPlannerTool(dataRef.current, name, input);
    if (next !== dataRef.current) {
      dataRef.current = next;
      setData(next);
    }
    return result;
  }), [dataRef, setData]);

  useEffect(() => onEvent((ev) => {
    if (ev.type === "text") setMsgs((m) => [...m, { role: "assistant", text: ev.text }]);
    if (ev.type === "error") setError(ev.message);
    if (ev.type === "tool") {
      const label = toolLabel(ev.name);
      if (label) setMsgs((m) => [...m, { role: "tool", label }]);
    }
  }), []);

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !available) return;
    setInput("");
    setError("");
    setMsgs((m) => [...m, { role: "user", text }]);
    setBusy(true);

    const res = await runQuery({
      prompt: text,
      sessionId: sessionRef.current,
      today: dateKey(new Date()),
    });

    if (res?.sessionId) sessionRef.current = res.sessionId;
    if (res?.error) setError(res.error);
    setBusy(false);
  };

  const clear = () => {
    cancelQuery();
    sessionRef.current = null; // start a genuinely new conversation, not a resumed one
    setMsgs([]);
    setError("");
    setBusy(false);
  };

  // Drag the left edge to resize. Listeners go on window, not the grip, so the
  // drag survives the pointer outrunning a fast mouse move.
  const startDrag = (e) => {
    e.preventDefault();
    setDragging(true);
    // also capped against the viewport so dragging can never squeeze the
    // planner itself down to nothing on a small window
    const cap = Math.min(AIW_MAX, Math.max(AIW_MIN, window.innerWidth - 380));
    const onMove = (ev) => setWidth(Math.min(cap, Math.max(AIW_MIN, window.innerWidth - ev.clientX)));
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <aside className="aipanel">
      <div className={`aigrip ${dragging ? "dragging" : ""}`} onMouseDown={startDrag}
        title="Drag to resize" role="separator" aria-orientation="vertical" />
      <div className="aihead">
        <span className="aititle">{label}</span>
        {msgs.length > 0 && <button className="btn ghost aimini" onClick={clear}>Clear</button>}
        <button className="btn ghost aimini" onClick={onClose} title="Close panel">✕</button>
      </div>

      <div className="aiscroll" ref={scrollRef}>
        {!available && (
          <div className="aiempty">
            <div className="sub">
              The {label.toLowerCase()} runs through the Claude Agent SDK in the desktop app's main
              process, so it isn't available in a browser tab. Start the app with <span className="mono">npm run electron:dev</span>,
              or use the installed desktop app.
            </div>
          </div>
        )}
        {available && msgs.length === 0 && (
          <div className="aiempty">
            <div className="sub">Ask me to change the planner, or anything else.</div>
            {[
              "Break my NSF personal statement task into subtasks",
              "Build a timeline for the Ford Foundation fellowship",
              "What's left in my food budget?",
            ].map((s) => (
              <button key={s} className="aisuggest" onClick={() => setInput(s)}>{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "tool" ? (
            <div className="aitool" key={i}>↳ {m.label}</div>
          ) : (
            <div className={`aimsg ${m.role}`} key={i}>{m.text}</div>
          )
        )}
        {busy && <div className="aitool aithinking">thinking…</div>}
        {error && <div className="aierror">{error}</div>}
      </div>

      <div className="aicompose">
        <textarea
          className="field aiinput" rows={5} placeholder={available ? "Ask or instruct…" : "Desktop app only"}
          value={input} disabled={!available}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        {busy
          ? <button className="btn" onClick={() => { cancelQuery(); setBusy(false); }}>Stop</button>
          : <button className="btn primary" onClick={send} disabled={!available || !input.trim()}>Send</button>}
      </div>
    </aside>
  );
}
