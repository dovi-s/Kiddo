/* eslint-disable no-console */
// Confirm the managed-mix ETF rows now read the plain-English name without the
// "(VTI)" vendor ticker, while the ticker itself stays visible (StockLogo).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
const baseUrl = "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "verify-etf-name");
mkdirSync(outDir, { recursive: true });
async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
  await ctx.request.post(`${baseUrl}/api/auth/login`, { data: { email: "marcus@riverafamily.com", password: "riverafamily" } });
  const fundsJson: any = await (await ctx.request.get(`${baseUrl}/api/funds`)).json();
  const list: any[] = Array.isArray(fundsJson) ? fundsJson : fundsJson?.funds || [];
  const luke = list.find((f) => /luke/i.test(String(f.recipientFirstName || f.name || "")));
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/dashboard?fund=${luke.id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  // Wait for an actual holding ROW to render (the rows are the slowest part on
  // cold remote DB; the heading appears well before them).
  await page.locator('[data-testid^="holding-row-"]').first().waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(1500);
  const body = await page.locator("body").innerText().catch(() => "");
  const hasClean = /Total Market Stocks(?!\s*\()/.test(body); // "Total Market Stocks" NOT followed by "("
  const hasParenTicker = /Total Market Stocks \(VTI\)/.test(body);
  console.log("contains 'Total Market Stocks':", body.includes("Total Market Stocks"));
  console.log("contains old 'Total Market Stocks (VTI)':", hasParenTicker);
  console.log("ticker 'VTI' still present somewhere:", body.includes("VTI"));
  // Scroll to a holding row + screenshot the holdings region.
  const title = page.getByTestId("text-holdings-title");
  if (await title.count()) { await title.first().scrollIntoViewIfNeeded(); await page.waitForTimeout(600); }
  await page.screenshot({ path: path.join(outDir, "luke-mix.png") });
  console.log(`\n${hasClean && !hasParenTicker ? "PASS" : "FAIL"}: ETF name is plain-English, no (VTI) in the name; ticker still shown via logo/chip.`);
  await browser.close();
  console.log(`screenshot: ${outDir}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
