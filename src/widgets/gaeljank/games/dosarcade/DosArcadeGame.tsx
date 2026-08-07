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
  }
}

const EMULATORS_PATH_PREFIX = "/js-dos/emulators/";
let jsDosLoadPromise: Promise<void> | null = null;

// js-dos.js is a classic (non-module) script with top-level `let`/`const`
// declarations - those share the page's single global lexical scope across
// *every* <script> tag, unlike `var`/functions. Loading and executing it a
// second time throws "Identifier '<x>' has already been declared" - a real
// bug hit here: an earlier version of this file gave up on a load that was
// merely slow (timed out, not actually failed) and re-appended a fresh
// script tag, which then collided with the first one once it also finished.
// There is no way to safely "cancel" a classic script that might already be
// executing, so once a load has actually started, it is never abandoned or
// retried - only a genuine `onerror` (the script never ran at all) is safe
// to retry from.
function loadJsDos(): Promise<void> {
  if (jsDosLoadPromise) return jsDosLoadPromise;
  jsDosLoadPromise = new Promise<void>((resolve, reject) => {
    if (window.Dos) {
      resolve();
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/js-dos/js-dos.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "/js-dos/js-dos.js";
    script.onload = () => resolve();
    script.onerror = () => {
      jsDosLoadPromise = null;
      reject(new Error("Failed to load js-dos."));
    };
    document.head.appendChild(script);
  });
  return jsDosLoadPromise;
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
        if (cancelled || !containerRef.current || !window.Dos) return;
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
