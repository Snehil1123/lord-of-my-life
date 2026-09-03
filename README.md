# Lord of My Life

A personal planner built around how research actually goes: long project
timelines, the day-to-day tasks under them, and the focus sessions you get them
done in.

**[⬇ Download the latest version for Windows](https://github.com/Snehil1123/lord-of-my-life/releases/latest)**

The installer isn't code-signed, so Windows will object in one of two ways:

- **"Windows protected your PC"** (SmartScreen) — choose
  **More info → Run anyway**.
- **"Smart App Control blocked this app"** — this one has no bypass. Smart App
  Control only runs software that's signed or already known to Microsoft, and
  ignores the Run-anyway path entirely. Either turn it off (Windows Security →
  App & browser control → Smart App Control — note that turning it off is
  permanent; re-enabling it requires reinstalling Windows) or run the app from
  source as below.

Signing the build is what actually fixes the second case, for everyone at once.
See "Releasing" below.

## What's in it

- **Work / Personal** — tasks under sections you define, each with a length, an
  optional due date, and subtasks. Due dates glow gold on the day and pulse red
  once they're late.
- **Gantt Chart** — projects broken into dated phases, optionally grouped into
  sections (one per fellowship, say), plus every dated task on one timeline.
- **Session** — a pomodoro timer with a queue of tasks, showing how many
  sessions are left and what time you'll finish. You can share a session with
  someone else, either on the same screen or over the network with a room code.
- **Calendar** — a week of events with your planned focus sessions drawn over
  it, so you can see what collides. Connect a Google Calendar (read-only) and
  those events come in too.
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

### Installing your own build

You don't have to keep a dev server running to use the app. This builds it and
drops shortcuts on the Desktop and in the Start Menu:

```bash
npm run app:install
```

The result lives in `release/win-unpacked/` (about 660 MB, most of it the Agent
SDK's runtime) and runs standalone — no Vite, no terminal.

After that you don't need the command again: when the checkout is behind its
remote, an **Update** pill appears in the app's header. It quits the app,
rebuilds it in a terminal window, and reopens it. It won't offer to update over
uncommitted changes, and if a build fails nothing is replaced.

Worth knowing: a build you make yourself isn't subject to the Smart App Control
block that stops the downloaded installer, because it never carried a
mark-of-the-web. Stop the dev server before running this — a live file watcher
can hold a handle in `release/` and fail the build with `EPERM`.

## Releasing

Tag and push; the workflow in `.github/workflows/release.yml` builds the
installer and publishes it, along with `latest.yml` and the `.blockmap` that
installed copies read to update themselves.

```bash
git tag v0.2.0 && git push origin v0.2.0
```

### Code signing (optional)

Builds are unsigned unless a set of `AZURE_SIGN_*` repo secrets is present, in
which case the workflow signs through [Azure Trusted
Signing](https://learn.microsoft.com/en-us/azure/trusted-signing/) — currently
about $10/month, and the cheapest certificate that Smart App Control accepts.
Traditional OV/EV certificates from a CA work too and cost several hundred a
year; either way the certificate has to be issued to a verified identity, which
is the part that takes time rather than the wiring.

Set up a Trusted Signing account and certificate profile, create a service
principal with the *Trusted Signing Certificate Profile Signer* role, then add:

```
AZURE_SIGN_ENDPOINT   https://<region>.codesigning.azure.net
AZURE_SIGN_ACCOUNT    Trusted Signing account name
AZURE_SIGN_PROFILE    certificate profile name
AZURE_SIGN_PUBLISHER  the certificate subject name, exactly
AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET
```

The next tag you push comes out signed, and the release notes drop the
Run-anyway instructions.
