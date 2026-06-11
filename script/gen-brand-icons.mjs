// Regenerate the Kiddo raster icon set from the vector sprout glyph.
//
// Source of truth: client/public/sprout-glyph.svg (the gold sprout on evergreen).
// Rasterizes it (via sharp, already a dependency) to the PNG sizes the browser /
// PWA / iOS need, so every icon stays pixel-identical to the one vector.
//
//   node script/gen-brand-icons.mjs          -> favicon.png only (the tab icon)
//   node script/gen-brand-icons.mjs --all     -> the FULL set, INCLUDING the app
//                                                icons (apple-touch / icon-192 /
//                                                icon-512). This replaces the K
//                                                monogram everywhere — a founder
//                                                call. See BRAND_IDENTITY.md.
//
// Reverting is one command: `git checkout client/public/*.png`.
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "client", "public");
const svg = readFileSync(join(pub, "sprout-glyph.svg"));

// Density high enough that the vector is crisp before downscaling.
const render = (size, out) =>
  sharp(svg, { density: 1024 }).resize(size, size).png().toFile(join(pub, out));

const FAVICON = [[32, "favicon.png"]];
const APP_ICONS = [
  [180, "apple-touch-icon.png"],
  [192, "icon-192.png"],
  [512, "icon-512.png"],
];

const all = process.argv.includes("--all");
const targets = all ? [...FAVICON, ...APP_ICONS] : FAVICON;

const written = await Promise.all(
  targets.map(async ([size, out]) => {
    await render(size, out);
    return `${out} (${size}px)`;
  }),
);

console.log(`Regenerated from sprout-glyph.svg:\n  ${written.join("\n  ")}`);
if (!all) {
  console.log(
    "\nApp icons (apple-touch / icon-192 / icon-512) left untouched (still the K monogram).\n" +
      "Run with --all to swap the full set to the sprout.",
  );
}
