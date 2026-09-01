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
- **Six views**, switched by the `view` tab in the header, all reading from
  the same `data`:
  - `CalendarView` — a week of one-off events with the session plan drawn over
    it. See "Calendar" below.
  - `GanttView` / `ProjectGantt` — projects → sections → phases, rendered on a
    week-resolution grid. Weeks are the grid's *resolution* only; columns are
    labelled with the date each week starts (`colLabel`), not week numbers.
    This is unrelated to the "current week" concept that used to gate
    Work/Session. See "Gantt sections" below.
  - `WorkView` / `PersonalView` — both are one-line wrappers around
    `TaskGroupView`, which renders every category in a `group` ("work" or
    "personal"). They were near-identical copies; don't fork them again.
    No week scoping: a task persists until checked off or deleted. Each
    category renders its own task list *and* its own `AddTaskRow`.
    See "Categories" below.
  - `SessionView` (was "Focus") — pomodoro timer plus a queue of tasks to work
    through. Completing a work session increments `pomoLog[today]` and the
    active task's `done` count. See "Session queue" below.
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
  sessionQueue: [taskId],                // tasks lined up in the Session tab
  guests: [{ id, name, tasks: [{ id, title, minutes, est, done, checked }] }],
  categories: [{ id, name, color, group: "work" | "personal" }],
  events: [{ id, title, date: "YYYY-MM-DD", start: "HH:MM", end: "HH:MM", cat? }],
  seededRecurring: true,                 // one-time flag, see "Recurring tasks" below
  projects: [{ id, name, color,
                phases: [{ id, name, start, end, done }],
                sections?: [{ id, name, color,
                              phases: [{ id, name, start, end, done }] }] }],
  tasks: [{ id, title, cat, minutes, est, done, checked, oneOnOne, dueDate,
            recurring, seedKey, completedDate, subtasks?, sectionId? }],
  budget: { monthlyIncome, categories: [{ id, name, type, budget?,
              items: [{ id, name, amount, date }],
              presets?: [{ id, name, amount }] }] },
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

## Categories

The sections tasks are filed under (Research, Fellowships, … Exercise, Music, …)
**live in `data.categories`, not in code** — the user can add their own from the
bottom of Work or Personal.

- `CAT_SEED` is only the starting point. `ensureCatSeed()` copies it into
  `data.categories` once, same one-time pattern as `ensureBudgetSeed`. **Never
  read `CAT_SEED` directly** outside seeding — use `allCats(data)` or
  `catsIn(data, group)`, or a user-made category will silently not exist as far
  as your code is concerned.
- `catColorFor(cats, catId)` takes the *list*, not `data`, because
  `DeadlinesGantt` only receives tasks. Callers pass `allCats(data)`.
- New ids are slugified from the name (`"LomL Dev"` → `loml-dev`) rather than
  random, since the AI assistant sees and writes them. `catIdFor` appends a
  short uid only on collision.
- **A category can only be deleted while it holds no tasks** — the ✕ in its
  header simply isn't rendered otherwise. Deleting one with tasks would strand
  them: nothing renders a task whose `cat` matches no category (which is also
  what already happens to tasks left over from the pre-redesign category names).
- Colors cycle through `CAT_COLORS`, which are `var(--…)` tokens so they follow
  the theme. Note this is the opposite constraint from Gantt section colors,
  which must stay hex literals because they get an alpha suffix.
- **`dragHandlers(drag)`** (above `TaskRow`) is shared by `TaskRow` and
  `QueueRow` and carries three things a native HTML5 drag needs to look right:
  - an explicit `setDragImage` offset to where the cursor grabbed the row,
    taken from a **detached opaque clone** (`makeDragImage`), never the live
    element. Handing Chromium the real row lets the bitmap pick up whatever the
    source is doing — the fade, and its transparent edges, since a row paints no
    background beyond the card behind it. The clone must be parked *inside* the
    `.fw` root: on `document.body` it falls outside every theme-scoped rule and
    renders the ghost in the wrong palette and fonts;
  - the source row's fade deferred a tick, because the snapshot is taken
    synchronously during `dragstart` and fading in the same tick bakes the
    transparency into the image you drag around. **That deferred setter is
    guarded on the drag ref**, or a drag ending within that tick lets the
    timeout re-apply `dragging` after cleanup and strand a permanently faded
    row;
  - a `dragover-before`/`dragover-after` insertion line on the hovered row,
    picked to match where the move actually lands (below when moving down,
    above when moving up).
