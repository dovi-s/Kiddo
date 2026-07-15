import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "staging");
mkdirSync(out, { recursive: true });

const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));

await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
try { await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 }); }
catch { await p.reload({ waitUntil: "domcontentloaded" }); await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 }); }
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/fund=/i, { timeout: 30000 }).catch(() => {});
const fund = (p.url().match(/fund=([a-f0-9-]+)/i) || [])[1];

await p.goto(base + "/staging?fund=" + fund + "&openAutoInvest=1", { waitUntil: "domcontentloaded" });
await p.getByTestId("input-auto-invest-amount").waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
await p.waitForTimeout(2000);
await p.getByTestId("button-auto-invest-next-target").click().catch(() => console.log("no continue"));
await p.waitForTimeout(1500);

const dlg = p.locator('[role="dialog"]').first();
// Screenshot at rest (top of target step).
await dlg.screenshot({ path: path.join(out, "target-top.png") }).catch(() => {});
console.log("-> target-top.png");

// Measure the inner scroller + whether "Pick a stock" is fully visible.
const info = await p.evaluate(() => {
  const scroller = document.querySelector('[role="dialog"] [class*="overflow-y-auto"]');
  const pick = Array.from(document.querySelectorAll('[role="dialog"] p')).find(el => el.textContent?.trim() === "Pick a stock");
  const pickCard = pick ? pick.closest("button") : null;
  const footer = document.querySelector('[role="dialog"] [class*="sticky"]');
  const r = (el) => el ? { top: Math.round(el.getBoundingClientRect().top), bottom: Math.round(el.getBoundingClientRect().bottom) } : null;
  return {
    scroller: scroller ? { scrollH: scroller.scrollHeight, clientH: scroller.clientHeight, overflows: scroller.scrollHeight > scroller.clientHeight + 2 } : null,
    pickCard: r(pickCard),
    footerTop: footer ? Math.round(footer.getBoundingClientRect().top) : null,
    pickBehindFooter: (pickCard && footer) ? pickCard.getBoundingClientRect().bottom > footer.getBoundingClientRect().top + 1 : null,
  };
});
console.log("INFO:", JSON.stringify(info));

// Scroll the inner scroller to the bottom, re-check.
await p.evaluate(() => { const s = document.querySelector('[role="dialog"] [class*="overflow-y-auto"]'); if (s) s.scrollTop = s.scrollHeight; });
await p.waitForTimeout(600);
await dlg.screenshot({ path: path.join(out, "target-bottom.png") }).catch(() => {});
console.log("-> target-bottom.png");
const after = await p.evaluate(() => {
  const pick = Array.from(document.querySelectorAll('[role="dialog"] p')).find(el => el.textContent?.trim() === "Pick a stock");
  const pickCard = pick ? pick.closest("button") : null;
  const footer = document.querySelector('[role="dialog"] [class*="sticky"]');
  return (pickCard && footer) ? { pickBottom: Math.round(pickCard.getBoundingClientRect().bottom), footerTop: Math.round(footer.getBoundingClientRect().top), covered: pickCard.getBoundingClientRect().bottom > footer.getBoundingClientRect().top + 1 } : null;
});
console.log("AFTER-SCROLL:", JSON.stringify(after));
await b.close();
