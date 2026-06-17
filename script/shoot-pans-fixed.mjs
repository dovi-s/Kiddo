/* eslint-disable no-console */
// Recapture the auto-scroll PAN full-page shots so scroll-reveal content
// (the "who gave / who loves" faces, cascades, charts) is PRESENT. Two fixes:
//   1) reducedMotion:"reduce" — the app renders whileInView/FadeIn elements in
//      their FINAL visible state instead of opacity:0 (their pre-scroll state).
//   2) a scroll-through pass before the full-page shot to mount any lazy content.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "client", "public", "product");
mkdirSync(out, { recursive: true });
const HIDE = `[data-testid="demo-banner"]{display:none !important} .mobile-nav-shell{display:none !important}`;

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    viewport: { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent: "Mozilla/5.0 (iPhone) Mobile",
    reducedMotion: "reduce",
  });
  // The dashboard faces use a custom IntersectionObserver cascade (NOT framer
  // whileInView), with a documented fallback: "if IntersectionObserver is
  // unavailable the faces just render visible." Stub it so a full-page capture
  // shows the faces instead of the hidden pre-scroll state.
  await ctx.addInitScript(() => {
    try { window.IntersectionObserver = undefined; } catch (_) { /* noop */ }
  });
  await ctx.request.post(`${base}/api/auth/login`, { data: { email: "elena@riverafamily.com", password: "riverafamily" }, timeout: 120000 }).catch(() => {});
  const funds = await ctx.request.get(`${base}/api/funds`, { timeout: 120000 }).then(r => r.json()).catch(() => []);
  const theo = funds.find(f => /theo/i.test(f?.recipientFirstName || "")) || funds[0];

  async function pan(url, name, waitSel) {
    const p = await ctx.newPage();
    await p.goto(base + url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.addStyleTag({ content: HIDE }).catch(() => {});
    if (waitSel) await p.waitForSelector(waitSel, { timeout: 22000 }).catch(() => {});
    await p.waitForTimeout(3500);
    // scroll-through pass to mount/trigger any lazy content
    const total = await p.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y <= total; y += 500) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(220); }
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(1200);
    const h = await p.evaluate(() => Math.round(document.body.scrollHeight));
    const txt = await p.evaluate(() => document.body.innerText);
    const hasFaces = /Who (loves|gave|helped)|people/i.test(txt);
    await p.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
    console.log(`${name}.png  height=${h}  facesSectionPresent=${hasFaces}`);
    await p.close();
  }
  await pan(`/design-lab?fund=${theo.id}`, "dashboard-full", "text=/\\$[0-9]/");
  await pan(`/memory/${theo.id}`, "memory-full", "text=/Memory Book/i");
  await b.close();
  console.log("done");
}
main().catch(e => { console.error(String(e)); process.exit(1); });
