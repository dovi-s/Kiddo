/* eslint-disable no-console */
// Capture /staging mobile at TOP and SCROLLED to diagnose the chameleon header
// (invisible profile icon + the green→cream switch) — one login, two shots.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
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
// Wait for the hero (not the cold-load skeleton) before shooting.
await p.locator('[data-testid="hero-card"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
await p.waitForTimeout(3000);
// find the scroll container (the dashboard scrolls inside an element, not window)
const scroller = await p.evaluate(() => {
  const main = document.getElementById("dashboard-main-content");
  let el = main;
  while (el && el !== document.body) {
    const s = getComputedStyle(el);
    if ((s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight) return "FOUND:" + (el.id || el.className).slice(0,40);
    el = el.parentElement;
  }
  return "window? scrollY=" + window.scrollY + " docScrollable=" + (document.documentElement.scrollHeight > window.innerHeight);
});
console.log("scroller:", scroller);
await p.screenshot({ path: path.join(out, "staging-scroll.top.png"), clip: { x: 0, y: 0, width: 393, height: 700 } });
// scroll down both window and the main container, then screenshot
await p.evaluate(() => {
  window.scrollTo(0, 380);
  const main = document.getElementById("dashboard-main-content");
  if (main) { let el = main; while (el && el !== document.body) { el.scrollTop = 380; el = el.parentElement; } }
});
await p.waitForTimeout(700);
await p.screenshot({ path: path.join(out, "staging-scroll.scrolled.png"), clip: { x: 0, y: 0, width: 393, height: 240 } });
console.log(errs.length ? "JS:" + [...new Set(errs)].slice(0,4).join(" | ") : "(no JS errors)");
await b.close();
