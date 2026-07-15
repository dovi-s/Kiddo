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
await p.waitForTimeout(2500);

const dlg = p.locator('[role="dialog"]').first();

// ── AMOUNT STEP: inline Continue button must have clearance below it. ──
await dlg.screenshot({ path: path.join(out, "footer-amount.png") }).catch(() => {});
const amt = await p.evaluate(() => {
  const btn = document.querySelector('[data-testid="button-auto-invest-next-target"]');
  const scroller = document.querySelector('[role="dialog"] [class*="overflow-y-auto"]');
  const r = (el) => el ? { top: Math.round(el.getBoundingClientRect().top), bottom: Math.round(el.getBoundingClientRect().bottom) } : null;
  return {
    continueBtn: r(btn),
    scrollerBottom: scroller ? Math.round(scroller.getBoundingClientRect().bottom) : null,
    gapBelowBtn: (btn && scroller) ? Math.round(scroller.getBoundingClientRect().bottom - btn.getBoundingClientRect().bottom) : null,
  };
});
console.log("AMOUNT:", JSON.stringify(amt));

// Advance to TARGET step.
await p.getByTestId("button-auto-invest-next-target").click().catch(() => console.log("no continue"));
await p.waitForTimeout(1200);
await dlg.screenshot({ path: path.join(out, "footer-target.png") }).catch(() => {});
const tgt = await p.evaluate(() => {
  const scroller = document.querySelector('[role="dialog"] [class*="overflow-y-auto"]');
  const pick = Array.from(document.querySelectorAll('[role="dialog"] p')).find(el => el.textContent?.trim() === "Pick a stock");
  const pickCard = pick ? pick.closest("button") : null;
  const footer = document.querySelector('[role="dialog"] [class*="sticky"]');
  const r = (el) => el ? { top: Math.round(el.getBoundingClientRect().top), bottom: Math.round(el.getBoundingClientRect().bottom) } : null;
  return {
    overflows: scroller ? scroller.scrollHeight > scroller.clientHeight + 2 : null,
    pickCard: r(pickCard),
    footer: r(footer),
    scrollerBottom: scroller ? Math.round(scroller.getBoundingClientRect().bottom) : null,
    pickBehindFooter: (pickCard && footer) ? pickCard.getBoundingClientRect().bottom > footer.getBoundingClientRect().top + 1 : null,
    footerFlushGap: (footer && scroller) ? Math.round(scroller.getBoundingClientRect().bottom - footer.getBoundingClientRect().bottom) : null,
  };
});
console.log("TARGET:", JSON.stringify(tgt));
await b.close();
