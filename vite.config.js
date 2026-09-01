import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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

export default defineConfig({
  base: "./",
  plugins: [react()],
  define: { __BUILD_COMMIT__: JSON.stringify(buildCommit()) },
});
