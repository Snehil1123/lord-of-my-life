/* ============================================================
   AI assistant bridge — the renderer half of the assistant.

   The agent itself runs in Electron's main process (electron/main.cjs)
   on the Claude Agent SDK, authenticated by the user's Claude
   subscription rather than an API key. This file is just the seam:
   it starts a query, streams events back, and routes tool calls to
   an executor the planner registers.

   Consequence of that split: the assistant only exists in the
   desktop app. In a plain browser `window.lolAI` is undefined and
   the panel says so instead of half-working.
   ============================================================ */

const bridge = () => (typeof window !== "undefined" ? window.lolAI : null);

export const agentAvailable = () => !!bridge();

export const MODEL = "claude-sonnet-5";

export const systemPrompt = (today) => `You are the assistant built into "Lord of My Life", a personal planner used by a graduate researcher. Today is ${today}.

The planner has five views, all backed by the same data:
- Gantt Chart — projects broken into dated phases, plus a Deadlines strip showing every task that has a due date.
- Work — tasks under four fixed categories: research, fellowships, classwork, ta.
- Personal — tasks under three fixed categories: exercise, music, other.
- Session — a pomodoro timer. A task's "sessions" count is derived from its minutes, so you only ever set minutes.
- Budget — monthly income split across fixed costs plus two spend-down budgets (Food and Free).

How to work:
- You have tools that read and write the planner directly. When the user asks for something to be *in* the planner, call the tools — don't describe what they should type in.
- Read before you write. Call list_tasks or list_projects to get real ids instead of guessing them.
- Prefer one create_project call carrying all its phases over a create_project followed by add_phases.
- Estimate task lengths in realistic multiples of 5 minutes. A subtask should be one sitting's worth of work, roughly 15–120 minutes; split anything longer.
- When you build a timeline around a real external deadline (a fellowship, a conference, a grant), use WebSearch to find the actual current deadline rather than assuming one, and say in your reply which deadline you found and where it came from. Work backwards from it, and leave real slack: recommendation letters need to be requested at least 4–6 weeks out, and drafts want a round of feedback before anything is final.
- After you change something, say briefly and concretely what you did. Don't paste back the whole list you just created — the user is looking at it.
- Keep replies short. This panel is a narrow sidebar.
- You have no file or shell access, and you are not editing a codebase. Ignore any instinct to look at files; the planner tools are your only view of the user's data.
- You can answer ordinary questions too; not every message needs a tool call.`;

/* The planner registers one executor; main.cjs's tool relay calls into it.
   Registered once for the life of the panel, torn down on unmount. */
export function onToolCall(execute) {
  const api = bridge();
  if (!api) return () => {};
  return api.onToolCall(async ({ id, name, input }) => {
    try {
      const result = await execute(name, input || {});
      api.respondTool({ id, result });
    } catch (e) {
      api.respondTool({ id, error: e?.message || String(e) });
    }
  });
}

export function onEvent(cb) {
  const api = bridge();
  return api ? api.onEvent(cb) : () => {};
}

// `today` comes from the planner's dateKey() rather than being derived here —
// same local-calendar-day rule the rest of the app depends on.
export async function runQuery({ prompt, sessionId, today }) {
  const api = bridge();
  if (!api) return { error: "The assistant only runs in the desktop app." };
  return api.query({ prompt, system: systemPrompt(today), model: MODEL, sessionId });
}

export const cancelQuery = () => bridge()?.cancel();