- **Tasks are reorderable by dragging the row.** `moveTask` uses the same
  shuffle-and-write-back as `moveCat`, over one category's slots in the flat
  `tasks` array. **Dropping onto a row in a different category is ignored** —
  a drag reorders, it never refiles a task. The whole row is the handle rather
  than a grip, since a grip on every task row would be a lot of furniture; the
  `editing` branch returns before the drag props are applied, so an open edit
  form is never draggable.
- **A task queued in the Session tab shows a `.tagsess` pill** in Work/Personal,
  driven by `data.sessionQueue`. `sessionEmoji` is threaded down for it, the
  same prop the Session tab already takes.
- **Sections are reorderable by dragging their header.** `moveCat` shuffles the
  ids within one group, then writes them back into the slots that group already
  occupies in the flat `categories` array — so reordering Work can never disturb
  Personal. The dragged id lives in a **ref**, not state: the drop handler reads
  it synchronously and must not depend on a re-render having landed between
  `dragstart` and `drop`. `dragId` state exists only to fade the dragged block.
  Only the header carries `draggable`; making the whole block draggable fights
  with selecting text in the add-task inputs inside it.
- **The AI's `cat` argument is a plain `z.string()`, not an enum** — an enum
  would freeze the category list into the tool schema at build time. Instead
  `list_tasks` returns the current categories alongside the tasks, and
  `runPlannerTool` rejects an unknown id with a message naming the valid ones.

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

## Calendar

A week grid (`CalendarView`) of one-off events, plus a collapsible left panel
(`CalendarPanel`) showing today when you're on any other tab. Repeating events
are deliberately not built yet.

- **`CalendarDay` is the one column implementation**, shared by both: the week
  view renders seven, the panel renders one. Same hour bars, same now line, same
  event and plan geometry (`placeIn`, `CAL_HOURS`), so the two can't drift apart.
  The panel passes `compact` to drop the category label, and omits the slot-click
  and delete handlers to make itself read-only.
- **Google Calendar is read-only and pulled, not stored.** `electron/gcal.cjs`
  owns the OAuth (Authorization Code + PKCE, loopback redirect on 127.0.0.1) and
  the fetching; `src/gcal.js` is the renderer seam and does the only conversion
  from Google's RFC3339 instants to the planner's local wall-clock shape.
  Points that matter:
  - Pulled events live in `useGoogleCalendar` **component state, never in
    `data`** — they mirror someone else's system, so persisting them would bloat
    the synced row and go stale. They're merged with `data.events` into
    `allEvents` purely for display and planning.
  - **Polled, not pushed** (on focus and every 5 minutes). Google's push
    notifications need a public HTTPS endpoint to receive webhooks, which a
    desktop app doesn't have.
  - The fetch is a **window** (`timeMin`/`timeMax`) with `singleEvents=true`
    rather than a sync token. That expansion is what makes a recurring Google
    meeting appear correctly even though this app's own events have no repeats.
  - **All-day events don't block time**: they're flagged `allDay` and filtered
    out before `planSession`, so a multi-day conference doesn't consume the
    whole scheduling window. They render as chips instead.
  - **Both ways a grant can die clear the stored token**, so `status()` never
    claims a connection that can't fetch: a 401 from the Calendar API, and an
    `invalid_grant` from the refresh call. The second one matters because Google
    expires refresh tokens after 7 days while the OAuth client is still in
    *Testing* publishing status. Any *other* token error is rethrown untouched —
    a transient 500 must not log the user out. `tokenRequest` carries Google's
    machine-readable `error` on `err.code` precisely so that check doesn't have
    to match on prose.
  - The refresh token is encrypted with Electron `safeStorage` in `userData`. If
    the platform has no encryption available it simply isn't persisted — it is
    never written as plaintext.
  - Google events have no delete button; removing one here would be a lie.
  - `VITE_GOOGLE_CLIENT_ID` ships in the build and is **not** a secret — PKCE is
    what protects the exchange. `VITE_GOOGLE_CLIENT_SECRET` isn't really one
    either — Google documents the desktop client's secret as non-confidential —
    but it is **required**: without it the token exchange fails with
    "client_secret is missing". `explain()` catches exactly that case, and only
    when no secret was sent, so a genuinely wrong secret still reports as itself.
