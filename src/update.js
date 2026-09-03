/* ============================================================
   In-app update — renderer half. The git work and the handoff to the rebuild
   script live in the main process (electron/updater.cjs); this is just the seam.

   Desktop-only, and specifically only when the app is running out of a checkout
   of its own repo, which is what `npm run app:install` produces. In a browser
   tab window.lolUpdate is undefined and the pill never appears.
   ============================================================ */

const bridge = () => (typeof window !== "undefined" ? window.lolUpdate : null);

export const updaterAvailable = () => !!bridge();
export const checkForUpdate = () =>
  bridge()?.check() ?? Promise.resolve({ ok: false, reason: "Desktop app only." });
export const runUpdate = () =>
  bridge()?.run() ?? Promise.resolve({ started: false, reason: "Desktop app only." });

/* The installed-app path: electron-updater downloads the release installer and
   then restarts into it. Separate from runUpdate because a checkout rebuilds
   itself instead — see electron/main.cjs for why one can't serve both. */
export const downloadUpdate = () =>
  bridge()?.download() ?? Promise.resolve({ downloaded: false, reason: "Desktop app only." });
export const installUpdate = () =>
  bridge()?.install() ?? Promise.resolve({ started: false, reason: "Desktop app only." });
export const onUpdateProgress = (cb) => bridge()?.onProgress(cb) ?? (() => {});
