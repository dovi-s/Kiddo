/* eslint-disable no-console */
import { chromium } from "playwright";
const base = "http://127.0.0.1:5000";

async function main() {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1.5 });
  const p = await c.newPage();
  // hold the gift-page document ~2.5s so the loading state is visible
  await p.route("**/theo-rivera", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await p.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(2000);
  const btn = p.getByRole("button", { name: /Start the live demo: A private gift link/i }).first();
  const fig = await btn.evaluateHandle((el) => el.closest("figure"));
  await (fig.asElement()).scrollIntoViewIfNeeded();
  await p.waitForTimeout(600);
  await btn.click();
  await p.waitForTimeout(900); // mid-load -> spinner state
  const loadingTxt = await p.evaluate(() => /Waking the live demo/.test(document.body.innerText));
  console.log("loading-state spinner visible?", loadingTxt);
  await (fig.asElement()).screenshot({ path: "artifacts/audit/embed-loading-state.png" }).catch(() => {});
  await p.waitForTimeout(4000); // let it finish loading
  await (fig.asElement()).screenshot({ path: "artifacts/audit/embed-loaded-state.png" }).catch(() => {});
  console.log("captured loading + loaded");
  await b.close();
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
