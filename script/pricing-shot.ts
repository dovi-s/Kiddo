/* eslint-disable no-console */
// One-off: screenshot the public /pricing page (a counsel-email attachment).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";
import { chromium } from "playwright";

const baseUrl = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "ui-smoke");
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
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 2200 } });
    await ctx.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
    const page = await ctx.newPage();
    await page.goto(`${baseUrl}/pricing`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.getByText(/Plus|Family|free|per \$1,000|\$3\.99|\$6\.99/i, { exact: false }).first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const shot = path.join(outDir, "pricing-page.png");
    await page.screenshot({ path: shot, fullPage: true });
    console.log(`SHOT: ${shot}`);
    await page.close(); await ctx.close();
  } finally {
    await browser.close();
    if (server && !server.killed && server.pid) { try { if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" }); else process.kill(server.pid, "SIGTERM"); } catch {} }
  }
}
main().catch((e) => { console.error("crash:", e); process.exit(1); });
