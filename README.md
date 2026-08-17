# Lord of My Life

A personal planner built around how research actually goes: long project
timelines, the day-to-day tasks under them, and the focus sessions you get them
done in.

**[⬇ Download the latest version for Windows](https://github.com/Snehil1123/lord-of-my-life/releases/latest)**

Windows will warn that the installer is from an unidentified publisher — the app
isn't code-signed. Choose **More info → Run anyway**.

## What's in it

- **Work / Personal** — tasks under sections you define, each with a length, an
  optional due date, and subtasks. Due dates glow gold on the day and pulse red
  once they're late.
- **Gantt Chart** — projects broken into dated phases, optionally grouped into
  sections (one per fellowship, say), plus every dated task on one timeline.
- **Session** — a pomodoro timer with a queue of tasks, showing how many
  sessions are left and what time you'll finish. You can share a session with
  someone else, either on the same screen or over the network with a room code.
- **Budget** — a month at a glance: fixed costs, spend-down budgets you draw
  against, and one-click presets for things you buy often.
- **Assistant** — a panel that can edit the planner directly: break a task into
  subtasks, or research a real fellowship deadline and lay out a timeline
  backwards from it.

Two themes, switched by clicking the title: a plain modern one and a
leather-and-candlelight "grimoire" with a forest, drifting embers, and tasks
that burn away as you finish them.

## Running it yourself

```bash
npm install
npm run electron:dev
```

Cloud sync and shared rooms need a [Supabase](https://supabase.com) project
(the free tier is plenty). Copy `.env.example` to `.env.local`, fill in your
project URL and anon key, and run `supabase/schema.sql` once in the SQL editor.
Without it the app is fully usable, just local to one machine.

The assistant panel additionally needs the desktop app — it runs the Claude
Agent SDK in Electron's main process, authenticated by your own Claude
subscription, so there's no API key anywhere in this project.

## Releasing

Tag and push; the workflow in `.github/workflows/release.yml` builds the
installer and publishes it.

```bash
git tag v0.2.0 && git push origin v0.2.0
```
