/* eslint-disable no-console */
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // wait for server to be healthy after the nodemon restart
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(base + "/api/health")).ok) break; } catch {}
    await delay(1000);
  }
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const bad = [];
  p.on("response", (r) => { if (r.status() >= 400 && r.url().includes("/api/")) bad.push(`${r.status()} ${r.url()}`); });
  await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
  await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
  bad.length = 0; // only care about /staging requests
  await p.goto(base + "/staging", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(8000);
  const staging404 = bad.filter((x) => x.includes("/public/funds/staging"));
  // Does the desktop sidebar / nav render?
  const navInfo = await p.evaluate(() => {
    const sidebar = document.querySelector('nav, [class*="sidebar" i], aside');
    const hasMemoryLink = !!Array.from(document.querySelectorAll("a,button,span")).find((e) => /memory book/i.test(e.textContent || ""));
    const hasSettingsLink = !!Array.from(document.querySelectorAll("a,button,span")).find((e) => /^settings$/i.test((e.textContent || "").trim()));
    return { sidebarFound: !!sidebar, hasMemoryLink, hasSettingsLink };
  });
  console.log("staging /api/public/funds/staging 404s:", staging404.length ? staging404 : "NONE ✅");
  console.log("any /api 4xx on /staging:", bad.length ? bad : "none");
  console.log("nav present:", navInfo);
  await p.screenshot({ path: path.join(out, "staging.after-fix.png"), fullPage: true });
  await b.close();
  console.log("-> saved staging.after-fix.png");
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
