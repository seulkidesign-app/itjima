import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/tokens.css";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
// Independently copied V02 landing CSS; order matches V02 base → polish.
import "./styles/landing-v2-base.css";
import "./styles/landing-v2-polish.css";
import "./styles/landing-adapter.css";