- **An event's `cat` is optional and comes from `data.categories`** — the add
  row's picker is built from `catsIn(data, group)`, so user-made sections like
  Quals or LomL Dev appear without any further wiring. The category is what
  colours the event; uncategorised ones fall back to `var(--slate)`.

- **Events are wall-clock, not instants**: `{ date: "YYYY-MM-DD", start: "HH:MM" }`,
  same reasoning as `dateKey` — storing a UTC timestamp would drift a 9am
  meeting onto the wrong day for anyone west of UTC. `atTime(date, time)` is the
  only place they become a `Date`.
- **`planSession(tasks, events, settings, cycle, from)` is the single source of
  truth for when work happens.** It walks the queue forward from `from`, laying
  down one block per remaining pomodoro and stepping the cursor past any event
  that would overlap. It returns ordered absolute blocks —
  `{ type: "task" | "break" | "event" }` — and an `"event"` block appears
  wherever the plan had to wait. The week grid draws it, the left panel's agenda
  reads it, the Session list derives its event dividers from it, and "Finish at"
  is just the end of the last block. Don't recompute any of that separately.
- `PLAN_CAP` bounds the output; a queue long enough to run for days would
  otherwise lay out forever.
- **The Session list distinguishes two cases, and conflating them reads as a
  bug**: an event *before* a task's first session means the whole task happens
  afterwards (divider above the row, "everything below is after this"), while an
  event landing *between* its sessions means the task is interrupted and only
  finishes afterwards (indented note below the row). `blockers` in `SessionView`
  tracks which tasks have already started to tell them apart.
- `place()` returns `null` for anything wholly outside the drawn window
  (`DAY_START`/`DAY_END`), so a plan running past midnight doesn't stack
  negative-height blocks at the bottom edge.
- The left panel mirrors the assistant panel's mechanics exactly — `--calw` on
  the `.fw` root feeding both the panel width and the root's `padding-left`,
  window-level drag listeners, persisted to `lordofmylife:calwidth`. It's hidden
  on the Calendar tab itself, since the full grid is right there. It scrolls to
  put the current hour in view on open rather than starting at `DAY_START`.

## Session queue

`SessionView` is styled after pomofocus.io: a mode-tabbed card (Pomodoro /
Short Break / Long Break) with big digits, a START button, and a thin progress
bar across the top of the card. **There is no timer ring anymore** — if you're
looking for the old `.timerring` SVG, it was replaced by `.pomoprog`.

- **The clock itself lives in `LordOfMyLife`, not `SessionView`** — see
  `usePomodoro`. Held inside the view, both the state and the `setInterval` died
  the moment you switched tabs, so a running session reset itself. Anything else
  that has to outlive a tab switch belongs up there too.
- `onComplete` reads the queue from `dataRef` at the moment it fires, so a
  session credits whatever task is active when it *ends*, not when it started.
- **Timer completion posts a desktop notification** (`notify`). Electron grants
  the permission without prompting; a browser asks, and `askNotifyPermission()`
  is called from Start rather than on load so the prompt is tied to an action.
  `notify` silently does nothing when permission isn't granted.
- `QueueRow` renders its subtask list as a **sibling** of `.qrow`, never a
  child: the row's own click completes the task, so nesting them would mean
  ticking a subtask also ticked off its parent. Its buttons stop propagation
  for the same reason.
