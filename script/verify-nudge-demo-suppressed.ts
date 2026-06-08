/* eslint-disable no-console */
// Verify the smart-nudge no longer fires on the demo (commit 85f770f).
// Loads Phil's Luke dashboard and waits past the 8s nudge timer, asserting
// no "Adjust recurring" toast appears. One-off; assumes dev server on :5000 +
// Dunphy seed. (A negative test by nature — the demo's isDemoAccount gate
// should suppress the nudge entirely; before the fix it fired up to 3x.)
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "verify-nudge");
mkdirSync(outDir, { recursive: true });

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.request.post(`${baseUrl}/api/auth/login`, {
    data: { email: "phil@dunphyfamily.com", password: "dunphyfamily" },
  });
  // Find Luke's fund.
  const fundsRes = await context.request.get(`${baseUrl}/api/funds`);
  const fundsJson: any = await fundsRes.json().catch(() => ({}));
  const list: any[] = Array.isArray(fundsJson) ? fundsJson : fundsJson?.funds || [];
  const luke = list.find((f) => /luke/i.test(String(f.recipientFirstName || f.name || "")));
  if (!luke) throw new Error(`Luke's fund not found (${list.length} funds)`);

  const page = await context.newPage();
  await page.goto(`${baseUrl}/dashboard?fund=${luke.id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  // The nudge timer is 8s after the dashboard settles. Wait well past it.
  console.log("waiting 13s past the nudge timer...");
  await page.waitForTimeout(13000);

  const bodyText = await page.locator("body").innerText().catch(() => "");
  const nudgeVisible =
    (await page.getByText(/Adjust recurring/i).count()) > 0 ||
    /up 71\.5%|fund is up .*%|every cycle|just crossed/i.test(bodyText);
  await page.screenshot({ path: path.join(outDir, "demo-dashboard-after-13s.png") });

  if (nudgeVisible) {
    console.error("FAIL: a smart-nudge / 'Adjust recurring' toast is visible on the demo");
    process.exitCode = 1;
  } else {
    console.log("PASS: no smart-nudge on the demo after 13s (suppressed)");
  }

  await browser.close();
  console.log(`screenshot: ${outDir}`);
}

main().catch((err) => { console.error("VERIFY SCRIPT ERROR:", err); process.exit(1); });
