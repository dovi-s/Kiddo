import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "staging");
mkdirSync(out, { recursive: true });
const FUND = "f9446a97-8774-49dc-b618-006571f5dbe0";
const SCHED = "9b4ce3d0-03f1-4b5f-811e-c7dff019a8a6";

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

await p.goto(base + `/staging?fund=${FUND}&openAutoInvest=1&editId=${SCHED}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(9000);
const dlg = p.locator('[role="dialog"]').first();
console.log("dialog open:", await dlg.count());

// Bump the amount so the edit shows the "Was -> Now" delta (worst case height).
await p.getByTestId("button-frequency-weekly").click().catch(() => {});
await p.waitForTimeout(600);

await dlg.screenshot({ path: path.join(out, "edit-amount-top.png") }).catch(() => {});
// Scroll to the bottom and verify Save is fully visible with breathing room.
await p.evaluate(() => { const s = document.querySelector('[role="dialog"] [class*="overflow-y-auto"]'); if (s) s.scrollTop = s.scrollHeight; });
await p.waitForTimeout(600);
await dlg.screenshot({ path: path.join(out, "edit-amount.png") }).catch(() => {});
const info = await p.evaluate(() => {
  const scroller = document.querySelector('[role="dialog"] [class*="overflow-y-auto"]');
  const save = document.querySelector('[data-testid="button-save-auto-invest-amount"]');
  const r = (el) => el ? { top: Math.round(el.getBoundingClientRect().top), bottom: Math.round(el.getBoundingClientRect().bottom), label: (el.textContent||"").trim().slice(0,18) } : null;
  return {
    overflows: scroller ? scroller.scrollHeight > scroller.clientHeight + 2 : null,
    scrollDelta: scroller ? scroller.scrollHeight - scroller.clientHeight : null,
    save: r(save),
    scrollerBottom: scroller ? Math.round(scroller.getBoundingClientRect().bottom) : null,
    gapBelowSave: (save && scroller) ? Math.round(scroller.getBoundingClientRect().bottom - save.getBoundingClientRect().bottom) : null,
  };
});
console.log("EDIT:", JSON.stringify(info));
await b.close();
