# Lord of My Life

A personal planner: big-picture project timelines (Gantt Chart), a fixed set
of Work categories (Research / Fellowships / Classwork / TA) plus a separate
Personal list, pomodoro focus sessions (Session), a monthly Budget, and an AI
assistant panel that can edit any of them.

## Stack

Vite + React, no router, no component library. `npm run dev` to run locally.

## Structure

This is intentionally a **single-file React app**: nearly all UI, state, and
styling lives in [src/research-planner.jsx](src/research-planner.jsx). `src/main.jsx` just mounts it.
Don't split it into multiple files/components unless the user asks — the whole
point is that one file is the source of truth for the whole app. The only
carve-outs in `src/` are the two remote-service layers, `sync.js` and `ai.js`,
which own network/IPC calls and nothing else. (The AI assistant's agent loop
additionally lives under `electron/` because it has to run in the main
process — see "AI assistant".)

- **Design tokens** live at the top of the file in the `CSS` template string
  (`:root` custom properties: `--paper`, `--ink`, `--pine`, `--tomato`,
  `--font-display`, `--font-body`, `--font-mono`, etc.), injected via a
  `<style>` tag. Change colors/spacing/fonts there, not inline, unless it's
  a one-off. Every rule in `CSS` reads colors and fonts through these
  variables — never hardcode a color or `font-family` directly in a new
  rule, or it won't respond to the theme toggle.
- **All state flows through one `data` object** (`{ settings, pomoLog,
  projects, tasks }`), held in `useState` in the top-level `LordOfMyLife`
  component and passed down as `data` / `setData` props. There is no
  Redux/Context — view components mutate by calling `setData({ ...data, ... })`.
  Keep it that way; don't introduce a state library for this app's size.
- **Persistence**: `loadData()` / `saveData()` read/write `localStorage` under
  key `lordofmylife:data`, debounced 500ms after `data` changes. No export/
  import — removed as unnecessary once cloud sync existed.
- **Five views**, switched by the `view` tab in the header, all reading from
  the same `data`:
  - `GanttView` / `ProjectGantt` — projects → sections → phases, rendered on a
    week-resolution grid. Weeks are the grid's *resolution* only; columns are
    labelled with the date each week starts (`colLabel`), not week numbers.
    This is unrelated to the "current week" concept that used to gate
    Work/Session. See "Gantt sections" below.
  - `WorkView` — tasks grouped under the four fixed `WORK_CATS` (Research,
    Fellowships, Classwork, TA). No week scoping: a task persists until
    checked off or deleted. Each category renders its own task list *and*
    its own `AddTaskRow` — there is no single global "add task" form anymore.
  - `PersonalView` — same `TaskRow`/`AddTaskRow` pieces as Work, grouped
    under the three fixed `PERSONAL_CATS` (Exercise, Music, Other) the same
    way Work groups under `WORK_CATS`.
  - `SessionView` (was "Focus") — pomodoro timer; completing a work session
    increments `pomoLog[today]` and optionally a task's `done` count. Its
    task picker lists every unchecked task across Work *and* Personal (no
    week filter).
  - `BudgetView` — see "Budget" below.
- **`TaskRow`/`AddTaskRow`/`toggleTask`/`editTask`** (above `WorkView` in the
  file) are shared between `WorkView` and `PersonalView` — keep task-row
  rendering, the add-task form, and the check/uncheck/edit logic in these
  rather than re-forking them per view. `TaskRow`'s pencil icon switches the
  row into an inline edit form (title always; minutes/due date too, unless
  the task has subtasks — see "Subtasks" below). `editTask()` recomputes
  `est` from the edited minutes and clamps `done` so it never exceeds it.

## Data model quick reference

