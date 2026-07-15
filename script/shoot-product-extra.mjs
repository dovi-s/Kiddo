/* eslint-disable no-console */
// Variety pass: desktop browser view + a feature close-up (the digest) +
// the kid-view learning detail (banner hidden). Output: client/public/product/.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "client", "public", "product");
mkdirSync(out, { recursive: true });
const HIDE = `[data-testid="demo-banner"]{display:none !important} .mobile-nav-shell{display:none !important}`;

async function main() {
  const b = await chromium.launch();

  // ── Desktop dashboard (browser-framed on the site) ──
  const d = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await d.request.post(`${base}/api/auth/login`, { data: { email: "elena@riverafamily.com", password: "riverafamily" }, timeout: 120000 }).catch(() => {});
  const funds = await d.request.get(`${base}/api/funds`, { timeout: 120000 }).then(r => r.json()).catch(() => []);
  const theo = funds.find(f => /theo/i.test(f?.recipientFirstName || "")) || funds[0];
  const dp = await d.newPage();
  await dp.goto(`${base}/design-lab?fund=${theo.id}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await dp.addStyleTag({ content: HIDE }).catch(() => {});
  await dp.waitForSelector("text=/\\$[0-9]/", { timeout: 22000 }).catch(() => {});
  await dp.waitForTimeout(5000);
  await dp.evaluate(() => window.scrollTo(0, 0));
  await dp.screenshot({ path: path.join(out, "dashboard-desktop.png") });
  console.log("dashboard-desktop.png");

  // ── Feature close-up: the "while you were away" digest (element shot) ──
  const m = await b.newContext({ viewport: { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (iPhone) Mobile" });
  await m.request.post(`${base}/api/auth/login`, { data: { email: "elena@riverafamily.com", password: "riverafamily" }, timeout: 120000 }).catch(() => {});
  const mp = await m.newPage();
  await mp.goto(`${base}/design-lab?fund=${theo.id}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await mp.addStyleTag({ content: HIDE }).catch(() => {});
  const dig = await mp.waitForSelector('[data-testid="since-last-visit-digest"]', { timeout: 20000 }).catch(() => null);
  await mp.waitForTimeout(2500);
  if (dig) { await dig.screenshot({ path: path.join(out, "feature-digest.png") }); console.log("feature-digest.png"); }
  else console.log("digest not found");

  // ── Kid-view learning region (banner hidden) ──
  const s = await m.request.get(`${base}/api/funds/${theo.id}/kid-view-settings`, { timeout: 60000 }).then(r => r.json()).catch(() => ({}));
  const token = (s.shareLink || "").split("/kid/")[1];
  if (token) {
    const kp = await m.newPage();
    await kp.goto(`${base}/kid/${token}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await kp.addStyleTag({ content: HIDE }).catch(() => {});
    await kp.waitForTimeout(2500);
    for (const x of ["1", "2", "3", "4"]) { await kp.getByRole("button", { name: new RegExp("^" + x + "$") }).first().click({ timeout: 5000 }).catch(() => {}); await kp.waitForTimeout(250); }
    await kp.waitForTimeout(5000);
    await kp.evaluate(() => window.scrollBy(0, 720));
    await kp.waitForTimeout(1500);
    await kp.screenshot({ path: path.join(out, "kidview-learn.png") });
    console.log("kidview-learn.png");
    await kp.close();
  }
  await b.close();
  console.log("done");
}
main().catch(e => { console.error(String(e)); process.exit(1); });
