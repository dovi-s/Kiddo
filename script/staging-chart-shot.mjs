/* eslint-disable no-console */
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "staging");
mkdirSync(out, { recursive: true });
const EMAIL = "elena@riverafamily.com";
const PASSWORD = "riverafamily";

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const login = await ctx.newPage();
await login.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
await login.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
await login.getByTestId("input-login-email").fill(EMAIL);
await login.getByTestId("input-login-password").fill(PASSWORD);
await login.getByTestId("button-login").click();
await login.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
await login.waitForTimeout(1500);
await login.close();

const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
await p.goto(base + "/staging", { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(9000);
// open the fund-so-far ledger + the growth chart collapses
for (const tid of ["lab-summary-details", "lab-chart-details"]) {
  const el = p.locator(`[data-testid="${tid}"]`).first();
  if (await el.count()) { await el.click(); await p.waitForTimeout(1800); }
}
await p.waitForTimeout(1500);
// scroll the growth section into view + shoot the whole page
const total = await p.evaluate(() => document.body.scrollHeight);
for (let y = 0; y <= total; y += 500) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(120); }
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(800);
await p.screenshot({ path: path.join(out, "staging.chart-open.png"), fullPage: true });
console.log("errors:", errs.length ? [...new Set(errs)].join(" | ") : "none");
await b.close();
console.log("-> artifacts/staging/staging.chart-open.png");
