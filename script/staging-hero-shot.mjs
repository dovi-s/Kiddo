/* eslint-disable no-console */
// Render the /staging dashboard (authed) after the full-bleed hero change.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });

async function run(ctx, label, w) {
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 80)); });
  await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
  await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
  // The app auto-selects a fund and appends ?fund=<id> to the URL after load.
  // Wait for that before hopping to /staging, or it lands fundless = skeleton.
  await p.waitForURL(/fund=/i, { timeout: 15000 }).catch(() => {});
  const m = p.url().match(/fund=([a-f0-9-]+)/i);
  const fund = m ? m[1] : null;
  await p.goto(base + "/staging" + (fund ? `?fund=${fund}` : ""), { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(14000); // cold load + reveal cascade + count-up settle
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(400);
  // Capture the top ~1100px (hero + first sections), not the whole 15k page.
  await p.screenshot({ path: path.join(out, `staging-hero.${label}.png`), clip: { x: 0, y: 0, width: w, height: Math.min(1100, w * 2) } });
  console.log(`-> staging-hero.${label}.png  ${errs.length ? "JS:" + [...new Set(errs)].slice(0,4).join(" | ") : "(no JS errors)"}`);
  await p.close();
}

const b = await chromium.launch();
await run(await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 }), "mobile", 393);
await run(await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 }), "desktop", 1280);
await b.close();
