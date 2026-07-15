/* eslint-disable no-console */
// Verify the icon-system pass renders: (1) managed-mix rows on /activity now show
// the Layers basket mark (not the Growth up-arrow), (2) the dashboard occasion nav
// pill shows a Lucide occasion glyph in line with its sibling pills.
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
await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
await p.waitForURL(/fund=/i, { timeout: 15000 }).catch(() => {});
const fund = (p.url().match(/fund=([a-f0-9-]+)/i) || [])[1];

// (A) Dashboard occasion nav pill — Lucide glyph in the actions row.
await p.goto(base + "/staging" + (fund ? `?fund=${fund}` : ""), { waitUntil: "domcontentloaded" });
await p.locator('[data-testid="hero-card"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
await p.waitForTimeout(2500);
const pill = p.locator('[data-testid="pill-occasion-active"]').first();
if (await pill.count()) {
  await pill.scrollIntoViewIfNeeded().catch(() => {});
  await p.waitForTimeout(600);
  const bb = await pill.boundingBox();
  if (bb) {
    await p.screenshot({ path: path.join(out, "icon-occasion-pill.png"),
      clip: { x: Math.max(0, bb.x - 20), y: Math.max(0, bb.y - 20), width: Math.min(393, bb.width + 40), height: bb.height + 40 } });
  }
}

// (B) Activity feed — managed-mix contribution rows + recurring markers.
await p.goto(base + "/activity", { waitUntil: "domcontentloaded" });
// Wait for real rows (not skeletons): a contribution row mentions "mix" or a $ amount.
await p.getByText(/mix|invested|every (week|month|year)/i).first().waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
await p.waitForTimeout(1500);
// Scroll to the first "mix" mention so a managed-mix row is in frame.
const mixRow = p.getByText(/mix/i).first();
if (await mixRow.count()) { await mixRow.scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(800); }
await p.screenshot({ path: path.join(out, "icon-activity-feed.png") });

console.log("-> icon-occasion-pill / icon-activity-feed  " + (errs.length ? "JS:" + [...new Set(errs)].slice(0, 3).join(" | ") : "(no JS errors)"));
await b.close();
