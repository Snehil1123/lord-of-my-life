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
  --fsz-body:16.5px; --fsz-meta:15.5px; --fsz-mono:13px;
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
.fw[data-theme="fantasy"] .projmeta,
.fw[data-theme="fantasy"] .legendamt,
.fw[data-theme="fantasy"] .legendpct,
.fw[data-theme="fantasy"] .presetamt,
.fw[data-theme="fantasy"] .budgetamt-input,
.fw[data-theme="fantasy"] .budgetdollar,
.fw[data-theme="fantasy"] .gaugesub,
.fw[data-theme="fantasy"] .todaypomos,
.fw[data-theme="fantasy"] .aitool{font-size:var(--fsz-mono);}
.fw[data-theme="fantasy"] .catname{font-size:15px;}
.fw[data-theme="fantasy"] .tab{font-size:16px;}
.fw[data-theme="fantasy"] .h2{font-size:26px;}
.fw[data-theme="fantasy"] .projname{font-size:18.5px;}
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
.taskrow.dragging, .qrow.dragging{opacity:.4;}
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
.subtaskrow.overdue{border-radius:6px; animation:overdueglow 1.3s ease-in-out infinite;}
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
  return resetRecurringTasks(ensureCatSeed(ensureBudgetSeed(ensureRecurringSeeds(d))));
}

// Assistant panel width — a per-device UI preference like the theme, not synced data.
const AIW_KEY = "lordofmylife:aiwidth";
const AIW_MIN = 300, AIW_MAX = 860;

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

  // held here, not in SessionView, so the countdown survives switching tabs
  const timer = usePomodoro(data, setData, dataRef);

  const sessionEmoji = theme === "fantasy" ? "🕯️" : "🍅";
  const assistantLabel = theme === "fantasy" ? "Wizard" : "Assistant";
  const todayPomos = data.pomoLog[dateKey(new Date())] || 0;

  return (
    <div className={`fw ${aiOpen ? "aiopen" : ""}`} data-theme={theme} style={{ "--aiw": `${aiWidth}px` }}>
      <style>{CSS}</style>
      {theme === "fantasy" && <FantasyScene />}
      <header className="hd">
        <button className="brand" title={`Switch to the ${THEMES[theme]} theme`} onClick={() => setTheme(THEMES[theme])}>
          Lord of <em>my Life</em>
        </button>
        <span className="wkchip">{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
        {todayPomos > 0 && <span className="todaypomos">{sessionEmoji} ×{todayPomos} today</span>}
        <nav className="tabs">
          {[["work", "Work"], ["personal", "Personal"], ["gantt", "Gantt Chart"], ["budget", "Budget"], ["session", "Session"]].map(([k, label]) => (
            <button key={k} className={`tab ${view === k ? "on" : ""}`} onClick={() => setView(k)}>{label}</button>
          ))}
        </nav>
        {!aiOpen && <button className="btn ghost" title={`Open the ${assistantLabel.toLowerCase()}`} onClick={() => setAiOpen(true)}>✦ {assistantLabel}</button>}
        <SyncBar data={data} setData={setData} />
      </header>
      <main className="wrap">
        {view === "gantt" && <GanttView data={data} setData={setData} now={now} />}
        {view === "work" && <WorkView data={data} setData={setData} now={now} sessionEmoji={sessionEmoji} />}
        {view === "session" && <SessionView data={data} setData={setData} sessionEmoji={sessionEmoji} now={now} timer={timer} />}
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

function TaskRow({ t, burst, onToggle, onToggleAll, onDelete, onEdit, onAddSubtask, onToggleSubtask, onDeleteSubtask, onEditSubtask, now, sessionMin, inSession, sessionEmoji, dragging, onDragStart, onDragEnd, onDropOn }) {
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
      <div className={`taskrow ${t.checked ? "done" : ""} ${burstClass(burst, t.id)} ${dragging ? "dragging" : ""} ${urgency === "due-today" ? "due-today" : ""} ${urgency === "overdue" ? "overdue" : ""}`}
        draggable={!!onDragStart}
        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart?.(); }}
        onDragEnd={() => onDragEnd?.()}
        onDragOver={(e) => onDropOn && e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onDropOn?.(); }}
        title="Drag to reorder">
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
              onEdit={(patch) => onEditSubtask(s.id, patch)} now={now} />
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
  setData({
    ...data,
    tasks: data.tasks.map((x) => (x.id === t.id
      ? { ...x, checked: nowChecked, completedDate: nowChecked ? dateKey(new Date()) : x.completedDate }
      : x)),
  });
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
  const task = data.tasks.find((t) => t.id === taskId);
  const wasChecked = task.checked;
  let updated = deriveFromSubtasks(fn(task), data.settings.work);
  if (!wasChecked && updated.checked) {
    updated = { ...updated, completedDate: dateKey(new Date()) };
    fireBurst(setBurst, taskId, "done");
  } else if (wasChecked && !updated.checked) {
    // unchecking a subtask reopens the parent — heal it, same as unchecking it directly
    fireBurst(setBurst, taskId, "undone");
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
// editing a subtask's minutes/due date re-derives the parent's totals, same as adding one
const editSubtask = (data, setData, taskId, subId, patch, setBurst) => updateSubtasks(
  data, setData, taskId,
  (t) => ({ ...t, subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, ...patch } : s)) }),
  setBurst,
);
// clicking the parent checkbox on a task with subtasks checks/unchecks all of them at once
const toggleAllSubtasks = (data, setData, taskId, setBurst) => {
  const task = data.tasks.find((t) => t.id === taskId);
  const target = !task.checked;
  updateSubtasks(data, setData, taskId, (t) => ({ ...t, subtasks: t.subtasks.map((s) => ({ ...s, checked: target })) }), setBurst);
};

