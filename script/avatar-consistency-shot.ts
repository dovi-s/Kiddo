/* eslint-disable no-console */
// Verify gifter avatar colors match across surfaces: the dashboard
// "building {child}'s future" roster vs the Memory Book "Who loves {child}"
// strip. Logs in to the demo, screenshots the dashboard roster, then the
// Memory Book roster, so the SAME person can be eyeballed side by side.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";
import { chromium } from "playwright";

const baseUrl = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "ui-smoke");
const EMAIL = process.env.DEMO_EMAIL || "elena@riverafamily.com";
const PASSWORD = process.env.DEMO_PASSWORD || "riverafamily";

function spawnNpm(a: string[], o: SpawnOptions): ChildProcess {
  if (process.platform === "win32") return spawn("cmd.exe", ["/d", "/s", "/c", `npm ${a.join(" ")}`], o);
  return spawn("npm", a, o);
}
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function healthy() { try { return (await fetch(`${baseUrl}/api/health`)).ok; } catch { return false; } }

async function main() {
  mkdirSync(outDir, { recursive: true });
  let server: ChildProcess | undefined;
  if (await healthy()) console.log(`> reuse ${baseUrl}`);
  else { server = spawnNpm(["run", "dev"], { stdio: "ignore", detached: false, env: process.env }); const s = Date.now(); while (Date.now() - s < 180000 && !(await healthy())) await delay(1000); }

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 414, height: 1100 }, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
    const login = await ctx.request.post(`${baseUrl}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
    console.log(`login status: ${login.status()}`);
    if (login.status() !== 200) throw new Error(`login failed: ${login.status()} ${await login.text()}`);

    const page = await ctx.newPage();

    // ── Dashboard roster ──
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("[data-testid='text-total-balance']").first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4500);
    // Scroll the "N people are building {child}'s future" roster into view.
    const rosterHdr = page.getByText(/people are building/i).first();
    await rosterHdr.scrollIntoViewIfNeeded({ timeout: 15000 }).catch(() => {});
    await page.evaluate(() => window.scrollBy({ top: -40 }));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, "avatar-1-dashboard.png") });
    console.log("shot: avatar-1-dashboard.png");

    // ── Memory Book roster ──
    // Click the Memory nav (mobile bottom nav testid nav-memory).
    const memNav = page.locator("[data-testid='nav-memory']").first();
    if (await memNav.count()) {
      await memNav.click();
    } else {
      await page.goto(`${baseUrl}/memory`, { waitUntil: "domcontentloaded", timeout: 30000 });
    }
    await page.waitForTimeout(3500);
    const strip = page.locator("[data-testid='memory-gifter-roster']").first();
    await strip.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    await strip.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(1200);
    // Tight shot of just the "Who loves" strip if we found it, else full page.
    if (await strip.count()) {
      await strip.screenshot({ path: path.join(outDir, "avatar-2-memorybook-strip.png") }).catch(async () => {
        await page.screenshot({ path: path.join(outDir, "avatar-2-memorybook-strip.png") });
      });
    } else {
      await page.screenshot({ path: path.join(outDir, "avatar-2-memorybook-strip.png") });
    }
    console.log("shot: avatar-2-memorybook-strip.png");
    // Also a full memory page for context.
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, "avatar-3-memorybook-page.png") });
    console.log("shot: avatar-3-memorybook-page.png");

    await page.close(); await ctx.close();
  } finally {
    await browser.close();
    if (server && !server.killed && server.pid) { try { if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" }); else process.kill(server.pid, "SIGTERM"); } catch {} }
  }
}
main().catch((e) => { console.error("crash:", e); process.exit(1); });
