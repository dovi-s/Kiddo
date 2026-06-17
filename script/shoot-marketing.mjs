/* eslint-disable no-console */
// Screenshot every marketing/public page at desktop + mobile widths so the
// design/look-feel can actually be reviewed (not just the code). Public pages,
// no login needed. Output: artifacts/marketing-audit/<slug>.<desktop|mobile>.png
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "marketing-audit");
mkdirSync(out, { recursive: true });

const ROUTES = [
  ["/", "home"],
  ["/how-it-works", "how-it-works"],
  ["/pricing", "pricing"],
  ["/faq", "faq"],
  ["/about", "about"],
  ["/security", "security"],
  ["/blog", "blog"],
  ["/stories", "stories"],
  ["/legal", "legal"],
  ["/gift", "gift"],
  ["/partners", "partners"],
];

async function main() {
  const browser = await chromium.launch();
  await browser.newContext().then((c) => c.request.get(`${base}/api/health`, { timeout: 120000 }).catch(() => {}).then(() => c.close()));
  for (const [route, slug] of ROUTES) {
    for (const [label, vp] of [["desktop", { width: 1366, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      try {
        const resp = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(out, `${slug}.${label}.png`), fullPage: true });
        console.log(`shot ${slug}.${label} (HTTP ${resp?.status()})`);
      } catch (e) {
        console.log(`FAIL ${slug}.${label}: ${String(e).slice(0, 80)}`);
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`done -> ${out}`);
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
