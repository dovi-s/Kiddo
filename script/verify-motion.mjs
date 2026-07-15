/* eslint-disable no-console */
import { chromium } from "playwright";
const base = "http://127.0.0.1:5000";

async function main() {
  const b = await chromium.launch();
  // Desktop showcase (BrowserFrame + digest accent)
  const d = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const dp = await d.newPage();
  const errs = [];
  dp.on("requestfailed", (r) => { if (/\/product\//.test(r.url())) errs.push("IMG FAIL " + r.url()); });
  await dp.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await dp.waitForTimeout(2500);
  // find the browser-frame showcase: the section whose text mentions "in one place"
  const showcase = await dp.locator("section", { hasText: "Everything the family builds" }).first();
  await showcase.scrollIntoViewIfNeeded();
  await dp.waitForTimeout(1200);
  await showcase.screenshot({ path: "artifacts/marketing-shots/embed-desktop-showcase.png" }).catch((e) => console.log("showcase shot err", String(e).slice(0, 60)));
  console.log("desktop showcase captured");
  await d.close();

  // Scroll-pan proof: capture the memory phone twice, ~6s apart
  const m = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const mp = await m.newPage();
  await mp.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await mp.waitForTimeout(2000);
  const figs = await mp.$$("figure");
  // figure 0 on Home is the memory scroll phone
  await figs[0].scrollIntoViewIfNeeded();
  await mp.waitForTimeout(1500);
  await figs[0].screenshot({ path: "artifacts/marketing-shots/embed-pan-a.png" });
  await mp.waitForTimeout(6500);
  await figs[0].screenshot({ path: "artifacts/marketing-shots/embed-pan-b.png" });
  console.log("pan frames captured (a, b ~6.5s apart)");
  console.log("img errors:", [...new Set(errs)]);
  await b.close();
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
