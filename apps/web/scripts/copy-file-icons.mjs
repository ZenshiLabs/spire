// Copies the material-icon-theme SVGs into public/file-icons and writes a
// trimmed lookup manifest.json next to them. Shipping the icons + lookup as
// static assets keeps the ~350KB icon map out of the JS bundle: the browser
// fetches manifest.json once and caches it. Run from the web app's `dev`/`build`
// scripts. Pass --force to regenerate when material-icon-theme is upgraded.
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { generateManifest } from "material-icon-theme";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const webRoot = dirname(here);
const iconsSrc = join(dirname(require.resolve("material-icon-theme/package.json")), "icons");
const outDir = join(webRoot, "public", "file-icons");
const manifestOut = join(outDir, "manifest.json");

if (existsSync(manifestOut) && !process.argv.includes("--force")) {
    console.log("[file-icons] already generated — skipping (use --force to rebuild)");
    process.exit(0);
}

mkdirSync(outDir, { recursive: true });

let copied = 0;
for (const entry of readdirSync(iconsSrc)) {
    if (!entry.endsWith(".svg")) {
        continue;
    }
    cpSync(join(iconsSrc, entry), join(outDir, entry));
    copied += 1;
}

const manifest = generateManifest();
// Only the maps the client resolver needs; icon names map 1:1 to <name>.svg.
const lookup = {
    file: manifest.file,
    folder: manifest.folder,
    folderExpanded: manifest.folderExpanded,
    fileNames: manifest.fileNames,
    fileExtensions: manifest.fileExtensions,
    folderNames: manifest.folderNames,
    folderNamesExpanded: manifest.folderNamesExpanded,
};
writeFileSync(manifestOut, JSON.stringify(lookup));

console.log(`[file-icons] copied ${copied} icons + manifest.json to public/file-icons`);
