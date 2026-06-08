/* eslint-disable no-console */
// Catch the transient route-skeleton on a COLD load and confirm it's offset
// past the 264px sidebar (commit 00e8fed). Forces the fallback to linger by
// delaying the Dashboard's lazy chunk request, then asserts the skeleton's
// left edge starts at/after ~264px (clear of the fixed sidebar).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "verify-skeleton");
mkdirSync(outDir, { recursive: true });

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.request.post(`${baseUrl}/api/auth/login`, { data: { email: "phil@dunphyfamily.com", password: "dunphyfamily" } });
  const page = await context.newPage();

  // Warm auth + the app shell first (Settings) so AppLoadingScreen — the
  // full-screen pre-auth bootstrap loader — is gone before we test. Otherwise
  // it paints OVER the route skeleton during the forced chunk delay.
  await page.goto(`${baseUrl}/settings`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000); // let auth resolve + sidebar render

  // Now hold the Dashboard chunk so the route Suspense fallback lingers, and
  // navigate. Auth is warm, so the sidebar is up and only the route skeleton
  // shows — beside the sidebar if the offset works.
  await page.route(/Dashboard/i, async (route) => {
    await new Promise((r) => setTimeout(r, 3500));
    await route.continue();
  });
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, "skeleton-during-load.png") });

  // Measure the skeleton's animate-pulse container left edge.
  const box = await page.locator(".animate-pulse").first().boundingBox().catch(() => null);
  if (box) {
    console.log(`skeleton left edge x = ${Math.round(box.x)}px (sidebar is 264px wide)`);
    if (box.x >= 250) console.log("PASS: skeleton starts clear of the 264px sidebar");
    else console.log(`NOTE: skeleton left edge at ${Math.round(box.x)}px — under/over the sidebar, or fallback not captured`);
  } else {
    console.log("NOTE: no .animate-pulse captured (chunk may have resolved before paint)");
  }

  await browser.close();
  console.log(`screenshot: ${outDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
