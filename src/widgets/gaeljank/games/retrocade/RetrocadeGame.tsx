import { useEffect, useRef, useState } from "react";
import { Nostalgist } from "nostalgist";
import { listRoms, openRomsFolder, readRom, type RomEntry } from "./romsService";
import { SYSTEMS } from "./retroSystems";
import "./RetrocadeGame.css";

// Cores are self-hosted at public/nostalgist/cores/ by
// scripts/setup-nostalgist-assets.mjs rather than fetched from Nostalgist's
// default (jsDelivr) CDN - see that script's own comment for why. Overriding
// both resolvers means Nostalgist never touches the network, mirroring how
// js-dos's EMULATORS_PATH_PREFIX keeps DOS Arcade offline too.
type LaunchOptions = NonNullable<Parameters<typeof Nostalgist.launch>[0]>;

function resolveCoreJs(core: LaunchOptions["core"]) {
  if (typeof core !== "string") throw new TypeError("Retrocade only resolves cores by name.");
  return `/nostalgist/cores/${core}_libretro.js`;
}

function resolveCoreWasm(core: LaunchOptions["core"]) {
  if (typeof core !== "string") throw new TypeError("Retrocade only resolves cores by name.");
  return `/nostalgist/cores/${core}_libretro.wasm`;
}

const LOAD_STALL_MS = 15_000;

function RetroPlayer({ rom, onBack }: { rom: RomEntry; onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let instance: Nostalgist | null = null;
    setError(null);
    setStalled(false);

    const stallTimer = setTimeout(() => {
      if (!cancelled) setStalled(true);
    }, LOAD_STALL_MS);

    const system = SYSTEMS[rom.system];

    (async () => {
      if (!system) throw new Error(`Retrocade doesn't know how to run a "${rom.system}" ROM.`);
      const file = await readRom(rom.filename);
      if (cancelled || !canvasRef.current) return;

      instance = await Nostalgist.launch({
        element: canvasRef.current,
        core: system.core,
        rom: file,
        resolveCoreJs,
        resolveCoreWasm,
      });

      // The component may have unmounted (or the user picked a different
      // ROM) while launch() was still in flight - tear the just-started
      // instance straight back down rather than leaving it running behind
      // whatever's rendered now.
      if (cancelled) {
        instance.exit();
        return;
      }
    })()
      .then(() => clearTimeout(stallTimer))
      .catch((err: unknown) => {
        clearTimeout(stallTimer);
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to start the emulator.");
      });

    return () => {
      cancelled = true;
      clearTimeout(stallTimer);
      instance?.exit();
    };
  }, [rom]);

  return (
    <div className="retrocade__player">
      <div className="retrocade__player-bar">
        <span className="retrocade__player-title">{rom.filename}</span>
        <button type="button" className="retrocade__back" onClick={onBack}>
          ← Back to Retrocade
        </button>
      </div>
      {stalled && !error && (
        <p className="retrocade__stall-notice">
          Still loading the emulator core - this can take a while on a slow disk or first run. If it never comes up,
          right-click anywhere and choose Inspect (or press F12) to check the Console.
        </p>
      )}
      {error ? (
        <p className="retrocade__error">{error}</p>
      ) : (
        <canvas ref={canvasRef} className="retrocade__canvas" />
      )}
    </div>
  );
}

/** GAELJANK SOFTWORKS cartridge: a NES/GB/GBA/Genesis front end for ROMs the
 * user drops into their own roms/ folder (see romsService.ts's
 * openRomsFolder / src-tauri/src/roms.rs) - unlike DOS Arcade, Retrocade
 * ships no games at all, only the (open source) emulator cores. */
export function RetrocadeGame({ onExit }: { onExit: () => void }) {
  const [activeRom, setActiveRom] = useState<RomEntry | null>(null);
  const [roms, setRoms] = useState<RomEntry[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    if (activeRom) return;
    let cancelled = false;
    setListError(null);
    listRoms()
      .then((entries) => {
        if (!cancelled) setRoms(entries);
      })
      .catch((err: unknown) => {
        if (!cancelled) setListError(err instanceof Error ? err.message : "Couldn't read the ROMs folder.");
      });
    return () => {
      cancelled = true;
    };
  }, [activeRom]);

  return (
    <div className="retrocade__root">
      <div className="retrocade__topbar">
        <button type="button" className="retrocade__quit" onClick={onExit}>
          ✕ QUIT TO GAELJANK MENU
        </button>
      </div>

      {activeRom ? (
        <RetroPlayer rom={activeRom} onBack={() => setActiveRom(null)} />
      ) : (
        <div className="retrocade__menu">
          <h2 className="retrocade__heading">Retrocade</h2>
          <p className="retrocade__tagline">
            NES, Game Boy/Color, GBA and Genesis - bring your own ROMs. Retrocade ships none itself, only the (open
            source) emulator cores; play whatever you already legally own.
          </p>

          <div className="retrocade__folder-row">
            <button type="button" className="retrocade__folder-button" onClick={() => void openRomsFolder()}>
              📂 Open ROMs Folder
            </button>
            <span className="retrocade__folder-hint">Drop files in, then come back here.</span>
          </div>

          {listError && <p className="retrocade__error">{listError}</p>}

          {roms && roms.length === 0 && !listError && (
            <div className="retrocade__empty">
              <p>No ROMs found yet. Supported systems:</p>
              <ul className="retrocade__systems">
                {Object.values(SYSTEMS).map((system) => (
                  <li key={system.label}>
                    <strong>{system.label}</strong> ({system.extensions}) - via {system.coreLabel} ({system.license})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {roms && roms.length > 0 && (
            <ul className="retrocade__list">
              {roms.map((rom) => {
                const system = SYSTEMS[rom.system];
                return (
                  <li key={rom.filename} className="retrocade__game">
                    <div className="retrocade__game-info">
                      <div className="retrocade__game-title">
                        {rom.filename} <span className="retrocade__game-tagline">{system?.label ?? rom.system}</span>
                      </div>
                    </div>
                    <button type="button" className="retrocade__play" onClick={() => setActiveRom(rom)}>
                      PLAY
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
