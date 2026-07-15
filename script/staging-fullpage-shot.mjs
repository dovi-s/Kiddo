/* eslint-disable no-console */
// Full-page /staging capture for a holistic layout/width audit.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });
const b = await chromium.launch();

async function shoot(ctx, label) {
  const p = await ctx.newPage();
  await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
  await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
  await p.waitForURL(/fund=/i, { timeout: 15000 }).catch(() => {});
  const fund = (p.url().match(/fund=([a-f0-9-]+)/i) || [])[1];
  await p.goto(base + "/staging" + (fund ? `?fund=${fund}` : ""), { waitUntil: "domcontentloaded" });
  await p.locator('[data-testid="hero-card"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(3500);
  // expand the collapses so the whole page is auditable
  for (const t of ["lab-summary-details","lab-chart-details","lab-portfolio-details","lab-yourpart-details"]) {
    const el = p.locator(`[data-testid="${t}"]`).first();
    if (await el.count() && (await el.getAttribute("aria-expanded")) !== "true") { await el.click().catch(()=>{}); await p.waitForTimeout(250); }
  }
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(out, `staging-full.${label}.png`), fullPage: true });
  console.log(`-> staging-full.${label}.png`);
  await p.close();
}

await shoot(await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 }), "mobile");
await shoot(await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 }), "desktop");
await b.close();
