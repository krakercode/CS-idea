// js-dos (GPL-2.0, see README's "GAELJANK SOFTWORKS" section) ships as
// prebuilt browser assets with no ESM entry point - its own README says
// to copy `emulators`'s dist into a static folder before running Vite,
// rather than `import`ing it. This script does that copy automatically
// (wired into `postinstall`/`predev`/`prebuild`) so `public/js-dos/` never
// needs to be committed - it's a build artifact derived from node_modules,
// same as everything else there.
//
// Only the plain-DOSBox backend + zip support are copied, not the much
// larger DOSBox-X (Windows 9x) backend or sockdrive streaming - Jetpack
// and friends are small, plain-DOS games that don't need either.
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "public", "js-dos");
const emulatorsOut = join(outDir, "emulators");

const files = [
  ["node_modules/js-dos/dist/js-dos.js", "js-dos.js"],
  ["node_modules/js-dos/dist/js-dos.css", "js-dos.css"],
  ["node_modules/emulators/dist/emulators.js", "emulators/emulators.js"],
  ["node_modules/emulators/dist/wdosbox.js", "emulators/wdosbox.js"],
  ["node_modules/emulators/dist/wdosbox.wasm", "emulators/wdosbox.wasm"],
  ["node_modules/emulators/dist/wlibzip.js", "emulators/wlibzip.js"],
  ["node_modules/emulators/dist/wlibzip.wasm", "emulators/wlibzip.wasm"],
];

mkdirSync(outDir, { recursive: true });
mkdirSync(emulatorsOut, { recursive: true });

let missing = 0;
for (const [src, destRel] of files) {
  const srcPath = join(root, src);
  const destPath = join(outDir, destRel);
  if (!existsSync(srcPath)) {
    console.warn(`[setup-jsdos-assets] missing ${src} - run npm install first`);
    missing++;
    continue;
  }
  copyFileSync(srcPath, destPath);
}

if (missing === 0) {
  console.log(`[setup-jsdos-assets] copied ${files.length} files to public/js-dos/`);
}