- **`data.sessionQueue` is a list of *ids*, not tasks.** The tasks live in
  `data.tasks` as always; the queue only references them. That's what makes
  checking a task off in Session the same edit as checking it off in Work — it
  routes through the same `toggleTask` / `toggleAllSubtasks` helpers, fires the
  same particle burst, and stamps `completedDate` the same way.
- **An entry is either `taskId` or `taskId::subId`** — a single subtask can be
  queued on its own. Keeping it a flat list of opaque strings is deliberate:
  saved queues, the drag reorder, the room presence payload and the stale-id
  filter all carry on unchanged, so there's no migration. `resolveQueued` /
  `queueItems` (below `minutesLeft`) turn ids into `{ qid, task, sub, item }`;
  `qidTask` recovers the task id, `qidFor` builds one. **Read the queue through
  `queueItems`, never by looking ids up in `data.tasks` directly**, or a queued
  subtask resolves to nothing.
  - A queued subtask's `item` is shaped like *a task whose only subtask is that
    one* (`subtasks: [sub]`). That's what makes `minutesLeft` measure it in real
    minutes instead of rounding it up to a whole pomodoro.
  - **The timer never credits `done` on a queued subtask.** Subtasks are ticked
    off by hand everywhere else in the app; a pomodoro ending just logs to
    `pomoLog`. `usePomodoro`'s `onComplete` checks `active.sub` for this.
  - A task and its own subtasks can never both be queued — `QueuePicker` drops
    the task from the list once it's queued whole, and hides "Add the whole task
    instead" once any subtask of it is queued. Both guards exist because the
    queue would otherwise count that time twice.
- Read it as `data.sessionQueue || []` — it's optional, so existing saved data
  needs no migration. Ids whose task was deleted elsewhere are dropped on read
  (`.filter(Boolean)`) rather than cleaned up in storage.
- **The active task is simply the first unchecked task in the queue** — that's
  what "#1" above the list refers to, and what a finished work session credits.
  `taskRef` is synced to it by an effect so a session that started under one
  task credits whatever is active when it *ends*.
- Queue rows are draggable too (`moveInQueue`), which also changes *which task
  is active*, since active is just the first unchecked one.
- Clicking a queue row completes the task; the ✕ only removes it from the
  queue and leaves the task itself alone. Completed rows stay visible (struck
  through) so the session totals don't shrink as you work.
- **Footer totals come from `sessionStats(tasks, settings, cycle, now)`**, which
  is shared by your column and every guest column. It works from
  `minutesLeft(t)` rather than `done`: a task with subtasks reports the sum of
  its *unchecked* subtasks, so ticking a subtask moves the finish time. Counting
  `done` alone was a bug — `done` only counts finished pomodoros, and a subtask
  isn't one, so subtask progress changed nothing. "Finish at" walks the
  remaining sessions one at a time to add the break after each — including the
  long one every 4th — which is most of the difference over a full day. It's
  driven by the `now` prop, so it re-estimates as time passes.
  - **`remaining` rounds up per item, matching how `planSession` lays blocks
    down** — a pomodoro is never split between two pieces of work. Ceiling the
    summed minutes instead made the footer disagree with the calendar as soon as
    two items were measured in real minutes (30 + 20 minutes is three blocks on
    the timeline but `ceil(50/25) = 2` here). For an ordinary task the two are
    identical, which is why it went unnoticed until subtasks could be queued.
  - **`doneEst` is counted, not derived as `totalEst - remaining`**, so it stays
    right whatever rounding the items involve.
