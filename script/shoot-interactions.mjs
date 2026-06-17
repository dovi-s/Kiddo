/* eslint-disable no-console */
// Capture the product IN USE — interaction states for the marketing site:
//   - sending a thank-you (Memory Book)
//   - tapping a gifter / gift to see its detail
//   - tapping a holding to see what the company is
// Output: client/public/product/.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "client", "public", "product");
mkdirSync(out, { recursive: true });
const HIDE = `[data-testid="demo-banner"]{display:none !important} .mobile-nav-shell{display:none !important}`;

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (iPhone) Mobile", reducedMotion: "reduce" });
  await ctx.request.post(`${base}/api/auth/login`, { data: { email: "elena@riverafamily.com", password: "riverafamily" }, timeout: 120000 }).catch(() => {});
  const funds = await ctx.request.get(`${base}/api/funds`, { timeout: 120000 }).then(r => r.json()).catch(() => []);
  const theo = funds.find(f => /theo/i.test(f?.recipientFirstName || "")) || funds[0];

  // ---- Memory Book: thank-you + gifter/gift detail ----
  const mp = await ctx.newPage();
  await mp.addInitScript(id => { try { localStorage.setItem("kiddo_active_fund_id", id) } catch (_) {} }, theo.id);
  await mp.goto(`${base}/memory/${theo.id}`, { waitUntil: "load", timeout: 60000 });
  await mp.addStyleTag({ content: HIDE }).catch(() => {});
  await mp.waitForSelector("text=/Memory Book/i", { timeout: 22000 }).catch(() => {});
  await mp.waitForTimeout(3000);

  // gifter/gift detail: tap a gift card (by a gifter name)
  const giftCard = mp.getByText(/Leo Rivera|Marcus Rivera|Sofia Rivera/).first();
  await giftCard.click({ timeout: 6000 }).catch(e => console.log("gift click err", String(e).slice(0, 40)));
  await mp.waitForTimeout(2200);
  await mp.screenshot({ path: path.join(out, "gifterdetail.png") });
  console.log("gifterdetail captured; head:", (await mp.evaluate(() => document.body.innerText)).replace(/\n+/g, " ").slice(0, 90));
  await mp.keyboard.press("Escape").catch(() => {});
  await mp.waitForTimeout(1200);

  // thank-you: tap a "Say thanks"
  const thanks = mp.getByText(/Say thanks/i).first();
  const hasThanks = await thanks.count().then(c => c > 0).catch(() => false);
  if (hasThanks) {
    await thanks.click({ timeout: 6000 }).catch(e => console.log("thanks click err", String(e).slice(0, 40)));
    await mp.waitForTimeout(2200);
    await mp.screenshot({ path: path.join(out, "thankyou.png") });
    console.log("thankyou captured; head:", (await mp.evaluate(() => document.body.innerText)).replace(/\n+/g, " ").slice(0, 90));
  } else console.log("no 'Say thanks' found");
  await mp.close();

  // ---- Kid View: tap a holding -> what the company is ----
  const s = await ctx.request.get(`${base}/api/funds/${theo.id}/kid-view-settings`, { timeout: 60000 }).then(r => r.json()).catch(() => ({}));
  const token = (s.shareLink || "").split("/kid/")[1];
  if (token) {
    const kp = await ctx.newPage();
    await kp.goto(`${base}/kid/${token}`, { waitUntil: "load", timeout: 60000 });
    await kp.addStyleTag({ content: HIDE }).catch(() => {});
    await kp.waitForTimeout(2500);
    for (const d of ["1", "2", "3", "4"]) { await kp.getByRole("button", { name: new RegExp("^" + d + "$") }).first().click({ timeout: 5000 }).catch(() => {}); await kp.waitForTimeout(300); }
    await kp.waitForTimeout(4000);
    // scroll to holdings and tap one
    const holding = kp.getByText(/Disney|Apple|Nintendo|Roblox|Spotify/).first();
    await holding.scrollIntoViewIfNeeded().catch(() => {});
    await kp.waitForTimeout(800);
    await holding.click({ timeout: 6000 }).catch(e => console.log("holding click err", String(e).slice(0, 40)));
    await kp.waitForTimeout(2200);
    await kp.screenshot({ path: path.join(out, "stockdetail.png") });
    console.log("stockdetail captured; head:", (await kp.evaluate(() => document.body.innerText)).replace(/\n+/g, " ").slice(0, 90));
    await kp.close();
  }
  await b.close();
  console.log("done");
}
main().catch(e => { console.error(String(e)); process.exit(1); });
