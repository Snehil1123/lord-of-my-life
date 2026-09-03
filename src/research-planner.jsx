import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  supabase, signUp, signIn, signOut, getSession, onAuthChange,
  fetchCloudData, pushCloudData, subscribeToCloudData,
  joinRoom, newRoomCode,
} from "./sync.js";
import { agentAvailable, onToolCall, onEvent, runQuery, cancelQuery } from "./ai.js";
import { calAvailable, calConfigured, calStatus, calConnect, calDisconnect, calFetch } from "./gcal.js";
import { updaterAvailable, checkForUpdate, runUpdate, downloadUpdate, installUpdate, onUpdateProgress } from "./update.js";

/* ============================================================
   LORD OF MY LIFE — one planner for the whole research pipeline
   Gantt Chart (big-picture timeline) · Work (Research / Fellowships /
   Classwork / TA) · Session (pomodoro focus) · Personal (everything else)
   ============================================================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Alegreya+SC:wght@400;700&family=Alegreya+Sans:wght@400;500;700&family=Alegreya:wght@400;500;700&family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Cinzel:wght@400;600;700;800&family=Courier+Prime:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Grenze+Gotisch:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Literata:opsz,wght@7..72,400..700&family=Marcellus&family=Space+Mono:wght@400;700&family=Spectral:wght@400;500;600;700&family=Uncial+Antiqua&family=Vollkorn:wght@400;600;700&display=swap');

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
  --font-display:'Uncial Antiqua',serif;
  --font-body:'Vollkorn',Georgia,serif;
  --font-mono:'Courier Prime',monospace;
  --radius:3px;
  font-size:18px;
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
/* EB Garamond has a much smaller x-height than Inter, so the same px reads noticeably
   smaller. These bumps are per-element because nearly every rule sets px directly —
   raising the root font-size alone would change almost nothing. */
/* Two scales, because the two font families don't compare at equal px: Space Mono
   has a far bigger apparent size than EB Garamond, so mono meta text set to the
   same value as prose ends up shouting over the title it annotates. Every mono
   run uses --fsz-mono and every prose run uses the body/meta pair. Adding a new
   text style means picking the scale by *font*, not by how small it looks. */
.fw[data-theme="fantasy"]{
  --fsz-body:18px; --fsz-meta:17px; --fsz-mono:14px;
}
.fw[data-theme="fantasy"] .tasktitle,
.fw[data-theme="fantasy"] .legendname,
.fw[data-theme="fantasy"] .budgetname-input,
.fw[data-theme="fantasy"] .pickitem,
.fw[data-theme="fantasy"] .aimsg{font-size:var(--fsz-body);}
.fw[data-theme="fantasy"] .sub,
.fw[data-theme="fantasy"] .emptystate,
.fw[data-theme="fantasy"] .gaugemeta,
.fw[data-theme="fantasy"] .btn,
.fw[data-theme="fantasy"] input,
.fw[data-theme="fantasy"] select,
.fw[data-theme="fantasy"] textarea,
.fw[data-theme="fantasy"] .qadd,
.fw[data-theme="fantasy"] .subtasktitle,
.fw[data-theme="fantasy"] .pickpath,
.fw[data-theme="fantasy"] .updpill,
.fw[data-theme="fantasy"] .updnote,
.fw[data-theme="fantasy"] .updwarn,
.fw[data-theme="fantasy"] .updsubject,
.fw[data-theme="fantasy"] .qparent,
.fw[data-theme="fantasy"] .presetlog{font-size:var(--fsz-meta);}
/* every mono run, so a row's annotations all match each other and sit below its title */
.fw[data-theme="fantasy"] .tagdue,
.fw[data-theme="fantasy"] .taskmin,
.fw[data-theme="fantasy"] .submeta .tagdue,
.fw[data-theme="fantasy"] .submeta .taskmin,
.fw[data-theme="fantasy"] .tag11,
.fw[data-theme="fantasy"] .pcount,
.fw[data-theme="fantasy"] .catcount,
.fw[data-theme="fantasy"] .subprogress,
.fw[data-theme="fantasy"] .picksub,
.fw[data-theme="fantasy"] .projmeta,
.fw[data-theme="fantasy"] .legendamt,
.fw[data-theme="fantasy"] .legendpct,
.fw[data-theme="fantasy"] .presetamt,
.fw[data-theme="fantasy"] .budgetamt-input,
.fw[data-theme="fantasy"] .budgetdollar,
.fw[data-theme="fantasy"] .gaugesub,
.fw[data-theme="fantasy"] .todaypomos,
.fw[data-theme="fantasy"] .aitool{font-size:var(--fsz-mono);}
.fw[data-theme="fantasy"] .archivetoggle{font-size:16px;}
.fw[data-theme="fantasy"] .catname{font-size:16.5px;}
.fw[data-theme="fantasy"] .tab{font-size:17.5px;}
.fw[data-theme="fantasy"] .h2{font-size:28px;}
.fw[data-theme="fantasy"] .projname{font-size:20px;}
.fw[data-theme="fantasy"] .gbar{font-size:14px;}
.fw[data-theme="fantasy"] .wkchip, .fw[data-theme="fantasy"] .gwk{font-size:var(--fsz-mono);}
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
/* a finished task is sealed with a glowing ember mark, not a green tick — the
   ✓ text node is collapsed with font-size:0 and the glyph comes from ::before */
