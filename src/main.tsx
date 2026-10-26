import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CreatorApp } from "./creator";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CreatorApp />
  </StrictMode>,
);
