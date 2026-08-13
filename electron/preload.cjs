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
