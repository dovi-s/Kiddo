/* eslint-disable no-console */
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });
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
  await p.goto(base + "/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });
  // wait for content to settle (balance paints, then a beat)
  await p.waitForFunction(() => !!document.querySelector('[data-testid="text-total-balance"]'), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(2500);
  const positions = [0, 780, 1560, 2340, 3120];
  for (let i = 0; i < positions.length; i++) {
    await p.evaluate((y) => window.scrollTo(0, y), positions[i]);
    await p.waitForTimeout(700);
    await p.screenshot({ path: path.join(out, `mobile-sec-${i}.png`) });
  }
  console.log("-> mobile section shots (0-4)");
  await b.close();
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
