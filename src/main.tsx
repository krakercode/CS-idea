import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { applyTheme, getThemeState } from "./app/themeStore";
import "./styles/global.css";

// Applied before the first render so the saved theme is in place from the
// very first paint instead of flashing the default (theme.css's :root)
// briefly first.
applyTheme(getThemeState());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
