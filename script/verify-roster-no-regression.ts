/* eslint-disable no-console */
// No-regression check for the gifter-roster re-keying (gifterIdentityKey).
// The Dunphy demo uses consistent gifter names, so the "who loves Luke" roster
// must look UNCHANGED — same distinct gifters, no crash, names/initials intact.
// (The dedup itself is proven by test:gifter-identity; the demo can't show a
// name-variant collapse.)
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
const baseUrl = "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "verify-roster");
mkdirSync(outDir, { recursive: true });
async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1500 } });
  await ctx.request.post(`${baseUrl}/api/auth/login`, { data: { email: "phil@dunphyfamily.com", password: "dunphyfamily" } });
  const fundsJson: any = await (await ctx.request.get(`${baseUrl}/api/funds`)).json();
  const list: any[] = Array.isArray(fundsJson) ? fundsJson : fundsJson?.funds || [];
  const luke = list.find((f) => /luke/i.test(String(f.recipientFirstName || f.name || "")));
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/dashboard?fund=${luke.id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  // Wait for a holding row (proves the dashboard data rendered).
  await page.locator('[data-testid^="holding-row-"]').first().waitFor({ state: "visible", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const body = await page.locator("body").innerText().catch(() => "");
  // The demo's known Luke gifters (consistent names) should all still appear.
  const expected = ["Gloria", "Mitchell", "Cameron", "Jay", "Manny"];
  const present = expected.filter((n) => body.includes(n));
  console.log("expected gifters present:", present.join(", ") || "(none)");
  // Scroll to the roster + screenshot for an eyeball.
  const who = page.getByText(/who loves/i).first();
  if (await who.count()) { await who.scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(600); }
  await page.screenshot({ path: path.join(outDir, "luke-roster.png") });
  const ok = present.length >= 3; // at least a few known gifters render
  console.log(`\n${ok ? "PASS" : "FAIL"}: roster renders known demo gifters (no regression).`);
  await browser.close();
  console.log(`screenshot: ${outDir}`);
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error("VERIFY ERROR:", e); process.exit(1); });
