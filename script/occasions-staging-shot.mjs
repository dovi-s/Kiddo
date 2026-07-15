/* eslint-disable no-console */
// Render the redesigned occasion tiles in the REAL /staging dashboard.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1180, height: 1000 }, deviceScaleFactor: 1 })).newPage();
const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 70)); });
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
await p.waitForTimeout(3000);
// Expand collapses so the occasions sit at a stable position, then settle.
for (const t of ["lab-summary-details","lab-chart-details","lab-portfolio-details","lab-yourpart-details"]) {
  const el = p.locator(`[data-testid="${t}"]`).first();
  if (await el.count() && (await el.getAttribute("aria-expanded")) !== "true") { await el.click().catch(()=>{}); await p.waitForTimeout(250); }
}
await p.waitForTimeout(500);
// Find the occasion tile in the DOM (even if a collapsed sibling matches first),
// scroll it to center via evaluate, then capture the row.
const y = await p.evaluate(() => {
  const els = Array.from(document.querySelectorAll("span,div"));
  const lbl = els.find((b) => (b.textContent || "").trim() === "Theo's Birthday" && b.getClientRects().length > 0);
  if (!lbl) return -1;
  lbl.scrollIntoView({ block: "center" });
  return 1;
});
await p.waitForTimeout(900);
if (y >= 0) {
  await p.screenshot({ path: path.join(out, "birthday-staging.png"), clip: { x: 220, y: 300, width: 700, height: 340 } });
  console.log("-> occasions-staging.png  " + (errs.length ? "JS:" + [...new Set(errs)].slice(0,3).join(" | ") : "(no JS errors)"));
} else {
  console.log("occasion tile not found in DOM  " + (errs.length ? "JS:" + [...new Set(errs)].slice(0,3).join(" | ") : ""));
}
await b.close();
