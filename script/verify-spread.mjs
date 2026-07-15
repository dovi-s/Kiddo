/* eslint-disable no-console */
import { chromium } from "playwright";
const base = "http://127.0.0.1:5000";

async function main() {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const p = await c.newPage();
  const errs = [];
  p.on("requestfailed", (r) => { if (/\/product\//.test(r.url())) errs.push("IMG FAIL " + r.url()); });

  for (const [route, tag] of [["/about", "about"], ["/stories", "stories"], ["/compare", "compare"], ["/age-18", "age18"]]) {
    await p.goto(base + route, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(2500);
    const figs = await p.$$("figure");
    let demoLinks = 0;
    for (const f of figs) {
      const a = await f.$('a[href="/demo"]');
      if (a) demoLinks++;
    }
    if (figs.length) {
      await figs[0].scrollIntoViewIfNeeded();
      await p.waitForTimeout(900);
      const sec = await figs[0].evaluateHandle((el) => el.closest("section") || el.parentElement);
      await (sec.asElement() || figs[0]).screenshot({ path: `artifacts/marketing-shots/spread-${tag}.png` }).catch(() => {});
    }
    console.log(`${tag}: figures=${figs.length} demoDoorways=${demoLinks}`);
  }
  console.log("img errors:", [...new Set(errs)]);
  await b.close();
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
