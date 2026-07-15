/* eslint-disable no-console */
// Verify the gifter-flow occasion glyphs: the GiftCheckout CTA ("Give $X to Theo")
// now leads with a white occasion glyph matching the trailing ArrowRight, instead
// of a lone emoji.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"] })).newPage();
const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 80)); });
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));

// Log in, grab the active-occasion gift link off the dashboard pill.
await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
await p.waitForURL(/fund=/i, { timeout: 15000 }).catch(() => {});
const fund = (p.url().match(/fund=([a-f0-9-]+)/i) || [])[1];
await p.goto(base + "/staging" + (fund ? `?fund=${fund}` : ""), { waitUntil: "domcontentloaded" });
await p.locator('[data-testid="hero-card"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
await p.waitForTimeout(2000);
const href = await p.locator('[data-testid="pill-occasion-active"]').first().getAttribute("href").catch(() => null);
console.log("occasion link:", href);

// Open the gifter page (log out of the parent session first so it renders public).
await p.context().clearCookies();
await p.goto(base + (href || "/theo-rivera"), { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
await p.screenshot({ path: path.join(out, "gifter-page-full.png"), fullPage: true });
const inputs = await p.locator("input").count();
const amtCount = await p.locator('input[inputmode="decimal"], input[type="number"]').count();
console.log("inputs:", inputs, "amt-like:", amtCount, "cta:", await p.locator('[data-testid="button-start-gift"]').count());
// Enter an amount so the CTA is enabled and in frame, then find the CTA button.
const amt = p.locator('input[inputmode="decimal"], input[type="number"], input[placeholder*="0"]').first();
if (await amt.count()) { await amt.fill("100").catch(() => {}); await p.waitForTimeout(600); }
const cta = p.locator('[data-testid="button-start-gift"]').first();
if (await cta.count()) {
  await cta.scrollIntoViewIfNeeded().catch(() => {});
  await p.waitForTimeout(500);
  const bb = await cta.boundingBox();
  if (bb) await p.screenshot({ path: path.join(out, "gifter-cta.png"),
    clip: { x: Math.max(0, bb.x - 10), y: Math.max(0, bb.y - 10), width: Math.min(393, bb.width + 20), height: bb.height + 20 } });
  else await p.screenshot({ path: path.join(out, "gifter-cta.png") });
} else {
  await p.screenshot({ path: path.join(out, "gifter-cta.png") });
}
console.log("-> gifter-cta.png  " + (errs.length ? "JS:" + [...new Set(errs)].slice(0, 3).join(" | ") : "(no JS errors)"));
await b.close();
