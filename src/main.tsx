import React from "react";
import ReactDOM from "react-dom/client";
import { IS_AERO } from "@/lib/variant";
import App from "./App";
import "./styles/globals.css";

// Set theme early to prevent flash of wrong theme
if (IS_AERO) {
  document.documentElement.setAttribute("data-theme", "aero-light");
} else {
  document.documentElement.setAttribute("data-theme", "light");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
