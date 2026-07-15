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
try {
  await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 });
} catch {
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 });
}
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/fund=/i, { timeout: 30000 }).catch(() => {});
const fund = (p.url().match(/fund=([a-f0-9-]+)/i) || [])[1];

await p.goto(base + "/staging?fund=" + fund, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(13000);

// The one-time card lives in the "Your part" LabCollapse (closed by default) — open it.
await p.evaluate(() => window.dispatchEvent(new CustomEvent("kiddo:lab-collapse-open", { detail: { key: "yourpart" } })));
await p.waitForTimeout(1500);

const btn = p.getByTestId("button-one-time-custom-amount-v2").first();
await btn.scrollIntoViewIfNeeded().catch(() => {});
if (!(await btn.count())) console.log("no custom-amount button (count 0)");
await btn.click().catch(() => console.log("custom-amount click failed"));
await p.waitForTimeout(2500);

const dlg = p.locator('[role="dialog"]').first();
if (await dlg.count()) {
  await dlg.screenshot({ path: path.join(out, "keypad-onetime.png") });
  console.log("-> keypad-onetime.png");
  const hasKeypad = await p.getByTestId("keypad-key-5").count();
  console.log("keypad present:", hasKeypad);
} else {
  console.log("no one-time dialog");
}
await b.close();
