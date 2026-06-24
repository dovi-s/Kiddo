/* eslint-disable no-console */
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });
const EMAIL = "elena@riverafamily.com";
const PASSWORD = "riverafamily";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1320, height: 1100 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
await p.getByTestId("input-login-email").fill(EMAIL);
await p.getByTestId("input-login-password").fill(PASSWORD);
await p.getByTestId("button-login").click();
await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(2000);
const landed = p.url();
console.log("URL after login:", landed);
if (!/\/dashboard/.test(landed)) {
  await p.goto(base + "/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });
}
await p.waitForTimeout(9000);
console.log("URL now:", p.url());
const labs = await p.locator('[data-testid^="lab-"]').evaluateAll((els) =>
  els.map((e) => e.getAttribute("data-testid") + " (aria-expanded=" + e.getAttribute("aria-expanded") + ")"));
console.log("lab-* testids:", labs);
const yourpart = p.locator('[data-testid="lab-yourpart-details"]').first();
console.log("yourpart count:", await yourpart.count());
if (await yourpart.count()) {
  await yourpart.scrollIntoViewIfNeeded();
  await yourpart.click();
  await p.waitForTimeout(900);
  const decks = await p.locator('[data-testid^="recurring-"], [data-testid^="card-"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-testid")));
  console.log("deck testids after expand:", decks);

  const recurring = p.locator('[data-testid="recurring-list-view"]').first();
  const oneTime = p.locator('[data-testid="card-one-time-contribution-v2"]').first();
  await recurring.scrollIntoViewIfNeeded();
  await p.waitForTimeout(600);
  const rb = await recurring.boundingBox();
  const ob = (await oneTime.count()) ? await oneTime.boundingBox() : null;
  const x = Math.max(0, Math.min(rb.x, ob ? ob.x : rb.x) - 18);
  const y = Math.max(0, rb.y - 56); // include the "Your part" header above
  const right = Math.max(rb.x + rb.width, ob ? ob.x + ob.width : 0) + 18;
  const bottom = Math.max(rb.y + rb.height, ob ? ob.y + ob.height : 0) + 18;
  await p.screenshot({ path: path.join(out, "invest-deck.desktop.png"), clip: { x, y, width: right - x, height: bottom - y } });
  console.log("-> artifacts/dash/invest-deck.desktop.png");
}

// Also full-page (expand all lab sections) to eyeball the codemod-converted
// areas (occasions tiles, journey caption) for any structural breakage.
for (const tid of ["lab-summary-details", "lab-chart-details", "lab-portfolio-details", "lab-yourpart-details"]) {
  const t = p.locator(`[data-testid="${tid}"]`).first();
  if ((await t.count()) && (await t.getAttribute("aria-expanded")) !== "true") {
    await t.scrollIntoViewIfNeeded(); await t.click(); await p.waitForTimeout(450);
  }
}
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(400);
await p.screenshot({ path: path.join(out, "dash-fullpage-postcodemod.png"), fullPage: true });
console.log("-> artifacts/dash/dash-fullpage-postcodemod.png");
await b.close();
