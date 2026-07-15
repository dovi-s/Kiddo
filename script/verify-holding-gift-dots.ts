/* eslint-disable no-console */
// Verify the gold gift-dots render correctly across ALL chart ranges on the
// HoldingDetailSheet (founder ask: "ensure 1D/1W/1M/1Y/ALL have the proper
// dots"). Opens Nora's AAPL holding, cycles each range, counts the gold
// ReferenceDot circles, and screenshots 1Y + ALL. Expectation: ALL shows the
// most (every gift), shorter ranges show only gifts inside that window
// (fewer / possibly zero) — that's correct, not a bug.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "verify-dots");
mkdirSync(outDir, { recursive: true });
const GOLD = "hsl(43, 75%, 55%)";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.request.post(`${baseUrl}/api/auth/login`, { data: { email: "marcus@riverafamily.com", password: "riverafamily" } });

  // Find Nora's fund + its AAPL holding id.
  const fundsJson: any = await (await context.request.get(`${baseUrl}/api/funds`)).json();
  const fundList: any[] = Array.isArray(fundsJson) ? fundsJson : fundsJson?.funds || [];
  const alex = fundList.find((f) => /alex/i.test(String(f.recipientFirstName || f.name || "")));
  if (!alex) throw new Error("Nora's fund not found");
  const summary: any = await (await context.request.get(`${baseUrl}/api/funds/${alex.id}/dashboard-summary`)).json();
  const aapl = (summary.holdings || []).find((h: any) => String(h.ticker).toUpperCase() === "AAPL");
  if (!aapl) throw new Error("AAPL holding not found on Nora's fund");
  console.log(`Nora fund ${alex.id}, AAPL holding ${aapl.id}\n`);

  const page = await context.newPage();
  await page.goto(`${baseUrl}/dashboard?fund=${alex.id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(9000); // let dashboard + holdings render

  const row = page.getByTestId(`holding-row-${aapl.id}`);
  await row.waitFor({ state: "visible", timeout: 20000 });
  await row.click();
  // Sheet + chart appear; wait for the default 1Y price fetch + render.
  await page.waitForTimeout(4000);

  const countGoldDots = async () => page.locator(`circle[fill="${GOLD}"]`).count();

  const ranges = ["1D", "1W", "1M", "1Y", "ALL"] as const;
  const results: Record<string, number> = {};
  for (const r of ranges) {
    await page.getByRole("button", { name: r, exact: true }).click().catch(async () => {
      // fallback: click by text within the sheet
      await page.locator(`button:has-text("${r}")`).first().click();
    });
    await page.waitForTimeout(3000); // price fetch + chart re-render
    results[r] = await countGoldDots();
    console.log(`${r}: ${results[r]} gold dot(s)`);
    if (r === "1Y" || r === "ALL") {
      await page.screenshot({ path: path.join(outDir, `aapl-${r}.png`) });
    }
  }

  // Sanity assertions (directional, not exact — demo prices/data vary):
  const ok =
    results["ALL"] >= 1 &&                          // ALL must show gifts
    results["ALL"] >= results["1Y"] &&              // ALL >= 1Y (superset window)
    results["1Y"] >= results["1M"] &&               // longer window >= shorter
    results["1M"] >= results["1W"];
  console.log(`\n${ok ? "PASS" : "FAIL"}: dot counts scale correctly by window (ALL>=1Y>=1M>=1W; ALL>=1).`);
  await browser.close();
  console.log(`screenshots: ${outDir}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error("VERIFY ERROR:", e); process.exit(1); });
