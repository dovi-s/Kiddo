/* eslint-disable no-console */
// Full-site render audit: every marketing page, desktop + mobile, full-page,
// reduced-motion (stable), scroll-triggered so lazy/whileInView content mounts.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "audit");
mkdirSync(out, { recursive: true });
const PAGES = [["/", "home"], ["/how-it-works", "how-it-works"], ["/pricing", "pricing"], ["/faq", "faq"], ["/about", "about"], ["/security", "security"], ["/blog", "blog"], ["/stories", "stories"], ["/compare", "compare"], ["/age-18", "age18"], ["/legal", "legal"], ["/demo", "demo"]];

async function shoot(ctx, route, file) {
  const p = await ctx.newPage();
  const errs = [];
  p.on("requestfailed", (r) => { const u = r.url(); if (/\/product\/|\.png|\.jpg|\.webp|\.svg/.test(u)) errs.push(u.split("/").pop()); });
  p.on("console", (m) => { if (m.type() === "error") errs.push("JS:" + m.text().slice(0, 50)); });
  await p.goto(base + route, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(2200);
  const total = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= total; y += 700) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(150); }
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(out, file), fullPage: true });
  if (errs.length) console.log(`  ! ${file}: ${[...new Set(errs)].slice(0, 5).join(", ")}`);
  await p.close();
}

async function main() {
  const b = await chromium.launch();
  const desk = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const mob = await b.newContext({ ...devices["iPhone 14 Pro"], reducedMotion: "reduce" });
  for (const [route, slug] of PAGES) {
    await shoot(desk, route, `${slug}.desktop.png`);
    await shoot(mob, route, `${slug}.mobile.png`);
    console.log("done", slug);
  }
  await b.close();
  console.log("-> artifacts/audit");
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
