# Lord of My Life

A personal planner: big-picture project timelines (Gantt Chart), a fixed set
of Work categories (Research / Fellowships / Classwork / TA) plus a separate
Personal list, pomodoro focus sessions (Session), and a monthly Budget.

## Stack

Vite + React, no router, no component library. `npm run dev` to run locally.

## Structure

This is intentionally a **single-file React app**: nearly all UI, state, and
styling lives in [src/research-planner.jsx](src/research-planner.jsx). `src/main.jsx` just mounts it.
Don't split it into multiple files/components unless the user asks — the whole
point is that one file is the source of truth for the whole app.

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
  - `GanttView` / `ProjectGantt` — projects → phases, rendered as a week-grid
    timeline. This is the only place "week" still means anything in the UI —
    it's the Gantt's inherent resolution for a multi-month plan, not the
    "current week" concept that used to gate Work/Session.
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
                phases: [{ id, name, start, end, done }] }],
  tasks: [{ id, title, cat, minutes, est, done, checked, oneOnOne, dueDate,
            recurring, seedKey, completedDate, subtasks? }],
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

## Cloud sync

Optional cross-device sync via Supabase (Postgres + auth + realtime), free
tier. This is the one deliberate exception to "everything lives in
research-planner.jsx" — [src/sync.js](src/sync.js) owns the Supabase client, auth calls, and
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
- `sessionEmoji` (computed once in `LordOfMyLife` from `theme`, passed down
  to `SessionView`) is 🍅 in `dark`, 🕯️ in `fantasy`. It's the only piece of
  theme-conditional *content* rather than styling — everything else is CSS.
  If you add more theme-flavored copy, follow this pattern rather than
  duplicating whole components per theme.

## Desktop app (Electron)

The app ships as a real Windows desktop app, not just a browser tab.
[electron/main.cjs](electron/main.cjs) is the whole main process: one `BrowserWindow` that loads
`http://localhost:5173` in dev or `dist/index.html` in production. No preload
script, no IPC — the renderer only ever talks to Supabase over HTTPS/WSS, so
default Electron security settings (`contextIsolation: true`, `nodeIntegration:
false`) are enough with nothing extra to bridge.

- `npm run electron:dev` — runs the Vite dev server and Electron together
  (`concurrently` + `wait-on` so Electron waits for port 5173 before launching).
- `npm run electron:build` — `vite build` then `electron-builder`, producing
  a Windows installer under `release/`.
- `vite.config.js` sets `base: "./"` — required so the built `dist/index.html`
  resolves its asset paths under Electron's `file://` protocol; don't remove it.
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
