/* eslint-disable no-console */
// Verify the hero renders cleanly after removing the "$X cash" stat:
//  - no [data-testid="button-hero-cash-stat"] / "text-hero-cash-stat-readonly"
//  - no orphaned vertical gap where it used to sit
// Output: artifacts/hero-cash/.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "hero-cash");
mkdirSync(out, { recursive: true });

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 430, height: 932, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (iPhone) Mobile" });
  await ctx.request.post(`${base}/api/auth/login`, { data: { email: "elena@riverafamily.com", password: "riverafamily" }, timeout: 120000 }).catch(() => {});
  const funds = await ctx.request.get(`${base}/api/funds`, { timeout: 120000 }).then(r => r.json()).catch(() => []);
  console.log("funds:", funds.map(f => `${f.recipientFirstName}(${f.id})`).join(", "));

  for (const f of funds) {
    const p = await ctx.newPage();
    await p.addInitScript(id => { try { localStorage.setItem("kiddo_active_fund_id", id) } catch (_) {} }, f.id);
    await p.goto(`${base}/dashboard`, { waitUntil: "load", timeout: 60000 });
    await p.waitForSelector('[data-testid="text-total-balance"]', { timeout: 25000 }).catch(() => {});
    await p.waitForTimeout(3500);
    const cashBtn = await p.$('[data-testid="button-hero-cash-stat"]');
    const cashRo = await p.$('[data-testid="text-hero-cash-stat-readonly"]');
    const bal = await p.$eval('[data-testid="text-total-balance"]', el => el.textContent).catch(() => "?");
    console.log(`${f.recipientFirstName}: balance=${bal} cashStatPresent=${!!cashBtn || !!cashRo}`);
    await p.screenshot({ path: path.join(out, `hero-${f.recipientFirstName}.png`) });
    await p.close();
  }
  await b.close();
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
