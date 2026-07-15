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

// Pull a real holding ticker from the fund so the deep-link points at something real.
const summary = await p.evaluate((fund) =>
  fetch(`/api/funds/${fund}/dashboard-summary`, { credentials: "include" }).then((r) => r.json()).catch(() => null),
  fund,
);
const holdings = summary?.holdings || [];
const ticker = String(holdings[0]?.ticker || "AAPL").toUpperCase();
console.log("fund:", fund, "ticker:", ticker, "holdingCount:", holdings.length);

// Deep-link exactly as Activity's "View holding →" now does.
await p.goto(base + `/dashboard?fund=${fund}&section=holdings&holding=${encodeURIComponent(ticker)}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(13000);

const dlg = p.locator('[role="dialog"]').first();
const open = await dlg.count();
console.log("sheet open:", open);
if (open) {
  await dlg.screenshot({ path: path.join(out, "holding-deeplink-sheet.png") });
  console.log("-> holding-deeplink-sheet.png");
} else {
  await p.screenshot({ path: path.join(out, "holding-deeplink-fullpage.png"), fullPage: true });
  console.log("-> holding-deeplink-fullpage.png (no sheet)");
}
await b.close();