```
data = {
  settings: { work, short, long },       // pomodoro minutes
  pomoLog:  { "YYYY-MM-DD": count },      // completed work sessions per day
  seededRecurring: true,                 // one-time flag, see "Recurring tasks" below
  projects: [{ id, name, color,
                phases: [{ id, name, start, end, done }],
                sections?: [{ id, name, color,
                              phases: [{ id, name, start, end, done }] }] }],
  tasks: [{ id, title, cat, minutes, est, done, checked, oneOnOne, dueDate,
            recurring, seedKey, completedDate, subtasks?, sectionId? }],
  budget: { monthlyIncome, categories: [{ id, name, type, budget?,
              items: [{ id, name, amount, date }] }] },
}
```

`cat` is one of `WORK_CATS` ids (`research` / `fellowships` / `classwork` /
`ta`) or `PERSONAL_CATS` ids (`exercise` / `music` / `other`). `minutes` is
what the user typed when adding the task; `est` is `estFor(minutes,
data.settings.work)` (near `fmtMoney`, top of file) — sessions are assumed
to be `data.settings.work` minutes long, **not** a hardcoded 25. `est` is
recomputed (not just derived at creation) any time `minutes` changes *or*
`settings.work` itself changes — see `recomputeSessions()` right below
`estFor`, called from `SessionView`'s `setDur` whenever the user edits the
focus-length field, so every task's dot count stays correct for whatever
session length is currently configured rather than freezing at whatever it
was when the task was created. `minutes` itself is kept for display/editing;
nothing re-derives it from `est`. `done` counts completed sessions against
`est`, clamped down whenever `est` shrinks so it can never exceed it.
`dueDate` is `"YYYY-MM-DD" | null`, optional, set from `AddTaskRow`'s date
input — see "Due dates" below. `recurring`/`seedKey`/`completedDate` only
matter for the built-in Exercise habits — see below.

Tasks created before this redesign may still have a stale `week` field or an
old `cat` (`writing`/`admin`/`personal`) — those are simply harmless dead
data; nothing reads `week` anymore, and a task whose `cat` doesn't match a
current category just won't render anywhere until deleted. There's no
migration step for this; it wasn't worth building for a single-user local app.

## Recurring tasks (Exercise habits)

`RECURRING_SEEDS` (Stretching, 20 push-ups, 20 sit-ups, 20 pull-ups, Hand
Stand) are fixed daily habits that live under Personal → Exercise and reopen
themselves the day after they're checked off.

- **Seeding**: `sampleData()` includes them for brand-new installs. For
  existing users, `ensureRecurringSeeds(data)` runs once (checked via the
  root-level `data.seededRecurring` flag) to backfill them without touching
  anything the user already has. It matches on `seedKey`, not title, and
  never re-adds one the user deleted on purpose — deleting is permanent.
- **Reopening**: `toggleTask()` (shared by `WorkView`/`PersonalView`) stamps
  `completedDate` with today's date whenever a task is checked.
  `resetRecurringTasks(data)` clears `checked`/`done`/`completedDate` on any
  `recurring` task whose `completedDate` isn't today. It runs on load and
  again on `visibilitychange`/`focus`/a 5-minute interval in `LordOfMyLife`,
  so a task reopens whether the app was closed overnight or just left running
  through midnight.
- If you add more recurring tasks, add them to `RECURRING_SEEDS` (each needs
  a unique `key`) — don't hand-roll a one-off task with `recurring: true`
  outside that list, or it won't survive `ensureRecurringSeeds`'s dedup logic
  on a fresh install.

## Gantt sections

A project can be split into named **sections** — e.g. a Fellowships project
holding NDSEG and GEM — each owning its own phases *and* its own tasks, drawn
as a tinted band across the full timeline so it reads as one block.

- `project.phases` is still the **ungrouped** list and renders above the
  sections. Projects created before sections existed have no `sections` key at
  all and render exactly as they always did; `sections` is read as
  `project.sections || []` everywhere. There's no migration.
- **One shared timeline.** The grid extent is computed from ungrouped phases,
  every section's phases, *and* every section task's due date together, so all
  of it lines up on the same columns. Don't compute a per-section grid.
