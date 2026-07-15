/* eslint-disable no-console */
// Verify the "while you were away" digest survives fund switching: it must
// appear on the landing fund, appear again when you switch to another kid, and
// REAPPEAR when you switch back (per-fund, persist-until-dismissed — same model
// as the co-parent banner). Regression target: the reveal latch could strand
// hidden when a roll armed but never started, so a fund showed no digest (Nora)
// or lost it on switch-back (Theo). The HERO_REVEAL_SAFETY_NET guarantees it.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "verify-digest-switch");
mkdirSync(outDir, { recursive: true });
const DIGEST = '[data-testid="since-last-visit-digest"]';

// Poll up to ~9s for the digest to become visible (the cascade + the safety net
// both resolve well inside this), returning the ms-to-visible or null.
async function waitForDigest(page: any, label: string): Promise<number | null> {
  const t0 = Date.now();
  for (let i = 0; i < 160; i++) {
    const vis = await page.locator(DIGEST).first().isVisible().catch(() => false);
    if (vis) {
      const ms = Date.now() - t0;
      const text = (await page.locator(DIGEST).first().innerText().catch(() => "")).replace(/\s+/g, " ").trim();
      console.log(`  [${label}] digest VISIBLE at t+${ms}ms: "${text.slice(0, 90)}"`);
      return ms;
    }
    await page.waitForTimeout(100);
  }
  console.log(`  [${label}] digest NEVER appeared within 16s`);
  return null;
}

// Switch the way a user does — click the FundTabs pill. This routes through
// Dashboard's selectFund (state + localStorage + event + URL ?fund=), unlike a
// raw event dispatch which leaves the URL stale and lets the URL-sync snap back.
async function switchToFund(page: any, id: string, name: string) {
  const tab = page.locator(`[data-testid="fund-tab-${id}"]`);
  if (await tab.count() === 0) {
    console.log(`  (no fund-tab pill for ${name}; falling back to ?fund= nav)`);
    await page.goto(`${baseUrl}/design-lab?fund=${id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    return;
  }
  await tab.first().click();
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
  await ctx.request.get(`${baseUrl}/api/health`, { timeout: 120000 }).catch(() => {});
  const login = await ctx.request.post(`${baseUrl}/api/auth/login`, {
    data: { email: "elena@riverafamily.com", password: "riverafamily" }, timeout: 120000,
  });
  console.log(`login HTTP ${login.status()}`);
  if (login.status() !== 200) { console.log("rate-limited — stopping"); await browser.close(); return; }

  const funds = (await ctx.request.get(`${baseUrl}/api/funds`, { timeout: 120000 }).then((r) => r.json())) as any[];
  const byName = (re: RegExp) => funds.find((f) => re.test(f?.recipientFirstName || ""));
  const luke = byName(/luke/i), alex = byName(/alex/i);
  if (!luke || !alex) { console.log(`missing funds (luke=${!!luke} alex=${!!alex})`); await browser.close(); return; }
  console.log(`luke=${luke.id}  alex=${alex.id}`);

  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);

  // Warm up: first cold hit compiles the /design-lab chunks in dev (Vite), which
  // can take 10s+ and would pollute the land timing. Load once, discard.
  console.log("(warming up dev bundle…)");
  await page.goto(`${baseUrl}/design-lab?fund=${luke.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector(DIGEST, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(500);

  // Land on Theo explicitly via ?fund= so the first paint is deterministic.
  await page.goto(`${baseUrl}/design-lab?fund=${luke.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(800);

  console.log("\n1) LAND on Theo:");
  const land = await waitForDigest(page, "Theo land");
  await page.screenshot({ path: path.join(outDir, "1-luke-land.png") });

  console.log("\n2) SWITCH to Nora:");
  await switchToFund(page, alex.id, "Nora");
  const alexShow = await waitForDigest(page, "Nora");
  await page.screenshot({ path: path.join(outDir, "2-alex.png") });

  console.log("\n3) SWITCH BACK to Theo:");
  await switchToFund(page, luke.id, "Theo");
  const lukeBack = await waitForDigest(page, "Theo back");
  await page.screenshot({ path: path.join(outDir, "3-luke-back.png") });

  // --- Dead-zone fix: dismissing the co-parent banner must release the digest.
  // On Nora the co-parent celebration shows and the digest yields (correct).
  // But dismiss persists only in localStorage while the server signal lives 30d,
  // so the digest must yield only WHILE the banner shows — once dismissed, the
  // recap returns instead of leaving a "neither card" dead zone.
  const COPARENT = '[data-testid="coparent-accepted-banner"]';
  const COPARENT_X = '[data-testid="coparent-accepted-dismiss"]';
  console.log("\n4) On Nora: co-parent banner present, digest yields:");
  await switchToFund(page, alex.id, "Nora");
  await page.waitForSelector(COPARENT, { timeout: 16000 }).catch(() => {});
  const coparentShown = await page.locator(COPARENT).first().isVisible().catch(() => false);
  const digestYielded = !(await page.locator(DIGEST).first().isVisible().catch(() => false));
  console.log(`  co-parent banner shown: ${coparentShown} | digest yielded (absent): ${digestYielded}`);

  let digestAfterDismiss: number | null = null;
  if (coparentShown) {
    console.log("5) Dismiss the co-parent banner, reload Nora:");
    await page.locator(COPARENT_X).first().click().catch(() => {});
    await page.waitForTimeout(900); // let the collapse finish so dismiss persists (onExitComplete)
    await page.goto(`${baseUrl}/design-lab?fund=${alex.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(800);
    digestAfterDismiss = await waitForDigest(page, "Nora after dismiss");
    await page.screenshot({ path: path.join(outDir, "4-alex-after-dismiss.png") });
  }

  console.log("\n=== RESULT ===");
  const switchOk = land != null && lukeBack != null;
  const yieldOk = coparentShown && digestYielded;
  const deadZoneClosed = digestAfterDismiss != null;
  console.log(`Theo land:                 ${land != null ? `OK (${land}ms)` : "FAIL"}`);
  console.log(`Theo return (switch-back): ${lukeBack != null ? `OK (${lukeBack}ms)` : "FAIL"}`);
  console.log(`Nora yields to co-parent:  ${yieldOk ? "OK" : "FAIL"}`);
  console.log(`Digest returns post-dismiss: ${deadZoneClosed ? `OK (${digestAfterDismiss}ms)` : "FAIL — DEAD ZONE"}`);
  const pass = switchOk && yieldOk && deadZoneClosed;
  console.log(pass
    ? "\nPASS — per-fund, survives switching, yields only WHILE the banner shows."
    : "\nFAIL — see above.");
  await browser.close();
  console.log(`screenshots: ${outDir}`);
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
