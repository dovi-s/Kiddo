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
await p.waitForTimeout(13000);

await p.getByTestId("chip-recurring-status").first().click().catch(() => console.log("no chip"));
await p.waitForTimeout(1200);
const payBtn = p.locator('[data-testid^="recurring-pay-now-"]').first();
await payBtn.scrollIntoViewIfNeeded().catch(() => {});
if (!(await payBtn.count())) console.log("no Add-it-now button");
await payBtn.click().catch(() => console.log("pay click failed"));
await p.waitForTimeout(1200);

const dlg = p.locator('[role="dialog"]').first();
if (await p.getByTestId("button-catchup-confirm").count()) {
  await dlg.screenshot({ path: path.join(out, "catchup-confirm.png") });
  console.log("-> catchup-confirm.png");
} else {
  console.log("no catch-up confirm dialog");
  await p.screenshot({ path: path.join(out, "catchup-confirm.png") }).catch(() => {});
}
await b.close();
