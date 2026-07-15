/* eslint-disable no-console */
// Does the "Theo"/Home sidebar item highlight on initial load? Check on
// /dashboard AND /design-lab. The active class is font-bold + bg rgb(237,244,238)
// (DesktopSidebar.tsx:712); report whether the Home nav button has it on each.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "verify-sidebar");
mkdirSync(outDir, { recursive: true });

async function check(page: any, route: string, label: string) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(outDir, `${label}.png`), clip: { x: 0, y: 0, width: 300, height: 700 } });
  // Find sidebar nav buttons; report each button's label + whether it's bold/active.
  const rows = await page.locator("nav button, aside button").evaluateAll((btns: any[]) =>
    btns.slice(0, 8).map((b) => {
      const t = (b.textContent || "").trim().slice(0, 18);
      const cs = getComputedStyle(b);
      const bold = Number(cs.fontWeight) >= 600;
      const bg = cs.backgroundColor;
      return `${t || "(icon)"} | bold=${bold} | bg=${bg}`;
    }),
  ).catch(() => []);
  console.log(`\n[${label}] ${route}`);
  rows.forEach((r: string) => console.log("   " + r));
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.request.get(`${baseUrl}/api/health`, { timeout: 120000 }).catch(() => {});
  const login = await ctx.request.post(`${baseUrl}/api/auth/login`, {
    data: { email: "marcus@riverafamily.com", password: "riverafamily" }, timeout: 120000,
  });
  console.log(`login HTTP ${login.status()}`);
  if (login.status() !== 200) { console.log("rate-limited — stopping"); await browser.close(); return; }
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  await check(page, "/dashboard", "dashboard");
  await check(page, "/design-lab", "design-lab");
  await browser.close();
  console.log(`\nscreenshots: ${outDir}`);
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
