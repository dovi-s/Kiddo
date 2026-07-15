/* eslint-disable no-console */
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "staging");
mkdirSync(out, { recursive: true });

const EMAIL = "elena@riverafamily.com";
const PASSWORD = "riverafamily";

async function login(ctx) {
  const p = await ctx.newPage();
  await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
  await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("input-login-email").fill(EMAIL);
  await p.getByTestId("input-login-password").fill(PASSWORD);
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1500);
  await p.close();
}

async function shoot(ctx, label) {
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error") errs.push("JS:" + m.text().slice(0, 90)); });
  p.on("pageerror", (e) => errs.push("PAGEERR:" + String(e).slice(0, 120)));
  await p.goto(base + "/staging", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(9000);
  const hero = await p.getByTestId("hero-card").count().catch(() => 0);
  const bal = await p.getByTestId("text-total-balance").first().textContent().catch(() => null);
  const total = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= total; y += 600) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(150); }
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(out, `staging.${label}.png`), fullPage: true });
  console.log(`  ${label}: hero=${hero} balance=${JSON.stringify(bal)} scrollH=${total}`);
  if (errs.length) console.log(`  ! ${label} errors: ${[...new Set(errs)].slice(0, 8).join(" | ")}`);
  else console.log(`  ${label}: no console errors`);
  await p.close();
}

async function main() {
  const b = await chromium.launch();
  const desk = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await login(desk);
  await shoot(desk, "desktop");
  const mob = await b.newContext({ ...devices["iPhone 14 Pro"] });
  await login(mob);
  await shoot(mob, "mobile");
  await b.close();
  console.log("-> artifacts/staging");
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
