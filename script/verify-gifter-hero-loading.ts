/* eslint-disable no-console */
// One-off capture of the gifter-hero first-paint loading state: with no
// localStorage cache and the dashboard API artificially delayed, the stats
// row should show quiet pulse blocks (never "$0.00 / 0 / 0"), then the real
// numbers once data lands.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "verify-gifter-hero");
mkdirSync(outDir, { recursive: true });

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const login = await context.request.post(`${baseUrl}/api/auth/login`, {
    data: { email: "robert@riverafamily.com", password: "riverafamily" },
  });
  if (login.status() !== 200) throw new Error(`login failed: ${login.status()}`);

  const page = await context.newPage();
  // Hold the dashboard payload for 4s so the loading state is capturable.
  await page.route("**/api/gifter-account/dashboard", async (route) => {
    await new Promise((r) => setTimeout(r, 4000));
    await route.continue();
  });
  await page.goto(`${baseUrl}/gifter`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.getByTestId("gifter-hero").waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(800); // hero entrance settles; API still held

  const heroText = await page.getByTestId("gifter-hero").innerText();
  await page.getByTestId("gifter-hero").screenshot({ path: path.join(outDir, "hero-loading.png") });
  if (/\$0\.00/.test(heroText)) {
    console.error("FAIL: hero shows $0.00 while loading");
    process.exitCode = 1;
  } else {
    console.log("PASS: no $0.00 during load (pulse placeholders)");
  }

  // Let the data land (4s hold + remote-DB endpoint latency); numbers should appear.
  await page.waitForTimeout(12000);
  const settled = await page.getByTestId("gifter-hero").innerText();
  await page.getByTestId("gifter-hero").screenshot({ path: path.join(outDir, "hero-settled.png") });
  if (/\$[1-9]/.test(settled)) console.log("PASS: real totals after data lands");
  else { console.error(`FAIL: no real totals after load: ${settled.slice(0, 120)}`); process.exitCode = 1; }

  await browser.close();
  console.log(`Screenshots: ${outDir}`);
}

main().catch((err) => { console.error("VERIFY SCRIPT ERROR:", err); process.exit(1); });
