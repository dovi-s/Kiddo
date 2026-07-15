/* eslint-disable no-console */
// Verify the demo LANDING choreography sequences cleanly: the hero number rolls
// in FIRST, then the "While you were away" digest appears AFTER it settles (not
// all at once). Anchors the timeline to the hero balance appearing (data-ready),
// so the slow dev cold-load doesn't skew the relative beats.
//
// Warms the server in context A, then captures in context B seeded from A's
// storageState — which carries the AUTH COOKIE but NOT sessionStorage, so the
// digest's once-per-session flag is fresh AND we only log in once.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "verify-demo-landing");
mkdirSync(outDir, { recursive: true });
const HERO = '[data-testid="text-total-balance"]';
const DIGEST = '[data-testid="since-last-visit-digest"]';

async function main() {
  const browser = await chromium.launch();
  const warm = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await warm.request.get(`${baseUrl}/api/health`, { timeout: 120000 }).catch(() => {});
  const login = await warm.request.post(`${baseUrl}/api/auth/login`, {
    data: { email: "marcus@riverafamily.com", password: "riverafamily" }, timeout: 120000,
  });
  console.log(`login HTTP ${login.status()}`);
  if (login.status() !== 200) { console.log("rate-limited — stopping"); await browser.close(); return; }
  // Warm: compile the dashboard chunk + prime queries.
  const wp = await warm.newPage();
  wp.setDefaultTimeout(120000);
  await wp.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await wp.waitForSelector(HERO, { timeout: 90000 }).catch(() => console.log("warm: hero not seen"));
  const state = await warm.storageState(); // auth cookie, NOT sessionStorage

  // Fresh-session capture (auth via cookie, but sessionStorage empty → digest unshown).
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: state });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
  // Anchor: data-ready = hero balance present.
  await page.waitForSelector(HERO, { timeout: 90000 });
  const t0 = Date.now();
  console.log("hero present (data-ready) — t0 anchored");
  // Pre-reveal shot (hero settled, no digest).
  await page.waitForTimeout(Math.max(0, 1500 - (Date.now() - t0)));
  console.log(`t0+1500ms  digestVisible=${await page.locator(DIGEST).isVisible().catch(() => false)}`);
  await page.screenshot({ path: path.join(outDir, "t1500-pre.png") });

  // Wait for the digest to appear, then SAMPLE its height rapidly: growing
  // heights prove the height-grow entrance animates; a constant height = it
  // snapped.
  await page.waitForSelector(DIGEST, { state: "visible", timeout: 10000 });
  const heights: number[] = [];
  for (let i = 0; i < 14; i++) {
    const box = await page.locator(DIGEST).boundingBox().catch(() => null);
    heights.push(box ? Math.round(box.height) : -1);
    if (i === 2) await page.screenshot({ path: path.join(outDir, "t-midgrow.png") });
    await page.waitForTimeout(40);
  }
  console.log("digest height @40ms steps:", heights.join(" "));
  await page.screenshot({ path: path.join(outDir, "t-settled.png") });
  await browser.close();
  console.log(`screenshots: ${outDir}`);
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
