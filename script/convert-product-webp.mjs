/* eslint-disable no-console */
// Optimize the marketing product images: PNG -> WebP (crisp q88 for UI text),
// and downsize the oversized desktop shot. Big perf win on the marketing pages.
import path from "node:path";
import { readdirSync, statSync, unlinkSync } from "node:fs";
import sharp from "sharp";

const dir = path.join(process.cwd(), "client", "public", "product");

async function main() {
  const pngs = readdirSync(dir).filter((f) => f.endsWith(".png"));
  for (const f of pngs) {
    const src = path.join(dir, f);
    const base = f.replace(/\.png$/, "");
    const dest = path.join(dir, `${base}.webp`);
    const before = statSync(src).size;
    let img = sharp(src);
    const meta = await img.metadata();
    // Desktop showcase: shown in a <=768px frame; 1600w is plenty @2x. Phone
    // shots/pans render <=260px wide; cap at 560w (>2x) — crisp, much lighter.
    const targetW = /desktop/.test(base) ? 1600 : 560;
    if (meta.width && meta.width > targetW) img = img.resize({ width: targetW });
    await img.webp({ quality: 88 }).toFile(dest);
    const after = statSync(dest).size;
    console.log(`${base}: ${Math.round(before / 1024)}KB png -> ${Math.round(after / 1024)}KB webp`);
    unlinkSync(src);
  }
  console.log("done");
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
