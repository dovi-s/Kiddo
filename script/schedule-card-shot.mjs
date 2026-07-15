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
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/fund=/i, { timeout: 30000 }).catch(() => {});
const fund = (p.url().match(/fund=([a-f0-9-]+)/i) || [])[1];

await p.goto(base + "/activity?fund=" + fund + "&tab=scheduled", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(9000);

// Expand the first recurring-investment card (the real "$100/month · Fired 84 times").
const card = p.locator('[data-testid^="scheduled-contrib-"]').first();
await card.scrollIntoViewIfNeeded().catch(() => {});
const toggle = card.locator('[role="button"][aria-expanded]').first();
if (await toggle.getAttribute("aria-expanded") !== "true") {
  await toggle.click().catch(() => {});
  await p.waitForTimeout(1200);
}
await card.screenshot({ path: path.join(out, "schedule-card-facts.png") });
console.log("-> schedule-card-facts.png");
await b.close();
