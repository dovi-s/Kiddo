/* eslint-disable no-console */
import { chromium } from "playwright";
const base = "http://127.0.0.1:5000";

async function main() {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const p = await c.newPage();
  await p.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(2500);

  // find the "Try it live" button (the EmbeddedDemo)
  const btn = p.getByRole("button", { name: /Start the live demo/i }).first();
  const fig = await btn.evaluateHandle((el) => el.closest("figure"));
  await (fig.asElement()).scrollIntoViewIfNeeded();
  await p.waitForTimeout(1000);
  await (fig.asElement()).screenshot({ path: "artifacts/marketing-shots/embed-live-poster.png" }).catch(() => {});
  console.log("poster captured");

  // activate
  await btn.click({ timeout: 8000 });
  await p.waitForTimeout(1500);
  // wait for the iframe to appear + load the gift page
  const frameEl = await p.waitForSelector('iframe[title="Kiddo live demo"]', { timeout: 15000 }).catch(() => null);
  console.log("iframe mounted?", !!frameEl);
  if (frameEl) {
    const frame = await frameEl.contentFrame();
    if (frame) {
      await frame.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {});
      await p.waitForTimeout(5000);
      const txt = await frame.evaluate(() => document.body.innerText).catch(() => "");
      console.log("iframe content has gift page?", /Theo|gift|Add to it|Gift Theo/i.test(txt), "| head:", txt.replace(/\n+/g, " ").slice(0, 90));
    }
  }
  await (fig.asElement()).screenshot({ path: "artifacts/marketing-shots/embed-live-active.png" }).catch(() => {});
  console.log("live state captured");
  await b.close();
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
