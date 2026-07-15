/* eslint-disable no-console */
// Verify the swipe-dismiss vs tab-swipe fix. The tab-swipe (MobileNav) listens on
// window touchstart/touchend; the fix makes it bail when the touch starts inside a
// [data-swipe-dismiss] element. Tests:
//   CONTROL   swipe on plain content  -> MUST navigate /dashboard -> /memory
//   GUARD     swipe inside injected [data-swipe-dismiss] -> MUST NOT navigate
//   REAL      report whether a live banner carries the attribute
import { chromium, devices } from "playwright";

const base = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const EMAIL = "elena@riverafamily.com";
const PASSWORD = "riverafamily";

async function swipe(page, selector, fromX, toX, y) {
  return page.evaluate(({ selector, fromX, toX, y }) => {
    const el = document.querySelector(selector);
    if (!el) return { ok: false, reason: "no-el:" + selector };
    const touch = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [touch(fromX)], changedTouches: [touch(fromX)] }));
    el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [touch(toX)] }));
    return { ok: true };
  }, { selector, fromX, toX, y });
}

async function goDash(p, base) {
  await p.goto(base + "/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(4500);
}

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices["iPhone 14 Pro"], hasTouch: true });
  const p = await ctx.newPage();
  await p.addInitScript((theo) => {
    sessionStorage.setItem("kora-launched", "1");
    localStorage.setItem("kiddo_active_fund_id", theo);
  }, "5c90c61f-ad56-4328-ac48-55d9a5c9798c");

  await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("input-login-email").fill(EMAIL);
  await p.getByTestId("input-login-password").fill(PASSWORD);
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});

  const results = [];

  // REAL: does a live banner carry the attribute?
  await goDash(p, base);
  const realCount = await p.locator("[data-swipe-dismiss]").count();
  results.push({ test: "real-banner-has-attribute", count: realCount, pass: realCount > 0 ? true : null });

  // CONTROL: plain content swipe must navigate to /memory.
  await goDash(p, base);
  const before1 = new URL(p.url()).pathname;
  const s1 = await swipe(p, "#root", 280, 40, 260);
  await p.waitForTimeout(900);
  const after1 = new URL(p.url()).pathname;
  results.push({ test: "control-content-navigates", dispatch: s1, before: before1, after: after1, pass: after1.startsWith("/memory") });

  // GUARD: inject a data-swipe-dismiss overlay, swipe inside it, must NOT navigate.
  await goDash(p, base);
  await p.evaluate(() => {
    const d = document.createElement("div");
    d.id = "swipe-guard-probe";
    d.setAttribute("data-swipe-dismiss", "true");
    d.style.cssText = "position:fixed;left:0;top:180px;width:100%;height:120px;z-index:99999;background:transparent";
    document.body.appendChild(d);
  });
  const before2 = new URL(p.url()).pathname;
  const s2 = await swipe(p, "#swipe-guard-probe", 280, 40, 240);
  await p.waitForTimeout(900);
  const after2 = new URL(p.url()).pathname;
  results.push({ test: "guard-blocks-nav", dispatch: s2, before: before2, after: after2, pass: after2 === before2 && before2.startsWith("/dashboard") });

  console.log(JSON.stringify(results, null, 2));
  await b.close();
  const failed = results.filter((r) => r.pass === false);
  if (failed.length) process.exitCode = 2;
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
