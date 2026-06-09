/* eslint-disable no-console */
// Render the Potential page (Projection.tsx) after the count-up + dot-glide +
// desktop two-column work, so the founder (and a blind builder) can SEE it.
// Logs in as the demo parent, resolves Luke's fund, then shoots:
//   desktop two-column at the default age + after sliding to another milestone
//   (to confirm the target dot + labels moved, i.e. the glide endpoint), and
//   the mobile single-column stack. Also shoots the loading skeleton by
//   delaying the lazy chunk.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "verify-potential");
mkdirSync(outDir, { recursive: true });

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  // Warm the dev server (first hit can trigger a slow Vite dep-optimize).
  await context.request.get(`${baseUrl}/api/health`, { timeout: 120000 }).catch(() => {});
  await context.request.post(`${baseUrl}/api/auth/login`, {
    data: { email: "phil@dunphyfamily.com", password: "dunphyfamily" },
    timeout: 120000,
  });

  // Resolve Luke's fund id from the API (the page route is /projection/:fundId).
  const fundsRes = await context.request.get(`${baseUrl}/api/funds`, { timeout: 120000 });
  const raw = await fundsRes.json();
  const funds: any[] = Array.isArray(raw) ? raw : (raw?.funds || raw?.data || raw?.items || []);
  if (!funds.length) console.log("funds payload keys:", Object.keys(raw || {}));
  const luke = funds.find((f) => /luke/i.test(f?.recipientFirstName || f?.name || "")) || funds[0];
  if (!luke) { console.log("NO FUNDS — is the demo seeded?"); await browser.close(); return; }
  const fundId = luke.id;
  console.log(`fund: ${luke.recipientFirstName || luke.name} (${fundId})`);

  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);

  // ---- Skeleton (cold-load) — hold the Projection chunk so the fallback lingers.
  await page.goto(`${baseUrl}/settings`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.route(/Projection/i, async (route) => { await new Promise((r) => setTimeout(r, 3000)); try { await route.continue(); } catch {} });
  await page.goto(`${baseUrl}/projection/${fundId}`, { waitUntil: "commit", timeout: 120000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, "desktop-skeleton.png") });
  await page.unroute(/Projection/i);

  // ---- Desktop two-column, settled.
  await page.goto(`${baseUrl}/projection/${fundId}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('[data-testid="text-projection-value"]', { timeout: 60000 });
  await page.waitForTimeout(1500); // let the entrance + count-up settle
  await page.screenshot({ path: path.join(outDir, "desktop-default.png"), fullPage: true });

  // Read the headline + target-dot position, slide one notch, re-read — proves
  // the dot/label endpoint moved (the glide is the tween between these).
  const slider = page.locator('[data-testid="slider-target-age"]');
  await slider.waitFor({ timeout: 60000 });
  const dot = page.locator('[data-testid="projection-trajectory-chart"] circle').last();
  const before = await dot.boundingBox().catch(() => null);
  // Bump the range input up two notches via keyboard (ArrowRight).
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(900); // let the count-up + spring settle
  const after = await dot.boundingBox().catch(() => null);
  await page.screenshot({ path: path.join(outDir, "desktop-after-slide.png"), fullPage: true });
  if (before && after) {
    const dx = Math.round(after.x - before.x), dy = Math.round(after.y - before.y);
    console.log(`target dot moved: dx=${dx}px dy=${dy}px (non-zero => the dot relocates on slide)`);
  } else {
    console.log("NOTE: could not measure the target dot bbox");
  }

  // ---- Mobile single-column.
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mctx.request.post(`${baseUrl}/api/auth/login`, { data: { email: "phil@dunphyfamily.com", password: "dunphyfamily" } });
  const mpage = await mctx.newPage();
  mpage.setDefaultTimeout(120000);
  await mpage.goto(`${baseUrl}/projection/${fundId}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await mpage.waitForSelector('[data-testid="text-projection-value"]', { timeout: 60000 });
  await mpage.waitForTimeout(1500);
  await mpage.screenshot({ path: path.join(outDir, "mobile-default.png"), fullPage: true });

  await browser.close();
  console.log(`screenshots: ${outDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
