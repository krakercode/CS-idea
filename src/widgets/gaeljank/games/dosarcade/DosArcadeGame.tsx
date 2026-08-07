import { useEffect, useRef, useState } from "react";
import { DOS_GAMES, type DosGameEntry } from "./dosGamesCatalog";
import "./DosArcadeGame.css";

// js-dos (GPL-2.0 - see README) ships as a prebuilt browser script with no
// ESM entry point, self-hosted at public/js-dos/ by
// scripts/setup-jsdos-assets.mjs rather than `import`ed - so it's loaded
// here as a classic <script>/<link> pair, same as the vendor recommends.
// `pathPrefix` overrides js-dos's own default, which otherwise reaches out
// to js-dos.com's CDN for the emulator backend - pointing it at our
// self-hosted copy instead keeps this fully offline, consistent with the
// rest of the app.
declare global {
  interface Window {
    Dos?: (container: HTMLElement, options?: { pathPrefix?: string; url?: string; autoStart?: boolean }) => unknown;
    __jsDosLoadPromise?: Promise<void>;
  }
}

const EMULATORS_PATH_PREFIX = "/js-dos/emulators/";

// js-dos.js is a classic (non-module) script with top-level `let`/`const`
// declarations - those share the page's single global lexical scope across
// *every* <script> tag, unlike `var`/functions. Loading and executing it a
// second time throws "Identifier '<x>' has already been declared", which
// aborts the *entire* second script before any of it runs (including the
// `window.Dos = ...` assignment) - and since a parse error still fires the
// script element's `load` event (only a fetch failure fires `error`), the
// loader below resolves "successfully" while `window.Dos` silently never
// gets (re)set. That's what made this so easy to misread as a hang.
//
// 0.7.2 fixed the original trigger (re-appending a fresh script tag after
// merely a slow, not actually failed, load) with a module-scoped promise
// cache. 0.7.4 added a DOM `querySelector` check on top, reasoning that the
// module-scoped cache "only holds within a single evaluation of this
// module" - but a *second* `<script>` tag is exactly what a second
// evaluation of this module produces before that querySelector ever runs:
// each copy has its own module-scoped `jsDosLoadPromise`, so each copy's
// *first* call still falls through past its own (empty) cache and creates
// its own tag. The DOM check only ever protects a copy's *second* call, by
// which point the damage is already done. `window` is the one object
// guaranteed to be the same no matter how many separate copies of this
// module end up alive in memory at once (confirmed happening in practice -
// see CHANGELOG 0.7.2 through 0.7.4), so the cache lives there instead of
// in module scope, closing that gap for good rather than racing it.
const JS_DOS_SCRIPT_SRC = "/js-dos/js-dos.js";