function SubtaskRow({ sub, onToggle, onDelete, onEdit, now }) {
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

/* ================= WORK / PERSONAL =================
   Both are the same view over a different `group` of categories, so they share
   one body. Categories come from data.categories, so the sections here are
   whatever the user has made rather than a fixed list. */
function TaskGroupView({ data, setData, now, group, title, sessionEmoji }) {
  const [burst, setBurst] = useState(null); // task id currently bursting
  const [newCat, setNewCat] = useState("");
  // the dragged id lives in a ref, not state: the drop handler needs it synchronously
  // and must not depend on a re-render having landed between dragstart and drop
  const dragRef = useRef(null);
  const [dragId, setDragId] = useState(null); // mirror, purely for the drag styling
  const taskDragRef = useRef(null);
  const [taskDragId, setTaskDragId] = useState(null);
  const queued = new Set(data.sessionQueue || []);

  const cats = catsIn(data, group);
  const tasks = data.tasks.filter((t) => cats.some((c) => c.id === t.cat));

  const addTask = (catId, title2, minutes, oneOnOne, dueDate) => {
    const est = estFor(minutes, data.settings.work);
    setData({ ...data, tasks: [...data.tasks, { id: uid(), title: title2, cat: catId, minutes, est, done: 0, checked: false, oneOnOne, dueDate }] });
  };
  const toggle = (t) => toggleTask(data, setData, t, setBurst);
  const delTask = (id) => setData({ ...data, tasks: data.tasks.filter((x) => x.id !== id) });
  const edit = (id, patch) => editTask(data, setData, id, patch);
  const toggleAll = (id) => toggleAllSubtasks(data, setData, id, setBurst);
  const addSub = (id, t2, minutes, dueDate) => addSubtask(data, setData, id, t2, minutes, dueDate, setBurst);
  const toggleSub = (id, subId) => toggleSubtask(data, setData, id, subId, setBurst);
  const delSub = (id, subId) => delSubtask(data, setData, id, subId, setBurst);
  const editSub = (id, subId, patch) => editSubtask(data, setData, id, subId, patch, setBurst);

  const addCat = () => {
    const name = newCat.trim();
    if (!name) return;
    const list = allCats(data);
    setData({
      ...data,
      categories: [...list, { id: catIdFor(name, list), name, color: CAT_COLORS[list.length % CAT_COLORS.length], group }],
    });
    setNewCat("");
  };
  // only ever offered for an empty section — deleting one with tasks would strand
  // them somewhere they can never be seen again
  const delCat = (id) => setData({ ...data, categories: allCats(data).filter((c) => c.id !== id) });

  // Same shuffle-and-write-back as moveCat, but over one category's slots in the
  // flat tasks array. Dropping onto another category's row is ignored — a drag
  // reorders, it doesn't refile.
  const moveTask = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    const all = data.tasks;
    const from = all.find((t) => t.id === fromId), to = all.find((t) => t.id === toId);
    if (!from || !to || from.cat !== to.cat) return;
    const ids = all.filter((t) => t.cat === from.cat).map((t) => t.id);
    const fi = ids.indexOf(fromId), ti = ids.indexOf(toId);
    if (fi < 0 || ti < 0) return;
    ids.splice(ti, 0, ids.splice(fi, 1)[0]);
    const byId = Object.fromEntries(all.map((t) => [t.id, t]));
    let i = 0;
    setData({ ...data, tasks: all.map((t) => (t.cat === from.cat ? byId[ids[i++]] : t)) });
  };

  // Reorder within this group only: the group's ids are shuffled, then written back
  // into the slots this group already occupies, so the other group stays put.
  const moveCat = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    const list = allCats(data);
    const ids = list.filter((c) => c.group === group).map((c) => c.id);
    const from = ids.indexOf(fromId), to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    const byId = Object.fromEntries(list.map((c) => [c.id, c]));
    let i = 0;
    setData({ ...data, categories: list.map((c) => (c.group === group ? byId[ids[i++]] : c)) });
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
                  inSession={queued.has(t.id)} sessionEmoji={sessionEmoji}
                  dragging={taskDragId === t.id}
                  onDragStart={() => { taskDragRef.current = t.id; setTaskDragId(t.id); }}
                  onDragEnd={() => { taskDragRef.current = null; setTaskDragId(null); }}
                  onDropOn={() => { moveTask(taskDragRef.current, t.id); taskDragRef.current = null; setTaskDragId(null); }}
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

  const updateCat = (catId, fn) => setData({
    ...data,
    budget: { ...budget, categories: budget.categories.map((c) => (c.id === catId ? fn(c) : c)) },
  });
  const addItem = (catId, name, amount) => updateCat(catId, (c) => ({ ...c, items: [...c.items, { id: uid(), name, amount, date: dateKey(now) }] }));
  const updateItem = (catId, itemId, patch) => updateCat(catId, (c) => ({ ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }));
  const delItem = (catId, itemId) => updateCat(catId, (c) => ({ ...c, items: c.items.filter((i) => i.id !== itemId) }));
  const addPreset = (catId, name, amount) => updateCat(catId, (c) => ({ ...c, presets: [...(c.presets || []), { id: uid(), name, amount }] }));
  const delPreset = (catId, pid) => updateCat(catId, (c) => ({ ...c, presets: (c.presets || []).filter((p) => p.id !== pid) }));
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
function usePomodoro(data, setData, dataRef) {
  const s = data.settings;
  const durFor = (m) => (m === "work" ? s.work : m === "short" ? s.short : s.long) * 60;
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
    chime();
    if (mode === "work") {
      // read the queue at completion time, so a session credits whatever is
      // active when it ends rather than when it started
      const cur = dataRef.current;
      const queue = (cur.sessionQueue || []).map((id) => cur.tasks.find((t) => t.id === id)).filter(Boolean);
      const active = queue.find((t) => !t.checked) || null;
      const dk = dateKey(new Date());
      setData((prev) => ({
        ...prev,
        pomoLog: { ...prev.pomoLog, [dk]: (prev.pomoLog[dk] || 0) + 1 },
        tasks: active ? prev.tasks.map((t) => (t.id === active.id ? { ...t, done: t.done + 1 } : t)) : prev.tasks,
      }));
      const nextCycle = cycle + 1;
      setCycle(nextCycle);
      const nm = nextCycle % 4 === 0 ? "long" : "short";
      setMode(nm); setLeft(durFor(nm));
      notify("Focus session complete", active
        ? `${active.title} — time for a ${nm === "long" ? "long" : "short"} break.`
        : `Time for a ${nm === "long" ? "long" : "short"} break.`);
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
      setLeft(remain);
      if (remain === 0) { clearInterval(tickRef.current); onComplete(); }
    }, 250);
    return () => clearInterval(tickRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return { mode, left, running, cycle, durFor, switchMode, reset, start, setLeft };
}

/* A queued task. The subtask list is a *sibling* of .qrow, not a child — the row
   itself completes the task on click, so nesting the subtasks inside it would
   mean checking a subtask also ticked off its parent. */
function QueueRow({ t, data, setData, now, isActive, burst, setBurst, onComplete, onRemove, dragging, onDragStart, onDragEnd, onDropOn }) {
  const [expanded, setExpanded] = useState(false);
  const subs = t.subtasks || [];
  const doneSubs = subs.filter((x) => x.checked).length;
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  return (
    <>
      <div className={`qrow ${t.checked ? "done" : ""} ${burstClass(burst, t.id)} ${isActive ? "active" : ""} ${dragging ? "dragging" : ""}`}
        onClick={onComplete} title="Click to mark done · drag to reorder"
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart?.(); }}
        onDragEnd={() => onDragEnd?.()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onDropOn?.(); }}>
        <span className="checkwrap">
          <button className={`check ${t.checked ? "on" : ""}`} aria-label={t.checked ? "Mark not done" : "Mark done"}>✓</button>
          {burst?.id === t.id && burst.kind === "done" && Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="particle" style={{
              background: catColorFor(allCats(data), t.cat),
              "--dx": `${Math.cos((i / 8) * 6.28) * 26}px`,
              "--dy": `${Math.sin((i / 8) * 6.28) * 26}px`,
            }} />
          ))}
        </span>
        <span className="tasktitle" style={{ flex: 1, minWidth: 0 }}>{t.title}</span>
        {subs.length > 0 && <span className="subprogress">{doneSubs}/{subs.length}</span>}
        <span className="pcount">{t.done}/{t.est}</span>
        <button className="subtoggle" title={expanded ? "Hide subtasks" : "Subtasks"}
          onClick={stop(() => setExpanded((v) => !v))}>{expanded ? "▾" : "▸"}</button>
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

