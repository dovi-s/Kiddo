import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "staging");
mkdirSync(out, { recursive: true });
const MIA = "e63f4477-6e47-413f-a3e7-508bda1d4f0d";

const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
async function login() {
  await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
  await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 });
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/fund=|dashboard/i, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(2500);
}
await login();
for (let i = 0; i < 3 && /\/login/.test(p.url()); i++) await login();

// Preseed the active fund to Mia so /staging resolves straight to her.
await p.evaluate((id) => localStorage.setItem("kiddo_active_fund_id", id), MIA);
await p.goto(base + `/staging?fund=${MIA}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(4000);
// If not on Mia yet, switch via the header.
await p.getByTestId("header-fund-name").click().catch(() => {});
await p.waitForTimeout(600);
await p.getByRole("option").filter({ hasText: /Mia/ }).first().click().catch(() => {});
await p.waitForTimeout(5000);

const label = await p.locator('.ch-label').first().textContent().catch(() => "");
const balance = await p.locator('.ch-balance').first().textContent().catch(() => "");
const hasCurve = await p.getByTestId("hero-keepsake-curve").count();
const caption = await p.locator('.ch-keepsake-cap').first().textContent().catch(() => "");
const badge = await p.getByTestId("badge-shared-fund").first().textContent().catch(() => "");
console.log(JSON.stringify({ label, balance, hasCurve, caption, badge }, null, 1));

const hero = p.getByTestId("hero-card").first();
if (await hero.count()) {
  const box = await hero.boundingBox().catch(() => null);
  await p.screenshot({ path: path.join(out, "keepsake-curve.png"), clip: box ? { x: 0, y: 0, width: 393, height: Math.min(760, Math.ceil(box.y + box.height + 40)) } : undefined });
} else {
  await p.screenshot({ path: path.join(out, "keepsake-curve.png") });
}
console.log("-> keepsake-curve.png");
await b.close();
