/* ============================================================
   Agent layer — owns the Claude Agent SDK: tool schemas, the
   query options, and the message loop. Authenticated by the
   user's Claude subscription (the credentials `claude login`
   writes), not an API key.

   Knows nothing about Electron. Tool calls are handed to an
   injected `callTool(name, input)` so the caller decides where
   planner state lives — main.cjs forwards them over IPC to the
   renderer, and the test harness answers them directly.
   ============================================================ */

const path = require("node:path");
const fs = require("node:fs");

/* The SDK spawns a native `claude` binary that ships in a per-platform package.
   Left to resolve it itself, in a packaged build it lands on a path *inside*
   app.asar — which fs can read (Electron's asar shim fakes it) but the OS
   cannot execute, so the spawn fails with "exists but failed to launch".
   asarUnpack puts a real copy alongside the archive; this rewrites the path
   to point at that copy. In dev there's no app.asar in the path and the
   replace is a no-op. Returns undefined if anything looks off, which just
   hands resolution back to the SDK. */
function nativeBinaryPath() {
  try {
    const pkg = `claude-agent-sdk-${process.platform}-${process.arch}`;
    const bin = process.platform === "win32" ? "claude.exe" : "claude";
    const resolved = path
      .join(__dirname, "..", "node_modules", "@anthropic-ai", pkg, bin)
      .replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
    return fs.existsSync(resolved) ? resolved : undefined;
  } catch (e) {
    return undefined;
  }
}

// The SDK and zod are ESM-only and this file is CommonJS, so they load via
// dynamic import on first use and are cached for the life of the process.
let sdkPromise = null;
const loadSdk = () => {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const [sdk, zod] = await Promise.all([
        import("@anthropic-ai/claude-agent-sdk"),
        import("zod"),
      ]);
      return { query: sdk.query, tool: sdk.tool, createSdkMcpServer: sdk.createSdkMcpServer, z: zod.z };
    })();
  }
  return sdkPromise;
};

const CATS = ["research", "fellowships", "classwork", "ta", "exercise", "music", "other"];

const TOOL_NAMES = [
  "list_tasks", "create_task", "update_task", "delete_task", "add_subtasks",
  "list_projects", "create_project", "add_phases", "get_budget_summary",
];
const QUALIFIED = TOOL_NAMES.map((n) => `mcp__planner__${n}`);

function buildPlannerServer({ tool, createSdkMcpServer, z }, callTool) {
  // Every handler is the same shape: hand the args to the planner, hand back
  // whatever JSON it returns. runPlannerTool reports bad input as an `error`
  // field inside a normal result, so only genuine transport failures are isError.
  const relay = (name) => async (args) => {
    try {
      const result = await callTool(name, args);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Couldn't reach the planner: ${e.message}` }], isError: true };
    }
  };
  const readOnly = { annotations: { readOnlyHint: true } };
  const dueDate = z.string().describe("Due date as YYYY-MM-DD. Omit if there's no deadline.").optional();
  const phase = z.object({
    name: z.string(),
    start: z.string().describe("YYYY-MM-DD"),
    end: z.string().describe("YYYY-MM-DD, on or after start"),
  });

  return createSdkMcpServer({
    name: "planner",
    version: "1.0.0",
    tools: [
      tool("list_tasks",
        "Read the user's current tasks. Call this before creating, updating, or breaking down a task so you have real task ids and don't duplicate something that already exists.",
        {
          cat: z.enum(CATS).describe("Only return tasks in this category. Omit for all categories.").optional(),
          includeCompleted: z.boolean().describe("Include finished tasks. Defaults to false.").optional(),
        },
        relay("list_tasks"), readOnly),

      tool("create_task",
        "Add a new task under one of the fixed categories. Work categories are research/fellowships/classwork/ta; personal ones are exercise/music/other.",
        {
          cat: z.enum(CATS),
          title: z.string(),
          minutes: z.number().describe("Estimated length in minutes. Focus sessions are derived from this."),
          dueDate,
        },
        relay("create_task")),

      tool("update_task",
        "Change an existing task's title, length, or due date. If the task has subtasks, only the title can be changed — its minutes and due date are derived from its subtasks.",
        {
          taskId: z.string(),
          title: z.string().optional(),
          minutes: z.number().optional(),
          dueDate: z.string().describe("YYYY-MM-DD, or null to clear the due date.").nullable().optional(),
        },
        relay("update_task")),

      tool("delete_task",
        "Permanently delete a task. Only do this when the user clearly asked for it.",
        { taskId: z.string() },
        relay("delete_task")),

      tool("add_subtasks",
        "Break a task into subtasks, each with its own length and optional due date. The parent task's total time becomes the sum of its subtasks, its due date becomes the latest subtask due date, and it completes automatically once every subtask is checked — so don't also call update_task to set those.",
        {
          taskId: z.string(),
          subtasks: z.array(z.object({ title: z.string(), minutes: z.number(), dueDate })),
        },
        relay("add_subtasks")),

      tool("list_projects",
        "Read the user's Gantt chart projects and their phases, with real project ids.",
        {}, relay("list_projects"), readOnly),

      tool("create_project",
        "Create a Gantt chart project, optionally with its phases in the same call. Use this for anything with a multi-week arc (a fellowship application, a manuscript, a conference submission).",
        {
          name: z.string(),
          phases: z.array(phase).describe("Ordered phases. Overlapping date ranges are fine.").optional(),
        },
        relay("create_project")),

      tool("add_phases",
        "Add phases to an existing project. Get the project id from list_projects first.",
        { projectId: z.string(), phases: z.array(phase) },
        relay("add_phases")),

      tool("get_budget_summary",
        "Read this month's budget: monthly income, each category's total, and how much of the Food and Free budgets is left.",
        {}, relay("get_budget_summary"), readOnly),
    ],
  });
}

