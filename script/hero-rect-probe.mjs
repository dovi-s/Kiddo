/* eslint-disable no-console */
import { chromium } from "playwright";
const base = "http://127.0.0.1:5000";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })).newPage();
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
const r = await p.evaluate(() => {
  const vw = window.innerWidth;
  const hero = document.querySelector('[data-testid="hero-card"]');
  const section = hero?.parentElement;
  const main = document.getElementById("dashboard-main-content");
  const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { left: Math.round(b.left), right: Math.round(b.right), width: Math.round(b.width) }; };
  const heroR = rect(hero), secR = rect(section), mainR = rect(main);
  return {
    vw,
    hero: heroR, section: secR, main: mainR,
    gapLeftOfHero: heroR ? heroR.left : null,
    gapRightOfHero: heroR ? vw - heroR.right : null,
    heroVsSection: heroR && secR ? { leftDelta: heroR.left - secR.left, rightDelta: secR.right - heroR.right } : null,
  };
});
console.log(JSON.stringify(r, null, 2));
await b.close();
