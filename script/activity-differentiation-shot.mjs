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
await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 30000 });
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/fund=/i, { timeout: 30000 }).catch(() => {});
const fund = (p.url().match(/fund=([a-f0-9-]+)/i) || [])[1];

// 1) Main feed — capture rows so recurring vs one-time labels are visible.
await p.goto(base + "/activity?fund=" + fund + "&tab=history", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(9000);
// Readable crop of the first stretch of rows (where contributions + gifts mix).
await p.screenshot({ path: path.join(out, "activity-feed-labels.png"), clip: { x: 0, y: 100, width: 393, height: 780 } });
console.log("-> activity-feed-labels.png");

// 2) Contributions modal ("What you've added") via the Activity deep-link.
await p.goto(base + "/activity?fund=" + fund + "&detail=contributions", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(9000);
const dlg = p.locator('[role="dialog"]').first();
if (await dlg.count()) {
  await dlg.screenshot({ path: path.join(out, "activity-contrib-modal.png") });
  console.log("-> activity-contrib-modal.png");
} else {
  console.log("no contributions modal");
}
await b.close();
