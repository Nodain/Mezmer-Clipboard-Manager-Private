import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import EyedropperApp from "./EyedropperApp";
import SettingsApp from "./SettingsApp";
import "./styles.css";

const label = getCurrentWindow().label;

function Root() {
  if (label === "settings") return <SettingsApp />;
  if (label === "eyedropper") return <EyedropperApp />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
