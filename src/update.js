/* ============================================================
   In-app update — renderer half. Two kinds of install can be behind, and this
   file is the one seam both answer through:

   kind "git"  — a copy running from a checkout (what `npm run app:install`
                 produces). The git work and the handoff to the rebuild script
                 live in the main process (electron/updater.cjs).
   kind "app"  — an installed .exe. electron-updater downloads the release
                 installer and restarts into it.

   The hosted version is deliberately neither. A website should simply be
   current, so it has no pill and nothing to accept: the service worker takes a
   new build as soon as it has downloaded, and `initWebApp` reloads into it
   during startup. In a browser window.lolUpdate is undefined, so both desktop
   paths report nothing and `updaterAvailable()` is false — which is what keeps
   UpdatePill from rendering there at all.
   ============================================================ */

const bridge = () => (typeof window !== "undefined" ? window.lolUpdate : null);

const WEB = import.meta.env.MODE === "web" && typeof navigator !== "undefined" && "serviceWorker" in navigator;

export const updaterAvailable = () => !!bridge();

/* ---------------- the hosted version ---------------- */

/* How long after opening the app a new build may still interrupt. Installing one
   means downloading the whole precache, so it can't be instant — but past this
   the person is working, and a reload would take whatever they were typing with
   it. They get the new version the next time they open the app instead, which is
   what "always launches the latest" means. */
const STARTUP_MS = 20000;

export function initWebApp() {
  if (!WEB) return;
  /* Without this the browser may evict localStorage under storage pressure, and
     localStorage is where a signed-out device's only copy of its work lives. */
  navigator.storage?.persist?.().catch(() => {});

  const opened = Date.now();
  /* A page with no controller is a first visit, and the worker claiming it is
     not an update — reloading there would restart the app for no reason. */
  const hadController = !!navigator.serviceWorker.controller;
  let touched = false;
  const mark = () => { touched = true; };
  window.addEventListener("keydown", mark, { once: true, capture: true });
  window.addEventListener("pointerdown", mark, { once: true, capture: true });

  /* The worker skips waiting and claims the page, so this fires as soon as a new
     build has finished installing. The document is still the old one until it is
     reloaded — which is safe to do while the app has only just opened and nobody
     has touched it, and is left alone after that. */
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || touched || Date.now() - opened > STARTUP_MS) return;
    window.location.reload();
  });

  const go = () => navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
    .catch(() => {}); // a failed registration just means no offline support
  /* Held back to `load` so registering doesn't compete with the first paint —
     but only if that hasn't already happened. Waiting for an event that has been
     and gone would mean never registering at all, and so never working offline. */
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
}

/* ---------------- what the pill asks ---------------- */

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
