/* eslint-disable no-console */
// Verify the CUSTOM occasion flow: no pencil glyph, header shows the person's
// typed name (not "Custom"), and the preview drops the redundant "Custom" badge.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 14 Pro"] });
// Force full coverage so the "create occasion" flow opens (demo funds are free →
// the deep-link would otherwise route to the upgrade gate). Test-only, no DB write.
await ctx.route("**/api/subscription", async (route) => {
  const resp = await route.fetch();
  let json;
  try { json = await resp.json(); } catch { return route.fulfill({ response: resp }); }
  const cov = json.coverageByFund || {};
  for (const k of Object.keys(cov)) cov[k] = "covered_family";
  json.coverageByFund = cov;
  await route.fulfill({ response: resp, body: JSON.stringify(json), headers: { ...resp.headers(), "content-type": "application/json" } });
});
const p = await ctx.newPage();
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
await p.goto(base + "/staging" + (fund ? `?fund=${fund}` : ""), { waitUntil: "domcontentloaded" });
await p.locator('[data-testid="hero-card"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
// Make sure the coverage-forced subscription has actually landed before we trigger
// the create flow, so the occasion gate sees "covered" and opens the sheet.
await p.waitForResponse((r) => r.url().includes("/api/subscription"), { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(2500);

// Open the create sheet via the "+ New" occasion button (not the racy deep-link).
const newBtn = p.locator('button:has-text("New")').filter({ hasText: /^\s*[+＋]?\s*New\s*$/ }).first();
await newBtn.scrollIntoViewIfNeeded().catch(() => {});
await newBtn.click();
await p.waitForTimeout(800);

// If a category step is showing, choose the occasion option.
const occOpt = p.getByText(/^An occasion$/i).first();
if (await occOpt.count()) { await occOpt.click().catch(() => {}); await p.waitForTimeout(400); }

// Debug: what does the picker look like?
await p.screenshot({ path: path.join(out, "custom-0-picker.png") });
const btnTexts = await p.locator("button").allInnerTexts();
console.log("buttons:", btnTexts.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 40).join(" | "));

// Pick the Custom tile (the picker button reading "✏️ Custom").
const customTile = p.locator('button:has-text("Custom")').last();
await customTile.click();
await p.waitForTimeout(700);

// (1) Details header BEFORE typing — should read a neutral "Custom occasion", no pencil.
await p.screenshot({ path: path.join(out, "custom-1-empty.png") });

// Type a real occasion name (the custom-name input has the Bar Mitzvah placeholder).
const nameInput = p.locator('input[placeholder*="Bar Mitzvah"]').first();
await nameInput.fill("Bar Mitzvah");
await p.waitForTimeout(500);

// (2) Details header AFTER typing — should read "Bar Mitzvah".
await p.screenshot({ path: path.join(out, "custom-2-named.png") });

// Go to preview.
const previewBtn = p.getByText(/Preview occasion/i).first();
if (await previewBtn.count()) { await previewBtn.click(); await p.waitForTimeout(900); }

// (3) Preview cover — the "✏️ Custom" badge should be gone; headline carries the name.
await p.screenshot({ path: path.join(out, "custom-3-preview.png") });

console.log("-> custom-1-empty / custom-2-named / custom-3-preview  " + (errs.length ? "JS:" + [...new Set(errs)].slice(0, 3).join(" | ") : "(no JS errors)"));
await b.close();
