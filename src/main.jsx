import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LordOfMyLife from "./research-planner.jsx";
import { initWebApp } from "./update.js";

// no-op outside the hosted build: registers the service worker that lets the
// web version open with the network down, and asks to keep storage persistent
initWebApp();

/* index.html parks a plain description of the app in the root, so the first
   paint says what this is and a crawler running no JavaScript still finds
   something. Clearing it explicitly rather than trusting createRoot to replace
   it: the boot markup would otherwise sit underneath the app if that ever
   changed, and this is one line. */
const root = document.getElementById("root");
root.replaceChildren();

createRoot(root).render(
  <StrictMode>
    <LordOfMyLife />
  </StrictMode>
);
