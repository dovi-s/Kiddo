/* eslint-disable no-console */
// Render smoke for the banner-hold gate: load the dashboard, confirm the hero
// still renders with no page errors (the fragment wrap is valid at runtime),
// and screenshot the settled state. Throwaway.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.WIL_BASE_URL || "http://127.0.0.1:5000";
const ALEX = "41562560-4581-4971-bfbb-3cec4534ca24";
// Under artifacts/verify-* so it matches .gitignore's `artifacts/verify-*/` rule.
const OUT = path.join(process.cwd(), "artifacts", "verify-banner-gate");

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
  await context.addInitScript(() => { try { sessionStorage.setItem("kora-launched", "1"); } catch { /* noop */ } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/401|Unauthorized/.test(m.text())) errors.push(m.text()); });
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ email: "claire@dunphyfamily.com", password: "dunphyfamily" }) });
    });
    // Warm the cache so dashboard-summary is instantly available on the next
    // load — then the ONLY thing delaying the gated CoparentAcceptedBanner
    // ("Phil accepted your invite") is the ~1.3s hold itself.
    await page.goto(`${BASE}/dashboard?fund=${ALEX}`, { waitUntil: "domcontentloaded" });
    const banner = () => page.getByText(/accepted your invite/i).first();
    await banner().waitFor({ timeout: 20_000 }).catch(() => null);

    // Warm reload: measure WHEN the gated banner appears relative to mount.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='text-total-balance']", { state: "attached", timeout: 20_000 });
    const t0 = Date.now();
    let firstVisible = -1;
    let visibleAt500 = false;
    while (Date.now() - t0 < 4000) {
      const vis = await banner().isVisible().catch(() => false);
      const dt = Date.now() - t0;
      if (vis && firstVisible < 0) firstVisible = dt;
      if (dt < 600) visibleAt500 = visibleAt500 || vis;
      if (firstVisible >= 0 && dt > firstVisible + 300) break;
      await page.waitForTimeout(50);
    }
    await page.screenshot({ path: path.join(OUT, "dashboard-settled.png"), fullPage: true }).catch(() => null);

    const heldNotInstant = !visibleAt500 && firstVisible >= 1000;
    const didAppear = firstVisible >= 0 && firstVisible <= 2600;
    console.log(`gated banner: visibleAt~500ms=${visibleAt500}  firstVisibleAt=${firstVisible}ms  pageErrors=${errors.length}`);
    if (errors.length) console.log("  errors: " + errors.slice(0, 4).join(" | "));
    const ok = heldNotInstant && didAppear && errors.length === 0;
    console.log(`\n${ok ? "PASS" : "FAIL"} — banner held until the hero roll settled, then revealed (~1.3s). Screenshot in ${OUT}`);
    process.exit(ok ? 0 : 1);
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });
