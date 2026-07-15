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

await p.goto(base + "/activity?fund=" + fund + "&tab=pending", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(9000);
await p.screenshot({ path: path.join(out, "pending-empty-failure.png"), clip: { x: 0, y: 120, width: 393, height: 620 } });
console.log("-> pending-empty-failure.png");
await b.close();