- **A shared room puts two people's sessions side by side over the network**
  (`useSessionRoom`, `PeerColumn`, `joinRoom` in `sync.js`). Key points:
  - **A room is a Supabase Realtime channel and nothing else** — no tables, no
    schema, no rows to clean up. It stops existing when the last person leaves,
    which is why joining needs no migration and costs no storage.
  - Everything rides on **presence**, not broadcast: each person's payload is
    their name, their queue and (for the host) the timer. A late joiner gets the
    whole state on their first `sync` without anyone re-sending it.
  - **The host owns the timer**; everyone else renders from it and their
    controls are hidden. Two people both able to start and pause would need
    conflict resolution for no real benefit. If no host is present, control
    falls back to local — that's the graceful degradation when a host leaves.
  - A running timer publishes an absolute **`endsAt`**, never a countdown, so
    each client derives the remaining seconds from its own clock and nothing
    drifts. A paused one publishes `left`. `total` rides along because the
    host's session lengths are theirs, not the viewer's.
  - The presence payload is republished on a **stable** subset of itself — the
    `endsAt`/`left` fields change every tick and would otherwise flood the
    channel.
  - **The room code and the host flag are persisted together** in
    `sessionStorage`. Persisting only the code meant a host who reloaded
    rejoined as a guest and the room silently lost its timer authority.
  - The display name defaults to the signed-in account but stays editable —
    two signed-out devices would otherwise both publish the same name.
- **Each column marks what the running pomodoro will do** (`SessionMark`):
  "this session" on the active task, or "finishes this session" when that
  pomodoro takes it to its last one.
- **Other people can share the session on one device** (`data.guests`,
  `GuestColumn`). Their tasks are typed in — a name and a length, no picker —
  and live on the guest, **never in `data.tasks`**: they aren't your work, so
  they must not appear in Work/Personal, on the Gantt, or to the assistant.
  The shape matches a task closely enough that `estFor`, `recomputeSessions`
  and `sessionStats` all apply unchanged. The pomodoro clock is shared; a
  guest's tasks are ticked off by hand rather than credited by the timer.
- `.focuswrap` widens to `.multi` only once a guest exists, so a solo session
  keeps its narrow centred column.
- **The Add Task picker (`QueuePicker`) is a drill-down**: Work/Personal →
  section → task → (if it has subtasks) its subtasks. It owns its own navigation
  state, so closing the panel resets it. A task with subtasks opens its subtask
  list rather than being added whole, since the usual intent there is to work
  through parts of it. Picking subtasks leaves the panel open — you normally take
  several, and each disappears as it's added; picking a whole task closes it.
  `onAdd` therefore only adds, and the picker decides when to call `onClose`.
- **"✎ New Task" creates a task without leaving the Session tab**: title,
  minutes, group, category. `createTask` builds exactly what `TaskGroupView`'s
  `addTask` builds, so it's an ordinary task — it appears under its category in
  Work/Personal, is editable, takes subtasks, and carries the `.tagsess` pill.
  Points to keep:
  - The task and its `sessionQueue` entry are written in **one `setData`**. Two
    writes off the same `data` would discard the first, same trap as unlinking a
    section's tasks.
  - The category `<select>` is driven by `catsIn(data, draft.group)`, so changing
    the group repopulates it and user-made sections appear with no extra wiring.
    `draftCat` falls back to the group's first category rather than storing a
    default, which is what keeps a group switch from leaving a stale `cat` from
    the other group selected.
  - Group and category persist between consecutive adds (several new tasks
    usually share them) but reset when the tab unmounts. They're component
    state, deliberately not in `data` — a transient UI preference shouldn't sync.
  - Add is disabled with an empty title, and when the chosen group has no
    categories at all, which is the only way `draftCat` can be `""`.

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
  `toggleSubtask`/`delSubtask`/`editSubtask` are thin wrappers around it; add
  any future subtask operation the same way rather than mutating `tasks`
  directly, or the parent won't re-derive and the completion burst won't fire.
- `SubtaskRow` has its own inline edit form (pencil icon) covering title,
  minutes, and due date. Editing one re-derives the parent exactly like adding
  one does — that's what `editSubtask` going through `updateSubtasks` buys.
