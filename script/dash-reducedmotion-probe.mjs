/* eslint-disable no-console */
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });
async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
  await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
  await p.goto(base + "/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let s = 1; s <= 14; s++) {
    await p.waitForTimeout(1000);
    const info = await p.evaluate(() => {
      const bal = document.querySelector('[data-testid="text-total-balance"]');
      const pulsing = document.querySelectorAll('.animate-pulse').length;
      // detect whether any animate-pulse is actually animating (computed)
      let activeAnim = 0;
      document.querySelectorAll('.animate-pulse').forEach((el) => {
        const a = getComputedStyle(el).animationName;
        if (a && a !== 'none') activeAnim++;
      });
      return { balance: bal ? bal.textContent.trim() : null, pulseEls: pulsing, activeAnim };
    });
    console.log(`t=${s}s balance=${JSON.stringify(info.balance)} animate-pulse_els=${info.pulseEls} actuallyAnimating=${info.activeAnim}`);
  }
  await p.screenshot({ path: path.join(out, "dashboard.reducedmotion.png"), fullPage: true });
  await b.close();
  console.log("-> saved reduced-motion shot");
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
