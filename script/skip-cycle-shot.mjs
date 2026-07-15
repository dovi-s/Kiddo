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

// Expand recurring chip → open a schedule's action sheet.
await p.getByTestId("chip-recurring-status").first().click().catch(() => console.log("no chip"));
await p.waitForTimeout(1200);
const row = p.locator('[data-testid^="recurring-list-row-"]').first();
await row.scrollIntoViewIfNeeded().catch(() => {});
await row.click().catch(() => console.log("no row"));
await p.waitForTimeout(1200);

const sheet = p.locator('[role="dialog"]').first();
if (await p.getByTestId("list-action-skip").count()) {
  await sheet.screenshot({ path: path.join(out, "skip-actionsheet.png") });
  console.log("-> skip-actionsheet.png");

  // Read the "next" date shown before skipping (from the schedule row text).
  const before = await row.textContent().catch(() => "?");
  console.log("row before:", (before || "").replace(/\s+/g, " ").trim().slice(0, 120));

  // Skip it.
  await p.getByTestId("list-action-skip").click().catch(() => console.log("skip click failed"));
  await p.waitForTimeout(2500);
  // Re-open the chip/row to read the advanced next date.
  await p.getByTestId("chip-recurring-status").first().click().catch(() => {});
  await p.waitForTimeout(1000);
  const rowAfter = p.locator('[data-testid^="recurring-list-row-"]').first();
  const after = await rowAfter.textContent().catch(() => "?");
  console.log("row after: ", (after || "").replace(/\s+/g, " ").trim().slice(0, 120));
  await p.screenshot({ path: path.join(out, "skip-after.png"), clip: { x: 0, y: 120, width: 393, height: 460 } });
  console.log("-> skip-after.png");
} else {
  console.log("no skip button in action sheet");
  await sheet.screenshot({ path: path.join(out, "skip-actionsheet.png") }).catch(() => {});
}
await b.close();
