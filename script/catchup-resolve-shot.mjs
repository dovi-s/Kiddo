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
await p.getByTestId("chip-recurring-status").first().click().catch(() => {});
await p.waitForTimeout(1200);

const row = p.locator('[data-testid^="recurring-list-row-"]').first();
const before = ((await row.textContent().catch(() => "")) || "").replace(/\s+/g, " ").trim();
console.log("BEFORE:", before.slice(0, 160));
await p.screenshot({ path: path.join(out, "catchup-before.png"), clip: { x: 0, y: 120, width: 393, height: 420 } });

// Tap "Add it now" → confirm → Continue to payment.
await p.locator('[data-testid^="recurring-pay-now-"]').first().click().catch(() => console.log("no add-it-now"));
await p.waitForTimeout(1000);
await p.getByTestId("button-catchup-confirm").click().catch(() => console.log("no confirm btn"));
await p.waitForTimeout(2000);

// Re-open the section to read the resolved state.
await p.getByTestId("chip-recurring-status").first().click().catch(() => {});
await p.waitForTimeout(1200);
const rowAfter = p.locator('[data-testid^="recurring-list-row-"]').first();
const after = ((await rowAfter.textContent().catch(() => "")) || "").replace(/\s+/g, " ").trim();
console.log("AFTER: ", after.slice(0, 160));
console.log("has 'Charge missed' after:", after.includes("Charge missed"));
await p.screenshot({ path: path.join(out, "catchup-after.png"), clip: { x: 0, y: 120, width: 393, height: 420 } });
console.log("-> catchup-before.png / catchup-after.png");
await b.close();
