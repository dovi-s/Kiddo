/* eslint-disable no-console */
// Build a polished product showcase image from the real device screenshots:
// branded gradient backdrop, three device-framed screens with soft drop shadows,
// staggered, with the wordmark + tagline. Output: artifacts/marketing-shots/showcase.png
import path from "node:path";
import sharp from "sharp";

const dir = path.join(process.cwd(), "artifacts", "marketing-shots");
const W = 1680, H = 1050;
const CREAM = "#F7F4ED", EVER = "#1B4332", INK = "#1A1710", GOLDINK = "#8A5A1A";

// Frame one screenshot into a phone bezel at a given screen width.
async function framed(src, screenW) {
  const screen = await sharp(src).resize({ width: screenW }).png().toBuffer();
  const m = await sharp(screen).metadata();
  const w = m.width, h = m.height, pad = Math.round(w * 0.035), r = Math.round(w * 0.085);
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${Math.round(r*0.7)}" ry="${Math.round(r*0.7)}"/></svg>`);
  const rounded = await sharp(screen).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const bezel = Buffer.from(`<svg width="${w + pad*2}" height="${h + pad*2}"><rect width="${w + pad*2}" height="${h + pad*2}" rx="${r}" ry="${r}" fill="#141009"/></svg>`);
  return sharp(bezel).composite([{ input: rounded, top: pad, left: pad }]).png().toBuffer();
}

// A soft drop shadow plate for a phone of given size.
async function shadow(w, h) {
  const r = Math.round(w * 0.1);
  const svg = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#0c1a13"/></svg>`);
  return sharp(svg).blur(34).png().toBuffer();
}

async function place(base, png, x, y, angle) {
  const rot = await sharp(png).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const m = await sharp(rot).metadata();
  const sh = await shadow(m.width, m.height);
  const shRot = await sharp(sh).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return base
    .composite([{ input: shRot, left: Math.round(x + 16), top: Math.round(y + 30) }])
    .png().toBuffer()
    .then((b) => sharp(b).composite([{ input: rot, left: Math.round(x), top: Math.round(y) }]).png().toBuffer());
}

async function main() {
  const bg = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${CREAM}"/>
          <stop offset="0.6" stop-color="#EFEEE6"/>
          <stop offset="1" stop-color="#DCE6DD"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      <circle cx="${W*0.93}" cy="${H*0.12}" r="220" fill="${EVER}" opacity="0.06"/>
      <circle cx="${W*0.06}" cy="${H*0.9}" r="180" fill="${GOLDINK}" opacity="0.05"/>
      <text x="96" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="34" fill="${EVER}" font-weight="700" letter-spacing="2">Kiddo</text>
      <text x="92" y="430" font-family="Georgia, serif" font-size="74" fill="${INK}" font-weight="700">Cash gifts disappear.</text>
      <text x="92" y="520" font-family="Georgia, serif" font-size="74" fill="${EVER}" font-weight="700">Kiddo gifts last.</text>
      <text x="96" y="600" font-family="Arial, Helvetica, sans-serif" font-size="27" fill="#5a5448">A real investment fund the family builds together,</text>
      <text x="96" y="640" font-family="Arial, Helvetica, sans-serif" font-size="27" fill="#5a5448">opened by the child when they reach adulthood.</text>
      <text x="96" y="720" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="${GOLDINK}" font-weight="700" letter-spacing="1">SHARE ONE LINK  ·  GIFT IN SECONDS  ·  NO ACCOUNT NEEDED</text>
    </svg>`);
  let base = sharp(bg).png();
  let buf = await base.png().toBuffer();

  const home = await framed(path.join(dir, "home.m0.png"), 360);
  const pricing = await framed(path.join(dir, "pricing.m0.png"), 300);
  const hiw = await framed(path.join(dir, "how-it-works.m0.png"), 300);

  // back-left, back-right, then front-center (home) on top.
  buf = await place(sharp(buf).png(), pricing, W - 760, 250, -8);
  buf = await place(sharp(buf).png(), hiw, W - 360, 300, 8);
  buf = await place(sharp(buf).png(), home, W - 600, 150, 0);

  await sharp(buf).png().toFile(path.join(dir, "showcase.png"));
  console.log("showcase.png built");
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
