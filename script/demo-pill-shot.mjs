/* eslint-disable no-console */
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });

async function login(ctx) {
  const p = await ctx.newPage();
  await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
  await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
  await p.close();
}
async function shot(ctx, label) {
  const p = await ctx.newPage();
  await p.goto(base + "/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(9000); // let reveal settle + banner entrance (delay 0.6s)
  await p.screenshot({ path: path.join(out, `demo-pill.${label}.png`) }); // viewport only
  await p.close();
}
async function main() {
  const b = await chromium.launch();
  const desk = await b.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  await login(desk); await shot(desk, "desktop");
  const mob = await b.newContext({ ...devices["iPhone 14 Pro"] });
  await login(mob); await shot(mob, "mobile");
  await b.close();
  console.log("-> demo-pill shots");
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
