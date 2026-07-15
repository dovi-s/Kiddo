/* eslint-disable no-console */
// Motion + variety capture pass:
//  - tall FULL-PAGE shots for the CSS auto-pan "scrolling" surfaces
//    (dashboard, memory) — logs each logical height for the pan math
//  - recaptured gift flow (new "seconds" copy)
//  - kid-view LEARNING region (scrolled) as a distinct detail crop
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
  const vp = { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  const e = await b.newContext({ viewport: vp, userAgent: "Mozilla/5.0 (iPhone) Mobile" });
  await e.request.post(`${base}/api/auth/login`, { data: { email: "elena@riverafamily.com", password: "riverafamily" }, timeout: 120000 }).catch(() => {});
  const funds = await e.request.get(`${base}/api/funds`, { timeout: 120000 }).then(r => r.json()).catch(() => []);
  const theo = funds.find(f => /theo/i.test(f?.recipientFirstName || "")) || funds[0];

  async function fullPage(url, name, waitSel) {
    const p = await e.newPage();
    await p.goto(base + url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.addStyleTag({ content: HIDE }).catch(() => {});
    if (waitSel) await p.waitForSelector(waitSel, { timeout: 22000 }).catch(() => {});
    await p.waitForTimeout(4500);
    await p.evaluate(() => window.scrollTo(0, 0));
    const h = await p.evaluate(() => Math.round(document.body.scrollHeight));
    await p.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
    console.log(`${name}.png  height=${h}`);
    await p.close();
  }
  await fullPage(`/design-lab?fund=${theo.id}`, "dashboard-full", "text=/\\$[0-9]/");
  await fullPage(`/memory/${theo.id}`, "memory-full", "text=/Memory Book/i");

  // kid-view learning region (token + PIN, scroll past the contributor list)
  const s = await e.request.get(`${base}/api/funds/${theo.id}/kid-view-settings`, { timeout: 60000 }).then(r => r.json()).catch(() => ({}));
  const token = (s.shareLink || "").split("/kid/")[1];
  if (token) {
    const kp = await e.newPage();
    await kp.goto(`${base}/kid/${token}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await kp.waitForTimeout(2500);
    for (const d of ["1", "2", "3", "4"]) { await kp.getByRole("button", { name: new RegExp("^" + d + "$") }).first().click({ timeout: 5000 }).catch(() => {}); await kp.waitForTimeout(250); }
    await kp.waitForTimeout(5000);
    await kp.evaluate(() => window.scrollBy(0, 760)); // past the "this is yours" + contributors
    await kp.waitForTimeout(1500);
    await kp.screenshot({ path: path.join(out, "kidview-learn.png") }); // viewport
    console.log("kidview-learn.png  text:", (await kp.evaluate(() => document.body.innerText.slice(0, 110).replace(/\n+/g, " "))));
    await kp.close();
  } else { console.log("no kid-view token"); }
  await e.close();

  // gift flow recapture (new "seconds" copy), public
  const g = await b.newContext({ viewport: vp, userAgent: "Mozilla/5.0 (iPhone) Mobile" });
  const gp = await g.newPage();
  await gp.goto(`${base}/theo-rivera`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await gp.waitForSelector("text=/Add to it|Gift Theo/i", { timeout: 20000 }).catch(() => {});
  await gp.waitForTimeout(4000);
  await gp.evaluate(() => window.scrollTo(0, 0));
  await gp.screenshot({ path: path.join(out, "giftflow.png") });
  console.log("giftflow.png recaptured");
  await g.close();
  await b.close();
  console.log("done");
}
main().catch(e => { console.error(String(e)); process.exit(1); });
