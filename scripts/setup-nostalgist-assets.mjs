// Retrocade (src/widgets/gaeljank/games/retrocade/) plays user-supplied ROMs
// via Nostalgist.js, a thin wrapper around RetroArch's libretro cores built
// for Emscripten/WASM. By default Nostalgist fetches those cores - and the
// zip.js library it uses to unpack them - from jsDelivr's GitHub CDN at
// runtime, same as js-dos reaches out to js-dos.com by default: exactly the
// kind of live network dependency this app avoids (see setup-jsdos-assets.mjs).
//
// This script downloads the handful of cores Retrocade actually offers,
// extracts each one's .js/.wasm pair once at build time, and drops them in
// public/nostalgist/cores/ - RetrocadeGame.tsx points Nostalgist's own
// resolveCoreJs/resolveCoreWasm hooks at these local files instead of the
// CDN, so no core-fetching happens at runtime, online or off.
//
// Cores are pinned to a specific retroarch-emscripten-build release so a
// build is reproducible and doesn't silently pick up a different core build
// later. Deliberately not every libretro core Nostalgist could resolve -
// only ones confirmed under an OSI-style copyleft/permissive license (GPL or
// MPL); Snes9x (SNES), for instance, is excluded because upstream Snes9x is
// "non-commercial use only", not actually redistributable.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "public", "nostalgist", "cores");

const CORE_BUILD_VERSION = "v1.22.2";
const CORE_BUILD_REPO = "arianrhodsandlot/retroarch-emscripten-build";

// extension -> [system, libretro core name] - see RetrocadeGame.tsx / roms.rs
// (Rust side) for the matching extension map.
export const CORES = ["fceumm", "gambatte", "mgba", "genesis_plus_gx"];

async function fetchCore(core) {
  const url = `https://cdn.jsdelivr.net/gh/${CORE_BUILD_REPO}@${CORE_BUILD_VERSION}/retroarch/${core}_libretro.zip`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  const zip = unzipSync(new Uint8Array(await response.arrayBuffer()));

  const jsEntry = Object.keys(zip).find((name) => name.endsWith(".js"));
  const wasmEntry = Object.keys(zip).find((name) => name.endsWith(".wasm"));
  if (!jsEntry || !wasmEntry) throw new Error(`${core}_libretro.zip is missing a .js or .wasm entry`);

  writeFileSync(join(outDir, `${core}_libretro.js`), zip[jsEntry]);
  writeFileSync(join(outDir, `${core}_libretro.wasm`), zip[wasmEntry]);
}

async function main() {
  mkdirSync(outDir, { recursive: true });

  let fetched = 0;
  let skipped = 0;
  let failed = 0;
  for (const core of CORES) {
    const jsPath = join(outDir, `${core}_libretro.js`);
    const wasmPath = join(outDir, `${core}_libretro.wasm`);
    if (existsSync(jsPath) && existsSync(wasmPath)) {
      skipped++;
      continue;
    }
    try {
      await fetchCore(core);
      fetched++;
    } catch (err) {
      // Non-fatal: a sandboxed/offline build shouldn't hard-fail just
      // because Retrocade's cores couldn't be fetched this run - Retrocade
      // itself surfaces a clear error if a core is genuinely missing at
      // runtime. Re-running this script (e.g. the next `npm run dev`) will
      // retry only the cores that are still missing.
      console.warn(`[setup-nostalgist-assets] couldn't fetch ${core}: ${err.message}`);
      failed++;
    }
  }

  console.log(
    `[setup-nostalgist-assets] ${fetched} fetched, ${skipped} already present, ${failed} failed` +
      (failed > 0 ? " (run again to retry)" : ""),
  );
}

main();
