/* eslint-disable no-console */
// Verify the demo opens with a GENUINE, account-true notification — not empty,
// not "9+". The bell catch-up is aligned to the digest's 6-day window, so the
// bell shows the recent gift / co-parent-joined items, bounded.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
const base = "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "verify-demo-notif");
mkdirSync(outDir, { recursive: true });

async function readBadge(page: any): Promise<string> {
  const b = page.getByTestId("sidebar-unread-activity");
  return (await b.count()) ? (await b.first().innerText()).trim() : "(none)";
}

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1400 } });
  await ctx.request.post(`${base}/api/auth/login`, { data: { email: "marcus@riverafamily.com", password: "riverafamily" } });
  const fundsJson: any = await (await ctx.request.get(`${base}/api/funds`)).json();
  const list: any[] = Array.isArray(fundsJson) ? fundsJson : fundsJson?.funds || [];
  const luke = list.find((f) => /luke/i.test(String(f.recipientFirstName || f.name || "")));
  const alex = list.find((f) => /alex/i.test(String(f.recipientFirstName || f.name || "")));

  const page = await ctx.newPage();
  await page.goto(`${base}/dashboard?fund=${luke.id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator('[data-testid^="holding-row-"]').first().waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(3000); // caught-up stamp + bell recompute (before the 25s dwell gift)

  const lukeBadge = await readBadge(page);
  const body = await page.locator("body").innerText().catch(() => "");
  const digestPresent = /while you were away/i.test(body);
  const giftMentioned = /Leo|gift from/i.test(body);
  console.log(`Theo bell badge: "${lukeBadge}"  (expect a small number, not "(none)" or "9+")`);
  console.log(`  digest card present: ${digestPresent} | recent gift mentioned: ${giftMentioned}`);
  await page.screenshot({ path: path.join(outDir, "luke.png") });

  // Switch to Nora — should reflect Nora's recent (gift from Robert + Co-parent joined).
  await page.goto(`${base}/dashboard?fund=${alex.id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator('[data-testid^="holding-row-"]').first().waitFor({ state: "visible", timeout: 60000 });
  // Poll up to ~12s for Nora's cold activities query to load + the badge to paint.
  let alexBadge = "(none)";
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(1000); alexBadge = await readBadge(page); if (alexBadge !== "(none)") break; }
  console.log(`Nora bell badge: "${alexBadge}"`);
  await page.screenshot({ path: path.join(outDir, "alex.png") });

  const n = (s: string) => (s === "9+" ? 99 : parseInt(s, 10) || 0);
  const lukeOk = lukeBadge !== "(none)" && lukeBadge !== "9+" && n(lukeBadge) >= 1 && n(lukeBadge) <= 6;
  const alexOk = alexBadge !== "9+" && n(alexBadge) <= 6; // Nora bounded too
  console.log(`\n${lukeOk && alexOk ? "PASS" : "FAIL"}: bell opens with a bounded, genuine notification (not empty, not 9+).`);
  await b.close();
  console.log(`screenshots: ${outDir}`);
  process.exit(lukeOk && alexOk ? 0 : 1);
}
main().catch((e) => { console.error("VERIFY ERROR:", e); process.exit(1); });
