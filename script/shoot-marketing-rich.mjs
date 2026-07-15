/* eslint-disable no-console */
// Rich marketing capture: real device-emulated screenshots (above-the-fold +
// scroll sequence), a device-framed version (sharp), and a scroll-through video
// (.webm) so the design/motion can actually be reviewed. Public pages, no login.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import sharp from "sharp";

const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "marketing-shots");
const vid = path.join(out, "video");
mkdirSync(out, { recursive: true });
mkdirSync(vid, { recursive: true });

const PAGES = [["/", "home"], ["/pricing", "pricing"], ["/how-it-works", "how-it-works"]];

// Composite a screenshot into a clean phone frame (dark rounded bezel).
async function frame(srcPng, destPng, w, h) {
  const pad = 14, radius = 44;
  const rounded = Buffer.from(
    `<svg><rect x="0" y="0" width="${w}" height="${h}" rx="28" ry="28"/></svg>`,
  );
  const screen = await sharp(srcPng).resize(w, h, { fit: "cover", position: "top" })
    .composite([{ input: rounded, blend: "dest-in" }]).png().toBuffer();
  const bezel = Buffer.from(
    `<svg width="${w + pad * 2}" height="${h + pad * 2}"><rect width="${w + pad * 2}" height="${h + pad * 2}" rx="${radius}" ry="${radius}" fill="#15110b"/></svg>`,
  );
  await sharp(bezel).composite([{ input: screen, top: pad, left: pad }]).png().toFile(destPng);
}

async function main() {
  const browser = await chromium.launch();
  for (const [route, slug] of PAGES) {
    const ctx = await browser.newContext({
      ...devices["iPhone 14 Pro"],
      recordVideo: slug === "home" ? { dir: vid, size: { width: 393, height: 852 } } : undefined,
    });
    const page = await ctx.newPage();
    await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2200);
    const vh = 852;
    // Above-the-fold + scroll sequence (viewport-clipped, readable).
    for (let i = 0; i < 5; i++) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), i * vh);
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(out, `${slug}.m${i}.png`) }); // viewport-only (no fullPage)
    }
    // Smooth scroll for the video (home only records).
    if (slug === "home") {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(400);
      const total = await page.evaluate(() => document.body.scrollHeight);
      const steps = 28;
      for (let s = 0; s <= steps; s++) {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), (total * s) / steps);
        await page.waitForTimeout(160);
      }
      await page.waitForTimeout(400);
    }
    console.log(`shot ${slug} (5 frames${slug === "home" ? " + video" : ""})`);
    await ctx.close(); // flushes the video file
  }
  // Desktop above-the-fold for the three pages.
  for (const [route, slug] of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(out, `${slug}.desktop-fold.png`) });
    await ctx.close();
  }
  await browser.close();

  // Device-frame the home above-the-fold shot.
  try {
    await frame(path.join(out, "home.m0.png"), path.join(out, "home.framed.png"), 393, 852);
    console.log("framed home.framed.png");
  } catch (e) {
    console.log("frame skipped:", String(e).slice(0, 60));
  }
  console.log(`done -> ${out}`);
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
