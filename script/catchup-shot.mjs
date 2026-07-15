/* eslint-disable no-console */
// Try to render the recurring "Pay it now" catch-up modal on /staging: log in as
// the Rivera demo, find a "Pay it now" chip on a retrying recurring row, click it,
// and screenshot the one-time sheet in CATCH-UP mode (banner + no quick-amount chips).
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });

const EMAIL = "elena@riverafamily.com";
const PASSWORD = "riverafamily";

const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 });

// login
const lp = await ctx.newPage();
await lp.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
await lp.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
await lp.getByTestId("input-login-email").fill(EMAIL);
await lp.getByTestId("input-login-password").fill(PASSWORD);
await lp.getByTestId("button-login").click();
await lp.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
await lp.close();

const p = await ctx.newPage();
const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 80)); });
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
await p.goto(base + "/staging", { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(9000);

// Walk the page so lazy/virtualized rows mount.
const total = await p.evaluate(() => document.body.scrollHeight);
for (let y = 0; y <= total; y += 500) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(150); }

const payNow = p.locator('[data-testid^="recurring-pay-now-"]').first();
const found = await payNow.count();
console.log("pay-now chips found:", found);
if (found > 0) {
  await payNow.scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
  await payNow.click();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(out, "catchup.modal.png") });
  console.log("-> catchup.modal.png");
} else {
  // Fallback: capture whatever the recurring area looks like for diagnosis.
  await p.screenshot({ path: path.join(out, "catchup.norow.png"), fullPage: true });
  console.log("-> catchup.norow.png (no pay-now chip reachable)");
}
console.log(errs.length ? "JS errors: " + [...new Set(errs)].slice(0, 5).join(" | ") : "no JS errors");
await b.close();
