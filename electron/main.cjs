const { app, BrowserWindow, ipcMain, shell, safeStorage } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { runAgentQuery, interruptAgent } = require("./agent.cjs");
const gcal = require("./gcal.cjs");
const updater = require("./updater.cjs");

const isDev = !app.isPackaged;

/* Which GPU to run on, when the machine has more than one.

   Left to Chromium by default, and that is deliberate: on a laptop the
   integrated GPU is the low-power one, and a planner has no business waking a
   discrete card. Forcing the discrete GPU lowers the percentage the task manager
   reports while raising the watts behind it, because the same work is now being
   done by a much larger chip that would otherwise be asleep. If the app is busy
   enough to matter, the fix is to do less work, not to spread it over a bigger
   GPU.

   Set LOML_GPU=high to force the discrete one anyway, or =low to pin the
   integrated one. */
const gpu = (process.env.LOML_GPU || "").toLowerCase();
if (gpu === "high") app.commandLine.appendSwitch("force_high_performance_gpu");
if (gpu === "low") app.commandLine.appendSwitch("force_low_power_gpu");

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

/* ---------------- updating ----------------
   Two mechanisms, because there are two kinds of install and neither can serve
   the other.

   A copy running from a git checkout — what `npm run app:install` produces, and
   what this machine runs — updates by pulling and rebuilding (updater.cjs).
   electron-updater cannot do that: it only knows how to run the NSIS installer,
   which lands somewhere else entirely and would leave two copies.

   Everyone who installed the .exe has no checkout, no Node and no build script,
   so they get electron-updater against the GitHub release feed. The git check
   runs first and, when it reports a checkout, wins — otherwise the installed
   path is used. */
let feed = null;   // electron-updater, loaded lazily: it throws when unpackaged
function autoUpdater() {
  if (!feed) ({ autoUpdater: feed } = require("electron-updater"));
  feed.autoDownload = false; // 160MB — ask before spending someone's bandwidth
  feed.autoInstallOnAppQuit = false;
  return feed;
}
const send = (channel, payload) => {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(channel, payload);
  }
};

ipcMain.handle("update:check", async () => {
  const git = await updater.check({ appPath: app.getAppPath() });
  if (git.ok) return { kind: "git", ...git };
  if (!app.isPackaged) return { kind: "none", ok: false, reason: git.reason };
  try {
    const up = autoUpdater();
    up.removeAllListeners("download-progress");
    up.on("download-progress", (p) => send("update:progress", Math.round(p.percent)));
    const res = await up.checkForUpdates();
    const version = res && res.updateInfo && res.updateInfo.version;
    if (!version || version === app.getVersion()) {
      return { kind: "app", ok: true, behind: 0, version: app.getVersion() };
    }
    return { kind: "app", ok: true, behind: 1, version, current: app.getVersion(),
             subject: `Version ${version} is available.` };
  } catch (e) {
    // no network, no release yet, or a malformed feed — say nothing rather than nag
    return { kind: "app", ok: false, reason: e.message };
  }
});

/* Quit only once the helper is actually running, and a beat later so the reply
   reaches the renderer first. The helper waits on this pid, so quitting before
   it exists would leave it waiting on nothing. */
ipcMain.handle("update:run", () => {
  const res = updater.run({ appPath: app.getAppPath(), exePath: app.getPath("exe"), pid: process.pid });
  if (res.started) setTimeout(() => app.quit(), 500);
  return res;
});

// download, then hand over to the installer and restart into the new version
ipcMain.handle("update:download", async () => {
  try {
    const up = autoUpdater();
    await up.downloadUpdate();
    return { downloaded: true };
  } catch (e) {
    return { downloaded: false, reason: e.message };
  }
});
ipcMain.handle("update:install", () => {
  try { autoUpdater().quitAndInstall(false, true); return { started: true }; }
  catch (e) { return { started: false, reason: e.message }; }
});
