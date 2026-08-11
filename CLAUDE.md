# Lord of My Life

A personal research planner: big-picture project timelines (Gantt), week-to-week
tasks and 1:1 action items, and pomodoro focus sessions — all tied together by
ISO week keys.

## Stack

Vite + React, no router, no component library. `npm run dev` to run locally.

## Structure

This is intentionally a **single-file React app**: nearly all UI, state, and
styling lives in [src/research-planner.jsx](src/research-planner.jsx). `src/main.jsx` just mounts it.
Don't split it into multiple files/components unless the user asks — the whole
point is that one file is the source of truth for the whole app.

- **Design tokens** live at the top of the file in the `CSS` template string
  (`:root` custom properties: `--paper`, `--ink`, `--pine`, `--tomato`, etc.),
  injected via a `<style>` tag. Change colors/spacing there, not inline,
  unless it's a one-off.
- **All state flows through one `data` object** (`{ settings, pomoLog,
  projects, tasks }`), held in `useState` in the top-level `LordOfMyLife`
  component and passed down as `data` / `setData` props. There is no
  Redux/Context — view components mutate by calling `setData({ ...data, ... })`.
  Keep it that way; don't introduce a state library for this app's size.
- **Persistence**: `loadData()` / `saveData()` read/write `localStorage` under
  key `lordofmylife:data`, debounced 500ms after `data` changes. `exportData()` /
  `importData()` handle JSON backup/restore (Export/Import buttons in the
  header). If the data shape changes, consider whether old exported JSON
  backups should still import cleanly.
- **Three views**, switched by the `view` tab in the header, all reading from
  the same `data`:
  - `PlanView` / `ProjectGantt` — projects → phases, rendered as a week-grid
    Gantt chart.
  - `WeekView` — tasks grouped by category (`CATS`), scoped to one week.
  - `FocusView` — pomodoro timer; completing a work session increments
    `pomoLog[today]` and optionally a task's `done` count.

## The week spine

Every task and the Gantt's week columns are keyed by **ISO week** strings like
`"2026-W33"`, produced by `weekKeyOf(date)` (see `isoWeek`/`monday`/`addDays`
helpers near the top of the file). This is what lets Week view, the Gantt's
today-marker, and pomodoro logging all agree on "what week is it." If you add
a feature that touches dates, use these helpers rather than rolling new date
math — ISO week edge cases (year boundaries, week 53) are already handled
here.

## Data model quick reference

```
data = {
  settings: { work, short, long },       // pomodoro minutes
  pomoLog:  { "YYYY-MM-DD": count },      // completed work sessions per day
  projects: [{ id, name, color,
                phases: [{ id, name, start, end, done }] }],
  tasks: [{ id, title, cat, week, est, done, checked, oneOnOne }],
}
```

`cat` refers to `CATS` ids (`research` / `writing` / `admin` / `personal`).
`week` is an ISO week key. `est`/`done` are pomodoro counts for that task.

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

## Conventions

- No comments explaining *what* code does — the file already favors compact,
  readable helpers. Only comment non-obvious *why* (there are a couple near
  the storage/audio helpers).
- Keep everything working with plain `useState`/`useEffect` — no external
  state or data-fetching libraries needed for a local-only planner.
- When adding UI, match the existing visual language: pill buttons, the
  `--pine`/`--tomato` accent pair, `IBM Plex Mono` for numeric/meta text,
  `Bricolage Grotesque` for headings.
