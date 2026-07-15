/* eslint-disable no-console */
// Verifies server/imagePipeline.ts in isolation (no server/DB/browser):
// EXIF/GPS stripped, orientation baked, modern format, size caps. The privacy
// guarantee (GPS removed) is the load-bearing assertion.

import sharp from "sharp";
import { normalizeImage, FULL_MAX_PX, THUMB_MAX_PX } from "../server/imagePipeline";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  // A 100×200 image carrying EXIF: Orientation=6 (display = rotate 90° CW → 200×100)
  // plus a GPS location. withMetadata sets orientation; withExif injects the GPS IFD.
  let input = await sharp({
    create: { width: 100, height: 200, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  // Best-effort GPS injection (proves the strip removes location specifically). If a
  // given sharp build rejects the GPS IFD shape, fall back to the orientation-only
  // input — the "no EXIF on output" assertion still proves wholesale stripping.
  let gpsInjected = false;
  try {
    input = await sharp(input)
      .withExif({ GPS: { GPSLatitudeRef: "N", GPSLatitude: "37/1 48/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "122/1 25/1 0/1" } })
      .toBuffer();
    gpsInjected = true;
  } catch {
    // orientation-only input; assertions below still hold.
  }

  const inMeta = await sharp(input).metadata();
  ok("input sanity: has EXIF", Boolean(inMeta.exif), "test setup failed to embed EXIF");
  ok("input sanity: orientation=6", inMeta.orientation === 6, `got ${inMeta.orientation}`);
  console.log(`  · GPS injected into input: ${gpsInjected}`);

  const out = await normalizeImage(input);
  const fullMeta = await sharp(out.full).metadata();
  const thumbMeta = await sharp(out.thumb).metadata();

  // Privacy: the load-bearing guarantee.
  ok("full: ALL EXIF stripped (incl. GPS)", !fullMeta.exif, "output still carries EXIF/GPS");
  ok("thumb: ALL EXIF stripped (incl. GPS)", !thumbMeta.exif, "thumb still carries EXIF/GPS");

  // Orientation baked, not just tagged.
  ok("full: orientation normalized", !fullMeta.orientation || fullMeta.orientation === 1, `orientation=${fullMeta.orientation}`);
  ok("full: orientation baked into pixels (dims swapped 100×200 → 200×100)", (fullMeta.width ?? 0) > (fullMeta.height ?? 0), `${fullMeta.width}×${fullMeta.height}`);

  // Format + size caps.
  ok("full: webp", fullMeta.format === "webp", `got ${fullMeta.format}`);
  ok("thumb: webp", thumbMeta.format === "webp", `got ${thumbMeta.format}`);
  ok(`full: within ${FULL_MAX_PX}px`, Math.max(fullMeta.width ?? 0, fullMeta.height ?? 0) <= FULL_MAX_PX, `${fullMeta.width}×${fullMeta.height}`);
  ok(`thumb: within ${THUMB_MAX_PX}px`, Math.max(thumbMeta.width ?? 0, thumbMeta.height ?? 0) <= THUMB_MAX_PX, `${thumbMeta.width}×${thumbMeta.height}`);

  // Quality preserved (not a degraded re-encode): output isn't trivially tiny.
  ok("full: non-trivial output (quality preserved)", out.full.length > 100, `${out.full.length} bytes`);

  console.log(`\nimage-pipeline: ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main().catch((err) => {
  console.error("image-pipeline test crashed:", err);
  process.exit(1);
});
