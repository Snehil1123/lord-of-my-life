import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LordOfMyLife from "./research-planner.jsx";
import { initWebApp } from "./update.js";

// no-op outside the hosted build: registers the service worker that lets the
// web version open with the network down, and asks to keep storage persistent
initWebApp();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LordOfMyLife />
  </StrictMode>
);
