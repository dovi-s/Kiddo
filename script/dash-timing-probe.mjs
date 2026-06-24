/* eslint-disable no-console */
import { chromium } from "playwright";
const base = "http://127.0.0.1:5000";
async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
  await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
  // Now on an authed page. Time the key endpoints with the session cookie.
  const endpoints = ["/api/dashboard-summary", "/api/funds"];
  // discover activeFundId for summary
  for (const ep of endpoints) {
    for (let i = 0; i < 2; i++) {
      const t = await p.evaluate(async (url) => {
        const t0 = performance.now();
        const r = await fetch(url, { credentials: "include" });
        await r.text();
        return { ms: Math.round(performance.now() - t0), status: r.status };
      }, ep);
      console.log(`${ep} run${i + 1}: ${t.ms}ms status=${t.status}`);
    }
  }
  // also time the summary for the active fund if the bare one 404s
  await b.close();
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
