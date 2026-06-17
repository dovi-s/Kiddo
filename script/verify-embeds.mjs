/* eslint-disable no-console */
import { chromium } from "playwright";

const base = "http://127.0.0.1:5000";

async function main() {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const p = await c.newPage();
  const errs = [];
  p.on("requestfailed", (r) => { if (/\/product\//.test(r.url())) errs.push("IMG FAIL " + r.url()); });

  async function shots(url, tag) {
    await p.goto(base + url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(2500);
    const figs = await p.$$("figure");
    console.log(tag, "figures:", figs.length);
    for (let i = 0; i < figs.length; i++) {
      await figs[i].scrollIntoViewIfNeeded();
      await p.waitForTimeout(900);
      const sec = await figs[i].evaluateHandle((el) => el.closest("section"));
      const target = sec.asElement() || figs[i];
      await target.screenshot({ path: `artifacts/marketing-shots/embed-${tag}-${i}.png` }).catch(() => {});
    }
  }
  await shots("/", "home");
  await shots("/how-it-works", "hiw");
  console.log("img errors:", [...new Set(errs)].slice(0, 8));
  await b.close();
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
