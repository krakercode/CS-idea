import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { applyTheme, getThemeState } from "./app/themeStore";
import "./styles/global.css";
// Self-hosted optional fonts for the appearance settings' font picker
// (styles/fonts.ts) - only the weights actually used anywhere in the app.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
// Not in the user-facing font picker - only used by theme-flair.css's
// "jesspring-io" preset for its widget titles (same pattern as Marathon/
// Alien/MGSV hardcoding a system monospace font for theirs, except this
// one isn't a system font, so it needs to actually ship the file).
import "@fontsource/press-start-2p/400.css";

// Applied before the first render so the saved theme is in place from the
// very first paint instead of flashing the default (theme.css's :root)
// briefly first.
applyTheme(getThemeState());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