- **Rows are assigned by a running counter** in `ProjectGantt` (`let row = 2`,
  row 1 being the date header): ungrouped phases, then per section a band, a
  label row, its phases, its tasks. The band is a `gridColumn: "1 / -1"` div
  spanning `1 + phases + tasks` rows at `z-index:1` — under the bars
  (`z-index:2`), over the grid lines. If you add anything to a section's
  render, update the band's span to match or the tint will end early.
- **Section colors come from `PROJ_COLORS` offset by one** so a section never
  lands on its parent project's color. They must stay hex literals — the band
  tint appends alpha (`${color}24`), which doesn't work on a `var(--…)` color.
- **A section task is a normal task**: it lives in `data.tasks`, carries a
  `cat`, and shows up under that category in Work/Personal like any other. The
  only extra field is `sectionId`. Deleting a section unlinks its tasks
  (`sectionId: null`) rather than deleting them — in one `setData`, since two
  calls off the same `data` would discard the first.
- **A section task requires a due date** (`SectionEditor` disables Add without
  one). It's placed on a timeline, so an undated task would have nowhere to
  sit. Tasks are not currently assignable to a section after creation.
- Column headers show the date each week starts, via `colLabel(d, prev)`,
  which drops the month when it hasn't changed: "Aug 10 / 17 / 24 / Sep 1".

## Due dates

Any task in Work or Personal can carry an optional `dueDate`, set via the
date input in `AddTaskRow`. Two places react to it, both driven by the same
`taskUrgency(t, now)` helper (near the date/week helpers, above `WORK_CATS`):

- `TaskRow` applies a `due-today`/`overdue` class to `.taskrow` for a gold
  glow (due today) or pulsing red glow (overdue) — see the matching CSS
  right after `.gbar.done`/`.taskrow.done`.
- `DeadlinesGantt` (in `GanttView`, above `ProjectGantt`) renders every task
  with a `dueDate` — from *either* Work or Personal — as a single-week
  marker on its own mini timeline, reusing the same week-snapping (`monday`)
  and grid math as `ProjectGantt`'s phases, and the same urgency classes on
  `.gbar`. It renders nothing if no task has a due date.

`taskUrgency` rules (never fires for a checked task or one with no `dueDate`):
- `dueDate` before today → `"overdue"` (pulsing red) — already missed.
- `dueDate` is today and local time is before 11pm → `"due-today"` (gold).
- `dueDate` is today and it's 11pm or later → `"overdue"` (pulsing red) —
  the day's basically over and it's still not done.
- `dueDate` in the future → no highlight.

