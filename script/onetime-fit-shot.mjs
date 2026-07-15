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

await p.goto(base + "/staging?fund=" + fund, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(8000);
await p.getByTestId("chip-add-onetime").scrollIntoViewIfNeeded().catch(() => {});
await p.getByTestId("chip-add-onetime").click().catch(() => console.log("no onetime chip"));
await p.waitForTimeout(1500);

const dlg = p.locator('[role="dialog"]').first();
console.log("dialog open:", await dlg.count());
await dlg.screenshot({ path: path.join(out, "onetime-amount.png") }).catch(() => {});
const info = await p.evaluate(() => {
  const scroller = document.querySelector('[role="dialog"] [class*="overflow-y-auto"]');
  // last button in the dialog = the step's primary action
  const btns = Array.from(document.querySelectorAll('[role="dialog"] button'));
  const btn = btns[btns.length - 1];
  const r = (el) => el ? { top: Math.round(el.getBoundingClientRect().top), bottom: Math.round(el.getBoundingClientRect().bottom), label: (el.textContent || "").trim().slice(0, 20) } : null;
  return {
    overflows: scroller ? scroller.scrollHeight > scroller.clientHeight + 2 : null,
    lastBtn: r(btn),
    scrollerBottom: scroller ? Math.round(scroller.getBoundingClientRect().bottom) : null,
    gapBelowBtn: (btn && scroller) ? Math.round(scroller.getBoundingClientRect().bottom - btn.getBoundingClientRect().bottom) : null,
  };
});
console.log("ONETIME:", JSON.stringify(info));
await b.close();