function loadJsDos(): Promise<void> {
  if (window.__jsDosLoadPromise) return window.__jsDosLoadPromise;
  const promise = new Promise<void>((resolve, reject) => {
    if (window.Dos) {
      resolve();
      return;
    }

    // Belt-and-braces on top of the window-level cache above: covers a
    // script tag left over from a load this same `window` is no longer
    // tracking (e.g. a previous attempt's promise was cleared after an
    // error, but its script tag - now known to have loaded fine, since we
    // only clear on a genuine fetch `onerror` - is still sitting in the
    // DOM).
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${JS_DOS_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load js-dos.")));
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/js-dos/js-dos.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = JS_DOS_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => {
      window.__jsDosLoadPromise = undefined;
      reject(new Error("Failed to load js-dos."));
    };
    document.head.appendChild(script);
  });
  window.__jsDosLoadPromise = promise;
  return promise;
}

const LOAD_STALL_MS = 15_000;
const RENDER_STALL_MS = 12_000;

function DosPlayer({ game, onBack }: { game: DosGameEntry; onBack: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [stalled, setStalled] = useState<"loading" | "rendering" | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStalled(null);
    setError(null);

    // Declared here (not inside the .then() below) so the effect's own
    // cleanup can reach them - a cleanup function *returned from* a .then()
    // callback isn't a real effect teardown, nothing ever calls it.
    let observer: MutationObserver | null = null;
    let renderStallTimer: ReturnType<typeof setTimeout> | null = null;

    // Purely a status message, not a cancellation - see loadJsDos's comment
    // on why a slow load must never be abandoned/retried by this firing.
    const loadStallTimer = setTimeout(() => {
      if (!cancelled) setStalled("loading");
    }, LOAD_STALL_MS);

    loadJsDos()
      .then(() => {
        clearTimeout(loadStallTimer);
        if (cancelled || !containerRef.current) return;
        if (!window.Dos) {
          // js-dos.js fired `load` (a fetch success) but never actually
          // defined `window.Dos` - the classic symptom of the script
          // having thrown a parse-time SyntaxError, which loadJsDos()
          // can't detect from the `load` event alone. Surfacing this
          // explicitly beats leaving the canvas blank with no signal.
          setError("js-dos loaded but didn't initialise. Try restarting JESSPR-EAST.");
          return;
        }
        setStalled(null);
        // js-dos.js is the full player app (its own UI, its own internal
        // state) - passing `url` in the options is what starts the bundle;
        // there's no separate run()/exit() handle to chain or dispose of.
        // Unmounting this component (removing the container from the DOM)
        // is the documented way to tear it down. `autoStart` skips js-dos's
        // own nearly-blank "click to play" splash (needed to unlock audio
        // autoplay) - our own PLAY button click is already the user gesture
        // that satisfies the browser's autoplay policy, so without this the
        // widget looked like it loaded a blank screen.
        window.Dos(containerRef.current, {
          pathPrefix: EMULATORS_PATH_PREFIX,
          url: game.bundleUrl,
          autoStart: true,
        });

        // window.Dos() doesn't return a promise or fire any callback on
        // successful startup - the only observable sign the player itself
        // is alive is that it fills the container with its own DOM (a
        // canvas, its own UI chrome). A successful call that never paints
        // anything (e.g. its internal WASM init silently stalls on a given
        // webview/platform combo) would otherwise look identical to this
        // component just doing nothing, with no way to tell "still
        // starting" apart from "broken" - this at least surfaces that
        // distinction instead of leaving the screen black with no signal.
        const container = containerRef.current;
        observer = new MutationObserver(() => {
          if (container.childElementCount > 0) {
            setStalled(null);
            observer?.disconnect();
          }
        });
        observer.observe(container, { childList: true });
        renderStallTimer = setTimeout(() => {
          if (!cancelled && container.childElementCount === 0) setStalled("rendering");
        }, RENDER_STALL_MS);
      })
      .catch((err: unknown) => {
        clearTimeout(loadStallTimer);
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to start the emulator.");
      });

    return () => {
      cancelled = true;
      clearTimeout(loadStallTimer);
      observer?.disconnect();
      if (renderStallTimer) clearTimeout(renderStallTimer);
    };
  }, [game]);

  return (
    <div className="dosarcade__player">
      <div className="dosarcade__player-bar">
        <span className="dosarcade__player-title">{game.title}</span>
        <button type="button" className="dosarcade__back" onClick={onBack}>
          ← Back to DOS Arcade
        </button>
      </div>
      {stalled && !error && (
        <p className="dosarcade__stall-notice">
          {stalled === "loading"
            ? "Still loading js-dos - this can take a while on a slow disk or first run. Hang tight; going Back " +
              "now won't speed it up and can cause a worse error if it finishes loading right after."
            : "js-dos loaded but the game hasn't appeared yet - this may just need more time."}{" "}
          If it never comes up, right-click anywhere and choose Inspect (or press F12) to check the Console, or
          restart JESSPR-EAST for a clean retry.
        </p>
      )}
      {error ? (
        <p className="dosarcade__error">{error}</p>
      ) : (
        <div ref={containerRef} className="dosarcade__canvas-host" />
      )}
    </div>
  );
}

/** GAELJANK SOFTWORKS cartridge: a small in-house front end for curated
 * freeware DOS games (see dosGamesCatalog.ts), running for real in-browser
 * via js-dos/DOSBox-WASM rather than a native emulator dependency. */
export function DosArcadeGame({ onExit }: { onExit: () => void }) {
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const activeGame = DOS_GAMES.find((g) => g.id === activeGameId) ?? null;

  return (
    <div className="dosarcade__root">
      <div className="dosarcade__topbar">
        <button type="button" className="dosarcade__quit" onClick={onExit}>
          ✕ QUIT TO GAELJANK MENU
        </button>
      </div>

      {activeGame ? (
        <DosPlayer game={activeGame} onBack={() => setActiveGameId(null)} />
      ) : (
        <div className="dosarcade__menu">
          <h2 className="dosarcade__heading">DOS Arcade</h2>
          <p className="dosarcade__tagline">Curated freeware &amp; public domain DOS games, running for real via DOSBox-WASM.</p>
          <ul className="dosarcade__list">
            {DOS_GAMES.map((game) => (
              <li key={game.id} className="dosarcade__game">
                <div className="dosarcade__game-info">
                  <div className="dosarcade__game-title">
                    {game.title} <span className="dosarcade__game-tagline">{game.tagline} · {game.year}</span>
                  </div>
                  <p className="dosarcade__game-blurb">{game.blurb}</p>
                </div>
                <button type="button" className="dosarcade__play" onClick={() => setActiveGameId(game.id)}>
                  PLAY
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
