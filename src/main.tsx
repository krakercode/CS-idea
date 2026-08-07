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
// Top 5 most-used Google Fonts by their own analytics (Roboto, Open Sans,
// Lato, Montserrat, Oswald - ~50 trillion font views, per Google Fonts'
// July 2026 usage data) - self-hosted for the same offline-first reason as
// everything above, not loaded from Google's CDN.
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/500.css";
import "@fontsource/open-sans/600.css";
import "@fontsource/lato/400.css";
import "@fontsource/lato/700.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/oswald/400.css";
import "@fontsource/oswald/500.css";
import "@fontsource/oswald/600.css";
// Not in the user-facing font picker - only used by theme-flair.css's
// "jesspring-io" preset for its widget titles (same pattern as Marathon/
// Alien/MGSV hardcoding a system monospace font for theirs, except this
// one isn't a system font, so it needs to actually ship the file).
import "@fontsource/press-start-2p/400.css";
// Not in the user-facing font picker either - the "One More Season" game
// (GAELJANK SOFTWORKS widget) uses these for its retro vidiprinter look.
// Self-hosted for the same reason as everything else here: this app needs
// to keep working with no network, so a live Google Fonts @import (what
// the game originally shipped with as a standalone HTML file) isn't an
// option.
import "@fontsource/vt323/400.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";

// Applied before the first render so the saved theme is in place from the
// very first paint instead of flashing the default (theme.css's :root)
// briefly first.
applyTheme(getThemeState());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
