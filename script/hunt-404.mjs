/* eslint-disable no-console */
import { chromium } from "playwright";
const base = "http://127.0.0.1:5000";

async function scan(ctx, route, label, doLogin) {
  const p = await ctx.newPage();
  const bad = [];
  p.on("response", (r) => { const s = r.status(); if (s >= 400) bad.push(`${s} ${r.request().method()} ${r.url()}`); });
  p.on("requestfailed", (r) => bad.push(`FAILED ${r.method()} ${r.url()} (${r.failure()?.errorText})`));
  await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
  if (doLogin) {
    await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
    await p.getByTestId("input-login-password").fill("riverafamily");
    await p.getByTestId("button-login").click();
    await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
  }
  await p.goto(base + route, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(6000);
  console.log(`\n=== ${label} (${route}) ===`);
  if (!bad.length) console.log("  no 4xx / failed requests");
  else [...new Set(bad)].forEach((b) => console.log("  " + b));
  await p.close();
}

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await scan(ctx, "/dashboard", "dashboard (authed)", true);
  await scan(ctx, "/staging", "staging (authed)", false); // session persists in ctx
  await b.close();
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
