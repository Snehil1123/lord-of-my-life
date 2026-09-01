/* ============================================================
   In-app update, for an app whose installation is its own git checkout.

   This machine runs the output of `npm run app:install` — an unpacked build in
   release/win-unpacked — rather than the NSIS installer, because a locally built
   binary carries no mark-of-the-web and so isn't blocked by Smart App Control.
   electron-updater can't serve that: it only knows how to run the installer,
   which lands in an entirely different directory and would leave two copies.

   So an update is: fetch, see whether the upstream branch is ahead, and on
   request hand off to a detached script. The app cannot rebuild itself in place
   — the running exe sits inside the very directory electron-builder replaces,
   and Windows won't allow that while it's open — so the script waits for this
   process to exit first, then pulls, rebuilds and relaunches.

   Knows nothing about Electron: paths come in as arguments, which is what makes
   it runnable from a plain Node harness.
   ============================================================ */
const { execFile, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const git = (cwd, args) =>
  new Promise((resolve, reject) => {
    execFile("git", args, { cwd, windowsHide: true }, (err, stdout, stderr) =>
      err ? reject(new Error((stderr || err.message).trim().split("\n")[0])) : resolve(stdout.trim()));
  });

/* Walk up looking for the checkout rather than counting "..": in dev the app
   path is the repo itself, in an unpacked build it's four levels below it, and
   walking covers both without branching on which one we're in. */
function repoRoot(from) {
  let dir = from;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, ".git")) && fs.existsSync(path.join(dir, "package.json"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

async function check({ appPath }) {
  const cwd = repoRoot(appPath);
  if (!cwd) return { ok: false, reason: "This build isn't running from a checkout of the repo." };
  try {
    const branch = await git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
    let upstream;
    try {
      upstream = await git(cwd, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
    } catch (e) {
      return { ok: false, reason: `Branch "${branch}" isn't tracking a remote to update from.` };
    }
    await git(cwd, ["fetch", "--quiet"]);
    const behind = Number(await git(cwd, ["rev-list", "--count", `HEAD..${upstream}`]));
    // a dirty tree can't be fast-forwarded, so say so up front rather than
    // letting the pull fail halfway through the update
    const dirty = (await git(cwd, ["status", "--porcelain"])) !== "";
    const head = await git(cwd, ["rev-parse", "HEAD"]);
    const subject = await git(cwd, ["log", "-1", "--pretty=%s", behind > 0 ? upstream : "HEAD"]);
    return { ok: true, behind, dirty, branch, upstream, subject, head };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

function run({ appPath, exePath, pid }) {
  const cwd = repoRoot(appPath);
  if (!cwd) return { started: false, reason: "No checkout to update from." };
  const script = path.join(cwd, "scripts", "update.ps1");
  if (!fs.existsSync(script)) return { started: false, reason: "scripts/update.ps1 is missing." };
  // detached so it outlives the quit that follows; its own console is where the
  // pull and build report progress, since by then there's no window left
  const child = spawn(
    "powershell",
    ["-ExecutionPolicy", "Bypass", "-NoProfile", "-File", script,
      "-Repo", cwd, "-Exe", exePath, "-WaitPid", String(pid)],
    { cwd, detached: true, stdio: "ignore", windowsHide: false },
  );
  child.unref();
  return { started: true };
}

module.exports = { check, run, repoRoot };
