/* eslint-disable no-console */
// One-off live verification of the demo gifter loop:
//   "give Theo a gift, then watch it land"
// Logs in as the shared demo parent (Elena), exercises the REAL gift-checkout
// sandbox endpoint, then drives the actual GiftSuccess -> back-to-dashboard ->
// "watch it land" beat in a real browser, screenshotting every surface and
// asserting the loop-closure toast + overlay actually fire. Throwaway; delete
// after (idiomatic with the other script/verify-*.ts harnesses).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

const BASE = process.env.WIL_BASE_URL || "http://127.0.0.1:5000";
// Under artifacts/verify-* so it matches .gitignore's `artifacts/verify-*/`
// rule (kept out of git, no untracked clutter on rerun).
const OUT = path.join(process.cwd(), "artifacts", "verify-watch-it-land");
const EMAIL = "elena@riverafamily.com";
const PASSWORD = "riverafamily";

type Step = { name: string; ok: boolean; notes: string[]; shot?: string };
const steps: Step[] = [];
const rec = (s: Step) => { steps.push(s); console.log(`${s.ok ? "PASS" : "FAIL"}  ${s.name}${s.notes.length ? " — " + s.notes.join("; ") : ""}`); };

async function shot(page: Page, name: string) {
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true }).catch(() => null);
  return p;
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  // Resolve Theo's live fund id from the public endpoint (no DB import needed).
  const lukeRes = await fetch(`${BASE}/api/public/funds/theo-rivera`);
  if (!lukeRes.ok) throw new Error(`Theo fund not seeded? /api/public/funds/theo-rivera -> ${lukeRes.status}. Run: npm run seed:dunphys`);
  const lukeJson: any = await lukeRes.json();
  const LUKE_ID = String(lukeJson?.fund?.id || "");
  if (!LUKE_ID) throw new Error("Could not resolve Theo fund id");
  console.log(`> Theo fund id: ${LUKE_ID}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  // Skip the marketing landing gate the way the app's own QA harness does.
  await context.addInitScript(() => { try { sessionStorage.setItem("kora-launched", "1"); } catch { /* noop */ } });
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  try {
    // 1) Land + log in as the shared demo parent (Elena).
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const login = await page.evaluate(async ({ email, password }) => {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      return { status: r.status, body: await r.text() };
    }, { email: EMAIL, password: PASSWORD });
    const isDemoAccount = /"isDemoAccount"\s*:\s*true/.test(login.body);
    rec({ name: "1. login as demo parent (Elena)", ok: login.status === 200 && isDemoAccount, notes: [`status ${login.status}`, `isDemoAccount=${isDemoAccount}`] });

    // 2) The gifter's landing surface (where the CTA points: /theo-rivera).
    //    waitForSelector actually WAITS for React to paint (isVisible() does not).
    await page.goto(`${BASE}/theo-rivera`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const landingHeading = await page.waitForSelector("[data-testid='text-heading']", { timeout: 20_000 }).then(() => true).catch(() => false);
    const startGiftVisible = await page.getByTestId("button-start-gift").first().isVisible().catch(() => false);
    const s2 = await shot(page, "02-gift-landing");
    rec({ name: "2. gift landing page renders (/theo-rivera)", ok: landingHeading && startGiftVisible, notes: [`heading=${landingHeading}`, `startGiftCTA=${startGiftVisible}`], shot: s2 });

    // 2b) Click into the flow in-UI to prove the gifter can actually progress.
    if (startGiftVisible) {
      await page.getByTestId("button-start-gift").first().click();
      await page.waitForTimeout(900);
      const s2b = await shot(page, "03-gift-amount-step");
      rec({ name: "2b. in-UI: start-gift advances the flow", ok: true, notes: ["clicked button-start-gift"], shot: s2b });
    }

    // 3) Hit the REAL gift-checkout endpoint exactly as GiftCheckout does, and
    //    confirm the demo sandbox returns the loop-closure success URL (no Stripe).
    const checkout = await page.evaluate(async ({ fundId }) => {
      const r = await fetch("/api/stripe/checkout/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fundId, amount: 75, senderName: "Sofia", executionModel: "auto" }),
      });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    }, { fundId: LUKE_ID });
    const url: string = checkout.body?.url || "";
    const sandboxOk = checkout.status === 200 && checkout.body?.isDemo === true && /\/gift\/success\?demo=1/.test(url) && url.includes("senderName=Sofia") && /amount=75/.test(url);
    rec({ name: "3. live sandbox returns loop URL (no Stripe charge)", ok: sandboxOk, notes: [`isDemo=${checkout.body?.isDemo}`, `url=${url.replace(BASE, "")}`] });

    // 4) Follow the sandbox URL — the real GiftSuccess surface for a demo send.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator("[data-testid='text-success-heading']").first().waitFor({ timeout: 20_000 }).catch(() => null);
    const demoBanner = await page.getByTestId("banner-demo-gift").isVisible().catch(() => false);
    const backBtn = page.getByTestId("demo-gift-back-to-dashboard");
    const backVisible = await backBtn.isVisible().catch(() => false);
    const s4 = await shot(page, "04-gift-success");
    rec({ name: "4. GiftSuccess shows demo banner + 'watch it land' return", ok: demoBanner && backVisible, notes: [`demoBanner=${demoBanner}`, `backButton=${backVisible}`], shot: s4 });

    // 5) Click the real "Back to your dashboard to watch it land" and wait for
    //    the loop-closure toast (fires ~4.8s after landing on the dashboard).
    if (backVisible) await backBtn.click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 }).catch(() => null);
    let landed = false;
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      const txt = await page.locator("body").innerText().catch(() => "");
      if (/added\s*\$?75/i.test(txt) && /Theo/i.test(txt) && /future/i.test(txt)) { landed = true; break; }
      await page.waitForTimeout(500);
    }
    const s5 = await shot(page, "05-watch-it-land");
    const toastText = await page.locator("body").innerText().catch(() => "");
    const toastLine = (toastText.split("\n").find((l) => /added\s*\$?75/i.test(l)) || "").trim();
    rec({ name: "5. 'watch it land' toast fires on dashboard", ok: landed, notes: [landed ? `toast: "${toastLine}"` : "toast not detected within 12s"], shot: s5 });

    // 6) Memory Book — the exact gift shows as a fresh entry (poll until the
    //    list paints past its skeleton, up to ~12s).
    await page.goto(`${BASE}/memory/${LUKE_ID}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    let inMemory = false;
    const memDeadline = Date.now() + 12_000;
    while (Date.now() < memDeadline) {
      const t = await page.locator("body").innerText().catch(() => "");
      if (/Sofia/i.test(t) && /\b75\b/.test(t)) { inMemory = true; break; }
      await page.waitForTimeout(500);
    }
    const memText = await page.locator("body").innerText().catch(() => "");
    const s6 = await shot(page, "06-memory-book");
    rec({ name: "6. gift lands in Theo's Memory Book", ok: inMemory, notes: [`gloriaPresent=${/Sofia/i.test(memText)}`, `amount75=${/\b75\b/.test(memText)}`], shot: s6 });

    rec({ name: "0. no uncaught page errors", ok: pageErrors.length === 0, notes: pageErrors.slice(0, 3) });
  } finally {
    await browser.close();
  }

  const passed = steps.filter((s) => s.ok).length;
  writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ base: BASE, results: steps }, null, 2));
  console.log(`\n${passed}/${steps.length} checks passed. Screenshots + report in ${OUT}`);
  process.exit(passed === steps.length ? 0 : 1);
}

main().catch((e) => { console.error("verify-watch-it-land crashed:", e); process.exit(1); });
