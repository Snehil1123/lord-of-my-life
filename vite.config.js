import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";

/* Stamped into the bundle so the app knows which commit it was built from. The
   update check needs it: comparing the checkout against its remote alone would
   stay silent in the ordinary case where commits land locally and are pushed in
   the same breath — HEAD equals origin, while the build sitting in
   release/win-unpacked is older than both. Empty outside a checkout, which just
   disables that half of the check. */
function buildCommit() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch (e) {
    return "";
  }
}

/* Two targets out of one source tree, told apart by the mode:

   default — the desktop app. Electron loads dist/index.html over file://, which
   is why base has to be relative.
   web     — the hosted version at lordofmylife.net. An absolute base here,
   because a service worker's scope and the manifest's start_url are resolved as
   real paths and "./" leaves them ambiguous. It is the site root rather than a
   repo subpath because of the custom domain — public/CNAME is what sets that,
   and the two have to change together or every asset 404s. */
export default defineConfig(({ mode }) => {
  const web = mode === "web";
  return {
    base: web ? "/" : "./",
    plugins: [
      react(),
      ...(web ? [VitePWA(pwa())] : []),
    ],
    define: { __BUILD_COMMIT__: JSON.stringify(buildCommit()) },
  };
});

/* The hosted app has to survive the same blocked networks the desktop one does —
   a tab with no service worker simply fails to load with the network down, which
   would lose the whole offline story the desktop app already has.

   "autoUpdate", so a new build takes over as soon as it has downloaded rather
   than waiting to be asked: a website has no business offering someone a version
   number to accept, it should just be current. The desktop app has to ask because
   updating it means quitting and reinstalling; here it costs a reload. What that
   reload must never do is interrupt someone mid-sentence, so src/update.js takes
   it during startup only. */
const pwa = () => ({
  registerType: "autoUpdate",
  injectRegister: null, // registration lives in src/update.js beside the other update paths
  manifest: {
    name: "Lord of My Life",
    short_name: "Lord of My Life",
    description: "A personal planner: project timelines, tasks, focus sessions, and a budget.",
    start_url: "./",
    scope: "./",
    display: "standalone",
    background_color: "#171C18",
    theme_color: "#171C18",
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  },
  workbox: {
    globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
    // the share card is fetched by link scrapers, never by the app — precaching
    // it would make every visitor download 40KB they will never see
    globIgnores: ["og.png"],
    navigateFallback: "index.html",
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      /* The themes' faces come from Google Fonts at runtime, so without this an
         offline launch falls back to system fonts and looks like a different
         app. Cached on first use and refreshed in the background after. */
      {
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
        handler: "StaleWhileRevalidate",
        options: { cacheName: "google-fonts", expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 } },
      },
    ],
  },
});