- The due-today/overdue glow is an **inset ring on the subtask row itself**, so
  `.subtaskrow` needs horizontal padding or the highlight sits right on top of
  the checkbox. `.submeta` wraps the "due …"/"N min" pair at one shared font
  size and a fixed min-width, so they line up down the column instead of
  drifting with each row's text.
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
- **Presets** (`category.presets: [{ id, name, amount }]`, `PresetBar` above
  `BudgetView`) are the things bought over and over — a $9.74 Piada lunch.
  Clicking one calls the same `addItem()` as the manual form, so the logged row
  is an ordinary item: editable, deletable, and dated today. Deleting the logged
  row leaves the preset alone and vice versa. Only offered on `"budget"`
  categories — a fixed category's items *are* its budget, so a one-click
  "I bought this again" makes no sense there.
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
  whole month's split across all six categories, drawn with stroke-dasharray/
  stroke-dashoffset arcs. `SegmentBar` fades the same category color per item
  to show a fixed category's internal composition (e.g. Rent vs. Utilities
  within Housing) without needing a second color per item. `BudgetGauge`
  reuses the same arc for Food/Free's spent/remaining, so "budget" reads as a
  countdown rather than a bolted-on chart style. (These arcs used to mirror
  the Session timer's ring; that ring is gone, so Budget is now the only place
  the technique appears.) There's a 6th palette color, `--teal`, added solely
  so Free (whose color would otherwise collide with Investments' pine) gets
  its own hue in the donut/legend.
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
Supabase). **Toggled by clicking the "Lord of my Life" brand** in the header —
there's no separate theme button; `.brand` is a `<button>` styled to look like
text, and `THEMES` maps the current theme to the one you'd get.

- Applied as `data-theme={theme}` on the root `.fw` div. `:root` in `CSS`
  defines the `dark` palette as the default custom-property values;
  `.fw[data-theme="fantasy"]` overrides them, cascading to everything
  underneath since all rules consume colors/fonts via `var(...)`.
- **Fantasy runs at larger type than `dark`.** EB Garamond has a much smaller
  x-height than Inter, so the same px reads noticeably smaller. The fix is a
  block of per-element overrides right after the palette override — raising the
  root `font-size` alone does almost nothing, because nearly every rule sets px
  directly. If you add a new text style, add it to that list too, and make sure
  the value actually differs from the `dark` base or the override is a no-op.
- **There are two scales, split by font, not by size.** Space Mono has a far
  larger apparent size than EB Garamond, so prose uses `--fsz-body`/`--fsz-meta`
  while *every* mono run (`.tagdue`, `.taskmin`, `.pcount`, `.catcount`,
  `.projmeta`, `.legendamt`, `.gwk`, …) uses `--fsz-mono`. Mixing them is what
  made a subtask's "due Aug 13" shout over the subtask title it annotates.
  Pick the scale by which font the element uses.
- `.tagdue`, `.taskmin` and `.pcount` annotate the same row and are deliberately
  the same size in both themes — they looked untidy when they drifted apart.
- **Fantasy ambience** (`FantasyScene`, above `SyncBar`) is a forest silhouette
  along the bottom plus a handful of drifting golden motes, rendered only when
  `theme === "fantasy"`. All of it is inline SVG and CSS — no image assets, so
  nothing extra to package. Rules to keep if you touch it:
  - `.fscene` is `position:fixed; z-index:0; pointer-events:none`, and `.wrap`
    carries `position:relative; z-index:1` to sit above it. Without that pairing
    the treeline paints over the cards.
  - The forest is masked with a `linear-gradient` to top so the treetops fade
    out; unmasked, a hard silhouette cuts across whatever content is at that
    height.
  - Tree positions are **deterministic**, derived from the index — no
    `Math.random()`. A forest that reshuffled on every render would be exactly
    the distracting movement this is supposed to avoid.
  - Motes take ~45–90s to cross the screen (~20px/s). Faster reads as rising
    rather than drifting and pulls the eye.
