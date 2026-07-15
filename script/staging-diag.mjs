/* eslint-disable no-console */
import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"] })).newPage();
const failed = [];
p.on("response", (r) => { if (r.status() >= 400) failed.push(r.status() + " " + r.url().slice(-60)); });
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(1500);
const fund = (p.url().match(/fund=([a-f0-9-]+)/i) || [])[1];
console.log("post-login url:", p.url());
await p.goto(base + "/staging" + (fund ? `?fund=${fund}` : ""), { waitUntil: "domcontentloaded" });
for (const t of [4000, 9000, 16000]) {
  await p.waitForTimeout(t === 4000 ? 4000 : t - (t === 9000 ? 4000 : 9000));
  const hero = await p.locator('[data-testid="hero-card"]').count();
  const bal = await p.locator('[data-testid="text-total-balance"]').count();
  const skel = await p.locator('[data-testid="hero-loading-skeleton"], .animate-pulse').count();
  console.log(`@${t}ms  url=${p.url().slice(-40)}  hero-card=${hero}  balance=${bal}  pulse/skel=${skel}`);
}
const balText = await p.locator('[data-testid="text-total-balance"]').first().textContent().catch(() => null);
console.log("balance text:", balText);
console.log("failed requests:", failed.length ? [...new Set(failed)].slice(0, 8) : "none");
await b.close();
