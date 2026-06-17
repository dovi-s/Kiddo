/* eslint-disable no-console */
import { chromium } from "playwright";
const base = "http://127.0.0.1:5000";

async function main() {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
  const p = await c.newPage();
  await p.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(2500);

  // there are two EmbeddedDemo buttons (gift + kid view); pick the kid-view one
  const btns = await p.getByRole("button", { name: /Start the live demo/i }).all();
  console.log("live-embed buttons:", btns.length);
  // the kid-view embed's aria-label mentions "companies they own" / "Kid View"
  let target = null;
  for (const btn of btns) {
    const label = await btn.getAttribute("aria-label");
    if (/companies they own|own view|who helped build/i.test(label || "")) { target = btn; break; }
  }
  target = target || btns[btns.length - 1];
  const fig = await target.evaluateHandle((el) => el.closest("figure"));
  await (fig.asElement()).scrollIntoViewIfNeeded();
  await p.waitForTimeout(800);
  await target.click({ timeout: 8000 });
  await p.waitForTimeout(2000);

  const frameEl = await p.waitForSelector('iframe[title="Kiddo live demo"]', { timeout: 15000 }).catch(() => null);
  console.log("iframe mounted?", !!frameEl);
  if (frameEl) {
    const frame = await frameEl.contentFrame();
    await frame.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(5000);
    const t1 = await frame.evaluate(() => document.body.innerText).catch(() => "");
    console.log("after redirect, iframe shows:", t1.replace(/\n+/g, " ").slice(0, 120));
    // enter PIN inside the iframe (hint reveals it; built-in demo = 1111)
    const pin = (t1.match(/Demo PIN:\s*(\d{4})/) || [])[1] || "1111";
    console.log("entering PIN:", pin);
    for (const d of pin.split("")) {
      await frame.getByRole("button", { name: new RegExp("^" + d + "$") }).first().click({ timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(300);
    }
    await p.waitForTimeout(5000);
    const t2 = await frame.evaluate(() => document.body.innerText).catch(() => "");
    console.log("after PIN, iframe shows kid view?", /This is yours|Real investments|who helped|own/i.test(t2), "| head:", t2.replace(/\n+/g, " ").slice(0, 100));
  }
  await (fig.asElement()).screenshot({ path: "artifacts/marketing-shots/embed-kidview-live.png" }).catch(() => {});
  console.log("captured");
  await b.close();
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
