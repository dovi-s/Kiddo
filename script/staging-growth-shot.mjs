/* eslint-disable no-console */
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });
async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
  await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
  await p.goto(base + "/staging", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(9000); // reveal cascade
  // expand the growth section
  const growth = p.getByText(/'s growth$|^Growth$/).first();
  await growth.scrollIntoViewIfNeeded().catch(() => {});
  await growth.click().catch((e) => console.log("click failed:", String(e).slice(0, 60)));
  await p.waitForTimeout(3500); // collapse open + chart lazy-load + draw-in
  // find the recharts svg and screenshot its card region
  const svg = p.locator("svg.recharts-surface").first();
  if (await svg.count()) {
    await svg.scrollIntoViewIfNeeded().catch(() => {});
    await p.waitForTimeout(800);
    // screenshot a region around the chart (the chart's nearest card)
    const box = await svg.boundingBox();
    if (box) {
      await p.screenshot({ path: path.join(out, "staging-costbasis.png"), clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 60), width: Math.min(1280, box.width + 40), height: box.height + 120 } });
      console.log("chart shot saved; svg box:", JSON.stringify(box));
    }
  } else {
    console.log("no recharts svg found (chart may not have opened)");
    await p.screenshot({ path: path.join(out, "staging-costbasis.png") });
  }
  await b.close();
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