.fw[data-theme="fantasy"] .check.on{
  background:radial-gradient(circle at 50% 36%, #f0cd6c 0%, #c08823 46%, #6d4310 100%);
  border-color:#e6c169; font-size:0;
  box-shadow:0 0 0 3px rgba(216,166,42,.18), 0 0 14px rgba(216,166,42,.55);
}
.fw[data-theme="fantasy"] .check.on::before{content:"✦"; font-size:12px; line-height:1; color:#2b1a06;}
.fw[data-theme="fantasy"] .check.small.on::before{font-size:9px;}
.fw[data-theme="fantasy"] .todayline{
  background:var(--amber); box-shadow:0 0 8px 1px var(--amber);
  animation:wardpulse 2.4s ease-in-out infinite;
}
.fw[data-theme="fantasy"] .todayflag{background:var(--amber); color:#241a10;}
@keyframes wardpulse{
  0%,100%{opacity:.7; box-shadow:0 0 6px 1px var(--amber);}
  50%{opacity:1; box-shadow:0 0 15px 3px var(--amber);}
}
.fw[data-theme="fantasy"] .pomocard.running{animation:runeglow 2.6s ease-in-out infinite;}
@keyframes runeglow{
  0%,100%{box-shadow:0 0 6px rgba(216,166,42,.2);}
  50%{box-shadow:0 0 20px 2px rgba(216,166,42,.5);}
}

/* ---------- fantasy ambience (forest, vines, motes) ----------
   All decorative and all fantasy-only. The scene sits behind the content and is
   pointer-events:none, so it can never swallow a click; every animation here is
   switched off by the global prefers-reduced-motion rule at the bottom. */
.fscene{position:fixed; inset:0; z-index:0; pointer-events:none; overflow:hidden;}
/* faded at the top so the treetops dissolve into the page instead of drawing a
   hard silhouette across whatever content happens to sit at that height */
.fforest{
  position:absolute; left:0; bottom:0; width:100%; height:36vh; min-height:180px;
  -webkit-mask-image:linear-gradient(to top, #000 30%, transparent 96%);
  mask-image:linear-gradient(to top, #000 30%, transparent 96%);
}
.fmote{
  position:absolute; bottom:-14px; border-radius:50%;
  background:radial-gradient(circle, rgba(255,247,214,1) 0%, rgba(250,216,132,.9) 34%, rgba(220,170,50,.42) 62%, rgba(216,166,42,0) 78%);
  box-shadow:0 0 9px rgba(244,206,116,.6);
  animation-name:motefloat; animation-timing-function:linear; animation-iteration-count:infinite;
}
@keyframes motefloat{
  0%{transform:translate3d(0,0,0); opacity:0;}
  14%{opacity:.9;}
  78%{opacity:.65;}
  100%{transform:translate3d(var(--drift), calc(-100vh - 40px), 0); opacity:0;}
}
/* Completing a task sets it alight; reopening one heals it back. Both are pure
   CSS on a class the row wears for the length of the animation, so in the dark
   theme these selectors don't match and the row just flips state as it always
   did. The particle burst is the dark theme's celebration — hidden here, since
   fire and confetti at the same time is a mess.
   (No backticks in this string: the whole CSS block is a JS template literal.) */
.fw[data-theme="fantasy"] .particle{display:none;}

/* A finished task stays burnt. This is the resting state, not part of the
   animation — it holds until the task is reopened. */
.fw[data-theme="fantasy"] .taskrow.done,
.fw[data-theme="fantasy"] .qrow.done{
  background:linear-gradient(180deg,#170e06 0%,#0a0503 100%);
  box-shadow:inset 0 0 26px rgba(0,0,0,.8), inset 0 -1px 0 rgba(214,118,38,.18);
  border-color:#2a1a0b;
}
/* readable against the char, but clearly spent — this is a finished task */
.fw[data-theme="fantasy"] .taskrow.done .tasktitle,
.fw[data-theme="fantasy"] .qrow.done .tasktitle{color:#8d7458; text-decoration-color:#a8681f;}
.fw[data-theme="fantasy"] .taskrow.done .taskmin,
.fw[data-theme="fantasy"] .taskrow.done .tagdue,
.fw[data-theme="fantasy"] .taskrow.done .pcount,
.fw[data-theme="fantasy"] .qrow.done .pcount{color:#5c4936;}

/* The burn: a sheet painted in the row's *normal* colour is wiped away left to
   right, uncovering the charred row underneath, with flame riding the wipe edge.
   Stacking matters — cover beneath the text (z 0), text above it (z 2), flame
   over everything (z 3) so it licks across the words rather than under them. */
.fw[data-theme="fantasy"] .taskrow.burning,
.fw[data-theme="fantasy"] .qrow.burning,
.fw[data-theme="fantasy"] .taskrow.healing,
.fw[data-theme="fantasy"] .qrow.healing{overflow:hidden;}
.fw[data-theme="fantasy"] .taskrow.burning > *,
.fw[data-theme="fantasy"] .qrow.burning > *,
.fw[data-theme="fantasy"] .taskrow.healing > *,
.fw[data-theme="fantasy"] .qrow.healing > *{position:relative; z-index:2;}
.fw[data-theme="fantasy"] .taskrow.burning::before,
.fw[data-theme="fantasy"] .qrow.burning::before{
  content:""; position:absolute; inset:0; z-index:0; pointer-events:none;
  background:var(--card); animation:charwipe 1.15s ease-in-out both;
}
@keyframes charwipe{
  0%{clip-path:inset(0 0 0 0);}
  100%{clip-path:inset(0 0 0 100%);}
}
.fw[data-theme="fantasy"] .taskrow.burning::after,
.fw[data-theme="fantasy"] .qrow.burning::after{
  content:""; position:absolute; top:-95%; bottom:-30%; left:-20%; width:36%;
  z-index:3; pointer-events:none; filter:blur(5px);
  background:
    radial-gradient(38% 46% at 20% 76%, rgba(255,238,178,.98), rgba(255,168,44,.85) 42%, rgba(206,58,12,.34) 68%, transparent 80%),
    radial-gradient(30% 62% at 45% 58%, rgba(255,224,132,.95), rgba(255,140,26,.74) 45%, transparent 78%),
    radial-gradient(26% 54% at 70% 68%, rgba(255,206,110,.9), rgba(232,110,20,.68) 45%, transparent 76%),
    radial-gradient(20% 40% at 88% 82%, rgba(255,182,82,.8), transparent 72%);
  animation:flamesweep 1.15s ease-in-out both, flicker .17s ease-in-out infinite;
}
@keyframes flamesweep{
  0%{transform:translateX(-45%);}
  100%{transform:translateX(330%);}
}
/* flicker changes opacity/blur, never transform — a second transform animation
   would simply override flamesweep's rather than compose with it */
@keyframes flicker{
  0%,100%{opacity:1; filter:blur(5px);}
  50%{opacity:.84; filter:blur(6.5px);}
}
/* The title only dims and gets struck through once the flame has passed. The
   from-values override .done's styling during the delay (backwards fill), so
   the task reads as intact right up to the moment it's spent. */
.fw[data-theme="fantasy"] .taskrow.burning .tasktitle,
.fw[data-theme="fantasy"] .qrow.burning .tasktitle{animation:charrtext .28s ease-out .92s both;}
@keyframes charrtext{
  from{color:var(--ink); text-decoration-color:transparent;}
  to{color:#8d7458; text-decoration-color:#a8681f;}
}

/* The heal is the same wipe in reverse: a charred sheet is pulled away to
   uncover the restored row, lit by a gold-green wisp instead of flame. */
.fw[data-theme="fantasy"] .taskrow.healing::before,
.fw[data-theme="fantasy"] .qrow.healing::before{
  content:""; position:absolute; inset:0; z-index:0; pointer-events:none;
  background:linear-gradient(180deg,#170e06 0%,#0a0503 100%);
  animation:charwipe 1s ease-in-out both;
}
.fw[data-theme="fantasy"] .taskrow.healing::after,
.fw[data-theme="fantasy"] .qrow.healing::after{
  content:""; position:absolute; top:-70%; bottom:-25%; left:-18%; width:32%;
  z-index:3; pointer-events:none; filter:blur(6px);
  background:
    radial-gradient(40% 52% at 38% 62%, rgba(226,255,206,.95), rgba(146,214,116,.72) 45%, transparent 78%),
    radial-gradient(28% 46% at 66% 54%, rgba(246,236,172,.88), rgba(196,222,126,.5) 50%, transparent 76%);
  animation:flamesweep 1s ease-in-out both, flicker .24s ease-in-out infinite;
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
/* the brand is the theme toggle — there's no separate button for it */
.brand{
  font-family:var(--font-display); font-weight:800; font-size:20px; letter-spacing:-0.02em;
  border:none; background:none; color:var(--ink); padding:0; text-align:left;
}
.brand em{font-style:normal; color:var(--pine);}
.brand:hover{filter:brightness(1.15);}
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
/* above .fscene, which is fixed at z-index 0 behind the content */
.wrap{max-width:1060px; margin:0 auto; padding:26px 22px 80px; position:relative; z-index:1;}
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
.gbar.overdue{box-shadow:inset 0 0 0 1px var(--tomato), 0 0 12px 0 var(--tomato);}
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
.catblock.dragging{opacity:.4;}
.cathead{display:flex; align-items:center; gap:8px; margin-bottom:8px;}
.cathead[draggable]{cursor:grab;}
.cathead[draggable]:active{cursor:grabbing;}
.catgrip{color:var(--line); font-size:13px; letter-spacing:-2px; user-select:none;}
.cathead:hover .catgrip{color:var(--muted);}
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
/* The pulse is an opacity animation on a glow layer, not an animated box-shadow.
   A shadow can't be composited: every frame repaints the element on the CPU and
   re-uploads it, 60 times a second, for as long as anything is overdue. Opacity
   is handled by the compositor and costs essentially nothing. Same look. */
.taskrow.overdue{border-radius:6px; box-shadow:inset 0 0 0 1px var(--tomato);}
.taskrow.overdue::after, .subtaskrow.overdue::after{
  content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
  box-shadow:0 0 16px 2px var(--tomato);
  animation:overduepulse 1.3s ease-in-out infinite;
}
@keyframes overduepulse{ 0%,100%{opacity:.28;} 50%{opacity:1;} }

/* Nothing decorative animates while the window is hidden or in the background.
   Chromium throttles background *tabs*, but a desktop window that is merely
   unfocused keeps compositing every frame, so ambience the user isn't looking at
   goes on costing GPU indefinitely. Everything here is decorative or transient;
   the timer is driven by an absolute end time, so pausing paint changes nothing
   about what it reports. */
.fw.idle *, .fw.idle *::before, .fw.idle *::after{ animation-play-state:paused !important; }
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
/* keep in step with .taskmin/.pcount — these three annotate the same row and
   reading at different sizes is exactly what makes a row look untidy */
.tagdue{font-family:var(--font-mono); font-size:12px; font-weight:600; flex:none;}
.tagsess{
  font-family:var(--font-mono); font-size:11px; font-weight:600; flex:none;
  background:var(--tomato-soft); color:var(--tomato); padding:1px 7px; border-radius:4px;
}
/* rows are drag handles for reordering; the cursor is the only affordance,
   since a grip on every row would be a lot of furniture */
.taskrow[draggable="true"], .qrow[draggable="true"]{cursor:grab;}
.taskrow[draggable="true"]:active, .qrow[draggable="true"]:active{cursor:grabbing;}
/* the row left behind while its snapshot follows the cursor */
.taskrow.dragging, .qrow.dragging{opacity:.28;}
/* insertion line on the edge the row will actually land on */
.taskrow.dragover-before, .qrow.dragover-before{box-shadow:inset 0 3px 0 var(--pine);}
.taskrow.dragover-after, .qrow.dragover-after{box-shadow:inset 0 -3px 0 var(--pine);}
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
.subtasks{background:var(--paper); border-bottom:1px solid var(--line-soft); padding:4px 12px 8px 40px;}
/* horizontal padding matters: the due-today/overdue glow is an inset ring on this
   row, so without it the highlight sits right on top of the checkbox and text */
.subtaskrow{display:flex; align-items:center; gap:10px; padding:6px 10px; margin:3px 0;}
.subtaskrow.done .subtasktitle{color:var(--muted); text-decoration:line-through; text-decoration-color:var(--pine);}
.subtaskrow.due-today{border-radius:6px; box-shadow:inset 0 0 0 1px var(--amber), 0 0 8px -3px var(--amber);}
.subtaskrow.overdue{border-radius:6px; position:relative; box-shadow:inset 0 0 0 1px var(--tomato);}
.subtaskrow.editing{gap:8px; flex-wrap:wrap;}
.subtasktitle{font-size:13.5px; flex:1; min-width:0;}
/* one shared baseline for "due …" and "N min" so they line up down the column */
.submeta{display:flex; align-items:center; gap:12px; flex:none;}
.submeta .tagdue, .submeta .taskmin{font-size:11.5px; line-height:1; margin:0;}
.submeta .taskmin{min-width:50px; text-align:right;}
.check.small{width:17px; height:17px; font-size:10px; flex:none;}
.subaddrow{padding:6px 0 2px; border-top:none; background:none;}

/* ---------- focus / session ---------- */
.focuswrap{max-width:480px; margin:0 auto; padding-top:8px;}
/* widened only once someone else is in the session, so a solo session keeps its
   narrow, centred column */
.focuswrap.multi{max-width:1000px;}
.qcols{display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap;}
.qcol{flex:1 1 300px; min-width:0;}
.guestname{
  border:1px solid transparent; background:none; border-radius:6px; padding:2px 6px;
  font-family:var(--font-display); font-weight:700; font-size:18px; color:var(--ink);
  min-width:0; flex:1;
}
.guestname:hover{border-color:var(--line-soft);}
.guestname:focus{border-color:var(--pine); outline:none; background:var(--paper);}
.qpeople{display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:18px;}
.qaddperson{
  border:1px solid var(--line); background:var(--card); border-radius:999px;
  padding:7px 16px; font-size:13.5px; font-weight:600; color:var(--muted);
}
.qaddperson:hover{border-color:var(--muted); color:var(--ink);}
.roomcode{
  font-family:var(--font-mono); font-size:16px; font-weight:700; letter-spacing:.22em;
  color:var(--amber); background:var(--paper); border:1px solid var(--line);
  border-radius:8px; padding:5px 10px 5px 14px;
}
.roomstatus{font-size:13px; color:var(--muted);}
.roomjoin{width:150px; font-family:var(--font-mono); letter-spacing:.14em; text-transform:uppercase;}
.roomname{width:130px;}
.pomofollow{font-size:13px; color:var(--muted); padding:14px 0 2px;}
/* someone else's row: theirs to tick off, not yours */
.qrow.readonly{cursor:default;}
.qrow.readonly .check{border-style:dashed;}
.qnow{
  font-family:var(--font-mono); font-size:11px; font-weight:600; flex:none;
  background:var(--pine-soft); color:var(--pine); padding:1px 7px; border-radius:4px;
}
.pomocard{
  position:relative; overflow:hidden; border-radius:16px; padding:16px 20px 26px;
  text-align:center; background:var(--tomato-soft); border:1px solid var(--line);
  transition:background .45s ease;
}
.pomocard.brk{background:var(--pine-soft);}
.pomoprog{position:absolute; top:0; left:0; height:3px; background:var(--tomato); transition:width .3s linear;}
.pomocard.brk .pomoprog{background:var(--pine);}
.pomotabs{display:inline-flex; gap:4px; margin-bottom:10px;}
.pomotab{
  border:none; background:none; border-radius:999px; padding:5px 14px;
  font-size:13.5px; font-weight:600; color:var(--muted);
}
.pomotab:hover{color:var(--ink);}
.pomotab.on{background:rgba(255,255,255,.13); color:var(--ink);}
.pomodigits{
  font-family:var(--font-mono); font-size:74px; font-weight:600; line-height:1.08;
  letter-spacing:-0.03em; font-variant-numeric:tabular-nums;
}
.pomostart{
  margin-top:12px; border:none; border-radius:10px; padding:12px 44px;
  font-size:17px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;
  background:var(--ink); color:var(--card); box-shadow:0 5px 0 rgba(0,0,0,.28);
}
.pomostart:active{transform:translateY(3px); box-shadow:0 2px 0 rgba(0,0,0,.28);}
.pomoreset{border:none; background:none; color:var(--muted); font-size:13px; margin-left:10px;}
.pomoreset:hover{color:var(--ink);}
.pomonow{text-align:center; margin:14px 0 4px; color:var(--muted); font-size:13.5px;}
.pomonow strong{display:block; color:var(--ink); font-size:16px; font-weight:600; margin-top:2px;}
.qhead{display:flex; align-items:center; gap:8px; margin:20px 0 8px; border-bottom:1px solid var(--line); padding-bottom:8px;}
.qhead .h2{font-size:18px;}
.qrow{
  display:flex; align-items:center; gap:10px; padding:11px 13px; margin-bottom:8px;
  background:var(--card); border:1px solid var(--line); border-left:5px solid var(--line);
  border-radius:8px; position:relative; cursor:pointer;
}
.qrow:hover{border-color:var(--muted);}
.qrow.active{border-left-color:var(--tomato);}
.qrow.done .tasktitle{color:var(--muted); text-decoration:line-through; text-decoration-color:var(--pine);}
.qrow:hover .xbtn{opacity:1;}
/* sits directly under its .qrow, which carries the 8px gap below itself */
.qsubtasks{
  background:var(--paper); border:1px solid var(--line); border-radius:8px;
  margin:-4px 0 8px; padding:4px 12px 6px 30px;
}
.qadd{
  width:100%; border:2px dashed var(--line); background:none; border-radius:8px;
  padding:13px; font-size:14.5px; font-weight:600; color:var(--muted);
}
.qadd:hover{border-color:var(--muted); color:var(--ink);}
.pickpanel{border:1px solid var(--line); border-radius:8px; background:var(--card); padding:8px; margin-bottom:8px; max-height:320px; overflow-y:auto;}
.pickgroup{font-family:var(--font-display); font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:.08em; padding:8px 6px 4px;}
.pickcat{font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; padding:6px 6px 3px;}
.pickitem{
  display:flex; width:100%; gap:8px; align-items:center; text-align:left;
  border:none; background:none; border-radius:6px; padding:7px 8px; font-size:14px; color:var(--ink);
}
.pickitem:hover{background:var(--paper);}
.pickitem:disabled{opacity:.38;}
.pickitem:disabled:hover{background:none;}
.pickchev{color:var(--muted); flex:none;}
.pickcrumb{display:flex; align-items:center; gap:8px; padding:0 2px 8px; border-bottom:1px solid var(--line); margin-bottom:4px;}
.pickpath{font-size:12.5px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.picksub{font-family:var(--font-mono); font-size:11.5px; color:var(--muted); flex:none;}
.qparent{color:var(--muted); font-size:12px;}
/* ---------- settings ---------- */
.setwrap{
  position:fixed; inset:0; z-index:60; background:rgba(0,0,0,.5);
  display:flex; justify-content:center; align-items:flex-start; padding:6vh 16px 24px;
  overflow-y:auto;
}
.setpanel{
  width:100%; max-width:520px; background:var(--card); color:var(--ink);
  border:1px solid var(--line); border-radius:var(--radius);
  box-shadow:0 24px 60px rgba(0,0,0,.5); padding:20px 22px 24px;
}
.sethead{display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;}
.setgroup{padding:16px 0; border-top:1px solid var(--line-soft);}
.setlabel{
  font-family:var(--font-display); font-weight:700; font-size:13px;
  text-transform:uppercase; letter-spacing:.08em; color:var(--muted);
}
.sethint{margin:6px 0 0; font-size:13px; color:var(--muted); line-height:1.5;}
.setchips{display:flex; flex-wrap:wrap; gap:7px; margin-top:10px;}
.setchip{
  border:1px solid var(--line); background:none; color:var(--muted);
  border-radius:999px; padding:5px 13px; font-size:13.5px; font-weight:600;
}
.setchip:hover{color:var(--ink); border-color:var(--muted);}
.setchip.on{background:var(--pine); border-color:var(--pine); color:#fff;}
.setfonts{display:grid; gap:8px; margin-top:10px;}
.setfont{
  display:grid; gap:2px; text-align:left; width:100%;
  border:1px solid var(--line); background:none; color:var(--ink);
  border-radius:var(--radius); padding:9px 12px;
}
.setfont:hover{border-color:var(--muted);}
.setfont.on{border-color:var(--pine); background:var(--pine-soft);}
.setfontname{font-size:17px; line-height:1.2;}
.setfontsample{font-size:15px; color:var(--muted); line-height:1.3;}
.setfontnote{
  font-family:var(--font-mono); font-size:11px; color:var(--dim,var(--muted)); opacity:.8;
}
.updwrap{position:relative;}
.updpill{
  display:flex; align-items:center; gap:6px; border:1px solid var(--pine);
  background:var(--pine); color:#fff; border-radius:999px; padding:5px 12px;
  font-size:13px; font-weight:600;
}
.updpill:hover{filter:brightness(1.08);}
.updpanel{
  position:absolute; right:0; top:calc(100% + 8px); z-index:20; width:290px;
  border:1px solid var(--line); border-radius:var(--radius); background:var(--card);
  padding:12px; box-shadow:0 12px 32px rgba(0,0,0,.35);
}
.updhead{font-family:var(--font-display); font-weight:700; font-size:14px;}
.updsubject{font-size:12.5px; color:var(--muted); margin-top:4px;}
.updnote{font-size:12.5px; color:var(--muted); margin-top:8px; line-height:1.45;}
.updwarn{font-size:12.5px; color:var(--amber); margin-top:8px; line-height:1.45;}
.archivebox{margin-top:22px;}
.archivetoggle{
  display:flex; align-items:center; gap:8px; width:100%; background:none; border:none;
  padding:6px 2px; color:var(--muted); font-family:var(--font-display); font-weight:700;
  font-size:13px; text-transform:uppercase; letter-spacing:.08em;
}
.archivetoggle:hover{color:var(--ink);}
.archrow{
  display:flex; align-items:center; gap:10px; padding:9px 14px;
  border-bottom:1px solid var(--line); color:var(--muted);
}
.archrow:last-child{border-bottom:none;}
.archrow .tasktitle{text-decoration:line-through; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.qfoot{
  margin-top:16px; border-top:1px solid var(--line); padding-top:14px;
  display:flex; gap:22px; justify-content:center; flex-wrap:wrap;
  font-size:13.5px; color:var(--muted);
}
.qfoot b{font-family:var(--font-mono); color:var(--ink); font-size:15px; font-weight:600;}
.durs{display:flex; gap:14px; margin-top:20px; align-items:center; justify-content:center; color:var(--muted); font-size:13px;}
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
.presets{display:flex; flex-wrap:wrap; gap:6px; padding:6px 16px 10px;}
.preset{display:inline-flex; align-items:center; border:1px solid var(--line); background:var(--paper); border-radius:999px;}
.preset:hover{border-color:var(--pine);}
.presetlog{border:none; background:none; border-radius:999px; padding:6px 4px 6px 12px; font-size:13px; font-weight:500; color:var(--ink); display:flex; gap:7px; align-items:center;}
.presetamt{font-family:var(--font-mono); font-size:12px; color:var(--muted);}
.preset .xbtn{padding:2px 8px 2px 2px; font-size:12px;}
.preset:hover .xbtn{opacity:1;}
.presetadd{border:1px dashed var(--line); background:none; border-radius:999px; padding:6px 12px; font-size:13px; color:var(--muted);}
.presetadd:hover{border-color:var(--muted); color:var(--ink);}
.presetform{display:flex; gap:6px; align-items:center; flex-wrap:wrap; padding:2px 16px 10px;}
.presetform input{padding:5px 8px; font-size:13px;}

/* ---------- calendar ---------- */
.calnav{display:flex; gap:6px;}
.calcard{margin-top:14px; overflow:hidden;}
.calgrid{display:flex; overflow-x:auto;}
.calgutterwrap{flex:none;}
.calheadspacer{height:46px;}
.calgutter{flex:none; width:52px;}
.calhour{
  height:44px; font-family:var(--font-mono); font-size:11px; color:var(--muted);
  text-align:right; padding-right:6px; transform:translateY(-6px);
}
.calday{flex:1 1 0; min-width:104px; border-left:1px solid var(--line-soft);}
.caldayhead{
  height:26px; display:flex; align-items:center; justify-content:center; gap:5px;
  font-size:12.5px; color:var(--muted); border-bottom:1px solid var(--line-soft);
}
.caldayhead.istoday{color:var(--tomato);}
.calalldays{min-height:20px; padding:2px 3px; display:flex; flex-direction:column; gap:2px; border-bottom:1px solid var(--line-soft);}
.calduechip{
  font-size:10.5px; color:#fff; border-radius:3px; padding:1px 5px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
/* the hour rows are the click target for adding an event */
.calslots{position:relative; cursor:copy;}
.calslot{height:44px; border-bottom:1px solid var(--line-soft);}
.calevent{
  position:absolute; left:2px; right:2px; z-index:2; overflow:hidden;
  background:var(--slate); color:#fff; border-radius:5px; padding:2px 5px;
  font-size:11.5px; line-height:1.25; cursor:default;
  display:flex; flex-direction:column; min-height:16px;
}
/* Both lines refuse to wrap or shrink. A long meta line ("11:00-11:45 - Classwork")
   otherwise wrapped to two lines inside a flex column and squeezed the title down
   to four pixels, which read as an event with no name at all. */
.caleventtitle{font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:none;}
.caleventtime{
  font-family:var(--font-mono); font-size:10px; opacity:.85; flex:none;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
/* A short booking has no room to stack two lines: an hour is one 44px slot, so a
   quarter of an hour is 11px and the title alone is 14px before padding. Below
   the height two lines need, the time moves alongside the title instead of under
   it, which is the difference between a legible event and a clipped smear. */
.calevent.short{
  flex-direction:row; align-items:center; gap:6px;
  min-height:18px; padding:1px 5px 1px 5px; padding-right:14px;
}
.calevent.short .caleventtitle{flex:1; min-width:0;}
.calevent.short .caleventtime{flex:none; font-size:9.5px; white-space:nowrap;}
.calevent .xbtn{position:absolute; top:0; right:0; color:#fff;}
.calevent:hover .xbtn{opacity:1;}
/* planned session work: outlined so a real booking always reads as more solid */
.calplan{
  position:absolute; left:2px; right:2px; z-index:1; border-radius:5px; overflow:hidden;
  border:1px dashed var(--tomato); background:var(--tomato-soft);
}
.calplan.break{border-color:var(--line); background:transparent;}
.calplantxt{
  display:block; font-size:11px; color:var(--ink); padding:1px 5px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
/* pulled from elsewhere, so it reads as a mirror rather than something you own */
.calevent.fromgoogle{border-left:3px solid rgba(255,255,255,.5);}
.calduechip.allday{background:var(--teal);}
.gcalchip{
  display:inline-flex; align-items:center; gap:6px; font-size:13px; color:var(--muted);
  border:1px solid var(--line); border-radius:999px; padding:3px 6px 3px 12px; background:var(--card);
}
.gcaldot{width:7px; height:7px; border-radius:50%; background:var(--teal);}
.calnow{position:absolute; left:0; right:0; height:2px; background:var(--tomato); z-index:3;}
.calnowdot{position:absolute; left:-3px; top:-3px; width:8px; height:8px; border-radius:50%; background:var(--tomato);}
/* an event the session plan has to wait for, shown inline in the queue */
.qevent{
  display:flex; align-items:center; gap:9px; padding:8px 12px; margin-bottom:8px;
  border-radius:8px; border:1px dashed var(--slate); background:var(--paper);
}
.qeventtime{font-family:var(--font-mono); font-size:11.5px; color:var(--slate); flex:none;}
.qeventtitle{font-size:14px; font-weight:600;}
.qeventnote{margin-left:auto; font-size:11.5px; color:var(--muted); flex:none;}
/* interrupts the task above rather than preceding it — indented to show that */
.qevent.during{margin-left:22px; border-style:dotted; margin-top:-4px;}
/* ---------- calendar side panel ---------- */
.fw.calopen{padding-left:var(--calw);}
.calpanel{
  position:fixed; top:0; left:0; bottom:0; width:var(--calw); z-index:40;
  display:flex; flex-direction:column;
  background:var(--card); border-right:1px solid var(--line);
}
.calgrip{
  position:absolute; right:-3px; top:0; bottom:0; width:7px; z-index:41;
  cursor:col-resize; background:transparent; border:none; padding:0;
}
.calgrip:hover, .calgrip.dragging{background:var(--pine); opacity:.5;}
.calpanelscroll{flex:1; overflow-y:auto; padding:0 10px 14px;}
.calpanelday{display:flex;}
.calpanelday .calday{flex:1; min-width:0; border-left:1px solid var(--line-soft);}

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
  .pomodigits{font-size:56px;}
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
/* ---------------- calendar time helpers ----------------
   An event is a local wall-clock thing: { date: "YYYY-MM-DD", start: "HH:MM" }.
   Same reasoning as dateKey — never store or compare these as UTC instants, or
   a 9am meeting drifts a day for anyone west of UTC. */
const timeToMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const minToTime = (n) => `${String(Math.floor(n / 60) % 24).padStart(2, "0")}:${String(Math.round(n) % 60).padStart(2, "0")}`;
const atTime = (dateStr, timeStr) => new Date(`${dateStr}T${timeStr}:00`);
/* ---------------- sync bookkeeping ----------------
   Per-device, and deliberately not inside `data` — it describes this machine's
   relationship with the cloud row, not the planner.

   `base` is the updated_at of the cloud row this device last agreed with, and
   `dirty` says we hold edits the server has not acknowledged. Together they
   answer the only question that matters on reconnect, without ever comparing two
   machines' clocks: if the row still reads `base`, nothing else has touched it
   and our edits are simply newer, so they go up. If it has moved on and we are
   dirty, both sides changed and the user gets to choose. */
const SYNC_KEY = "lordofmylife:sync";
const loadSync = () => {
  try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || { base: null, dirty: false }; }
  catch (e) { return { base: null, dirty: false }; }
};
const saveSync = (v) => {
  try { localStorage.setItem(SYNC_KEY, JSON.stringify(v)); } catch (e) { /* unavailable */ }
};

/* The whole reconnect decision, as a pure function, because it is the piece that
   loses people's work when it is wrong and it must be testable without a network:

     push — the cloud has nothing, or has not moved since we last agreed, so our
            edits are the only new ones. This is the offline case.
     pull — we hold nothing unsynced, so the cloud is authoritative.
     ask  — both sides moved. Unguessable, so the user decides and nothing is
            touched until they do.

   Note what is absent: any comparison of timestamps between machines. Two
   devices' clocks disagree, and a device whose clock is behind would otherwise
   lose every edit it made. */
function syncPlan({ row, base, dirty }) {
  if (!row) return "push";
  if (!dirty) return "pull";
  return row.updated_at === base ? "push" : "ask";
}

/* What actually differs, in the terms the user thinks in. Compared by id so a
   reordered array doesn't read as a change. */
const COLLECTIONS = [["tasks", "tasks"], ["events", "calendar events"], ["projects", "projects"], ["archive", "archived tasks"]];
function diffData(mine, theirs) {
  const out = [];
  for (const [key, label] of COLLECTIONS) {
    const a = mine?.[key] || [], b = theirs?.[key] || [];
    const bIds = new Set(b.map((x) => x.id)), aIds = new Set(a.map((x) => x.id));
    const onlyMine = a.filter((x) => !bIds.has(x.id));
    const onlyTheirs = b.filter((x) => !aIds.has(x.id));
    if (onlyMine.length || onlyTheirs.length) {
      out.push({ label, onlyMine, onlyTheirs });
    }
  }
  return out;
}

/* ---------------- user settings ----------------
   Everything the gear controls. All of it is read through a helper with a
   default, so data saved before any given setting existed needs no migration.
   These live in `data.settings` rather than localStorage because they describe
   the planner rather than the machine — the exception is `theme`, which stays
   per-device for the reasons in CLAUDE.md. */
const ALL_VIEWS = [
  ["work", "Work"], ["personal", "Personal"], ["calendar", "Calendar"],
  ["gantt", "Gantt Chart"], ["budget", "Budget"], ["session", "Session"],
];
const TEXT_SIZES = { small: 0.9, medium: 1, large: 1.14 };
const FANTASY_FONTS = {
  uncial: { name: "Uncial Antiqua & Vollkorn", note: "medieval manuscript",
    display: "'Uncial Antiqua',serif", body: "'Vollkorn',Georgia,serif", mono: "'Courier Prime',monospace" },
  grenze: { name: "Grenze Gotisch & Alegreya Sans", note: "clearest to read",
    display: "'Grenze Gotisch',serif", body: "'Alegreya Sans',system-ui,sans-serif", mono: "'IBM Plex Mono',monospace" },
  marcellus: { name: "Marcellus & Spectral", note: "roman, screen-drawn",
    display: "'Marcellus',serif", body: "'Spectral',Georgia,serif", mono: "'IBM Plex Mono',monospace" },
  literata: { name: "Cinzel & Literata", note: "bookish",
    display: "'Cinzel',serif", body: "'Literata',Georgia,serif", mono: "'IBM Plex Mono',monospace" },
  alegreya: { name: "Alegreya", note: "one family throughout",
    display: "'Alegreya SC',serif", body: "'Alegreya',Georgia,serif", mono: "'IBM Plex Mono',monospace" },
  cinzel: { name: "Cinzel & EB Garamond", note: "the original",
    display: "'Cinzel',serif", body: "'EB Garamond',Georgia,serif", mono: "'Space Mono',monospace" },
};
// never leave the header with nothing in it
const visibleViews = (data) => {
  const chosen = data.settings.tabs;
  const list = ALL_VIEWS.filter(([k]) => !chosen || chosen.includes(k));
  return list.length ? list : ALL_VIEWS;
};
const textScale = (data) => TEXT_SIZES[data.settings.textSize] || 1;
const fantasyFont = (data) => FANTASY_FONTS[data.settings.fantasyFont] || FANTASY_FONTS.uncial;

/* Two settings are read by plain helpers rather than passed down as props: the
   clock format, wanted by half a dozen components at every depth, and the sound
   switch, wanted by `tone()` which is not a component at all. They mirror
   `data.settings` from an effect. Safe because nothing can change either one
   without also changing `data`, so the render that follows already sees the new
   value — but they are display-only, and nothing may branch on them for state. */
let CLOCK_24 = false;
let SOUND_ON = true;

const fmtClock = (d) => d.toLocaleTimeString(undefined,
  CLOCK_24 ? { hour: "2-digit", minute: "2-digit", hour12: false } : { hour: "numeric", minute: "2-digit" });
// "HH:MM" as stored, rendered the way the user asked to see it
const fmtHM = (hm) => {
  if (CLOCK_24) return hm;
  const [h, m] = hm.split(":").map(Number);
  const ampm = h < 12 ? "am" : "pm";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}${ampm}`;
};
const fmtMin = (n) => fmtHM(minToTime(n));
// the slice of the day the week grid draws; events outside it are clamped in
const DAY_START = 7 * 60, DAY_END = 22 * 60;
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
  if (!SOUND_ON) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = (window.__fwAudio = window.__fwAudio || new Ctx());
    // a context created before the first gesture starts suspended, and stays
    // that way silently — every later sound is lost unless it's woken up
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
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
// dark: a plain two-note ding, the sound a kitchen timer makes
const chime = () => { tone(520, 520, 0.4, 0.1); setTimeout(() => tone(780, 780, 0.55, 0.1), 180); };
/* fantasy: the same event, rung rather than beeped — a fifth-and-octave stack
   entering in sequence, each partial quieter and longer than the last, so it
   blooms and decays instead of stopping. Same theme-conditional pattern as
   sessionEmoji and assistantLabel. */
const shimmer = () => {
  [[392, 0, 1.1], [588, 200, 1.3], [784, 430, 1.6], [1176, 700, 1.9]]
    .forEach(([freq, delay, dur]) => setTimeout(() => tone(freq, freq, dur, 0.05), delay));
};
const endSound = (theme) => (theme === "fantasy" ? shimmer : chime)();

/* Breaks are opt-out, read as "not explicitly false" so saved data that predates
   the setting keeps taking them and needs no migration. */
const breaksOn = (settings) => settings.breaks !== false;
const takesBreaks = (data) => breaksOn(data.settings);

/* ---------------- default data ---------------- */
/* Categories live in `data.categories` so the user can add their own. These are only
   the seed values — never read them directly outside defaultCategories()/seeding.
   Read the live list with allCats(data) / catsIn(data, group) instead. */
const CAT_SEED = [
  { id: "research", name: "Research", color: "var(--pine)", group: "work" },
  { id: "fellowships", name: "Fellowships", color: "var(--amber)", group: "work" },
  { id: "classwork", name: "Classwork", color: "var(--slate)", group: "work" },
  { id: "ta", name: "TA", color: "var(--plum)", group: "work" },
  { id: "exercise", name: "Exercise", color: "var(--pine)", group: "personal" },
  { id: "music", name: "Music", color: "var(--plum)", group: "personal" },
  { id: "other", name: "Other", color: "var(--slate)", group: "personal" },
];
const CAT_COLORS = ["var(--pine)", "var(--amber)", "var(--slate)", "var(--plum)", "var(--teal)", "var(--tomato)"];
const defaultCategories = () => CAT_SEED.map((c) => ({ ...c }));

const allCats = (data) => data.categories || CAT_SEED;
const catsIn = (data, group) => allCats(data).filter((c) => c.group === group);
const catColorFor = (cats, catId) => cats.find((c) => c.id === catId)?.color || "var(--slate)";
// readable ids (the AI sees them), de-duped against what's already there
const catIdFor = (name, cats) => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cat";
  return cats.some((c) => c.id === base) ? `${base}-${uid().slice(0, 4)}` : base;
};
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
function ensureCatSeed(data) {
  if (data.categories) return data;
  return { ...data, categories: defaultCategories() };
}

function sampleData() {
  const m0 = monday(new Date());
  const iso = (d) => d.toISOString().slice(0, 10);
  return {
    settings: { work: 25, short: 5, long: 15 },
    pomoLog: {},
    sessionQueue: [],
    seededRecurring: true,
    categories: defaultCategories(),
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

/* On a new day, work finished on an earlier day stops cluttering today's lists:
   completed tasks move to data.archive, and anything already done drops out of
   the session queue.

   Gated on data.lastRollover rather than on each task's own completedDate, so it
   sweeps exactly once per day. Per-item dating would be wrong twice over: a
   cloud pull at noon would strip what you finished this morning, and a queued
   *subtask* records no completion date at all, so there'd be nothing to test it
   against. Once a day, "still checked" is enough — it can only be older work.

   Only whole tasks archive. A task with some subtasks ticked isn't itself
   checked (deriveFromSubtasks sees to that), so it stays put and keeps every
   subtask, finished ones included. Recurring habits are excluded outright rather
   than by ordering: archiving one would quietly delete the habit. */
function archiveFinished(data) {
  const today = dateKey(new Date());
  if (data.lastRollover === today) return data;

  // completedDate is still checked, for the app left running across midnight:
  // the sweep fires minutes into the new day and must not take something ticked
  // off just after it. A legacy task with no date at all reads as older work.
  const stale = (t) => t.checked && !t.recurring && t.completedDate !== today;
  const going = data.tasks.filter(stale);
  const queue = data.sessionQueue || [];
  const keep = queue.filter((qid) => {
    const q = resolveQueued(qid, data.tasks, data.settings.work);
    if (!q) return false;
    if (!q.item.checked) return true;
    return !q.sub && q.task.completedDate === today;
  });
  return {
    ...data,
    lastRollover: today,
    tasks: data.tasks.filter((t) => !stale(t)),
    archive: [...(data.archive || []), ...going],
    sessionQueue: keep,
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

// Backfills missing fields (recurring seeds, budget) and reopens recurring tasks.
// Applied to local loads AND cloud pulls — a cloud row can predate a field that was
// added after sync already existed, so this can't just run once on initial load.
// resetRecurringTasks runs first so a habit is already reopened, and unchecked,
// by the time the sweep looks at it.
function hydrate(d) {
  return archiveFinished(resetRecurringTasks(ensureCatSeed(ensureBudgetSeed(ensureRecurringSeeds(d)))));
}

// Assistant panel width — a per-device UI preference like the theme, not synced data.
const AIW_KEY = "lordofmylife:aiwidth";
const AIW_MIN = 300, AIW_MAX = 860;
const CALW_KEY = "lordofmylife:calwidth";
const CALW_MIN = 220, CALW_MAX = 480;

const THEME_KEY = "lordofmylife:theme";
const THEMES = { dark: "fantasy", fantasy: "dark" }; // maps a theme to "what toggling gives you"

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
  const [calOpen, setCalOpen] = useState(false);
  const gcalState = useGoogleCalendar(now);
  const [calWidth, setCalWidth] = useState(() => {
    const n = Number(localStorage.getItem(CALW_KEY));
    return n >= CALW_MIN && n <= CALW_MAX ? n : 280;
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

  const [settingsOpen, setSettingsOpen] = useState(false);
  /* Mirror the two display-only settings the plain helpers read. Effects rather
     than props because fmtClock and tone() are reached from everywhere, and
     neither can change without `data` changing too. */
  useEffect(() => { CLOCK_24 = !!data.settings.clock24; }, [data.settings.clock24]);
  useEffect(() => { SOUND_ON = data.settings.sounds !== false; }, [data.settings.sounds]);

  const views = visibleViews(data);
  // hiding the tab you're standing on shouldn't leave a blank page
  useEffect(() => {
    if (!views.some(([k]) => k === view)) setView(views[0][0]);
  }, [views, view]);

  // see the .fw.idle rule: decoration stops when the window isn't being looked at
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const update = () => setIdle(document.hidden || !document.hasFocus());
    update();
    const events = ["visibilitychange", "focus", "blur"];
    events.forEach((e) => window.addEventListener(e, update, true));
    document.addEventListener("visibilitychange", update);
    return () => {
      events.forEach((e) => window.removeEventListener(e, update, true));
      document.removeEventListener("visibilitychange", update);
    };
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
    const check = () => setData((d) => archiveFinished(resetRecurringTasks(d)));
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
  useEffect(() => {
    try { localStorage.setItem(CALW_KEY, String(calWidth)); } catch (e) { /* storage full or unavailable */ }
  }, [calWidth]);

  // held here, not in SessionView, so the countdown survives switching tabs
  const timer = usePomodoro(data, setData, dataRef, theme);
  const authEmail = useAuthEmail();
  const roomQueue = useMemo(
    () => queueItems(data.sessionQueue, data.tasks, data.settings.work).map((q) => q.item),
    [data.sessionQueue, data.tasks, data.settings.work],
  );
  const session = useSessionRoom({
    defaultName: authEmail ? authEmail.split("@")[0] : "",
    myTasks: roomQueue,
    timer,
  });
  // Your own events and anything pulled from Google, in one list — everything
  // downstream (grid, panel, plan) treats them the same, except that Google
  // events can't be edited here and all-day ones don't block time.
  const allEvents = useMemo(
    () => [...(data.events || []), ...gcalState.events],
    [data.events, gcalState.events],
  );
  // One plan drives the calendar blocks, the left panel's agenda and the event
  // dividers in the Session list, so the three can never disagree.
  const plan = useMemo(
    () => planSession(
      roomQueue,
      // all-day events don't block time, and a dismissed one is being treated
      // as not really booked — neither should push the plan around
      allEvents.filter((e) => !e.allDay && !(data.ignoredEvents || []).includes(e.id)),
      data.settings, timer.cycle, now, takesBreaks(data),
    ),
    [roomQueue, allEvents, data.settings, data.ignoredEvents, timer.cycle, now],
  );

  const sessionEmoji = theme === "fantasy" ? "🕯️" : "🍅";
  const assistantLabel = theme === "fantasy" ? "Wizard" : "Assistant";
  const todayPomos = data.pomoLog[dateKey(new Date())] || 0;

  return (
    <div className={`fw ${idle ? "idle" : ""} ${aiOpen ? "aiopen" : ""} ${calOpen && view !== "calendar" ? "calopen" : ""}`}
      data-theme={theme}
      style={{
        "--aiw": `${aiWidth}px`, "--calw": `${calWidth}px`,
        zoom: textScale(data),
        ...(theme === "fantasy" ? {
          "--font-display": fantasyFont(data).display,
          "--font-body": fantasyFont(data).body,
          "--font-mono": fantasyFont(data).mono,
        } : {}),
      }}>
      <style>{CSS}</style>
      {theme === "fantasy" && <FantasyScene />}
      <header className="hd">
        <button className="brand" title={`Switch to the ${THEMES[theme]} theme`} onClick={() => setTheme(THEMES[theme])}>
          Lord of <em>my Life</em>
        </button>
        <span className="wkchip">{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
        {todayPomos > 0 && <span className="todaypomos">{sessionEmoji} ×{todayPomos} today</span>}
        <nav className="tabs">
          {views.map(([k, label]) => (
            <button key={k} className={`tab ${view === k ? "on" : ""}`} onClick={() => setView(k)}>{label}</button>
          ))}
        </nav>
        {view !== "calendar" && !calOpen && (
          <button className="btn ghost" title="Show today's calendar" onClick={() => setCalOpen(true)}>▤ Today</button>
        )}
        {!aiOpen && <button className="btn ghost" title={`Open the ${assistantLabel.toLowerCase()}`} onClick={() => setAiOpen(true)}>✦ {assistantLabel}</button>}
        <button className="btn ghost" title="Settings" aria-label="Settings"
          onClick={() => setSettingsOpen(true)}>⚙</button>
        <UpdatePill />
        <SyncBar data={data} setData={setData} />
      </header>
      {settingsOpen && (
        <SettingsPanel data={data} setData={setData} theme={theme} onClose={() => setSettingsOpen(false)} />
      )}
      {calOpen && view !== "calendar" && (
        <CalendarPanel data={data} events={allEvents} now={now} plan={plan} setWidth={setCalWidth}
          onClose={() => setCalOpen(false)} />
      )}
      <main className="wrap">
        {view === "calendar" && <CalendarView data={data} setData={setData} now={now} plan={plan} events={allEvents} gcal={gcalState} />}
        {view === "gantt" && <GanttView data={data} setData={setData} now={now} />}
        {view === "work" && <WorkView data={data} setData={setData} now={now} sessionEmoji={sessionEmoji} />}
        {view === "session" && <SessionView data={data} setData={setData} sessionEmoji={sessionEmoji} now={now} timer={timer} session={session} plan={plan} />}
        {view === "personal" && <PersonalView data={data} setData={setData} now={now} sessionEmoji={sessionEmoji} />}
        {view === "budget" && <BudgetView data={data} setData={setData} now={now} />}
      </main>
      {aiOpen && (
        <AiPanel dataRef={dataRef} setData={setData} onClose={() => setAiOpen(false)}
          label={assistantLabel} width={aiWidth} setWidth={setAiWidth} />
      )}
    </div>
  );
}

/* ================= FANTASY AMBIENCE ================= */

// Firs as plain triangles: at these opacities the silhouette reads as a treeline
// long before anyone can pick out an individual tree, so detail would be wasted.
// Deterministic (no Math.random) — a reshuffling forest on every render would be
// exactly the kind of movement that pulls the eye away from the planner.
const firs = (count, baseH, jitter, W = 1200, H = 260) =>
  Array.from({ length: count }, (_, i) => {
    const step = W / count;
    const x = (i + 0.5) * step + ((i * jitter) % 34) - 17;
    const h = baseH + ((i * jitter * 7) % 58);
    const w = h * 0.3;
    return `M${(x - w).toFixed(1)} ${H} L${x.toFixed(1)} ${(H - h).toFixed(1)} L${(x + w).toFixed(1)} ${H} Z`;
  }).join(" ");

const MOTES = Array.from({ length: 30 }, (_, i) => ({
  // golden ratio stride so they scatter across the width instead of banding
  left: (i * 61.8 + 4) % 97,
  size: 3 + (i % 5) * 1.4,
  // slow enough to read as drifting rather than rising — roughly a minute to cross
  dur: 44 + (i % 7) * 7,
  delay: -((i * 5.7) % 46),
  drift: (i % 2 ? 1 : -1) * (14 + (i % 4) * 10),
}));

function FantasyScene() {
  return (
    <div className="fscene" aria-hidden="true">
      <svg className="fforest" viewBox="0 0 1200 260" preserveAspectRatio="xMidYMax slice">
        <path d={firs(22, 62, 5)} fill="rgba(124,154,92,.08)" />
        <path d={firs(15, 104, 11)} fill="rgba(9,7,3,.34)" />
        <path d={firs(9, 150, 23)} fill="rgba(6,4,2,.44)" />
      </svg>
      {MOTES.map((m, i) => (
        <span key={i} className="fmote" style={{
          left: `${m.left}%`, width: m.size, height: m.size,
          animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s`, "--drift": `${m.drift}px`,
        }} />
      ))}
    </div>
  );
}

/* ================= CLOUD SYNC ================= */
/* The header's update affordance. Absent entirely unless the app is running out
   of a checkout of its own repo, which is the only shape this updater can serve
   — see electron/updater.cjs for why that's the shape we're in.

   Polled on a long interval and on refocus rather than pushed: it's a `git
   fetch`, and there's nothing to push from. */
function UpdatePill() {
  const [state, setState] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!updaterAvailable()) return onUpdateProgress(() => {});
    return onUpdateProgress(setPct);
  }, []);

  useEffect(() => {
    if (!updaterAvailable()) return;
    const look = () => checkForUpdate().then(setState).catch(() => {});
    const first = setTimeout(look, 4000); // let the window settle before a network call
    const id = setInterval(look, 30 * 60 * 1000);
    const onFocus = () => look();
    window.addEventListener("focus", onFocus);
    return () => { clearTimeout(first); clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, []);

  /* Two ways to be out of date, and the second is the common one here: the
     remote is ahead of the checkout, or the checkout is ahead of this build.
     Commits usually land locally and are pushed in the same breath, so HEAD
     matches the remote while release/win-unpacked is older than both — checking
     only the remote would never fire. A failed check stays quiet rather than
     nagging about git in the corner of a planner. */
  const built = typeof __BUILD_COMMIT__ === "string" ? __BUILD_COMMIT__ : "";
  const rebuildOnly = state?.kind === "git" && !state.behind && !!built && !!state.head && state.head !== built;
  if (!state?.ok || (!state.behind && !rebuildOnly)) return null;
  // only a pull can be blocked by local edits; a plain rebuild is exactly what
  // `npm run app:install` does with them in place
  const blocked = state.kind === "git" && state.dirty && state.behind > 0;

  /* Two very different actions behind one button. A checkout rebuilds itself and
     is gone in half a second. An installed copy has to fetch a 160MB installer
     first, so it reports progress and only then restarts. */
  const start = async () => {
    setBusy(true);
    if (state.kind === "git") {
      const res = await runUpdate();
      if (!res?.started) { setBusy(false); setState({ ...state, failed: res?.reason || "Couldn't start the update." }); }
      return; // on success the app is quitting
    }
    const dl = await downloadUpdate();
    if (!dl?.downloaded) {
      setBusy(false);
      setState({ ...state, failed: dl?.reason || "The download didn't finish." });
      return;
    }
    const res = await installUpdate();
    if (!res?.started) { setBusy(false); setState({ ...state, failed: res?.reason || "Couldn't start the installer." }); }
  };

  return (
    <div className="updwrap">
      <button className="updpill" onClick={() => setOpen((v) => !v)} title="An update is ready to install">
        Update
      </button>
      {open && (
        <div className="updpanel">
          <div className="updhead">
            {state.kind === "app"
              ? `Version ${state.version} is available`
              : rebuildOnly
                ? "This build is behind your checkout"
                : `${state.behind} new commit${state.behind === 1 ? "" : "s"} on ${state.upstream}`}
          </div>
          {state.subject && <div className="updsubject">{state.subject}</div>}
          {blocked ? (
            <div className="updwarn">
              This checkout has uncommitted changes, so it can't fast-forward.
              Commit or stash them first.
            </div>
          ) : (
            <div className="updnote">
              {state.kind === "app"
                ? `You're on ${state.current}. The update downloads in the background, then the app restarts to install it.`
                : "The app will close, rebuild itself in a terminal window, and reopen. Takes a minute or so."}
            </div>
          )}
          {state.failed && <div className="updwarn">{state.failed}</div>}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button className="btn primary" style={{ marginLeft: "auto" }}
              disabled={blocked || busy} onClick={start}>
              {!busy ? "Update & restart"
                : state.kind === "app" ? (pct > 0 && pct < 100 ? `Downloading ${pct}%` : "Downloading…")
                : "Updating…"}
            </button>
            <button className="btn ghost" onClick={() => setOpen(false)}>Later</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Shown only when both this device and the cloud changed since they last agreed.
   Every other case resolves itself; this one cannot be guessed, so it asks — and
   until it is answered nothing is pushed and nothing is overwritten. */
function ConflictDialog({ diff, onKeepMine, onKeepCloud }) {
  const sample = (list) => list.slice(0, 4).map((x) => x.title || x.name).filter(Boolean);
  return (
    <div className="setwrap">
      <div className="setpanel" role="dialog" aria-label="Sync conflict">
        <div className="sethead"><span className="h2">This device and the cloud disagree</span></div>
        <p className="sethint" style={{ marginBottom: 4 }}>
          Both changed since they were last in step — most likely this device was offline while
          another one kept going. Nothing has been overwritten. Pick which version to keep;
          the other is replaced, so check the list first.
        </p>
        <div className="setgroup">
          {diff.map(({ label, onlyMine, onlyTheirs }) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div className="setlabel">{label}</div>
              {onlyMine.length > 0 && (
                <p className="sethint">
                  <b style={{ color: "var(--pine)" }}>Only on this device ({onlyMine.length}):</b>{" "}
                  {sample(onlyMine).join(", ")}{onlyMine.length > 4 ? ` and ${onlyMine.length - 4} more` : ""}
                </p>
              )}
              {onlyTheirs.length > 0 && (
                <p className="sethint">
                  <b style={{ color: "var(--slate)" }}>Only in the cloud ({onlyTheirs.length}):</b>{" "}
                  {sample(onlyTheirs).join(", ")}{onlyTheirs.length > 4 ? ` and ${onlyTheirs.length - 4} more` : ""}
                </p>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onKeepCloud}>Keep the cloud's</button>
          <button className="btn primary" onClick={onKeepMine}>Keep this device's</button>
        </div>
      </div>
    </div>
  );
}

/* The gear. Deliberately not one of the tabs, since which tabs exist is itself
   one of the things it controls — hiding the way back in would be a trap. */
function SettingsPanel({ data, setData, theme, onClose }) {
  const st = data.settings;
  const set = (patch) => setData((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  const shown = st.tabs || ALL_VIEWS.map(([k]) => k);
  const toggleView = (k) => {
    const next = shown.includes(k) ? shown.filter((x) => x !== k) : [...shown, k];
    if (!next.length) return; // the last one stays; an app with no tabs has no way back
    set({ tabs: ALL_VIEWS.map(([key]) => key).filter((key) => next.includes(key)) });
  };

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="setwrap" onClick={onClose}>
      <div className="setpanel" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <div className="sethead">
          <span className="h2">Settings</span>
          <button className="xbtn" style={{ opacity: 1 }} title="Close" onClick={onClose}>✕</button>
        </div>

        <div className="setgroup">
          <div className="setlabel">Tabs</div>
          <p className="sethint">Which sections appear in the header. Hiding one never deletes anything in it.</p>
          <div className="setchips">
            {ALL_VIEWS.map(([k, label]) => (
              <button key={k} className={`setchip ${shown.includes(k) ? "on" : ""}`}
                onClick={() => toggleView(k)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="setgroup">
          <div className="setlabel">Text size</div>
          <div className="setchips">
            {["small", "medium", "large"].map((k) => (
              <button key={k} className={`setchip ${(st.textSize || "medium") === k ? "on" : ""}`}
                onClick={() => set({ textSize: k })} style={{ textTransform: "capitalize" }}>{k}</button>
            ))}
          </div>
        </div>

        <div className="setgroup">
          <div className="setlabel">Clock</div>
          <div className="setchips">
            <button className={`setchip ${!st.clock24 ? "on" : ""}`} onClick={() => set({ clock24: false })}>12 hour</button>
            <button className={`setchip ${st.clock24 ? "on" : ""}`} onClick={() => set({ clock24: true })}>24 hour</button>
          </div>
        </div>

        <div className="setgroup">
          <div className="setlabel">Sounds</div>
          <p className="sethint">The chime when a session ends, and the pop when a task is finished.</p>
          <div className="setchips">
            <button className={`setchip ${st.sounds !== false ? "on" : ""}`} onClick={() => set({ sounds: true })}>On</button>
            <button className={`setchip ${st.sounds === false ? "on" : ""}`} onClick={() => set({ sounds: false })}>Off</button>
          </div>
        </div>

        <div className="setgroup">
          <div className="setlabel">Fantasy lettering</div>
          <p className="sethint">
            {theme === "fantasy"
              ? "Applies as you pick — the page behind this is already wearing it."
              : "Used by the fantasy theme; click the title in the header to see it."}
          </p>
          <div className="setfonts">
            {Object.entries(FANTASY_FONTS).map(([k, f]) => (
              <button key={k} className={`setfont ${(st.fantasyFont || "uncial") === k ? "on" : ""}`}
                onClick={() => set({ fantasyFont: k })}>
                <span className="setfontname" style={{ fontFamily: f.display }}>{f.name.split(" & ")[0]}</span>
                <span className="setfontsample" style={{ fontFamily: f.body }}>
                  Draft the NDSEG personal statement
                </span>
                <span className="setfontnote">{f.note}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SyncBar({ data, setData }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("offline"); // offline | connecting | synced | error
  const [form, setForm] = useState({ email: "", password: "", mode: "signin" });
  const [authError, setAuthError] = useState("");
  const pushTimer = useRef(null);
  const skipNextPush = useRef(false); // true while applying a remote update, so we don't echo it straight back
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);
  const [conflict, setConflict] = useState(null); // { mine, theirs, diff }

  useEffect(() => {
    if (!supabase) return;
    getSession().then(setSession);
    const { data: sub } = onAuthChange(setSession);
    return () => sub.subscription.unsubscribe();
  }, []);

  const applyRemote = (remote, base) => {
    skipNextPush.current = true;
    saveSync({ base, dirty: false });
    setData(hydrate(remote));
  };
  const pushLocal = async (payload) => {
    const at = await pushCloudData(session.user.id, payload);
    saveSync({ base: at, dirty: false });
    setStatus("synced");
  };

  /* Reconcile against the cloud row. Runs on sign-in, on reconnect, and on
     refocus — anywhere the two sides might have drifted apart.

     The old version pulled unconditionally, which is what deleted a day of
     offline work: edits made with no connection sat in localStorage, the next
     launch fetched the untouched cloud row on top of them, and the push that
     followed wrote the loss back up permanently. Nothing here overwrites local
     data unless we know the cloud is strictly ahead. */
  const reconcile = async () => {
    if (!supabase || !session || conflict) return;
    setStatus("connecting");
    try {
      const row = await fetchCloudData(session.user.id);
      const { base, dirty } = loadSync();
      const mine = dataRef.current;

      const plan = syncPlan({ row, base, dirty });
      if (plan === "push") { await pushLocal(mine); return; }
      if (plan === "pull") { applyRemote(row.data, row.updated_at); setStatus("synced"); return; }

      // both sides moved since we last agreed — never guess, and never delete
      const diff = diffData(mine, row.data);
      if (!diff.length) { await pushLocal(mine); return; }  // diverged, but nothing actually differs
      setConflict({ mine, theirs: row.data, at: row.updated_at, diff });
      setStatus("error");
    } catch (e) {
      setStatus("error"); // offline: keep the local edits and the dirty flag
    }
  };

  useEffect(() => {
    if (!supabase || !session) return;
    let unsub;
    reconcile().then(() => {
      unsub = subscribeToCloudData(session.user.id, (remoteData) => {
        /* Never drop unpushed local edits on the floor. Our push is moments away
           and is the later write, which is the rule the user asked for. */
        if (loadSync().dirty) return;
        applyRemote(remoteData, new Date().toISOString());
      });
    });
    return () => unsub && unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // a failed push leaves edits stranded until something retries — so retry the
  // moment the machine says it has a network again, and when the window returns
  useEffect(() => {
    if (!supabase || !session) return;
    const retry = () => { if (loadSync().dirty) reconcile(); };
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    return () => { window.removeEventListener("online", retry); window.removeEventListener("focus", retry); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, conflict]);

  // push local edits up, debounced — skipped once right after applying a remote update
  useEffect(() => {
    if (!supabase || !session) return;
    if (skipNextPush.current) { skipNextPush.current = false; return; }
    // recorded before the debounce, so quitting while offline still remembers
    // that this device is holding unsynced work
    saveSync({ ...loadSync(), dirty: true });
    if (conflict) return; // don't race the user's answer
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      try { await pushLocal(data); }
      catch (e) { setStatus("error"); }
    }, 600);
    return () => clearTimeout(pushTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, conflict]);

  const resolveConflict = async (keep) => {
    const c = conflict;
    setConflict(null);
    if (keep === "cloud") { applyRemote(c.theirs, c.at); setStatus("synced"); return; }
    try { await pushLocal(c.mine); } catch (e) { setStatus("error"); }
  };

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

  const statusLabel = conflict ? "Needs a decision"
    : { connecting: "Syncing…", synced: "Synced", error: "Not synced" }[status] || "Offline";
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span className="wkchip" style={{ color: status === "error" ? "var(--tomato)" : "var(--muted)" }}
        title={status === "error" ? "Your changes are saved on this device and will go up when the connection returns." : ""}>
        {statusLabel}
      </span>
      <button className="btn ghost" onClick={() => { saveSync({ base: null, dirty: false }); signOut(); }}>Sign out</button>
      {conflict && (
        <ConflictDialog diff={conflict.diff}
          onKeepMine={() => resolveConflict("mine")} onKeepCloud={() => resolveConflict("cloud")} />
      )}
    </div>
  );
}

/* ================= GANTT CHART ================= */
function GanttView({ data, setData, now }) {
  const [name, setName] = useState("");

  const addProject = () => {
    if (!name.trim()) return;
    const id = uid(), label = name.trim();
    setData((prev) => ({
      ...prev,
      projects: [...prev.projects, { id, name: label, color: PROJ_COLORS[prev.projects.length % PROJ_COLORS.length], phases: [] }],
    }));
    setName("");
  };
  const delProject = (id) => setData((prev) => ({ ...prev, projects: prev.projects.filter((p) => p.id !== id) }));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="h2">Big picture</div>
        </div>
        <input className="field" placeholder="New project name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addProject()} />
        <button className="btn primary" onClick={addProject}>Add project</button>
      </div>

      <DeadlinesGantt tasks={data.tasks} cats={allCats(data)} now={now} />

      {data.projects.length === 0 && <div className="emptystate">No projects yet — add one above to start your plan.</div>}
      {data.projects.map((p) => <ProjectGantt key={p.id} project={p} data={data} setData={setData} onDelete={() => delProject(p.id)} now={now} />)}
    </div>
  );
}

// Any task (Work or Personal) with a due date shows up here as a single-week marker,
// snapped to its due week the same way ProjectGantt snaps phases.
function DeadlinesGantt({ tasks, cats, now }) {
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
                style={{ gridColumn: `${col} / span 1`, gridRow: idx + 2, background: catColorFor(cats, t.cat) }}
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
  const update = (proj) => setData((prev) => ({ ...prev, projects: prev.projects.map((p) => (p.id === proj.id ? proj : p)) }));
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
  const delSection = (id) => setData((prev) => ({
    ...prev,
    projects: prev.projects.map((p) => (p.id === project.id
      ? { ...p, sections: (p.sections || []).filter((s) => s.id !== id) } : p)),
    tasks: prev.tasks.map((t) => (t.sectionId === id ? { ...t, sectionId: null } : t)),
  }));
  const addSectionPhase = (secId, p) => updateSection(secId, (s) => ({ ...s, phases: [...s.phases, { id: uid(), ...p, done: false }] }));
  const toggleSecPhase = (secId, id) => updateSection(secId, (s) => ({ ...s, phases: s.phases.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) }));
  const delSecPhase = (secId, id) => updateSection(secId, (s) => ({ ...s, phases: s.phases.filter((x) => x.id !== id) }));
  const addSectionTask = (secId, { title, minutes, dueDate, cat }) => {
    const id = uid();
    setData((prev) => ({ ...prev, tasks: [...prev.tasks, {
      id, title, cat, minutes, est: estFor(minutes, prev.settings.work), done: 0, checked: false,
      oneOnOne: false, dueDate, sectionId: secId,
    }] }));
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
          style={{ gridColumn: `${colOf(t.dueDate)} / span 1`, gridRow: row, background: catColorFor(allCats(data), t.cat) }}
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
        <SectionEditor key={sec.id} section={sec} cats={allCats(data)}
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
function SectionEditor({ section, cats, onAddPhase, onAddTask }) {
  const [ph, setPh] = useState({ name: "", start: "", end: "" });
  const [tk, setTk] = useState({ title: "", minutes: 25, dueDate: "", cat: cats[0]?.id || "" });

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
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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

/* The thing that follows the cursor is a detached, fully opaque copy of the row
   rather than the row itself. Handing Chromium the live element means the bitmap
   it rasterises can pick up whatever the source is doing — the .dragging fade
   most obviously, but also its transparent edges, since a row draws no
   background of its own beyond the card behind it. A clone owes nothing to the
   original: we give it a solid background, a hard edge and a lift shadow, and it
   stays crisp no matter what happens to the row underneath.
   It has to be attached and laid out to rasterise, hence the off-screen park
   and the removal on the next tick — and it must be parked *inside* the themed
   .fw root, not on document.body, or every theme-scoped rule and custom property
   misses it and the ghost renders in the wrong palette and fonts. */
function makeDragImage(el) {
  const cs = getComputedStyle(el);
  const clone = el.cloneNode(true);
  clone.classList.remove("dragging", "dragover-before", "dragover-after");
  clone.style.cssText = `position:absolute; top:-9999px; left:0; margin:0; pointer-events:none;
    width:${el.offsetWidth}px; height:${el.offsetHeight}px; opacity:1;
    background:${cs.backgroundColor === "rgba(0, 0, 0, 0)" ? "var(--card)" : cs.backgroundColor};
    border-radius:8px; box-shadow:0 10px 24px rgba(0,0,0,.5); overflow:hidden;`;
  (el.closest(".fw") || document.body).appendChild(clone);
  return clone;
}

/* Shared by TaskRow and QueueRow. */
function dragHandlers(drag) {
  if (!drag) return {};
  return {
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = "move";
      const r = e.currentTarget.getBoundingClientRect();
      try {
        const ghost = makeDragImage(e.currentTarget);
        e.dataTransfer.setDragImage(ghost, e.clientX - r.left, e.clientY - r.top);
        setTimeout(() => ghost.remove(), 0);
      } catch (err) { /* older engines fall back to the default drag image */ }
      drag.onStart();
    },
    onDragEnd: drag.onEnd,
    onDragOver: (e) => { e.preventDefault(); drag.onOver(); },
    onDragLeave: drag.onLeave,
    onDrop: (e) => { e.preventDefault(); drag.onDrop(); },
  };
}

function TaskRow({ t, burst, onToggle, onToggleAll, onDelete, onEdit, onAddSubtask, onToggleSubtask, onDeleteSubtask, onEditSubtask, now, sessionMin, inSession, queuedSubs, sessionEmoji, drag }) {
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
      <div className={`taskrow ${t.checked ? "done" : ""} ${burstClass(burst, t.id)} ${drag?.dragging ? "dragging" : ""} ${drag?.over || ""} ${urgency === "due-today" ? "due-today" : ""} ${urgency === "overdue" ? "overdue" : ""}`}
        {...dragHandlers(drag)} title="Drag to reorder">
        <span className="checkwrap">
          <button className={`check ${t.checked ? "on" : ""}`} aria-label={t.checked ? "Mark not done" : "Mark done"}
            onClick={() => (hasSubs ? onToggleAll() : onToggle(t))}>✓</button>
          {burst?.id === t.id && burst.kind === "done" && Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            const r = 22 + (i % 3) * 8;
            const colors = ["var(--tomato)", "var(--pine)", "var(--amber)"];
            return <span key={i} className="particle" style={{ background: colors[i % 3], "--dx": `${Math.cos(a) * r}px`, "--dy": `${Math.sin(a) * r}px` }} />;
          })}
        </span>
        <span className="tasktitle">{t.title}</span>
        {inSession && <span className="tagsess" title="Queued in the current session">{sessionEmoji} session</span>}
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
            <SubtaskRow key={s.id} sub={s} onToggle={() => onToggleSubtask(s.id)} onDelete={() => onDeleteSubtask(s.id)}
              onEdit={(patch) => onEditSubtask(s.id, patch)} now={now}
              inSession={!!queuedSubs?.has(qidFor(t.id, s.id))} sessionEmoji={sessionEmoji} />
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
  setData((prev) => ({
    ...prev,
    tasks: prev.tasks.map((x) => {
      if (x.id !== id) return x;
      if (patch.minutes === undefined) return { ...x, title: patch.title };
      const est = estFor(patch.minutes, prev.settings.work);
      return { ...x, title: patch.title, minutes: patch.minutes, dueDate: patch.dueDate, est, done: Math.min(x.done, est) };
    }),
  }));
}

/* The completion flourish. `burst` is {id, kind} rather than a bare id because
   fantasy animates *both* directions — "done" burns the row, "undone" heals it —
   while dark only has a celebration for finishing, so it ignores "undone". */
// Must outlast the longest fantasy animation, or the class is pulled mid-flame:
// the burn runs 1.15s and the delayed strikethrough finishes at 1.2s.
const BURST_MS = 1250;
// "" in dark, where neither class has any rules — the flourish is fantasy-only
const burstClass = (burst, id) =>
  burst?.id === id ? (burst.kind === "done" ? "burning" : "healing") : "";
function fireBurst(setBurst, id, kind) {
  if (!setBurst) return;
  setBurst({ id, kind });
  if (kind === "done") popSound();
  setTimeout(() => setBurst(null), BURST_MS);
}

// shared by WorkView/PersonalView — stamps completedDate so recurring tasks know when they were last finished
function toggleTask(data, setData, t, setBurst) {
  const nowChecked = !t.checked;
  setData((prev) => ({
    ...prev,
    tasks: prev.tasks.map((x) => (x.id === t.id
      ? { ...x, checked: nowChecked, completedDate: nowChecked ? dateKey(new Date()) : x.completedDate }
      : x)),
  }));
  fireBurst(setBurst, t.id, nowChecked ? "done" : "undone");
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
  /* The animation is decided from the row the user just clicked, the data from
     the latest state. Keeping them apart matters: a state updater has to stay
     pure (React may run it more than once), and the two can only disagree in a
     race, where one wrong animation frame beats a lost edit. */
  const seen = data.tasks.find((t) => t.id === taskId);
  if (seen) {
    const preview = deriveFromSubtasks(fn(seen), data.settings.work);
    if (!seen.checked && preview.checked) fireBurst(setBurst, taskId, "done");
    // unchecking a subtask reopens the parent — heal it, same as unchecking it directly
    else if (seen.checked && !preview.checked) fireBurst(setBurst, taskId, "undone");
  }
  setData((prev) => ({
    ...prev,
    tasks: prev.tasks.map((t) => {
      if (t.id !== taskId) return t;
      const next = deriveFromSubtasks(fn(t), prev.settings.work);
      return !t.checked && next.checked ? { ...next, completedDate: dateKey(new Date()) } : next;
    }),
  }));
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
// editing a subtask's minutes/due date re-derives the parent's totals, same as adding one
const editSubtask = (data, setData, taskId, subId, patch, setBurst) => updateSubtasks(
  data, setData, taskId,
  (t) => ({ ...t, subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, ...patch } : s)) }),
  setBurst,
);
// clicking the parent checkbox on a task with subtasks checks/unchecks all of them at once
const toggleAllSubtasks = (data, setData, taskId, setBurst) => {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return;
  const target = !task.checked;
  updateSubtasks(data, setData, taskId, (t) => ({ ...t, subtasks: t.subtasks.map((s) => ({ ...s, checked: target })) }), setBurst);
};

function SubtaskRow({ sub, onToggle, onDelete, onEdit, now, inSession, sessionEmoji }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(sub.title);
  const [minutes, setMinutes] = useState(sub.minutes);
  const [dueDate, setDueDate] = useState(sub.dueDate || "");
  const urgency = taskUrgency(sub, now);

  const startEdit = () => {
    setTitle(sub.title); setMinutes(sub.minutes); setDueDate(sub.dueDate || "");
    setEditing(true);
  };
  const commit = () => {
    if (!title.trim()) return;
    onEdit({ title: title.trim(), minutes: Math.max(5, +minutes || 25), dueDate: dueDate || null });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="subtaskrow editing">
        <input className="field" style={{ flex: 1, minWidth: 110 }} autoFocus value={title}
          onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commit()} />
        <label style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
          <input type="number" min="5" step="5" className="field" style={{ width: 56 }} value={minutes}
            onChange={(e) => setMinutes(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commit()} /> min
        </label>
        <label style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
          due <input type="date" className="field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <button className="btn primary" onClick={commit}>Save</button>
        <button className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <div className={`subtaskrow ${sub.checked ? "done" : ""} ${urgency === "due-today" ? "due-today" : ""} ${urgency === "overdue" ? "overdue" : ""}`}>
      <button className={`check small ${sub.checked ? "on" : ""}`} aria-label={sub.checked ? "Mark not done" : "Mark done"} onClick={onToggle}>✓</button>
      <span className="subtasktitle">{sub.title}</span>
      {inSession && <span className="tagsess">{sessionEmoji} session</span>}
      <span className="submeta">
        {sub.dueDate && (
          <span className="tagdue" style={{ color: urgency === "overdue" ? "var(--tomato)" : urgency === "due-today" ? "var(--amber)" : "var(--muted)" }}>
            due {fmtDue(sub.dueDate)}
          </span>
        )}
        <span className="taskmin">{sub.minutes} min</span>
      </span>
      <button className="xbtn" onClick={startEdit} title="Edit subtask">✎</button>
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

/* ================= CALENDAR =================
   Events are absolutely positioned inside a day column and the session plan is
   drawn in the same space, so a collision is visible rather than something you
   have to work out. The week view is seven of these columns; the side panel is
   one. They share CalendarDay so the two can't drift apart. */

/* Pulled Google events are a cache of somebody else's system, so they live in
   component state rather than in `data` — persisting them would bloat the synced
   row and go stale the moment the real calendar changed. Polled rather than
   pushed: Google's webhooks need a public HTTPS endpoint, which a desktop app
   doesn't have. */
function useGoogleCalendar(now) {
  const [state, setState] = useState({ connected: false, email: null, events: [], error: null, busy: false });

  const refresh = async () => {
    if (!calAvailable() || !calConfigured()) return;
    const res = await calFetch();
    setState((s) => ({ ...s, connected: res.connected, email: res.email ?? s.email, events: res.events, error: res.error || null }));
  };

  useEffect(() => {
    if (!calAvailable() || !calConfigured()) return;
    calStatus().then((s) => setState((p) => ({ ...p, connected: s.connected, email: s.email })));
    refresh();
    const id = setInterval(refresh, 5 * 60 * 1000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(id); window.removeEventListener("focus", onFocus); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    available: calAvailable(), configured: calConfigured(),
    connect: async () => {
      setState((s) => ({ ...s, busy: true, error: null }));
      const res = await calConnect();
      setState((s) => ({ ...s, busy: false, error: res?.error || null }));
      if (!res?.error) { setState((s) => ({ ...s, connected: true, email: res?.email || s.email })); refresh(); }
    },
    disconnect: async () => { await calDisconnect(); setState({ connected: false, email: null, events: [], error: null, busy: false }); },
    refresh,
  };
}

const CAL_SPAN = DAY_END - DAY_START;
const CAL_HOURS = Array.from({ length: CAL_SPAN / 60 + 1 }, (_, i) => DAY_START + i * 60);
const minsOf = (d) => d.getHours() * 60 + d.getMinutes();
// null for anything wholly outside the drawn window, so a late-running plan
// doesn't produce negative-height blocks stacked at the bottom edge
const placeIn = (startMin, endMin) => {
  const top = Math.max(startMin, DAY_START), bottom = Math.min(endMin, DAY_END);
  if (bottom <= top) return null;
  return { top: `${((top - DAY_START) / CAL_SPAN) * 100}%`, height: `${((bottom - top) / CAL_SPAN) * 100}%` };
};

function CalendarDay({ day, data, events, plan, now, onSlotClick, onDelEvent, compact }) {
  const key = dateKey(day);
  const cats = allCats(data);
  const dayEvents = events.filter((e) => e.date === key && !e.allDay);
  const dayPlan = plan.filter((b) => b.type !== "event" && dateKey(b.start) === key);
  const isToday = key === dateKey(now);
  const nowPct = ((minsOf(now) - DAY_START) / CAL_SPAN) * 100;

  return (
    <div className="calslots" onClick={onSlotClick && ((e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const mins = DAY_START + Math.floor(((e.clientY - r.top) / r.height) * CAL_SPAN / 30) * 30;
      onSlotClick(day, Math.max(DAY_START, Math.min(DAY_END - 30, mins)));
    })}>
      {CAL_HOURS.slice(0, -1).map((h) => <div key={h} className="calslot" />)}

      {dayPlan.map((b, i) => {
        const box = placeIn(minsOf(b.start), minsOf(b.end));
        if (!box) return null;
        return (
          <div key={i} className={`calplan ${b.type}`} style={box}
            title={b.type === "task" ? `${b.title} — session ${b.n} of ${b.of}` : b.long ? "long break" : "break"}>
            {b.type === "task" && <span className="calplantxt">{b.title}</span>}
          </div>
        );
      })}

      {dayEvents.map((ev) => {
        const box = placeIn(timeToMin(ev.start), timeToMin(ev.end));
        if (!box) return null;
        const cat = cats.find((c) => c.id === ev.cat);
        // 44px an hour, and two stacked lines need about 31px of it
        const mins = timeToMin(ev.end) - timeToMin(ev.start);
        const short = mins < 45;
        return (
          <div key={ev.id} className={`calevent phaserow ${short ? "short" : ""} ${ev.source === "google" ? "fromgoogle" : ""}`}
            style={{ ...box, background: cat ? cat.color : ev.source === "google" ? "var(--teal)" : "var(--slate)" }}
            title={`${ev.title}${cat ? ` · ${cat.name}` : ""} — ${fmtHM(ev.start)}–${fmtHM(ev.end)}${ev.source === "google" ? " · from Google Calendar" : ""}`}
            onClick={(e) => e.stopPropagation()}>
            <span className="caleventtitle">{ev.title}</span>
            {/* A short block shows its length, not its span: "09:00-09:10" eats
                two thirds of a day column and leaves four characters for the
                name, while the start time is already what the block's position
                says. The full range stays in the hover title. */}
            <span className="caleventtime">
              {short ? `${mins}m` : `${fmtHM(ev.start)}–${fmtHM(ev.end)}${cat && !compact ? ` · ${cat.name}` : ""}`}
            </span>
            {/* Google events are a mirror of somewhere else; deleting here would
                be a lie, so only the app's own events get a remove button */}
            {onDelEvent && ev.source !== "google" && (
              <button className="xbtn" title="Delete event" onClick={() => onDelEvent(ev.id)}>✕</button>
            )}
          </div>
        );
      })}

      {isToday && nowPct >= 0 && nowPct <= 100 && (
        <div className="calnow" style={{ top: `${nowPct}%` }}><span className="calnowdot" /></div>
      )}
    </div>
  );
}

const CalHours = () => (
  <div className="calgutter">{CAL_HOURS.map((h) => <div key={h} className="calhour">{fmtMin(h)}</div>)}</div>
);

function CalendarView({ data, setData, now, plan, events, gcal }) {
  const [offset, setOffset] = useState(0); // weeks from this one
  const [form, setForm] = useState({ date: "", start: "09:00", end: "10:00", title: "", cat: "" });
  const titleRef = useRef(null);

  const mine = data.events || [];
  const days = Array.from({ length: 7 }, (_, i) => addDays(addDays(monday(now), offset * 7), i));

  const addEvent = () => {
    if (!form.title.trim() || !form.date || timeToMin(form.end) <= timeToMin(form.start)) return;
    const ev = { id: uid(), ...form, title: form.title.trim() };
    setData((prev) => ({ ...prev, events: [...(prev.events || []), ev] }));
    setForm({ ...form, title: "" });
  };
  const delEvent = (id) => setData((prev) => ({ ...prev, events: (prev.events || []).filter((e) => e.id !== id) }));

  // clicking an empty slot prefills the form rather than opening a popover
  const slotClick = (day, minutes) => {
    setForm((f) => ({ ...f, date: dateKey(day), start: minToTime(minutes), end: minToTime(Math.min(DAY_END, minutes + 60)), title: "" }));
    setTimeout(() => titleRef.current?.focus(), 0);
  };

  const todayKey = dateKey(now);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}><div className="h2">Calendar</div></div>
        <GoogleChip gcal={gcal} />
        <div className="calnav">
          <button className="btn" onClick={() => setOffset(offset - 1)}>←</button>
          <button className="btn" onClick={() => setOffset(0)}>This week</button>
          <button className="btn" onClick={() => setOffset(offset + 1)}>→</button>
        </div>
      </div>
      {gcal.error && <div className="aierror" style={{ marginTop: 10 }}>{gcal.error}</div>}

      <div className="card calcard">
        <div className="calgrid">
          <div className="calgutterwrap"><div className="calheadspacer" /><CalHours /></div>
          {days.map((d) => {
            const key = dateKey(d);
            const dueHere = data.tasks.filter((t) => t.dueDate === key && !t.checked);
            return (
              <div className="calday" key={key}>
                <div className={`caldayhead ${key === todayKey ? "istoday" : ""}`}>
                  {d.toLocaleDateString(undefined, { weekday: "short" })} <b>{d.getDate()}</b>
                </div>
                <div className="calalldays">
                  {events.filter((e) => e.allDay && e.date === key).map((e) => (
                    <span key={e.id} className="calduechip allday" title={`all day — ${e.title}`}>{e.title}</span>
                  ))}
                  {dueHere.map((t) => (
                    <span key={t.id} className="calduechip" title={`due — ${t.title}`}
                      style={{ background: catColorFor(allCats(data), t.cat) }}>{t.title}</span>
                  ))}
                </div>
                <CalendarDay day={d} data={data} events={events} plan={plan} now={now}
                  onSlotClick={slotClick} onDelEvent={delEvent} />
              </div>
            );
          })}
        </div>

        <div className="addrow">
          <input className="field" ref={titleRef} style={{ flex: 1, minWidth: 150 }} placeholder="Event (e.g. Lab meeting)"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && addEvent()} />
          <select className="field" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}
            title="Category (optional) — colours the event">
            <option value="">No category</option>
            <optgroup label="Work">
              {catsIn(data, "work").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
            <optgroup label="Personal">
              {catsIn(data, "personal").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          </select>
          <input type="date" className="field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input type="time" className="field" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          <span style={{ color: "var(--muted)", fontSize: 13 }}>to</span>
          <input type="time" className="field" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          <button className="btn primary" onClick={addEvent}>Add event</button>
        </div>
      </div>
      <div className="sub" style={{ marginTop: 10 }}>
        Click any slot to start an event there. Queued session work is drawn in outline and steps over anything booked.
      </div>
    </div>
  );
}

/* Today as a single column of the same grid — same hour bars, same now line,
   same blocks — rather than a separate agenda that could disagree with it. */
/* Connect / disconnect, and what account is feeding events in. */
function GoogleChip({ gcal }) {
  if (!gcal.available) return <span className="roomstatus">Google Calendar needs the desktop app.</span>;
  if (!gcal.configured) return <span className="roomstatus">Google Calendar isn't configured in this build.</span>;
  if (!gcal.connected) {
    return (
      <button className="btn" onClick={gcal.connect} disabled={gcal.busy}>
        {gcal.busy ? "Waiting for Google…" : "Connect Google Calendar"}
      </button>
    );
  }
  return (
    <span className="gcalchip">
      <span className="gcaldot" />
      {gcal.email || "Google Calendar"}
      <button className="btn ghost aimini" onClick={gcal.refresh} title="Refresh now">↻</button>
      <button className="btn ghost aimini" onClick={gcal.disconnect} title="Disconnect">✕</button>
    </span>
  );
}

function CalendarPanel({ data, events, now, plan, setWidth, onClose }) {
  const [dragging, setDragging] = useState(false);
  const scrollRef = useRef(null);

  // open with the current hour in view rather than at 7am
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pct = (minsOf(new Date()) - DAY_START) / CAL_SPAN;
    el.scrollTop = Math.max(0, pct * el.scrollHeight - el.clientHeight / 2);
  }, []);

  const startDrag = (e) => {
    e.preventDefault();
    setDragging(true);
    const cap = Math.min(CALW_MAX, Math.max(CALW_MIN, window.innerWidth - 420));
    const onMove = (ev) => setWidth(Math.min(cap, Math.max(CALW_MIN, ev.clientX)));
    const onUp = () => { setDragging(false); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <aside className="calpanel">
      <div className={`calgrip ${dragging ? "dragging" : ""}`} onMouseDown={startDrag}
        title="Drag to resize" role="separator" aria-orientation="vertical" />
      <div className="aihead">
        <span className="aititle">{now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span>
        <button className="btn ghost aimini" onClick={onClose} title="Close panel">✕</button>
      </div>
      <div className="calpanelscroll" ref={scrollRef}>
        <div className="calpanelday">
          <CalHours />
          <div className="calday">
            <CalendarDay day={now} data={data} events={events} plan={plan} now={now} compact />
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ================= WORK / PERSONAL =================
   Both are the same view over a different `group` of categories, so they share
   one body. Categories come from data.categories, so the sections here are
   whatever the user has made rather than a fixed list. */
function TaskGroupView({ data, setData, now, group, title, sessionEmoji }) {
  const [burst, setBurst] = useState(null); // task id currently bursting
  const [newCat, setNewCat] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  // the dragged id lives in a ref, not state: the drop handler needs it synchronously
  // and must not depend on a re-render having landed between dragstart and drop
  const dragRef = useRef(null);
  const [dragId, setDragId] = useState(null); // mirror, purely for the drag styling
  const taskDragRef = useRef(null);
  const [taskDragId, setTaskDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  // a queued subtask marks its parent too, so the pill means "some of this is
  // in the session" rather than going missing whenever you queued the parts
  const queued = new Set((data.sessionQueue || []).map(qidTask));
  const queuedSubs = new Set(data.sessionQueue || []);

  // which edge of the hovered row to draw the insertion line on, matching where
  // moveTask will actually drop it: below when moving down, above when moving up
  const overClass = (targetId) => {
    if (overId !== targetId) return "";
    const fromId = taskDragRef.current;
    if (!fromId || fromId === targetId) return "";
    const from = data.tasks.find((t) => t.id === fromId), to = data.tasks.find((t) => t.id === targetId);
    if (!from || !to || from.cat !== to.cat) return "";
    const ids = data.tasks.filter((t) => t.cat === from.cat).map((t) => t.id);
    return ids.indexOf(fromId) < ids.indexOf(targetId) ? "dragover-after" : "dragover-before";
  };
  const endTaskDrag = () => { taskDragRef.current = null; setTaskDragId(null); setOverId(null); };
  const taskDrag = (id) => ({
    dragging: taskDragId === id,
    over: overClass(id),
    // The fade is deferred a tick so it isn't captured in the drag snapshot. The
    // ref guard matters: a drag that ends within that tick would otherwise have
    // the timeout re-apply `dragging` after cleanup and strand a faded row.
    onStart: () => { taskDragRef.current = id; setTimeout(() => { if (taskDragRef.current === id) setTaskDragId(id); }, 0); },
    onEnd: endTaskDrag,
    onOver: () => setOverId((o) => (o === id ? o : id)),
    onLeave: () => setOverId((o) => (o === id ? null : o)),
    onDrop: () => { moveTask(taskDragRef.current, id); endTaskDrag(); },
  });

  const cats = catsIn(data, group);
  const tasks = data.tasks.filter((t) => cats.some((c) => c.id === t.cat));

  const addTask = (catId, title2, minutes, oneOnOne, dueDate) => {
    const id = uid();
    setData((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { id, title: title2, cat: catId, minutes, est: estFor(minutes, prev.settings.work), done: 0, checked: false, oneOnOne, dueDate }],
    }));
  };
  const toggle = (t) => toggleTask(data, setData, t, setBurst);
  const delTask = (id) => setData((prev) => ({ ...prev, tasks: prev.tasks.filter((x) => x.id !== id) }));
  const edit = (id, patch) => editTask(data, setData, id, patch);
  const toggleAll = (id) => toggleAllSubtasks(data, setData, id, setBurst);
  const addSub = (id, t2, minutes, dueDate) => addSubtask(data, setData, id, t2, minutes, dueDate, setBurst);
  const toggleSub = (id, subId) => toggleSubtask(data, setData, id, subId, setBurst);
  const delSub = (id, subId) => delSubtask(data, setData, id, subId, setBurst);
  const editSub = (id, subId, patch) => editSubtask(data, setData, id, subId, patch, setBurst);

  // newest first — the reason to open the archive is nearly always something
  // finished recently
  const archived = (data.archive || [])
    .filter((t) => cats.some((c) => c.id === t.cat))
    .slice()
    .reverse();
  /* Reopen puts it back unchecked rather than restoring it as-completed, which
     would simply archive itself again at the next rollover. Subtasks come back
     unchecked too, or the parent would re-derive straight to checked. */
  const reopenArchived = (id) => {
    setData((prev) => {
      const t = (prev.archive || []).find((x) => x.id === id);
      if (!t) return prev;
      return {
        ...prev,
        archive: (prev.archive || []).filter((x) => x.id !== id),
        tasks: [...prev.tasks, {
          ...t, checked: false, done: 0, completedDate: null,
          subtasks: (t.subtasks || []).map((sb) => ({ ...sb, checked: false })),
        }],
      };
    });
  };

  const addCat = () => {
    const name = newCat.trim();
    if (!name) return;
    setData((prev) => {
      const list = allCats(prev);
      return {
        ...prev,
        categories: [...list, { id: catIdFor(name, list), name, color: CAT_COLORS[list.length % CAT_COLORS.length], group }],
      };
    });
    setNewCat("");
  };
  // only ever offered for an empty section — deleting one with tasks would strand
  // them somewhere they can never be seen again
  const delCat = (id) => setData((prev) => ({ ...prev, categories: allCats(prev).filter((c) => c.id !== id) }));

  // Same shuffle-and-write-back as moveCat, but over one category's slots in the
  // flat tasks array. Dropping onto another category's row is ignored — a drag
  // reorders, it doesn't refile.
  const moveTask = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    setData((prev) => {
      const all = prev.tasks;
      const from = all.find((t) => t.id === fromId), to = all.find((t) => t.id === toId);
      if (!from || !to || from.cat !== to.cat) return prev;
      const ids = all.filter((t) => t.cat === from.cat).map((t) => t.id);
      const fi = ids.indexOf(fromId), ti = ids.indexOf(toId);
      if (fi < 0 || ti < 0) return prev;
      ids.splice(ti, 0, ids.splice(fi, 1)[0]);
      const byId = Object.fromEntries(all.map((t) => [t.id, t]));
      let i = 0;
      return { ...prev, tasks: all.map((t) => (t.cat === from.cat ? byId[ids[i++]] : t)) };
    });
  };

  // Reorder within this group only: the group's ids are shuffled, then written back
  // into the slots this group already occupies, so the other group stays put.
  const moveCat = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    setData((prev) => {
      const list = allCats(prev);
      const ids = list.filter((c) => c.group === group).map((c) => c.id);
      const from = ids.indexOf(fromId), to = ids.indexOf(toId);
      if (from < 0 || to < 0) return prev;
      ids.splice(to, 0, ids.splice(from, 1)[0]);
      const byId = Object.fromEntries(list.map((c) => [c.id, c]));
      let i = 0;
      return { ...prev, categories: list.map((c) => (c.group === group ? byId[ids[i++]] : c)) };
    });
  };

  const doneCt = tasks.filter((t) => t.checked).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="h2">{title}</div>
        </div>
        <span className="catcount">{doneCt}/{tasks.length} done</span>
      </div>

      {cats.map((c) => {
        const list = tasks.filter((t) => t.cat === c.id);
        return (
          <div className={`catblock ${dragId === c.id ? "dragging" : ""}`} key={c.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); moveCat(dragRef.current, c.id); dragRef.current = null; setDragId(null); }}>
            {/* only the header is the drag handle — making the whole block draggable
                would fight with selecting text in the add-task inputs inside it */}
            <div className="cathead phaserow" draggable
              onDragStart={(e) => { dragRef.current = c.id; setDragId(c.id); e.dataTransfer.effectAllowed = "move"; }}
              onDragEnd={() => { dragRef.current = null; setDragId(null); }}
              title="Drag to reorder this section">
              <span className="catgrip">⠿</span>
              <span className="catdot" style={{ background: c.color }} />
              <span className="catname" style={{ color: c.color }}>{c.name}</span>
              <span className="catcount">{list.filter((t) => t.checked).length}/{list.length}</span>
              {list.length === 0 && (
                <button className="xbtn" style={{ marginLeft: "auto" }} title={`Delete the ${c.name} section`}
                  onClick={() => delCat(c.id)}>✕</button>
              )}
            </div>
            <div className="card">
              {list.map((t) => (
                <TaskRow key={t.id} t={t} burst={burst} onToggle={toggle} onToggleAll={() => toggleAll(t.id)}
                  onDelete={delTask} onEdit={edit} now={now} sessionMin={data.settings.work}
                  inSession={queued.has(t.id)} queuedSubs={queuedSubs} sessionEmoji={sessionEmoji} drag={taskDrag(t.id)}
                  onAddSubtask={(t2, minutes, dueDate) => addSub(t.id, t2, minutes, dueDate)}
                  onToggleSubtask={(subId) => toggleSub(t.id, subId)}
                  onDeleteSubtask={(subId) => delSub(t.id, subId)}
                  onEditSubtask={(subId, patch) => editSub(t.id, subId, patch)} />
              ))}
              {list.length === 0 && <div className="emptystate" style={{ padding: "14px 16px" }}>No tasks yet.</div>}
              <AddTaskRow onAdd={(t2, minutes, oneOnOne, dueDate) => addTask(c.id, t2, minutes, oneOnOne, dueDate)} />
            </div>
          </div>
        );
      })}

      <div className="addrow" style={{ marginTop: 18, border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
        <input className="field" style={{ flex: 1, minWidth: 160 }} placeholder={`New ${title} section (e.g. ${group === "work" ? "Quals" : "LomL Dev"})`}
          value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCat()} />
        <button className="btn" onClick={addCat}>Add section</button>
      </div>

      {archived.length > 0 && (
        <div className="archivebox">
          <button className="archivetoggle" onClick={() => setShowArchive((v) => !v)}>
            {showArchive ? "▾" : "▸"} Archive
            <span className="catcount">{archived.length}</span>
          </button>
          {showArchive && (
            <div className="card">
              {archived.map((t) => {
                const c = cats.find((x) => x.id === t.cat);
                const subs = t.subtasks || [];
                return (
                  <div key={t.id} className="archrow">
                    <span className="tasktitle">{t.title}</span>
                    {subs.length > 0 && (
                      <span className="subprogress">{subs.length} subtask{subs.length === 1 ? "" : "s"}</span>
                    )}
                    <span style={{ flex: 1 }} />
                    {c && <span className="pickcat" style={{ color: c.color, padding: 0 }}>{c.name}</span>}
                    <span className="tagdue">{t.completedDate ? fmtDue(t.completedDate) : "—"}</span>
                    <button className="btn ghost" title="Put it back in its section, unchecked"
                      onClick={() => reopenArchived(t.id)}>Reopen</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const WorkView = (props) => <TaskGroupView {...props} group="work" title="Work" />;
const PersonalView = (props) => <TaskGroupView {...props} group="personal" title="Personal" />;

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

/* Presets are the things you buy over and over (a $9.74 Piada lunch). Clicking one
   logs a purchase for that amount today — it's a shortcut for AddBudgetItemRow, not
   a different kind of item, so the logged row is editable/deletable like any other.
   Only offered on "budget" categories; a fixed category's items *are* its budget. */
function PresetBar({ presets, onLog, onDelete, onAdd }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", amount: "" });

  const submit = () => {
    const amount = Math.max(0, +form.amount || 0);
    if (!form.name.trim() || !amount) return;
    onAdd(form.name.trim(), amount);
    setForm({ name: "", amount: "" });
    setAdding(false);
  };

  return (
    <>
      <div className="presets">
        {presets.map((p) => (
          <span className="preset" key={p.id}>
            <button className="presetlog" title={`Log ${p.name} — ${fmtMoney(p.amount)}`} onClick={() => onLog(p)}>
              {p.name}<span className="presetamt">{fmtMoney(p.amount)}</span>
            </button>
            <button className="xbtn" title="Remove this preset" onClick={() => onDelete(p.id)}>✕</button>
          </span>
        ))}
        {!adding && <button className="presetadd" onClick={() => setAdding(true)}>+ preset</button>}
      </div>
      {adding && (
        <div className="presetform">
          <input className="field" style={{ flex: 1, minWidth: 110 }} autoFocus placeholder="Preset name (e.g. Piada)"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && submit()} />
          <input className="field" style={{ width: 82 }} type="number" min="0" step="0.01" placeholder="9.74"
            value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && submit()} />
          <button className="btn" onClick={submit}>Save</button>
          <button className="btn ghost" onClick={() => { setAdding(false); setForm({ name: "", amount: "" }); }}>Cancel</button>
        </div>
      )}
    </>
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

  const updateCat = (catId, fn) => setData((prev) => ({
    ...prev,
    budget: { ...prev.budget, categories: prev.budget.categories.map((c) => (c.id === catId ? fn(c) : c)) },
  }));
  const addItem = (catId, name, amount) => updateCat(catId, (c) => ({ ...c, items: [...c.items, { id: uid(), name, amount, date: dateKey(now) }] }));
  const updateItem = (catId, itemId, patch) => updateCat(catId, (c) => ({ ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }));
  const delItem = (catId, itemId) => updateCat(catId, (c) => ({ ...c, items: c.items.filter((i) => i.id !== itemId) }));
  const addPreset = (catId, name, amount) => updateCat(catId, (c) => ({ ...c, presets: [...(c.presets || []), { id: uid(), name, amount }] }));
  const delPreset = (catId, pid) => updateCat(catId, (c) => ({ ...c, presets: (c.presets || []).filter((p) => p.id !== pid) }));
  const setIncome = (v) => setData((prev) => ({ ...prev, budget: { ...prev.budget, monthlyIncome: Math.max(0, +v || 0) } }));
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
              <PresetBar presets={c.presets || []}
                onLog={(p) => addItem(c.id, p.name, p.amount)}
                onDelete={(pid) => delPreset(c.id, pid)}
                onAdd={(name, amount) => addPreset(c.id, name, amount)} />
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
const MODE_LABEL = { work: "Pomodoro", short: "Short Break", long: "Long Break" };

/* How much work is genuinely left on a task, in minutes. A task with subtasks
   reports the sum of its *unchecked* subtasks — without this, ticking off a
   subtask changed nothing in the session totals, because `done` only counts
   finished pomodoros and a subtask isn't one. */
/* Real minutes of work left, which is not the same as sessions left times the
   session length: a ten-minute task is one session but ten minutes, and saying
   twenty-five put the finish time out by a quarter of an hour per short task.
   Progress is prorated across the task's own length, so a 50-minute task with
   one of two sessions done reports 25 minutes. `minutes` is absent on tasks
   predating the field, which fall back to the old session-based reading. */
function minutesLeft(t, workMin) {
  if (t.checked) return 0;
  const subs = t.subtasks || [];
  if (subs.length) return subs.filter((x) => !x.checked).reduce((n, x) => n + x.minutes, 0);
  const total = t.minutes || t.est * workMin;
  if (!t.est) return Math.max(0, total);
  return Math.max(0, Math.round((total * (t.est - t.done)) / t.est));
}

/* A queue entry is either a task id or "taskId::subId". Keeping the queue a flat
   list of opaque strings is what lets saved queues, the drag reorder, the room
   presence payload and the stale-id filter all carry on unchanged — there's no
   migration.

   A queued subtask resolves to an item shaped like a task whose only subtask is
   that one, which is deliberate: minutesLeft then measures it exactly, the same
   way it measures a parent's remaining subtasks, instead of rounding it up to a
   whole pomodoro the way a bare `minutes` field would. */
const QSEP = "::";
const qidFor = (taskId, subId) => (subId ? `${taskId}${QSEP}${subId}` : taskId);
const qidTask = (qid) => String(qid).split(QSEP)[0];

function resolveQueued(qid, tasks, workMin) {
  const [tid, sid] = String(qid).split(QSEP);
  const task = tasks.find((t) => t.id === tid);
  if (!task) return null;
  if (!sid) return { qid, task, sub: null, item: task };
  const sub = (task.subtasks || []).find((x) => x.id === sid);
  if (!sub) return null;
  const est = estFor(sub.minutes, workMin);
  return {
    qid, task, sub,
    item: {
      id: qid, title: sub.title, cat: task.cat, minutes: sub.minutes,
      est, done: sub.checked ? est : 0, checked: sub.checked, subtasks: [sub],
    },
  };
}
// stale entries (task or subtask deleted elsewhere) are dropped on read
const queueItems = (queueIds, tasks, workMin) =>
  (queueIds || []).map((q) => resolveQueued(q, tasks, workMin)).filter(Boolean);

/* Lays the session queue forward from `from`, stepping over anything already
   booked. This is the one place that decides when work actually happens: the
   week grid draws it, the Session list reads the events out of it, and the
   finish time is simply the end of the last block.

   Returned blocks are in order and absolute: { type: "task"|"break"|"event" }.
   An "event" block appears where the plan had to wait for it, which is what
   makes the Session list able to say "this task is after the lab meeting". */
const PLAN_CAP = 60; // stop laying out rather than spin on pathological input
function planSession(tasks, events, s, cycle, from, breaks = true) {
  const busy = events
    .map((e) => ({ id: e.id, title: e.title, start: atTime(e.date, e.start), end: atTime(e.date, e.end) }))
    .filter((b) => b.end > from && b.end > b.start)
    .sort((a, b) => a.start - b.start);

  const blocks = [];
  const noted = new Set();
  let cursor = new Date(from);
  let cyc = cycle;

  for (const t of tasks) {
    let left = minutesLeft(t, s.work);
    if (left <= 0) continue;
    const count = Math.ceil(left / s.work);
    for (let i = 0; i < count; i++) {
      if (blocks.length > PLAN_CAP) return blocks;
      /* The block is as long as the work actually left, capped at one focus
         length — not always a whole session. A ten-minute task takes ten
         minutes on the timeline, which is what makes the finish time honest. */
      const span = Math.min(left, s.work);
      const dur = span * 60000;
      // walk past every event this session would collide with
      for (let guard = 0; guard < busy.length + 1; guard++) {
        const hit = busy.find((b) => b.start < new Date(cursor.getTime() + dur) && b.end > cursor);
        if (!hit) break;
        if (!noted.has(hit.id)) { blocks.push({ type: "event", ...hit }); noted.add(hit.id); }
        cursor = new Date(hit.end.getTime());
      }
      const start = new Date(cursor);
      cursor = new Date(cursor.getTime() + dur);
      blocks.push({ type: "task", taskId: t.id, title: t.title, start, end: new Date(cursor), n: i + 1, of: count });
      left -= span;
      cyc += 1;
      if (!breaks) continue;
      const brk = (cyc % 4 === 0 ? s.long : s.short) * 60000;
      blocks.push({ type: "break", long: cyc % 4 === 0, start: new Date(cursor), end: new Date(cursor.getTime() + brk) });
      cursor = new Date(cursor.getTime() + brk);
    }
  }
  if (blocks.length && blocks[blocks.length - 1].type === "break") blocks.pop();
  return blocks;
}

/* Session totals for one person's list, plus when they'd finish starting now.
   Remaining sessions are walked one at a time so the break after each is
   counted, including the long one every 4th — that's most of the difference
   over a full day. */
function sessionStats(tasks, s, cycle, now, breaks = true) {
  const totalEst = tasks.reduce((n, t) => n + t.est, 0);
  /* Two different questions, and they want different answers. `remaining` counts
     blocks, because "Sessions 2/5" is a count of sittings and a pomodoro is
     never shared between two pieces of work — it rounds up per item, matching
     how planSession lays blocks down. The finish time is measured in real
     minutes instead: a ten-minute task should push the estimate by ten minutes,
     not by a whole focus length. */
  const remaining = tasks.reduce((n, t) => n + Math.ceil(minutesLeft(t, s.work) / s.work), 0);
  // counted rather than derived from totalEst - remaining, so it stays right
  // whatever rounding the items involve
  const doneEst = Math.min(totalEst, tasks.reduce((n, t) => n + (t.checked ? t.est : t.done), 0));
  let mins = tasks.reduce((n, t) => n + minutesLeft(t, s.work), 0);
  if (breaks) {
    for (let i = 0; i < remaining - 1; i++) mins += (cycle + i + 1) % 4 === 0 ? s.long : s.short;
  }
  mins = Math.round(mins);
  const fmtSpan = mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}` : `${mins}m`;
  return { totalEst, doneEst, remaining, finishAt: new Date(now.getTime() + mins * 60000), fmtSpan };
}

/* The session queue is a list of task ids pulled in from Work/Personal. The tasks
   themselves stay in data.tasks — the queue only references them, so checking one
   off here is the same edit as checking it off in Work, and shows up everywhere. */
/* Desktop notification when a timer runs out. Electron grants permission without
   prompting; a browser asks the first time. Silently does nothing if blocked. */
function notify(title, body) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    new Notification(title, { body, tag: "loml-timer", renotify: true });
  } catch (e) { /* unsupported or blocked */ }
}
function askNotifyPermission() {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
  } catch (e) { /* unsupported */ }
}

/* The pomodoro clock lives above the view switcher, in LordOfMyLife, so it keeps
   running when you leave the Session tab. Held inside SessionView it died on
   unmount — both the state and the interval went with the component. */
function usePomodoro(data, setData, dataRef, theme) {
  const s = data.settings;
  const durFor = (m) => (m === "work" ? s.work : m === "short" ? s.short : s.long) * 60;
  /* Read through refs at completion time, not captured: onComplete lives inside
     an interval created when `running` flipped, so anything closed over there is
     as old as the session. */
  const themeRef = useRef(theme);
  useEffect(() => { themeRef.current = theme; }, [theme]);
  const breaksRef = useRef(takesBreaks(data));
  useEffect(() => { breaksRef.current = takesBreaks(data); }, [data]);
  const [mode, setMode] = useState("work"); // work | short | long
  const [left, setLeft] = useState(() => data.settings.work * 60);
  const [running, setRunning] = useState(false);
  const [cycle, setCycle] = useState(0); // completed work sessions in current set
  const endRef = useRef(null);
  const tickRef = useRef(null);

  const switchMode = (m) => { setMode(m); setRunning(false); setLeft(durFor(m)); };
  const reset = () => { setRunning(false); setLeft(durFor(mode)); };
  const start = () => { askNotifyPermission(); setRunning((r) => !r); };

  const onComplete = () => {
    setRunning(false);
    endSound(themeRef.current);
    const breaks = breaksRef.current;
    if (mode === "work") {
      // read the queue at completion time, so a session credits whatever is
      // active when it ends rather than when it started
      const cur = dataRef.current;
      const active = queueItems(cur.sessionQueue, cur.tasks, cur.settings.work).find((q) => !q.item.checked) || null;
      const dk = dateKey(new Date());
      setData((prev) => ({
        ...prev,
        pomoLog: { ...prev.pomoLog, [dk]: (prev.pomoLog[dk] || 0) + 1 },
        // a queued subtask has no pomodoro counter of its own — it's ticked off
        // by hand, exactly as subtasks already are in Work/Personal
        tasks: active && !active.sub
          ? prev.tasks.map((t) => (t.id === active.task.id ? { ...t, done: t.done + 1 } : t))
          : prev.tasks,
      }));
      const nextCycle = cycle + 1;
      setCycle(nextCycle);
      // with breaks off the timer simply re-arms for the next focus session
      const nm = !breaks ? "work" : nextCycle % 4 === 0 ? "long" : "short";
      setMode(nm); setLeft(durFor(nm));
      const what = nm === "work" ? "another focus session is ready" : `time for a ${nm} break`;
      notify("Focus session complete", active ? `${active.title} — ${what}.` : `${what[0].toUpperCase()}${what.slice(1)}.`);
    } else {
      setMode("work"); setLeft(durFor("work"));
      notify("Break over", "Back to it — a new focus session is ready.");
    }
  };

  useEffect(() => {
    if (!running) { clearInterval(tickRef.current); return; }
    endRef.current = Date.now() + left * 1000;
    tickRef.current = setInterval(() => {
      const remain = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      /* Polled four times a second so the end is caught promptly, but the state
         only moves when the displayed second does. The digits are mm:ss, so the
         other three polls were re-rendering the entire app for nothing. */
      setLeft((prev) => (prev === remain ? prev : remain));
      if (remain === 0) { clearInterval(tickRef.current); onComplete(); }
    }, 250);
    return () => clearInterval(tickRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return { mode, left, running, cycle, durFor, switchMode, reset, start, setLeft };
}

/* ---------------- shared focus room ----------------
   Everyone in the room publishes their own queue through presence; the host
   additionally publishes the timer, and everyone else renders from it. Making
   one person authoritative is what keeps this simple — two people both able to
   start and pause would need conflict resolution for no real benefit.

   A running timer is published as an absolute `endsAt`, not a countdown, so
   every client derives the remaining seconds from its own clock and nobody
   drifts. A paused one publishes `left` instead, since there's no deadline. */
const ROOM_KEY = "lordofmylife:room";
const NAME_KEY = "lordofmylife:displayname";
const roomTaskView = (t) => ({ id: t.id, title: t.title, est: t.est, done: t.done, checked: t.checked });

// The signed-in email, purely so peers see a name rather than a random key.
function useAuthEmail() {
  const [email, setEmail] = useState(null);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    getSession().then((s) => alive && setEmail(s?.user?.email || null)).catch(() => {});
    const { data } = onAuthChange((s) => alive && setEmail(s?.user?.email || null));
    return () => { alive = false; data?.subscription?.unsubscribe(); };
  }, []);
  return email;
}

function useSessionRoom({ defaultName, myTasks, timer }) {
  const enabled = !!supabase;
  // code *and* host flag are restored together: persisting only the code meant a
  // host who reloaded rejoined as a guest and the room lost its timer authority
  const restored = (() => {
    try { return JSON.parse(sessionStorage.getItem(ROOM_KEY) || "{}"); } catch (e) { return {}; }
  })();
  const [code, setCode] = useState(restored.code || "");
  // what peers see. Defaults to the signed-in account, but stays editable —
  // without it two signed-out devices both publish the same name.
  const [nameOverride, setNameOverride] = useState(() => { try { return localStorage.getItem(NAME_KEY) || ""; } catch (e) { return ""; } });
  const myName = nameOverride || defaultName || "Someone";
  const setName = (v) => {
    setNameOverride(v);
    try { v ? localStorage.setItem(NAME_KEY, v) : localStorage.removeItem(NAME_KEY); } catch (e) { /* private mode */ }
  };
  const [isHostLocal, setIsHost] = useState(!!restored.host);
  const [peers, setPeers] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | connecting | joined | error
  const keyRef = useRef(uid());
  const connRef = useRef(null);

  useEffect(() => {
    try {
      if (code) sessionStorage.setItem(ROOM_KEY, JSON.stringify({ code, host: isHostLocal }));
      else sessionStorage.removeItem(ROOM_KEY);
    } catch (e) { /* private mode */ }
  }, [code, isHostLocal]);

  useEffect(() => {
    if (!enabled || !code) { setPeers([]); setStatus("idle"); return; }
    setStatus("connecting");
    const conn = joinRoom(code, keyRef.current, setPeers, (s) => {
      setStatus(s === "SUBSCRIBED" ? "joined" : s === "CHANNEL_ERROR" || s === "TIMED_OUT" ? "error" : "connecting");
    });
    connRef.current = conn;
    return () => { conn.leave(); connRef.current = null; };
  }, [enabled, code]);

  // republish whenever anything others can see changes
  const payload = useMemo(() => ({
    name: myName,
    host: isHostLocal,
    tasks: myTasks.slice(0, 20).map(roomTaskView),
    timer: isHostLocal
      ? { mode: timer.mode, running: timer.running, cycle: timer.cycle,
          // absolute deadline while running so guests derive from their own clock;
          // `total` rides along because the host's session lengths are theirs, not ours
          endsAt: timer.running ? Date.now() + timer.left * 1000 : null,
          left: timer.left, total: timer.durFor(timer.mode) }
      : null,
  }), [myName, isHostLocal, myTasks, timer.mode, timer.running, timer.cycle, timer.left]);

  // the timer field changes every tick; only republish on the parts peers react to
  const stable = JSON.stringify({ ...payload, timer: payload.timer && { ...payload.timer, endsAt: null, left: null } });
  useEffect(() => {
    if (status === "joined") connRef.current?.publish(payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, stable]);

  const others = peers.filter((p) => p.key !== keyRef.current);
  const hostPeer = peers.find((p) => p.host && p.key !== keyRef.current);

  return {
    code, others, status, available: enabled, isHost: isHostLocal,
    name: nameOverride, namePlaceholder: defaultName || "Your name", setName,
    inRoom: !!code && status === "joined",
    hostTimer: hostPeer?.timer || null,
    create: () => { setIsHost(true); setCode(newRoomCode()); },
    join: (c) => { setIsHost(false); setCode(c.trim().toUpperCase()); },
    leave: () => { setIsHost(false); setCode(""); setPeers([]); },
  };
}

/* A remote participant's list. Read-only: you can see what they're on and what's
   coming, but their tasks are theirs to tick off. */
function PeerColumn({ peer, s, now }) {
  const tasks = peer.tasks || [];
  const active = tasks.find((t) => !t.checked) || null;
  const st = sessionStats(tasks, s, peer.timer?.cycle || 0, now, breaksOn(s));
  return (
    <div className="qcol">
      <div className="qhead">
        <span className="h2">{peer.name || "Someone"}</span>
        <span className="catcount" style={{ marginLeft: "auto" }}>{peer.host ? "host" : "guest"}</span>
      </div>
      {tasks.map((t) => (
        <div key={t.id} className={`qrow readonly ${t.checked ? "done" : ""} ${active && t.id === active.id ? "active" : ""}`}>
          <span className="checkwrap">
            <span className={`check ${t.checked ? "on" : ""}`}>✓</span>
          </span>
          <span className="tasktitle" style={{ flex: 1, minWidth: 0 }}>{t.title}</span>
          {active && t.id === active.id && <SessionMark t={t} />}
          <span className="pcount">{t.done}/{t.est}</span>
        </div>
      ))}
      {tasks.length === 0 && <div className="emptystate" style={{ padding: "10px 2px" }}>Nothing queued yet.</div>}
      {tasks.length > 0 && (
        <div className="qfoot">
          <span>Sessions <b>{st.doneEst}/{st.totalEst}</b></span>
          {st.remaining > 0
            ? <span>Finish at <b>{fmtClock(st.finishAt)}</b> ({st.fmtSpan})</span>
            : <span><b>All done</b></span>}
        </div>
      )}
    </div>
  );
}

// what the pomodoro running right now will do to this task
const SessionMark = ({ t }) => (
  <span className="qnow">{t.done + 1 >= t.est ? "finishes this session" : "this session"}</span>
);

/* Someone else working alongside you on this device. Their tasks are typed in
   here and live on the guest (data.guests), never in data.tasks — they're not
   your work, so they must not show up in Work/Personal, the Gantt or anything
   the assistant reads. Same shape as a task otherwise, so sessionStats and
   estFor apply unchanged. */
function GuestColumn({ guest, s, cycle, now, onAddTask, onToggleTask, onDelTask, onRename, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", minutes: 25 });

  const submit = () => {
    if (!form.title.trim()) return;
    onAddTask(form.title.trim(), Math.max(5, +form.minutes || 25));
    setForm({ title: "", minutes: 25 });
    setAdding(false);
  };
  const st = sessionStats(guest.tasks, s, cycle, now, breaksOn(s));

  return (
    <div className="qcol">
      <div className="qhead">
        <input className="guestname" value={guest.name} onChange={(e) => onRename(e.target.value)}
          aria-label="Person's name" />
        <button className="xbtn" style={{ marginLeft: "auto" }} title={`Remove ${guest.name}`} onClick={onRemove}>✕</button>
      </div>

      {guest.tasks.map((t) => (
        <div key={t.id} className={`qrow ${t.checked ? "done" : ""}`} onClick={() => onToggleTask(t.id)} title="Click to mark done">
          <span className="checkwrap">
            <button className={`check ${t.checked ? "on" : ""}`} aria-label={t.checked ? "Mark not done" : "Mark done"}>✓</button>
          </span>
          <span className="tasktitle" style={{ flex: 1, minWidth: 0 }}>{t.title}</span>
          <span className="taskmin">{t.minutes} min</span>
          <span className="pcount">{t.done}/{t.est}</span>
          <button className="xbtn" title="Remove task" onClick={(e) => { e.stopPropagation(); onDelTask(t.id); }}>✕</button>
        </div>
      ))}
      {guest.tasks.length === 0 && !adding && <div className="emptystate" style={{ padding: "10px 2px" }}>No tasks yet.</div>}

      {adding ? (
        <div className="pickpanel">
          <input className="field" style={{ width: "100%" }} autoFocus placeholder="What are they working on?"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && submit()} />
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
            <input type="number" min="5" step="5" className="field" style={{ width: 70 }} value={form.minutes}
              onChange={(e) => setForm({ ...form, minutes: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
            <span style={{ fontSize: 13, color: "var(--muted)" }}>min</span>
            <button className="btn primary" style={{ marginLeft: "auto" }} onClick={submit}>Add</button>
            <button className="btn ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="qadd" onClick={() => setAdding(true)}>✛ Add Task</button>
      )}

      {guest.tasks.length > 0 && (
        <div className="qfoot">
          <span>Sessions <b>{st.doneEst}/{st.totalEst}</b></span>
          {st.remaining > 0
            ? <span>Finish at <b>{fmtClock(st.finishAt)}</b> ({st.fmtSpan})</span>
            : <span><b>All done</b></span>}
        </div>
      )}
    </div>
  );
}

/* A queued task. The subtask list is a *sibling* of .qrow, not a child — the row
   itself completes the task on click, so nesting the subtasks inside it would
   mean checking a subtask also ticked off its parent. */
function QueueRow({ entry, data, setData, now, isActive, burst, setBurst, onComplete, onRemove, drag }) {
  const [expanded, setExpanded] = useState(false);
  const t = entry.item;
  // A queued subtask is one line of work, not a container: it shows its parent
  // for context and has nothing to expand. Only a whole task offers the list.
  const isSub = !!entry.sub;
  const subs = isSub ? [] : t.subtasks || [];
  const doneSubs = subs.filter((x) => x.checked).length;
  const burstId = isSub ? entry.sub.id : t.id;
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  return (
    <>
      <div className={`qrow ${t.checked ? "done" : ""} ${burstClass(burst, burstId)} ${isActive ? "active" : ""} ${drag?.dragging ? "dragging" : ""} ${drag?.over || ""}`}
        onClick={onComplete} title="Click to mark done · drag to reorder"
        {...dragHandlers(drag)}>
        <span className="checkwrap">
          <button className={`check ${t.checked ? "on" : ""}`} aria-label={t.checked ? "Mark not done" : "Mark done"}>✓</button>
          {burst?.id === burstId && burst.kind === "done" && Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="particle" style={{
              background: catColorFor(allCats(data), t.cat),
              "--dx": `${Math.cos((i / 8) * 6.28) * 26}px`,
              "--dy": `${Math.sin((i / 8) * 6.28) * 26}px`,
            }} />
          ))}
        </span>
        <span className="tasktitle" style={{ flex: 1, minWidth: 0 }}>
          {t.title}
          {isSub && <span className="qparent"> · {entry.task.title}</span>}
        </span>
        {isActive && !t.checked && <SessionMark t={t} />}
        {subs.length > 0 && <span className="subprogress">{doneSubs}/{subs.length}</span>}
        <span className="pcount">{t.done}/{t.est}</span>
        {!isSub && (
          <button className="subtoggle" title={expanded ? "Hide subtasks" : "Subtasks"}
            onClick={stop(() => setExpanded((v) => !v))}>{expanded ? "▾" : "▸"}</button>
        )}
        <button className="xbtn" title="Remove from session" onClick={stop(onRemove)}>✕</button>
      </div>

      {expanded && (
        <div className="subtasks qsubtasks">
          {subs.map((sb) => (
            <SubtaskRow key={sb.id} sub={sb} now={now}
              onToggle={() => toggleSubtask(data, setData, t.id, sb.id, setBurst)}
              onDelete={() => delSubtask(data, setData, t.id, sb.id, setBurst)}
              onEdit={(patch) => editSubtask(data, setData, t.id, sb.id, patch, setBurst)} />
          ))}
          <AddSubtaskRow onAdd={(title, minutes, dueDate) => addSubtask(data, setData, t.id, title, minutes, dueDate, setBurst)} />
        </div>
      )}
    </>
  );
}

/* Adding an existing task is a drill-down — Work/Personal, then section, then
   task — rather than one list of every open task with its sections as headings.
   The flat list was fine with a handful of tasks and unreadable past that.

   A task that has subtasks opens its subtask list instead of being added whole:
   the usual intent with such a task is to work through parts of it, not to sit
   down to all of it. Adding it whole is still offered there, and only while it
   isn't already queued. Picking subtasks leaves the list open, since you're
   normally taking several; picking a whole task closes it. */
function QueuePicker({ data, queueIds, onAdd, onClose }) {
  const [group, setGroup] = useState(null);
  const [catId, setCatId] = useState(null);
  const [taskId, setTaskId] = useState(null);

  const queued = new Set(queueIds);
  const subsOf = (t) => t.subtasks || [];
  const openSubs = (t) => subsOf(t).filter((sb) => !sb.checked && !queued.has(qidFor(t.id, sb.id)));
  // Queued whole, a task drops out entirely rather than still offering its
  // parts: the queue would otherwise hold the task *and* pieces of it and count
  // that time twice. The whole-task button is guarded the other way round.
  const offerable = (t) => !t.checked && !queued.has(t.id) && (subsOf(t).length ? openSubs(t).length > 0 : true);
  const anySubQueued = (t) => subsOf(t).some((sb) => queued.has(qidFor(t.id, sb.id)));
  const open = data.tasks.filter(offerable);
  const countIn = (g) => open.filter((t) => catsIn(data, g).some((c) => c.id === t.cat)).length;

  const cats = group ? catsIn(data, group) : [];
  const task = taskId ? data.tasks.find((t) => t.id === taskId) : null;
  const back = () => (task ? setTaskId(null) : catId ? setCatId(null) : setGroup(null));

  const crumb = [
    group === "work" ? "Work" : group === "personal" ? "Personal" : null,
    catId ? cats.find((c) => c.id === catId)?.name : null,
    task ? task.title : null,
  ].filter(Boolean).join(" › ");

  const done = <button className="btn" style={{ marginTop: 6, width: "100%" }} onClick={onClose}>Done</button>;
  const header = group && (
    <div className="pickcrumb">
      <button className="btn ghost" style={{ padding: "2px 8px" }} onClick={back}>‹ Back</button>
      <span className="pickpath" title={crumb}>{crumb}</span>
    </div>
  );

  let body;
  if (task) {
    const subs = openSubs(task);
    body = (
      <>
        {subs.map((sb) => (
          <button key={sb.id} className="pickitem" onClick={() => onAdd(qidFor(task.id, sb.id))}>
            <span style={{ flex: 1, minWidth: 0 }}>{sb.title}</span>
            <span className="picksub">{sb.minutes} min</span>
          </button>
        ))}
        {!subs.length && (
          <div className="emptystate" style={{ padding: "12px 8px" }}>
            Every subtask here is already queued or done.
          </div>
        )}
        {!anySubQueued(task) && (
          <button className="pickitem" style={{ borderTop: "1px solid var(--line)", marginTop: 4 }}
            onClick={() => { onAdd(task.id); onClose(); }}>
            <span style={{ flex: 1, minWidth: 0, color: "var(--muted)" }}>Add the whole task instead</span>
          </button>
        )}
      </>
    );
  } else if (catId) {
    const list = open.filter((t) => t.cat === catId);
    body = list.map((t) => {
      const n = openSubs(t).length;
      return subsOf(t).length ? (
        <button key={t.id} className="pickitem" onClick={() => setTaskId(t.id)}>
          <span style={{ flex: 1, minWidth: 0 }}>{t.title}</span>
          <span className="picksub">{n} subtask{n === 1 ? "" : "s"}</span>
          <span className="pickchev">›</span>
        </button>
      ) : (
        <button key={t.id} className="pickitem" onClick={() => { onAdd(t.id); onClose(); }}>
          <span style={{ flex: 1, minWidth: 0 }}>{t.title}</span>
          <span className="pcount">{t.done}/{t.est}</span>
        </button>
      );
    });
  } else if (group) {
    body = cats.map((c) => {
      const n = open.filter((t) => t.cat === c.id).length;
      return (
        <button key={c.id} className="pickitem" disabled={!n} onClick={() => setCatId(c.id)}>
          <span className="pickcat" style={{ color: c.color, padding: 0 }}>{c.name}</span>
          <span style={{ flex: 1 }} />
          <span className="picksub">{n}</span>
          <span className="pickchev">›</span>
        </button>
      );
    });
  } else {
    body = [["work", "Work"], ["personal", "Personal"]].map(([g, label]) => {
      const n = countIn(g);
      return (
        <button key={g} className="pickitem" disabled={!n} onClick={() => setGroup(g)}>
          <span className="pickgroup" style={{ padding: 0 }}>{label}</span>
          <span style={{ flex: 1 }} />
          <span className="picksub">{n}</span>
          <span className="pickchev">›</span>
        </button>
      );
    });
  }

  return (
    <div className="pickpanel">
      {header}
      {body}
      {!group && !open.length && (
        <div className="emptystate" style={{ padding: "12px 8px" }}>
          Nothing left to add — every open task is already in this session.
        </div>
      )}
      {done}
    </div>
  );
}

function SessionView({ data, setData, sessionEmoji, now, timer, session, plan = [] }) {
  const s = data.settings;
  const breaks = breaksOn(s);
  const [roomInput, setRoomInput] = useState("");
  const { durFor, switchMode, reset, start, setLeft } = timer;

  /* In a room, the host's timer is the one everyone sees. Guests derive the
     countdown from the host's absolute `endsAt` against their own clock, so no
     drift accumulates and no per-second messages are needed. */
  const remote = session?.inRoom && session.hostTimer ? session.hostTimer : null;
  const canControl = !remote;
  const mode = remote ? remote.mode : timer.mode;
  const running = remote ? remote.running : timer.running;
  const cycle = remote ? remote.cycle : timer.cycle;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!remote || !remote.running) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [remote && remote.running, remote && remote.endsAt]);
  const left = remote
    ? (remote.running ? Math.max(0, Math.round((remote.endsAt - Date.now()) / 1000)) : remote.left)
    : timer.left;
  const [picking, setPicking] = useState(false);
  // group/cat persist between adds — several new tasks in a row usually share them
  const [draft, setDraft] = useState({ title: "", minutes: 25, group: "work", cat: "" });
  const [creating, setCreating] = useState(false);
  const [burst, setBurst] = useState(null);
  const qDragRef = useRef(null);
  const [qDragId, setQDragId] = useState(null);
  const [qOverId, setQOverId] = useState(null);

  const queueIds = data.sessionQueue || [];
  const entries = queueItems(queueIds, data.tasks, s.work);
  const queue = entries.map((q) => q.item);
  const activeEntry = entries.find((q) => !q.item.checked) || null;
  const active = activeEntry?.item || null;
  const activeNo = activeEntry ? entries.indexOf(activeEntry) + 1 : 0;

  /* Dismissing an event doesn't delete it — it only stops it blocking the plan,
     because plenty of things on a calendar aren't really time you can't work in.
     Held as a list of ids so it works for pulled Google events too, which live
     in component state and have nothing to hang a flag on. */
  const ignored = data.ignoredEvents || [];
  const ignoreEvent = (id) =>
    setData((prev) => ({ ...prev, ignoredEvents: [...(prev.ignoredEvents || []), id] }));
  const unignoreAll = () => setData((prev) => ({ ...prev, ignoredEvents: [] }));

  const setQueue = (ids) => setData((prev) => ({ ...prev, sessionQueue: ids }));
  // closing is the picker's call, not this one's — it stays open across subtask picks
  const addToQueue = (qid) => setData((prev) => {
    const ids = prev.sessionQueue || [];
    return ids.includes(qid) ? prev : { ...prev, sessionQueue: [...ids, qid] };
  });
  // A task typed in here is an ordinary task, filed under a real category, so it
  // shows up in Work/Personal like any other. The task and its queue entry are
  // written in one setData — two writes off the same `data` would drop the first.
  const draftCats = catsIn(data, draft.group);
  const draftCat = draftCats.some((c) => c.id === draft.cat) ? draft.cat : draftCats[0]?.id || "";
  const createTask = () => {
    const title = draft.title.trim();
    if (!title || !draftCat) return;
    const minutes = Math.max(5, +draft.minutes || 25);
    const id = uid();
    setData((prev) => ({
      ...prev,
      tasks: [...prev.tasks, {
        id, title, cat: draftCat, minutes, est: estFor(minutes, prev.settings.work),
        done: 0, checked: false, oneOnOne: false, dueDate: null,
      }],
      sessionQueue: [...(prev.sessionQueue || []), id],
    }));
    setDraft({ ...draft, title: "", minutes: 25, cat: draftCat });
    setCreating(false);
  };
  const removeFromQueue = (id) =>
    setData((prev) => ({ ...prev, sessionQueue: (prev.sessionQueue || []).filter((x) => x !== id) }));
  // reordering the queue also moves which task is active, since "active" is just
  // the first unchecked one — that's the point of being able to drag them
  const moveInQueue = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    setData((prev) => {
      const ids = [...(prev.sessionQueue || [])];
      const fi = ids.indexOf(fromId), ti = ids.indexOf(toId);
      if (fi < 0 || ti < 0) return prev;
      ids.splice(ti, 0, ids.splice(fi, 1)[0]);
      return { ...prev, sessionQueue: ids };
    });
  };
  const guests = data.guests || [];
  const updateGuest = (gid, fn) =>
    setData((prev) => ({ ...prev, guests: (prev.guests || []).map((g) => (g.id === gid ? fn(g) : g)) }));
  const addGuest = () => setData((prev) => {
    const list = prev.guests || [];
    return { ...prev, guests: [...list, { id: uid(), name: `Person ${list.length + 2}`, tasks: [] }] };
  });
  const addGuestTask = (gid, title, minutes) => updateGuest(gid, (g) => ({
    ...g,
    tasks: [...g.tasks, { id: uid(), title, minutes, est: estFor(minutes, s.work), done: 0, checked: false }],
  }));
  const toggleGuestTask = (gid, tid) => updateGuest(gid, (g) => ({
    ...g, tasks: g.tasks.map((t) => (t.id === tid ? { ...t, checked: !t.checked } : t)),
  }));

  const endQDrag = () => { qDragRef.current = null; setQDragId(null); setQOverId(null); };
  const qDrag = (id) => ({
    dragging: qDragId === id,
    over: qOverId === id && qDragRef.current && qDragRef.current !== id
      ? (queueIds.indexOf(qDragRef.current) < queueIds.indexOf(id) ? "dragover-after" : "dragover-before")
      : "",
    onStart: () => { qDragRef.current = id; setTimeout(() => { if (qDragRef.current === id) setQDragId(id); }, 0); },
    onEnd: endQDrag,
    onOver: () => setQOverId((o) => (o === id ? o : id)),
    onLeave: () => setQOverId((o) => (o === id ? null : o)),
    onDrop: () => { moveInQueue(qDragRef.current, id); endQDrag(); },
  });
  const completeTask = (q) => {
    if (q.sub) toggleSubtask(data, setData, q.task.id, q.sub.id, setBurst);
    else if ((q.task.subtasks || []).length) toggleAllSubtasks(data, setData, q.task.id, setBurst);
    else toggleTask(data, setData, q.task, setBurst);
  };

  const total = remote ? remote.total || durFor(mode) : durFor(mode);
  const pct = 1 - left / total;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  const stats = sessionStats(queue, s, cycle, now, breaks);
  const { totalEst, doneEst, remaining } = stats;
  // when the plan had to route around meetings, its end is the honest answer
  const planned = plan.length ? plan[plan.length - 1].end : null;
  const finishAt = planned || stats.finishAt;
  const spanMin = Math.round((finishAt - now) / 60000);
  const fmtSpan = spanMin >= 60 ? `${Math.floor(spanMin / 60)}h${spanMin % 60 ? ` ${spanMin % 60}m` : ""}` : `${Math.max(0, spanMin)}m`;
  /* Events the plan had to wait for, attached to the task they affect. The two
     cases read very differently and must not be conflated: an event before a
     task's first session means the whole task happens afterwards, while one
     landing between its sessions means the task is interrupted and only
     *finishes* afterwards. */
  const blockers = useMemo(() => {
    const map = {}; const started = new Set(); let pending = [];
    for (const b of plan) {
      if (b.type === "event") { pending.push(b); continue; }
      if (b.type !== "task") continue;
      const rec = map[b.taskId] || (map[b.taskId] = { before: [], during: [] });
      if (pending.length) {
        (started.has(b.taskId) ? rec.during : rec.before).push(...pending);
        pending = [];
      }
      started.add(b.taskId);
    }
    return map;
  }, [plan]);

  const setDur = (k, v) => {
    const val = Math.max(1, Math.min(120, +v || 1));
    setData((prev) => ({
      ...prev,
      settings: { ...prev.settings, [k]: val },
      tasks: k === "work" ? recomputeSessions(prev.tasks, val) : prev.tasks,
      // guests' tasks track the focus length too — they're the same shape
      guests: k === "work"
        ? (prev.guests || []).map((g) => ({ ...g, tasks: recomputeSessions(g.tasks, val) }))
        : prev.guests,
    }));
    if (!running) setLeft((k === "work" && mode === "work") || (k === "short" && mode === "short") || (k === "long" && mode === "long") ? val * 60 : left);
  };

  return (
    <div className={`focuswrap ${guests.length || (session?.others || []).length ? "multi" : ""}`}>
      <div className={`pomocard ${mode === "work" ? "" : "brk"} ${running ? "running" : ""}`}>
        <div className="pomoprog" style={{ width: `${pct * 100}%` }} />
        <div className="pomotabs">
          {["work", "short", "long"].map((m) => (
            <button key={m} className={`pomotab ${mode === m ? "on" : ""}`} disabled={!canControl}
              onClick={() => switchMode(m)}>{MODE_LABEL[m]}</button>
          ))}
        </div>
        <div className="pomodigits">{mm}:{ss}</div>
        {canControl ? (
          <div>
            <button className="pomostart" onClick={start}>{running ? "Pause" : "Start"}</button>
            {(left !== total || running) && <button className="pomoreset" onClick={reset}>reset</button>}
          </div>
        ) : (
          <div className="pomofollow">following {session.others.find((p) => p.host)?.name || "the host"}'s timer</div>
        )}
      </div>

      <div className="pomonow">
        {active ? <>#{activeNo}<strong>{active.title}</strong></> : <>Nothing queued — add a task below, or just focus.</>}
      </div>

      <div className="qcols">
      <div className="qcol">
      <div className="qhead">
        <span className="h2">{guests.length ? "You" : "Tasks"}</span>
        <span className="catcount" style={{ marginLeft: "auto" }}>
          today {sessionEmoji} ×{data.pomoLog[dateKey(now)] || 0} · {cycle % 4}/4 to long break
        </span>
      </div>

      {entries.map((q) => {
        const t = q.item;
        return (
        <React.Fragment key={q.qid}>
        {(blockers[t.id]?.before || []).map((ev) => (
          <div className="qevent" key={ev.id} title="Booked — the session picks up afterwards">
            <span className="qeventtime">{fmtClock(ev.start)}–{fmtClock(ev.end)}</span>
            <span className="qeventtitle">{ev.title}</span>
            <span className="qeventnote">everything below is after this</span>
            <button className="xbtn" title="Not really blocking — plan straight through it"
              onClick={() => ignoreEvent(ev.id)}>✕</button>
          </div>
        ))}
        <QueueRow entry={q} data={data} setData={setData} now={now}
          isActive={!!active && t.id === active.id} burst={burst} setBurst={setBurst}
          onComplete={() => completeTask(q)} onRemove={() => removeFromQueue(q.qid)}
          drag={qDrag(q.qid)} />
        {(blockers[t.id]?.during || []).map((ev) => (
          <div className="qevent during" key={ev.id} title="This lands in the middle of the task above">
            <span className="qeventtime">{fmtClock(ev.start)}–{fmtClock(ev.end)}</span>
            <span className="qeventtitle">{ev.title}</span>
            <span className="qeventnote">the task above only finishes after this</span>
            <button className="xbtn" title="Not really blocking — plan straight through it"
              onClick={() => ignoreEvent(ev.id)}>✕</button>
          </div>
        ))}
        </React.Fragment>
        );
      })}

      {picking ? (
        <QueuePicker data={data} queueIds={queueIds} onAdd={addToQueue} onClose={() => setPicking(false)} />
      ) : creating ? (
        <div className="pickpanel">
          <input className="field" style={{ width: "100%" }} autoFocus placeholder="What are you working on?"
            value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && createTask()} />
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
            <input type="number" min="5" step="5" className="field" style={{ width: 70 }} value={draft.minutes}
              onChange={(e) => setDraft({ ...draft, minutes: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && createTask()} />
            <span style={{ fontSize: 13, color: "var(--muted)" }}>min</span>
            <select className="field" style={{ flex: 1, minWidth: 0 }} value={draft.group}
              onChange={(e) => setDraft({ ...draft, group: e.target.value, cat: "" })}>
              <option value="work">Work</option>
              <option value="personal">Personal</option>
            </select>
            <select className="field" style={{ flex: 1, minWidth: 0 }} value={draftCat}
              disabled={!draftCats.length}
              onChange={(e) => setDraft({ ...draft, cat: e.target.value })}>
              {draftCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {!draftCats.length && (
            <div className="emptystate" style={{ padding: "10px 2px" }}>
              No sections in {draft.group === "work" ? "Work" : "Personal"} yet — add one there first.
            </div>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button className="btn primary" style={{ marginLeft: "auto" }}
              disabled={!draft.title.trim() || !draftCat} onClick={createTask}>Add</button>
            <button className="btn ghost" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6 }}>
          <button className="qadd" style={{ flex: 1 }} onClick={() => setPicking(true)}>✛ Add Task</button>
          <button className="qadd" style={{ flex: 1 }} onClick={() => setCreating(true)}>✎ New Task</button>
        </div>
      )}

      {queue.length > 0 && (
        <div className="qfoot">
          <span>Sessions <b>{doneEst}/{totalEst}</b></span>
          {remaining > 0 && <span>Finish at <b>{fmtClock(finishAt)}</b> ({fmtSpan})</span>}
          {remaining === 0 && <span><b>All done</b> — nothing left in this session.</span>}
          {ignored.length > 0 && (
            <button className="btn ghost" style={{ marginLeft: "auto" }} onClick={unignoreAll}
              title="Let these block the plan again">
              {ignored.length} event{ignored.length === 1 ? "" : "s"} ignored — restore
            </button>
          )}
        </div>
      )}
      </div>

      {(session?.others || []).map((p) => <PeerColumn key={p.key} peer={p} s={s} now={now} />)}

      {guests.map((g) => (
        <GuestColumn key={g.id} guest={g} s={s} cycle={cycle} now={now}
          onAddTask={(title, minutes) => addGuestTask(g.id, title, minutes)}
          onToggleTask={(tid) => toggleGuestTask(g.id, tid)}
          onDelTask={(tid) => updateGuest(g.id, (x) => ({ ...x, tasks: x.tasks.filter((t) => t.id !== tid) }))}
          onRename={(name) => updateGuest(g.id, (x) => ({ ...x, name }))}
          onRemove={() => setData((prev) => ({ ...prev, guests: (prev.guests || []).filter((x) => x.id !== g.id) }))} />
      ))}
      </div>

      <div className="qpeople">
        <button className="qaddperson" onClick={addGuest}>✛ Add person here</button>
        {session && (session.inRoom || session.code ? (
          <>
            <span className="roomcode" title="Share this code so someone can join">{session.code}</span>
            <input className="field roomname" placeholder={session.namePlaceholder} aria-label="Name others see"
              value={session.name} onChange={(e) => session.setName(e.target.value)} />
            <span className="roomstatus">
              {session.status === "joined"
                ? `${session.others.length + 1} in the room`
                : session.status === "error" ? "connection problem" : "connecting…"}
            </span>
            <button className="qaddperson" onClick={session.leave}>Leave room</button>
          </>
        ) : session.available ? (
          <>
            <button className="qaddperson" onClick={session.create}>✦ Start a shared room</button>
            <input className="field roomjoin" placeholder="or enter a code" maxLength={6}
              value={roomInput} onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter" && roomInput.trim()) { session.join(roomInput); setRoomInput(""); } }} />
          </>
        ) : (
          <span className="roomstatus">Sign in to share a room with someone else.</span>
        ))}
      </div>

      <div className="durs">
        <label>focus <input type="number" className="field" value={s.work} onChange={(e) => setDur("work", e.target.value)} /> min</label>
        {breaks && <label>short <input type="number" className="field" value={s.short} onChange={(e) => setDur("short", e.target.value)} /> min</label>}
        {breaks && <label>long <input type="number" className="field" value={s.long} onChange={(e) => setDur("long", e.target.value)} /> min</label>}
        <label title="Run focus sessions back to back, with no break between them">
          <input type="checkbox" checked={breaks}
            onChange={(e) => setData((prev) => ({ ...prev, settings: { ...prev.settings, breaks: e.target.checked } }))} />
          {" "}breaks
        </label>
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
      const cats = allCats(data);
      let list = data.tasks.filter((t) => cats.some((c) => c.id === t.cat));
      if (input.cat) list = list.filter((t) => t.cat === input.cat);
      if (!input.includeCompleted) list = list.filter((t) => !t.checked);
      // categories ride along: the user can add their own, so the model can't
      // rely on a fixed set baked into its tool schema
      return same({
        categories: cats.map((c) => ({ id: c.id, name: c.name, group: c.group })),
        tasks: list.map(aiTask),
      });
    }

    case "create_task": {
      const cats = allCats(data);
      if (!cats.some((c) => c.id === input.cat)) {
        return same({ error: `Unknown category "${input.cat}". Use one of: ${cats.map((c) => c.id).join(", ")}.` });
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
