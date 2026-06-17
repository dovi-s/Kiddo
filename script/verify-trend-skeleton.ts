/* eslint-disable no-console */
// Confirm the trend chart now shows a chart-SHAPED skeleton (not a blank box)
// while its lazy chunk loads. Forces the skeleton to linger by delaying the
// DashboardTrendChart module request, then screenshots it; then lets it load.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "verify-trend-skeleton");
mkdirSync(outDir, { recursive: true });
const SKEL = '[aria-label="Loading chart"]';

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.request.get(`${baseUrl}/api/health`, { timeout: 120000 }).catch(() => {});
  const login = await ctx.request.post(`${baseUrl}/api/auth/login`, {
    data: { email: "marcus@riverafamily.com", password: "riverafamily" }, timeout: 120000,
  });
  console.log(`login HTTP ${login.status()}`);
  if (login.status() !== 200) { console.log("rate-limited — stopping"); await browser.close(); return; }

  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  // Hold the chart chunk so the Suspense fallback (skeleton) lingers.
  await page.route(/DashboardTrendChart/i, async (r) => {
    await new Promise((res) => setTimeout(res, 4000));
    try { await r.continue(); } catch { /* ignore */ }
  });
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
  // Wait for the skeleton to appear, scroll it into view, shoot it.
  const skel = page.locator(SKEL).first();
  await skel.waitFor({ state: "attached", timeout: 60000 }).catch(() => console.log("skeleton not attached"));
  await skel.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  const visible = await skel.isVisible().catch(() => false);
  console.log(`chart skeleton visible while chunk loads: ${visible}`);
  await page.screenshot({ path: path.join(outDir, "skeleton.png") });

  // Let the chunk load, then shoot the real chart in the same spot.
  await page.unroute(/DashboardTrendChart/i);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(outDir, "loaded.png") });
  await browser.close();
  console.log(`screenshots: ${outDir}`);
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
