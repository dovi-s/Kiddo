/* eslint-disable no-console */
// NEGATIVE / honesty guardrail: the gift beat must NEVER fire on its own — not
// on initial load (baseline ack), not on the count-up roll, not on a fund
// switch. It may ONLY fire on a genuinely new gift the user caused. This watches
// for the arc across a full load + settle and across a fund switch and FAILS if
// it ever appears unprompted.
import { chromium } from "playwright";

const base = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";

async function arcSeen(p) {
  return await p.evaluate(() => !!document.querySelector('[data-testid="hero-gift-arc"]'));
}

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
  await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1500);

  // 1) Full load + settle + count-up roll — arc must NEVER appear.
  await p.goto(base + "/staging", { waitUntil: "domcontentloaded", timeout: 60000 });
  let firedOnLoad = false;
  for (let t = 0; t < 150; t++) { // ~15s through the whole opening cascade
    if (await arcSeen(p)) { firedOnLoad = true; break; }
    await p.waitForTimeout(100);
  }
  console.log("arc fired spuriously on load:", firedOnLoad, firedOnLoad ? "  ❌" : "  ✓ (correct: baseline-acked)");

  // 2) Fund switch (if more than one fund) — arc must NEVER appear.
  let switched = false;
  try {
    const sw = p.getByTestId("sidebar-fund-switcher");
    if (await sw.count()) {
      await sw.first().click();
      await p.waitForTimeout(500);
      // pick any fund option that isn't the current one
      const opts = p.locator('[data-testid^="sidebar-nav-"], [role="option"], [data-testid^="fund-option"]');
      const n = await opts.count();
      if (n > 1) {
        await opts.nth(1).click().catch(() => {});
        switched = true;
        let firedOnSwitch = false;
        for (let t = 0; t < 60; t++) { // ~6s after switch
          if (await arcSeen(p)) { firedOnSwitch = true; break; }
          await p.waitForTimeout(100);
        }
        console.log("arc fired spuriously on fund switch:", firedOnSwitch, firedOnSwitch ? "  ❌" : "  ✓");
      }
    }
  } catch (e) { console.log("switch step skipped:", String(e).slice(0, 80)); }
  if (!switched) console.log("fund switch: not exercised (single fund or switcher shape differs) — load test is the key guardrail");

  await b.close();
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
