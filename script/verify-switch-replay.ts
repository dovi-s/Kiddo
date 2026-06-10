/* eslint-disable no-console */
// Verify the lab replays its entrance beats on a FUND SWITCH: switch Luke→Alex
// and sample the gifter faces' opacity right after. If the cascade re-fires,
// some faces are mid-animation (opacity < 1) just after the switch; if it
// doesn't, they're all instantly full-opacity. Also shoots a mid-cascade frame.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "verify-switch-replay");
mkdirSync(outDir, { recursive: true });
const FACES = ".kiddo-gifter-avatar";

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.request.get(`${baseUrl}/api/health`, { timeout: 120000 }).catch(() => {});
  const login = await ctx.request.post(`${baseUrl}/api/auth/login`, {
    data: { email: "phil@dunphyfamily.com", password: "dunphyfamily" }, timeout: 120000,
  });
  console.log(`login HTTP ${login.status()}`);
  if (login.status() !== 200) { console.log("rate-limited — stopping"); await browser.close(); return; }
  const funds = (await ctx.request.get(`${baseUrl}/api/funds`, { timeout: 120000 }).then((r) => r.json())) as any[];
  const alex = funds.find((f) => /alex/i.test(f?.recipientFirstName || ""));
  if (!alex) { console.log("no Alex fund"); await browser.close(); return; }

  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  await page.goto(`${baseUrl}/design-lab`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector(FACES, { timeout: 90000 });
  // Scroll the faces into view so the re-pulse isn't skipped, let them settle.
  await page.locator(FACES).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);

  const opacities = async () =>
    page.locator(FACES).evaluateAll((els: any[]) =>
      els.slice(0, 10).map((e) => Number(getComputedStyle(e).opacity).toFixed(2)),
    ).catch(() => []);
  console.log("before switch:", (await opacities()).join(" "));

  // Trigger the switch the same way the UI does (handleActiveFundChange listens).
  const t0 = Date.now();
  await page.evaluate((id) => {
    window.dispatchEvent(new CustomEvent("kiddo:active-fund-change", { detail: { id } }));
  }, alex.id);

  // The cascade fires when the NEW fund's data lands (async), so poll for up to
  // 4s and catch any mid-cascade frame (a face present at opacity 0<x<0.98).
  let caught = false, sawFaces = false, shot = false;
  for (let i = 0; i < 60; i++) {
    const o = await opacities();
    if (o.length > 0) sawFaces = true;
    const anyMid = o.some((v) => Number(v) > 0 && Number(v) < 0.98);
    if (anyMid) {
      caught = true;
      console.log(`t+${Date.now() - t0}ms MID-CASCADE (replay fired):`, o.join(" "));
      if (!shot) { await page.screenshot({ path: path.join(outDir, "mid-cascade.png") }); shot = true; }
    }
    await page.waitForTimeout(60);
  }
  console.log(`faces reappeared after switch: ${sawFaces} | cascade replay caught: ${caught}`);
  await page.screenshot({ path: path.join(outDir, "settled.png") });
  await browser.close();
  console.log(`screenshots: ${outDir}`);
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
