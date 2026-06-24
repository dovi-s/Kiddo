/* eslint-disable no-console */
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });
async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
  await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
  await p.goto(base + "/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(12000); // wait out the reveal cascade
  // crisp top viewport (hero + first rows)
  await p.screenshot({ path: path.join(out, "hero.desktop.2x.png") });
  await b.close();
  console.log("-> saved hero shot");
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
