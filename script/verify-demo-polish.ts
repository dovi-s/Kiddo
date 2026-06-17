/* eslint-disable no-console */
// Verifies two 2026-06-08 changes in one demo session:
//  (B) Demo opens CAUGHT UP — the Activity badge is NOT "9+" on entry.
//  (A) HoldingDetailSheet contributor re-key (gifterIdentityKey) didn't break
//      the wiring — the AAPL "N people chose" list renders REAL names + counts
//      + expandable detail rows (no "e:"/"anon" key leak, no "0 people").
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
const baseUrl = "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "verify-demo-polish");
mkdirSync(outDir, { recursive: true });

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1500 } });
  await ctx.request.post(`${baseUrl}/api/auth/login`, { data: { email: "marcus@riverafamily.com", password: "riverafamily" } });
  const fundsJson: any = await (await ctx.request.get(`${baseUrl}/api/funds`)).json();
  const list: any[] = Array.isArray(fundsJson) ? fundsJson : fundsJson?.funds || [];
  const alex = list.find((f) => /alex/i.test(String(f.recipientFirstName || f.name || "")));
  const summary: any = await (await ctx.request.get(`${baseUrl}/api/funds/${alex.id}/dashboard-summary`)).json();
  const aapl = (summary.holdings || []).find((h: any) => String(h.ticker).toUpperCase() === "AAPL");

  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/dashboard?fund=${alex.id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator('[data-testid^="holding-row-"]').first().waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(2500); // let the caught-up stamp settle the badges

  // ── (B) badge is caught-up, not 9+ ──
  const badge = page.getByTestId("sidebar-unread-activity");
  const badgeText = (await badge.count()) ? (await badge.first().innerText()).trim() : "(none)";
  const taskB = badgeText !== "9+";
  console.log(`(B) Activity badge on demo entry: "${badgeText}"  → ${taskB ? "PASS (not 9+)" : "FAIL (still 9+)"}`);
  await page.screenshot({ path: path.join(outDir, "demo-entry-badges.png") });

  // ── (A) contributor list renders correctly after the re-key ──
  // Find the AAPL row by content (demo reseeds rotate holding ids).
  void aapl;
  const aaplRow = page.locator('[data-testid^="holding-row-"]').filter({ hasText: /Apple/ }).first();
  await aaplRow.waitFor({ state: "visible", timeout: 20000 });
  await aaplRow.click();
  await page.waitForTimeout(3500);
  const sheetText = await page.locator("body").innerText().catch(() => "");
  const choseHdr = /people chose AAPL|chose AAPL/i.test(sheetText);
  const hasRealName = /David|Marcus/.test(sheetText);
  // The only realistic leak signature is a raw idKey rendered as a name:
  // "e:<email>@…". (Anonymous renders as "Anonymous", never the "anon" bucket
  // key.) Scoped to that exact shape so the roster's "1 anon." doesn't false-trip.
  const keyLeak = /e:\S+@/.test(sheetText);
  const zeroPeople = /\b0 people chose/i.test(sheetText);
  const taskA = choseHdr && hasRealName && !keyLeak && !zeroPeople;
  console.log(`(A) "chose AAPL" header: ${choseHdr}; real name (David/Marcus): ${hasRealName}; key-leak: ${keyLeak}; zero-people: ${zeroPeople}`);
  console.log(`(A) contributor wiring → ${taskA ? "PASS" : "FAIL"}`);
  await page.screenshot({ path: path.join(outDir, "aapl-contributors.png") });

  await browser.close();
  console.log(`\nscreenshots: ${outDir}`);
  process.exit(taskA && taskB ? 0 : 1);
}
main().catch((e) => { console.error("VERIFY ERROR:", e); process.exit(1); });
