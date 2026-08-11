import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LordOfMyLife from "./research-planner.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LordOfMyLife />
  </StrictMode>
);
