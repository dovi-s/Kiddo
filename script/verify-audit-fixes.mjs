/* eslint-disable no-console */
import { chromium } from "playwright";
const base = "http://127.0.0.1:5000";

async function main() {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });

  // 1) image-load errors across image-heavy pages (webp must resolve)
  for (const route of ["/", "/about", "/stories", "/compare", "/how-it-works", "/age-18"]) {
    const p = await c.newPage();
    const bad = [];
    p.on("requestfailed", (r) => { if (/\/product\//.test(r.url())) bad.push(r.url().split("/").pop()); });
    p.on("response", (r) => { if (/\/product\//.test(r.url()) && r.status() >= 400) bad.push(r.url().split("/").pop() + ":" + r.status()); });
    await p.goto(base + route, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(2500);
    const total = await p.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y <= total; y += 800) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(120); }
    console.log(`${route}: product-img errors = ${bad.length ? [...new Set(bad)].join(", ") : "NONE"}`);
    await p.close();
  }

  // 2) bento modal close button
  const p = await c.newPage();
  await p.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.click('[data-testid="bento-tile-customize-the-mix"]', { timeout: 8000 });
  await p.waitForTimeout(1200);
  const closeBtn = await p.$('[data-testid="bento-modal-close"]');
  console.log("bento close button present?", !!closeBtn);
  if (closeBtn) { await closeBtn.click(); await p.waitForTimeout(800); const stillOpen = await p.$('[role="dialog"]'); console.log("modal closed by X?", !stillOpen); }
  await p.close();

  // 3) kid-view embed redirect still resolves
  const r = await c.request.get(base + "/demo/kidview/theo-rivera", { maxRedirects: 0 }).catch((e) => ({ status: () => "ERR " + String(e).slice(0, 40) }));
  console.log("kidview redirect status:", typeof r.status === "function" ? r.status() : r.status);

  await b.close();
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
