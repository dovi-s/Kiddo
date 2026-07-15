import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "staging");
mkdirSync(out, { recursive: true });
const FUND = "f9446a97-8774-49dc-b618-006571f5dbe0";

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

await p.goto(base + `/staging?fund=${FUND}&openAutoInvest=1`, { waitUntil: "domcontentloaded" });
await p.getByTestId("input-auto-invest-amount").waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
await p.waitForTimeout(2500);
const dlg = p.locator('[role="dialog"]').first();
await dlg.getByText("$50", { exact: true }).first().click().catch(() => console.log("no $50 preset"));
await p.waitForTimeout(300);
await p.getByTestId("button-auto-invest-next-target").click().catch(() => console.log("no next-target"));
await p.waitForTimeout(500);
await p.getByTestId("button-auto-invest-next-bank").click().catch(() => console.log("no next-bank"));
await p.waitForTimeout(500);
await p.getByTestId("button-auto-invest-next-legal").click().catch(() => console.log("no next-legal"));
await p.waitForTimeout(500);
await p.getByTestId("button-save-auto-invest").click().catch(() => console.log("no save"));
await p.waitForTimeout(1500);
// Note step -> skip
await p.getByText("Skip for now", { exact: true }).click().catch(() => console.log("no skip"));
await p.waitForTimeout(1500);

// On the DONE success screen: assert NO demo conversion toast yet.
const onDone = await p.getByText(/is on\.|It's on\./).count();
const toastDuringSuccess = await p.getByText(/Start your own|for Theo 🌱|Won't save in the demo/i).count();
console.log("on DONE screen:", onDone, "| conversion toast during success (want 0):", toastDuringSuccess);
await p.screenshot({ path: path.join(out, "demo-recur-done.png"), clip: { x: 0, y: 0, width: 393, height: 500 } });

// Close the success screen -> the deferred toast should now fire.
await p.getByText("Done", { exact: true }).click().catch(() => console.log("no Done btn"));
await p.waitForTimeout(1600);
const toastAfterClose = await p.getByText(/Start your own|for Theo 🌱|Won't save in the demo/i).count();
console.log("conversion toast after close (want >=1):", toastAfterClose);
await p.screenshot({ path: path.join(out, "demo-recur-after.png"), clip: { x: 0, y: 0, width: 393, height: 220 } });
await b.close();
