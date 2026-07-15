/* eslint-disable no-console */
// Full product + marketing capture suite for the showcase set:
//  - above-the-fold device shots for EVERY marketing page (+ device frames)
//  - the real PRODUCT (logged-in demo): dashboard hero (count-up settled),
//    Memory Book — the actual thing we're selling
//  - a walkthrough video (.webm) of the demo flow
// Output: artifacts/marketing-shots/  (frames: *.framed.png ; product: app.*.png)
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";
import sharp from "sharp";

const base = "http://127.0.0.1:5000";
const dir = path.join(process.cwd(), "artifacts", "marketing-shots");
const vid = path.join(dir, "video");
mkdirSync(vid, { recursive: true });

const MKT = [["/", "home"], ["/how-it-works", "how-it-works"], ["/pricing", "pricing"], ["/faq", "faq"], ["/about", "about"], ["/security", "security"], ["/blog", "blog"], ["/stories", "stories"], ["/gift", "gift"]];

async function frame(srcBuf, destPng) {
  const screen = await sharp(srcBuf).resize({ width: 390 }).png().toBuffer();
  const m = await sharp(screen).metadata();
  const w = m.width, h = m.height, pad = 14, r = 34;
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="26" ry="26"/></svg>`);
  const rounded = await sharp(screen).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const bezel = Buffer.from(`<svg width="${w+pad*2}" height="${h+pad*2}"><rect width="${w+pad*2}" height="${h+pad*2}" rx="${r}" ry="${r}" fill="#141009"/></svg>`);
  await sharp(bezel).composite([{ input: rounded, top: pad, left: pad }]).png().toFile(destPng);
}

async function main() {
  const browser = await chromium.launch();

  // ── Marketing pages: above-the-fold device shot + frame ───────────────────
  for (const [route, slug] of MKT) {
    const ctx = await browser.newContext({ ...devices["iPhone 14 Pro"] });
    const page = await ctx.newPage();
    try {
      await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1800);
      const buf = await page.screenshot();
      await frame(buf, path.join(dir, `${slug}.framed.png`));
      console.log(`framed ${slug}`);
    } catch (e) { console.log(`FAIL ${slug}: ${String(e).slice(0,50)}`); }
    await ctx.close();
  }

  // ── Product (logged-in demo): dashboard + memory + walkthrough video ──────
  const ctx = await browser.newContext({ ...devices["iPhone 14 Pro"], recordVideo: { dir: vid, size: { width: 393, height: 852 } } });
  await ctx.request.post(`${base}/api/auth/login`, { data: { email: "elena@riverafamily.com", password: "riverafamily" }, timeout: 120000 }).catch(() => {});
  const funds = await ctx.request.get(`${base}/api/funds`, { timeout: 120000 }).then((r) => r.json()).catch(() => []);
  const luke = Array.isArray(funds) ? funds.find((f) => /theo/i.test(f?.recipientFirstName || "")) : null;
  const page = await ctx.newPage();
  try {
    await page.goto(`${base}/design-lab${luke ? `?fund=${luke.id}` : ""}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(6000); // let the hero count-up settle
    const dash = await page.screenshot();
    await frame(dash, path.join(dir, "app.dashboard.framed.png"));
    await sharp(dash).toFile(path.join(dir, "app.dashboard.png"));
    console.log("captured app.dashboard");
    // gentle scroll for the walkthrough video
    const total = await page.evaluate(() => document.body.scrollHeight);
    for (let s = 0; s <= 16; s++) { await page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), (total * s) / 16); await page.waitForTimeout(180); }
    if (luke) {
      await page.goto(`${base}/memory/${luke.id}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(3500);
      const mem = await page.screenshot();
      await frame(mem, path.join(dir, "app.memory.framed.png"));
      await sharp(mem).toFile(path.join(dir, "app.memory.png"));
      console.log("captured app.memory");
      const mt = await page.evaluate(() => document.body.scrollHeight);
      for (let s = 0; s <= 12; s++) { await page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), (mt * s) / 12); await page.waitForTimeout(180); }
    }
  } catch (e) { console.log("product capture error:", String(e).slice(0, 80)); }
  await ctx.close(); // flush walkthrough video
  await browser.close();
  console.log(`done -> ${dir}`);
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