This needs a live clock, not just render-time `new Date()`, so the 11pm
cutoff (and midnight rollover) actually appears while the app sits open.
`LordOfMyLife` keeps a `now` state ticking every 60s and passes it down to
`GanttView`/`WorkView`/`PersonalView` → `TaskRow`/`DeadlinesGantt`. If you add
another view that shows tasks with due dates, thread `now` through the same
way rather than reading `new Date()` inline (it won't update between ticks).

**`dateKey(d)` uses local calendar-day components, not `d.toISOString()`.**
UTC would roll a date over early for anyone west of UTC in the evening (e.g.
7pm Central is already after midnight UTC) — it silently broke same-day due
date comparisons, and would have done the same to the recurring-task and
`pomoLog` "today" checks. Don't reintroduce `toISOString()` for anything
that means "today" in the user's local time.

## Subtasks

Any task (Work or Personal) can be expanded — via the `▸`/`▾` toggle at the
right of `TaskRow`, not the `▸` count in the header — into a checklist of
`subtasks: [{ id, title, minutes, checked, dueDate }]`. Once a task has at
least one subtask, its own `minutes`, `est`, `dueDate`, and `checked` stop
being independently meaningful — they're recomputed by `deriveFromSubtasks()`
(above `updateSubtasks`, near `toggleTask`) every time the subtask list
changes: `minutes` is a plain sum, `dueDate` is the *latest* subtask due date
(you're not done until the last one lands), and `checked` is true only once
every subtask is checked.

- **All subtask mutations go through `updateSubtasks(data, setData, taskId, fn, setBurst)`**,
  which applies `fn` to the task, re-derives it, and — if that derivation
  flips `checked` from false to true — stamps `completedDate` and fires the
  same particle-burst/sound as finishing a normal task. `addSubtask`/
  `toggleSubtask`/`delSubtask` are thin wrappers around it; add any future
  subtask operation the same way rather than mutating `tasks` directly, or
  the parent won't re-derive and the completion burst won't fire.
- **The parent checkbox becomes a bulk toggle once subtasks exist** —
  `TaskRow` routes its `onClick` to `onToggleAll` instead of `onToggle`,
  which (`toggleAllSubtasks`) sets every subtask to the opposite of the
  parent's current `checked`. It no longer flips its own `checked` directly;
  that would immediately be overwritten by the next derive anyway.
- **The edit form hides the minutes/due-date fields when `t.subtasks.length > 0`**
  and `commit()` sends a title-only patch. `editTask()` checks for
  `patch.minutes === undefined` to tell "title-only" apart from "full edit"
  — don't send `minutes: undefined` from anywhere else, it'll be read as
  "leave minutes alone" rather than "clear it."
- Subtasks reuse `taskUrgency`/`fmtDue`/the due-today/overdue glow classes
  directly (`SubtaskRow`, right above `AddTaskRow`) since their shape
  (`dueDate`, `checked`) matches what those helpers expect — no parallel
  implementation needed.
- If all of a task's subtasks are deleted, `deriveFromSubtasks` leaves the
  parent's `minutes`/`est`/`dueDate`/`checked` at whatever they last derived
  to (there's no "revert to manual" step). Not worth solving until someone
  actually hits it on a single-user local app.

## Budget

Two category `type`s, rendered by the same `BudgetView` but treated
differently:

- **`"fixed"`** (Housing, Loans, Investments, Monthly Fees) — the category's
  `items` *are* the budget; there's no separate target to compare against.
  `catTotal()` just sums `items` unconditionally, no date filtering. The user
  can add/edit/delete line items (rent changes, a new subscription, etc.) via
  the same `AddBudgetItemRow`/`BudgetRow` pieces used everywhere else in
  Budget. `BudgetRow`'s name/amount are live `<input>`s, not static text —
  `onUpdate(patch)` calls `updateItem()` in `BudgetView`. The amount input
  buffers its string locally and only commits (clamped, coerced to a number)
  on blur/Enter, so clearing the field to retype a value doesn't get
  stomped by React re-coercing an empty string to `0` on every keystroke.
- **`"budget"`** (Food, Free) — a monthly cap the user draws down by logging
  purchases through the month. Each item gets `date: dateKey(now)` when
  added; `itemsThisMonth()` filters to the current `monthKey(now)` so past
  months' purchases stay in storage (for a future "view last month" feature,
  not built yet) without counting against the current month's remaining
  amount — nothing deletes old entries, the month just rolls over on its own
  once the calendar turns.
- **Free's `budget` is never read from storage** — `defaultBudget()` sets it
  to `null` as a placeholder. `BudgetView` always computes it live as
  `monthlyIncome - (sum of fixed categories) - Food's budget`, so editing
  Housing/Loans/Investments/Fees/Food immediately changes what Free shows,
  the same render it's edited in.
- Ring/color logic: `var(--pine)` (or the category's own color) under 75%
  spent, `var(--amber)` from 75% up to the cap, `var(--tomato)` once
  `remaining` goes negative (shown as "over by $X" instead of "$X left").
  This is plain color logic, not the due-date urgency system — don't reach
  for `taskUrgency` here.
- **Visuals** (above `BudgetView`): `BudgetDonut` is a ring chart of the
  whole month's split across all six categories — same stroke-dasharray/
  stroke-dashoffset arc technique as the Focus timer ring in `SessionView`,
  just drawing six static arcs instead of animating one. `SegmentBar` fades
  the same category color per item to show a fixed category's internal
  composition (e.g. Rent vs. Utilities within Housing) without needing a
  second color per item. `BudgetGauge` is deliberately the *same* ring as
  the Focus timer, reused for Food/Free's spent/remaining — the intent is
  that "budget" reads as another countdown, not a bolted-on chart style.
  There's a 6th palette color, `--teal`, added solely so Free (whose color
  would otherwise collide with Investments' pine) gets its own hue in the
  donut/legend.
- **Seeding**: `defaultBudget()` (Rent $400/Utilities $200, Loans $300,
  Roth/Savings $200 each, Claude $17/Spotify $23.58/Gym $76.86, Food budget
  $400, monthly income $3000) is in `sampleData()` for fresh installs;
  `ensureBudgetSeed(data)` backfills it once for existing users, same
  one-time-flag pattern as `ensureRecurringSeeds` (checks `data.budget`
  itself rather than a separate flag, since this seeds the whole object
  rather than merging into an existing array).

## AI assistant

A collapsible right-hand panel (`AiPanel`, bottom of `research-planner.jsx`)
that chats with Claude *and can edit the planner directly* through tool use.
Opened from the header's "✦ Assistant" button; `aiOpen` is `useState` in
`LordOfMyLife`, not persisted.

**It runs on the Claude Agent SDK in Electron's main process, authenticated
by the user's Claude subscription — there is no API key anywhere in this
app, and adding one would start billing them separately.** That choice is why
the assistant is desktop-only: the SDK is a Node library, so in a plain
browser `window.lolAI` is undefined and the panel says so rather than
half-working. Everything else in the app still runs fine in a browser.

Four pieces, and the split matters:

- [electron/agent.cjs](electron/agent.cjs) — the SDK layer. Owns the zod tool schemas, the
  `query()` options, and the message loop. Knows nothing about Electron:
  tool calls go to an injected `callTool(name, input)`. That injection is
  what makes it testable without launching a window.
- [electron/main.cjs](electron/main.cjs) — windows and IPC only. Its `callTool` forwards each
  call to the renderer and waits (`askRenderer`, 20s timeout, correlation-id
  map). **This process is a relay and never learns what a task is.**
- [electron/preload.cjs](electron/preload.cjs) — the whole Node surface the renderer gets:
  start/cancel a query, receive events, answer tool calls. Nothing else. No
  fs, no shell, no generic `ipcRenderer`. Keep it that narrow.
- [src/ai.js](src/ai.js) — renderer-side seam plus `systemPrompt`. `research-planner.jsx`
  owns `runPlannerTool`, the executor, because that's where
  `uid`/`estFor`/`deriveFromSubtasks` live.

A tool call therefore crosses the process boundary twice: SDK (main) → IPC →
`runPlannerTool` (renderer, live `data`) → IPC → SDK. Adding a tool means
touching three places: a zod schema in `agent.cjs`, a `case` in
`runPlannerTool`, and a label in `TOOL_LABEL`.

- **`runPlannerTool(data, name, input)` is pure**: it returns
  `{ data, result }` and never calls `setData`. Every write goes through the
  same helpers the UI uses, so an AI-created task is indistinguishable from a
  hand-made one.
- **Bad input returns an `error` result, it never throws.** The model reads
  the error and corrects itself on the next turn. Same for partially-invalid
  input: `create_project`/`add_phases` keep the good phases and report the
  rest under `rejected`. Only genuine IPC failures come back as `isError`.
- **The executor reads `data` from `dataRef`, not from props.** Consecutive
  tool calls in one turn must each see the previous one's writes, and a
  closure over `data` would hand the second call a stale snapshot.
  `LordOfMyLife` mirrors `dataRef` to `data` via an effect; the executor
  writes to both. (Known limit: a realtime sync push arriving mid-turn gets
  clobbered — same tradeoff as the last-write-wins sync model.)
- **`tools: ["WebSearch"]` in the query options strips every other built-in**,
  so the assistant physically cannot read files or run shell commands on the
  user's machine. `permissionMode: "bypassPermissions"` is only safe *because*
  of that line — there's no TTY and no permission UI, so a prompt would hang
  forever. Don't widen `tools` without revisiting the permission mode.
- `settingSources: []` keeps it from inheriting `~/.claude` settings or this
  repo's own CLAUDE.md. The planner agent is configured only by `agent.cjs`.
- **The Agent SDK owns the conversation transcript.** The panel keeps only a
  `sessionRef` and passes it as `resume` on the next message; "Clear" nulls it
  so a new thread starts. There's no locally-assembled message history to
  corrupt anymore — an earlier version of this feature had to hand-manage
  `tool_use`/`tool_result` pairing, and that whole class of bug is gone.
- Tool names arrive in two forms: bare (`create_task`) over IPC, fully
  qualified (`mcp__planner__create_task`) in the streamed events. `toolLabel()`
  normalises both and returns `null` for anything unrecognised, so the SDK's
  internal tool-search bookkeeping doesn't leak into the transcript.
- Chat transcript is component state, not `data` — don't move it into `data`
  or every message would sync to Supabase and bloat the row.
- **The panel is resizable by dragging its left edge.** The width lives in
  `LordOfMyLife` and is published as the `--aiw` custom property on the `.fw`
  root, which both the panel's `width` and the root's `padding-right` read —
  that's what keeps the panel and the space cleared for it from ever
  disagreeing. Drag listeners go on `window`, not the grip, so a fast mouse
  outrunning the 7px handle doesn't drop the drag. Clamped to
  `AIW_MIN`/`AIW_MAX` and additionally against the viewport, so the planner
  can't be squeezed to nothing. Persisted to `lordofmylife:aiwidth` — a
  per-device UI preference, not synced data, same as the theme key.
- The panel is called "Assistant" in `dark` and **"Wizard" in `fantasy`**.
  Computed once in `LordOfMyLife` as `assistantLabel` and passed down, the
  same theme-conditional-copy pattern as `sessionEmoji`.

## Cloud sync

Optional cross-device sync via Supabase (Postgres + auth + realtime), free
tier. One of the two deliberate exceptions to "everything lives in
research-planner.jsx" (the other is `ai.js`) — [src/sync.js](src/sync.js) owns the Supabase client, auth calls, and
the `planner_data` row (one JSONB row per user, schema in
[supabase/schema.sql](supabase/schema.sql)). `research-planner.jsx` imports plain functions from it;
no Supabase-specific code/types leak into the UI file beyond the `SyncBar`
component, which owns all sync *state* (session, status, debounced push,
realtime subscription).

- Config comes from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in
  `.env.local` (gitignored; see `.env.example`). If unset, `supabase` in
  `sync.js` is `null` and `SyncBar` renders nothing — the app is fully
  functional localStorage-only with no signed-in state.
- Sync model is intentionally simple: **last write wins**. On sign-in, cloud
  data replaces local if a cloud row exists, otherwise local data seeds the
  cloud row. After that, local edits debounce-push (600ms) to Supabase, and a
  realtime subscription applies remote changes as they arrive. There's no
  merge/conflict resolution — fine for one person using one device at a time,
  not fine if you need concurrent editing.
- `skipNextPush` in `SyncBar` exists to stop a remote-applied update from
  immediately bouncing back to the server as if it were a local edit. Keep
  that guard if you touch the push/pull effects.

## Theming

Two themes: `dark` (default — modern, Inter/Bricolage Grotesque/IBM Plex
Mono, forest-and-tomato palette) and `fantasy` (a leather-and-candlelight
"grimoire" look — Cinzel/EB Garamond/Space Mono, deep brown with gold/
burgundy/moss accents). The active theme is `useState` in `LordOfMyLife`,
persisted to `localStorage` under `lordofmylife:theme` (a separate key from
planner `data` — it's a UI preference, not synced data, and doesn't touch
Supabase). Toggled via the header button, which reads `THEMES`/`THEME_LABEL`
to show "switch to the other theme."

- Applied as `data-theme={theme}` on the root `.fw` div. `:root` in `CSS`
  defines the `dark` palette as the default custom-property values;
  `.fw[data-theme="fantasy"]` overrides them, cascading to everything
  underneath since all rules consume colors/fonts via `var(...)`.
- Fantasy-only decoration (ember-glow brand text, button shimmer sweep,
  the Gantt today-line's `wardpulse`, the Focus ring's `runeglow` when
  running) lives in `.fw[data-theme="fantasy"] ...` rules near the top of
  `CSS`, right after the palette override. Keep new decorative animations
  scoped there rather than global — the `dark` theme should stay plain.
  All animations already respect `prefers-reduced-motion` via the existing
  global media query; don't bypass it.
- The Focus timer ring gets a `running` class (`timerring ${running ? "running" : ""}`)
  purely so the fantasy theme can glow while a session is active.
- `sessionEmoji` (🍅 in `dark`, 🕯️ in `fantasy`) and `assistantLabel`
  ("Assistant" vs "Wizard") are computed once in `LordOfMyLife` from `theme`
  and passed down to `SessionView`/`AiPanel`. They're the only theme-conditional
  *content* rather than styling — everything else is CSS. If you add more
  theme-flavored copy, follow this pattern rather than duplicating whole
  components per theme.

## Desktop app (Electron)

The app ships as a real Windows desktop app, not just a browser tab.
[electron/main.cjs](electron/main.cjs) creates one `BrowserWindow` that loads `http://localhost:5173`
in dev or `dist/index.html` in production, and owns the assistant's IPC.
`contextIsolation: true` / `nodeIntegration: false` stay on; the only Node
surface the renderer gets is [electron/preload.cjs](electron/preload.cjs) (see "AI assistant").

- `npm run electron:dev` — runs the Vite dev server and Electron together
  (`concurrently` + `wait-on` so Electron waits for port 5173 before launching).
  **The assistant only works under this, not plain `npm run dev`.**
- `npm run electron:build` — `vite build` then `electron-builder`, producing
  a Windows installer under `release/`.
- `vite.config.js` sets `base: "./"` — required so the built `dist/index.html`
  resolves its asset paths under Electron's `file://` protocol; don't remove it.
- **The installer is much bigger now — 162MB.** `@anthropic-ai/claude-agent-sdk`
  pulls in a platform package (`…-win32-x64`) holding a 293MB `claude.exe`,
  which is the agent runtime (NSIS compresses it down). Both are listed in
  `asarUnpack` in `package.json`. To trade self-containment for size, point
  `nativeBinaryPath()` in `agent.cjs` at the user's own Claude Code install.
- **`asarUnpack` alone is not enough, and the failure only appears in a
  packaged build.** The SDK *spawns* that binary, and left to resolve it
  itself it returns the path inside `app.asar` — which `fs.existsSync` happily
  confirms (Electron fakes reads into the archive) but the OS cannot execute.
  The symptom is a misleading SDK error blaming a libc mismatch:
  `"binary at …\app.asar\…\claude.exe exists but failed to launch"`.
  `nativeBinaryPath()` in `agent.cjs` rewrites `app.asar` → `app.asar.unpacked`
  and passes the result as `pathToClaudeCodeExecutable`; in dev the path holds
  no `app.asar` so the rewrite is a no-op. Keep both halves — the unpack rule
  *and* the explicit path — or the assistant breaks in the installed app while
  still working perfectly under `npm run electron:dev`.
- **Known gotcha**: if the Vite dev server (or anything else watching the
  project directory) is running while you `electron-builder` package the app,
  the file watcher can hold a handle inside `release/win-unpacked.tmp` and
  the final rename fails with `EPERM`. Stop the dev server before packaging.

## Conventions

- No comments explaining *what* code does — the file already favors compact,
  readable helpers. Only comment non-obvious *why* (there are a couple near
  the storage/audio helpers).
- Keep everything working with plain `useState`/`useEffect` — no external
  state or data-fetching libraries needed for a local-only planner.
- When adding UI, match the existing visual language: pill buttons, the
  `--pine`/`--tomato` accent pair, `var(--font-mono)` for numeric/meta text,
  `var(--font-display)` for headings — never a literal font name, so it
  works in both themes.
