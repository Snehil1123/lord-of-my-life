const { contextBridge, ipcRenderer } = require("electron");

/* The only bridge between the renderer and Node. Deliberately narrow: the
   renderer can start/cancel an assistant query and answer tool calls, and
   nothing else. No fs, no shell, no generic ipcRenderer access. */
contextBridge.exposeInMainWorld("lolAI", {
  available: true,

  // resolves { sessionId } or { error }
  query: (payload) => ipcRenderer.invoke("ai:query", payload),
  cancel: () => ipcRenderer.send("ai:cancel"),

  // streamed assistant text / tool-call notices / errors
  onEvent: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on("ai:event", handler);
    return () => ipcRenderer.removeListener("ai:event", handler);
  },

  // main asks the renderer to run a planner tool against live state
  onToolCall: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on("ai:tool", handler);
    return () => ipcRenderer.removeListener("ai:tool", handler);
  },
  respondTool: (payload) => ipcRenderer.send("ai:tool-result", payload),
});

/* Read-only calendar access. The renderer supplies the client id (it comes from
   the Vite build) and never sees the tokens, which stay in the main process. */
contextBridge.exposeInMainWorld("lolCal", {
  available: true,
  connect: (cfg) => ipcRenderer.invoke("gcal:connect", cfg),
  list: (cfg) => ipcRenderer.invoke("gcal:list", cfg),
  status: () => ipcRenderer.invoke("gcal:status"),
  disconnect: () => ipcRenderer.invoke("gcal:disconnect"),
});

/* Update: ask whether the checkout is behind, and ask to update. Both are
   fixed operations — the renderer names no path and runs no command. */
contextBridge.exposeInMainWorld("lolUpdate", {
  available: true,
  check: () => ipcRenderer.invoke("update:check"),
  run: () => ipcRenderer.invoke("update:run"),          // checkout: pull and rebuild
  download: () => ipcRenderer.invoke("update:download"), // installed: fetch the installer
  install: () => ipcRenderer.invoke("update:install"),   // installed: restart into it
  onProgress: (cb) => {
    const handler = (_e, pct) => cb(pct);
    ipcRenderer.on("update:progress", handler);
    return () => ipcRenderer.removeListener("update:progress", handler);
  },
});
