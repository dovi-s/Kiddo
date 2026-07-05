/* eslint-disable no-console */
import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
async function measure(p, label) {
  const t0 = Date.now();
  await p.goto(base + "/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });
  // poll for a visible $-amount balance AND note when it appears
  let ms = null, bal = null;
  for (let i = 0; i < 30; i++) {
    const r = await p.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[data-testid="text-total-balance"]'));
      for (const el of els) {
        const vis = el.offsetParent !== null || getComputedStyle(el).display !== "none";
        const t = (el.textContent || "").trim();
        if (vis && /\$[\d,]+/.test(t)) return t;
      }
      return null;
    });
    if (r) { ms = Date.now() - t0; bal = r; break; }
    await p.waitForTimeout(500);
  }
  const cacheKeys = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("kiddo.dashboard.summary")));
  console.log(`${label}: balance=${JSON.stringify(bal)} in ${ms === null ? ">15000" : ms}ms | summary-cache keys: ${cacheKeys.length}`);
  return ms;
}
async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices["iPhone 14 Pro"] });
  const p = await ctx.newPage();
  await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
  await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
  await measure(p, "COLD (1st)");
  await p.goto(base + "/activity", { waitUntil: "domcontentloaded" }).catch(() => {});
  await p.waitForTimeout(800);
  await measure(p, "WARM (return)");
  await p.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  await measure(p, "WARM (reload)");
  await b.close();
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