let activeQuery = null;

/* Runs one exchange. Streams {type:"text"|"tool"|"error"} to onEvent and
   resolves { sessionId } or { error }. */
async function runAgentQuery({ prompt, system, model, sessionId, cwd, callTool, onEvent }) {
  if (activeQuery) return { error: "A request is already running." };
  let latestSession = sessionId || null;

  try {
    const sdk = await loadSdk();
    const q = sdk.query({
      prompt,
      options: {
        systemPrompt: system,
        model,
        maxTurns: 16,
        mcpServers: { planner: buildPlannerServer(sdk, callTool) },
        // Availability: strip every built-in except WebSearch, so the assistant
        // physically cannot read files or run shell commands on this machine.
        tools: ["WebSearch"],
        allowedTools: [...QUALIFIED, "WebSearch"],
        // Nothing here can prompt for approval — there's no TTY and no permission
        // UI — so a prompt would hang forever. Safe only because `tools` above
        // already limits what exists. Don't widen `tools` without revisiting this.
        permissionMode: "bypassPermissions",
        // Don't inherit ~/.claude settings or a nearby CLAUDE.md — this agent is
        // configured only by what's in this file.
        settingSources: [],
        cwd,
        ...(nativeBinaryPath() ? { pathToClaudeCodeExecutable: nativeBinaryPath() } : {}),
        ...(sessionId ? { resume: sessionId } : {}),
      },
    });
    activeQuery = q;

    for await (const message of q) {
      if (message.session_id) latestSession = message.session_id;

      if (message.type === "assistant") {
        // Docs show both shapes across pages; the SDK wrapper nests the API message.
        const blocks = message.message?.content || message.content || [];
        for (const b of blocks) {
          if (b.type === "text" && b.text?.trim()) onEvent({ type: "text", text: b.text });
          if (b.type === "tool_use") onEvent({ type: "tool", name: b.name });
        }
      }
      if (message.type === "result" && message.subtype !== "success") {
        onEvent({ type: "error", message: message.result || "The assistant stopped unexpectedly." });
      }
    }
    return { sessionId: latestSession };
  } catch (e) {
    return { error: describeError(e), sessionId: latestSession };
  } finally {
    activeQuery = null;
  }
}

function interruptAgent() {
  try { activeQuery?.interrupt?.(); } catch (e) { /* already finished */ }
  activeQuery = null;
}

// The SDK surfaces auth problems as ordinary process errors, which read as
// noise. Translate the common one into the action that actually fixes it.
function describeError(e) {
  const msg = String(e?.message || e);
  if (/auth|login|credential|unauthor|401/i.test(msg)) {
    return "Not signed in. Run `claude login` in a terminal once, then try again.";
  }
  return msg;
}

module.exports = { runAgentQuery, interruptAgent, TOOL_NAMES };