function SessionView({ data, setData, sessionEmoji, now, timer }) {
  const s = data.settings;
  const { mode, left, running, cycle, durFor, switchMode, reset, start, setLeft } = timer;
  const [picking, setPicking] = useState(false);
  const [burst, setBurst] = useState(null);
  const qDragRef = useRef(null);
  const [qDragId, setQDragId] = useState(null);

  const queueIds = data.sessionQueue || [];
  // stale ids (task deleted elsewhere) are dropped on read rather than migrated
  const queue = queueIds.map((id) => data.tasks.find((t) => t.id === id)).filter(Boolean);
  const active = queue.find((t) => !t.checked) || null;
  const activeNo = active ? queue.indexOf(active) + 1 : 0;

  const setQueue = (ids) => setData({ ...data, sessionQueue: ids });
  const addToQueue = (id) => { setQueue([...queueIds, id]); setPicking(false); };
  const removeFromQueue = (id) => setQueue(queueIds.filter((x) => x !== id));
  // reordering the queue also moves which task is active, since "active" is just
  // the first unchecked one — that's the point of being able to drag them
  const moveInQueue = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    const ids = [...queueIds];
    const fi = ids.indexOf(fromId), ti = ids.indexOf(toId);
    if (fi < 0 || ti < 0) return;
    ids.splice(ti, 0, ids.splice(fi, 1)[0]);
    setQueue(ids);
  };
  const completeTask = (t) => {
    if (t.subtasks && t.subtasks.length) toggleAllSubtasks(data, setData, t.id, setBurst);
    else toggleTask(data, setData, t, setBurst);
  };

  const total = durFor(mode);
  const pct = 1 - left / total;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  // Session accounting for everything in the queue, completed rows included, so
  // the totals don't shrink as you tick things off.
  const totalEst = queue.reduce((n, t) => n + t.est, 0);
  const doneEst = queue.reduce((n, t) => n + (t.checked ? t.est : t.done), 0);
  const remaining = Math.max(0, totalEst - doneEst);
  // Walk the remaining sessions so the breaks between them are counted too,
  // including the longer one every 4th — that's most of the difference on a long day.
  let mins = 0;
  for (let i = 0; i < remaining; i++) {
    mins += s.work;
    if (i < remaining - 1) mins += (cycle + i + 1) % 4 === 0 ? s.long : s.short;
  }
  const finishAt = new Date(now.getTime() + mins * 60000);
  const fmtSpan = mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}` : `${mins}m`;

  const queued = new Set(queueIds);
  const available = data.tasks.filter((t) => !t.checked && !queued.has(t.id));

  const setDur = (k, v) => {
    const val = Math.max(1, Math.min(120, +v || 1));
    const tasks = k === "work" ? recomputeSessions(data.tasks, val) : data.tasks;
    setData({ ...data, settings: { ...s, [k]: val }, tasks });
    if (!running) setLeft((k === "work" && mode === "work") || (k === "short" && mode === "short") || (k === "long" && mode === "long") ? val * 60 : left);
  };

  return (
    <div className="focuswrap">
      <div className={`pomocard ${mode === "work" ? "" : "brk"} ${running ? "running" : ""}`}>
        <div className="pomoprog" style={{ width: `${pct * 100}%` }} />
        <div className="pomotabs">
          {["work", "short", "long"].map((m) => (
            <button key={m} className={`pomotab ${mode === m ? "on" : ""}`} onClick={() => switchMode(m)}>{MODE_LABEL[m]}</button>
          ))}
        </div>
        <div className="pomodigits">{mm}:{ss}</div>
        <div>
          <button className="pomostart" onClick={start}>{running ? "Pause" : "Start"}</button>
          {(left !== total || running) && <button className="pomoreset" onClick={reset}>reset</button>}
        </div>
      </div>

      <div className="pomonow">
        {active ? <>#{activeNo}<strong>{active.title}</strong></> : <>Nothing queued — add a task below, or just focus.</>}
      </div>

      <div className="qhead">
        <span className="h2">Tasks</span>
        <span className="catcount" style={{ marginLeft: "auto" }}>
          today {sessionEmoji} ×{data.pomoLog[dateKey(now)] || 0} · {cycle % 4}/4 to long break
        </span>
      </div>

      {queue.map((t) => (
        <QueueRow key={t.id} t={t} data={data} setData={setData} now={now}
          isActive={!!active && t.id === active.id} burst={burst} setBurst={setBurst}
          onComplete={() => completeTask(t)} onRemove={() => removeFromQueue(t.id)}
          dragging={qDragId === t.id}
          onDragStart={() => { qDragRef.current = t.id; setQDragId(t.id); }}
          onDragEnd={() => { qDragRef.current = null; setQDragId(null); }}
          onDropOn={() => { moveInQueue(qDragRef.current, t.id); qDragRef.current = null; setQDragId(null); }} />
      ))}

      {picking ? (
        <div className="pickpanel">
          {[["Work", catsIn(data, "work")], ["Personal", catsIn(data, "personal")]].map(([group, cats]) => {
            const anyHere = cats.some((c) => available.some((t) => t.cat === c.id));
            if (!anyHere) return null;
            return (
              <div key={group}>
                <div className="pickgroup">{group}</div>
                {cats.map((c) => {
                  const list = available.filter((t) => t.cat === c.id);
                  if (!list.length) return null;
                  return (
                    <div key={c.id}>
                      <div className="pickcat" style={{ color: c.color }}>{c.name}</div>
                      {list.map((t) => (
                        <button key={t.id} className="pickitem" onClick={() => addToQueue(t.id)}>
                          <span style={{ flex: 1, minWidth: 0 }}>{t.title}</span>
                          <span className="pcount">{t.done}/{t.est}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {available.length === 0 && (
            <div className="emptystate" style={{ padding: "12px 8px" }}>
              Nothing left to add — every open task is already in this session.
            </div>
          )}
          <button className="btn" style={{ marginTop: 6, width: "100%" }} onClick={() => setPicking(false)}>Done</button>
        </div>
      ) : (
        <button className="qadd" onClick={() => setPicking(true)}>✛ Add Task</button>
      )}

      {queue.length > 0 && (
        <div className="qfoot">
          <span>Sessions <b>{doneEst}/{totalEst}</b></span>
          {remaining > 0 && <span>Finish at <b>{finishAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</b> ({fmtSpan})</span>}
          {remaining === 0 && <span><b>All done</b> — nothing left in this session.</span>}
        </div>
      )}

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