- **Completing a task burns it; reopening heals it** — fantasy only.
  - The charred look lives on `.taskrow.done`/`.qrow.done`, *not* in the
    animation, so a finished task stays burnt until it's reopened.
  - The burn is a **wipe, not a fade**: `::before` is a sheet painted in the
    row's normal colour, removed left to right by `charwipe` (a `clip-path`
    inset) to uncover the charred row beneath, while `::after` carries the
    flame along the wipe edge. The heal is the same wipe with a charred sheet
    and a gold-green wisp, uncovering the restored row.
  - **Stacking is load-bearing**: cover at `z-index:0`, the row's children
    lifted to `2`, flame at `3`. Without that the cover paints over the text
    (pseudo-elements outrank in-flow content) and the title appears to be drawn
    in as the flame passes.
  - `flicker` animates opacity/blur only. A second `transform` animation would
    override `flamesweep`'s rather than compose with it.
  - Both are pure CSS on a class the row wears for `BURST_MS`, so the dark theme
    — where none of these selectors match — just flips state as before. The
    particle burst is dark's celebration and is hidden in fantasy.
- **The completed checkbox is an ember seal in fantasy, not a green tick.** The
  ✓ text node is collapsed with `font-size:0` and the glyph comes from
  `.check.on::before`, which avoids threading a per-theme glyph through
  `TaskRow`/`SubtaskRow`/the session rows.
- **`burst` is `{ id, kind }`, not a bare task id.** Fantasy animates *both*
  directions, so `toggleTask`/`updateSubtasks` fire `fireBurst(setBurst, id,
  "done" | "undone")`; dark ignores `"undone"` because nothing matches it.
  `burstClass()` turns that into the row's class and returns `""` when the burst
  belongs to another row. Unchecking a subtask that reopens its parent heals the
  parent, same as unchecking it directly.
- **No backticks anywhere in the `CSS` string** — the whole thing is a JS
  template literal, so a backtick in even a CSS *comment* ends the string and
  the file fails to parse.
- Fantasy-only decoration (ember-glow brand text, button shimmer sweep,
  the Gantt today-line's `wardpulse`, the Focus ring's `runeglow` when
  running) lives in `.fw[data-theme="fantasy"] ...` rules near the top of
  `CSS`, right after the palette override. Keep new decorative animations
  scoped there rather than global — the `dark` theme should stay plain.
  All animations already respect `prefers-reduced-motion` via the existing
  global media query; don't bypass it.
- The Session timer card gets a `running` class purely so the fantasy theme can
  glow (`runeglow`) while a session is active.
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
- `npm run app:install` — the same build with `--dir` (no NSIS step, so it's
  fast), then `scripts/make-shortcut.mjs` writes Desktop and Start Menu `.lnk`s
  pointing at `release/win-unpacked/Lord of My Life.exe`. This is how the app
  gets used day to day without a dev server. It deliberately skips the
  installer: a locally built binary has no mark-of-the-web, so Smart App
  Control leaves it alone, while the same app downloaded from Releases is
  blocked outright.
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
- **Releases are built by CI, not by hand.** Pushing a `v*` tag runs
  `.github/workflows/release.yml`, which sets the version from the tag,
  reconstructs `.env.local` from the `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` repo secrets, and has electron-builder publish the
  installer to GitHub Releases. Don't bump `version` in `package.json` by
  hand — the tag is the source of truth. The repo is public so that
  `/releases/latest` is shareable; the secrets are what keep the Supabase
  values out of the source.
- **Publishing is done by `gh release create`, not electron-builder's own
  publisher.** That one creates the release as a *draft* by default and raced
  with itself across artifacts, leaving two release objects for one tag — the
  visible one holding nothing but a `.blockmap`. The explicit step attaches only
  the `.exe`; `latest.yml`/`.blockmap` exist for auto-update, which this app
  doesn't do.
- **Code signing is optional and off by default.** `azureSignOptions` is *not*
  in `package.json` — electron-builder switches to the Azure signing manager the
  moment that key exists, so a half-filled config would break every unsigned
  build. Instead the workflow passes `-c.win.azureSignOptions.*` overrides only
  when the `AZURE_SIGN_*` secrets are set, and picks the release notes to match.
  Unsigned matters: SmartScreen has a "Run anyway" bypass, **Smart App Control
  does not** — it blocks unsigned installers outright, so a signature is the
  only thing that makes the download work for those users.
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
