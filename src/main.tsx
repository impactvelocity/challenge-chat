import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CreatorApp } from "./creator";
import "cal-sans/index.css";
import "@fontsource-variable/geist-mono";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CreatorApp />
  </StrictMode>,
);
