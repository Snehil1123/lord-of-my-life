const { app, BrowserWindow, ipcMain, shell, safeStorage } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { runAgentQuery, interruptAgent } = require("./agent.cjs");
const gcal = require("./gcal.cjs");

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: "#171C18",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

/* ---------------- assistant IPC ----------------
   The agent runs here in the main process (agent.cjs), but planner state lives
   in the renderer, so every tool call round-trips: main asks, the renderer runs
   runPlannerTool against live data, main resolves the promise the SDK is waiting
   on. This process stays a relay and never learns what a task is. */

let toolSeq = 0;
const pendingTools = new Map();
const TOOL_TIMEOUT = 20000;

function askRenderer(win, name, input) {
  return new Promise((resolve, reject) => {
    if (!win || win.isDestroyed()) return reject(new Error("Window is gone."));
    const id = String(++toolSeq);
    const timer = setTimeout(() => {
      pendingTools.delete(id);
      reject(new Error("The planner didn't respond in time."));
    }, TOOL_TIMEOUT);
    pendingTools.set(id, { resolve, reject, timer });
    win.webContents.send("ai:tool", { id, name, input });
  });
}

ipcMain.on("ai:tool-result", (_e, { id, result, error }) => {
  const p = pendingTools.get(id);
  if (!p) return; // already timed out
  clearTimeout(p.timer);
  pendingTools.delete(id);
  if (error) p.reject(new Error(error));
  else p.resolve(result);
});

ipcMain.handle("ai:query", async (event, { prompt, system, model, sessionId }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return runAgentQuery({
    prompt, system, model, sessionId,
    cwd: app.getPath("userData"),
    callTool: (name, input) => askRenderer(win, name, input),
    onEvent: (payload) => {
      if (win && !win.isDestroyed()) win.webContents.send("ai:event", payload);
    },
  });
});

ipcMain.on("ai:cancel", () => interruptAgent());

/* ---------------- Google Calendar ----------------
   The refresh token is a long-lived credential, so it's encrypted with the OS
   keychain via safeStorage rather than left as plain JSON in userData. If the
   platform has no encryption available, we don't fall back to plaintext — we
   just don't persist, and the user reconnects next launch. */
const tokenFile = () => path.join(app.getPath("userData"), "gcal.token");
const store = {
  get() {
    try {
      if (!fs.existsSync(tokenFile())) return null;
      const raw = fs.readFileSync(tokenFile());
      return JSON.parse(safeStorage.decryptString(raw));
    } catch (e) { return null; }
  },
  set(value) {
    try {
      if (!value) { fs.rmSync(tokenFile(), { force: true }); return; }
      if (!safeStorage.isEncryptionAvailable()) return;
      fs.writeFileSync(tokenFile(), safeStorage.encryptString(JSON.stringify(value)));
    } catch (e) { /* keep going without persistence */ }
  },
};
const gcalArgs = (cfg) => ({ ...cfg, store, openUrl: (u) => shell.openExternal(u) });

ipcMain.handle("gcal:connect", async (_e, cfg) => {
  try { return await gcal.connect(gcalArgs(cfg)); }
  catch (err) { return { error: err.message }; }
});
ipcMain.handle("gcal:list", async (_e, cfg) => {
  try { return await gcal.listEvents(gcalArgs(cfg)); }
  catch (err) { return { error: err.message }; }
});
ipcMain.handle("gcal:status", () => gcal.status({ store }));
ipcMain.handle("gcal:disconnect", () => gcal.disconnect({ store }));
