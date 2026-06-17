/* eslint-disable no-console */
// One-off: verify the LabCollapse "reveal-if-needed on open" behavior.
// Logs into the demo, finds a collapse header sitting LOW in the viewport,
// screenshots before-open, opens it, screenshots after, and reports how far
// the section's header moved + whether its content ended up on-screen.
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
    // iPhone-ish viewport so the floating mobile nav is present (worst case for
    // "content revealed behind the bottom bar"). Override via VP_W/VP_H to shoot
    // the desktop case (no mobile nav, taller header).
    const vpW = Number(process.env.VP_W || 414);
    const vpH = Number(process.env.VP_H || 896);
    const ctx = await browser.newContext({ viewport: { width: vpW, height: vpH }, deviceScaleFactor: vpW < 700 ? 2 : 1 });
    await ctx.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
    // Log in via the API (sets the session cookie on the context) — the
    // canonical path the ui-smoke harness uses; form-fill is flaky.
    const login = await ctx.request.post(`${baseUrl}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
    console.log(`login status: ${login.status()}`);
    if (login.status() !== 200) throw new Error(`login failed: ${login.status()} ${await login.text()}`);

    const page = await ctx.newPage();
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("[data-testid='text-total-balance']").first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4500); // let the hero roll + cascade settle

    // Find every collapse header (aria-expanded buttons inside the dashboard).
    const headers = page.locator('button[aria-expanded]');
    const count = await headers.count();
    console.log(`collapse headers found: ${count}`);
    if (!count) throw new Error("no aria-expanded collapse headers found");

    // Pick a CLOSED header that sits low in the viewport (so opening it would
    // push content below the fold) — that's the case the reveal is for. We
    // scroll it to ~70% down the viewport first to force the worst case.
    let target = null as null | number;
    for (let i = 0; i < count; i++) {
      const h = headers.nth(i);
      const expanded = await h.getAttribute("aria-expanded");
      if (expanded === "false") { target = i; }
    }
    if (target === null) target = count - 1;
    const h = headers.nth(target);
    await h.scrollIntoViewIfNeeded();
    // Nudge so the header is ~65% down the viewport (low, content will overflow).
    await page.evaluate(() => window.scrollBy({ top: -220 }));
    await page.waitForTimeout(500);

    const beforeTop = await h.evaluate((el) => el.getBoundingClientRect().top);
    const label = (await h.innerText()).split("\n")[0];
    console.log(`target header: "${label}"  top(before)=${Math.round(beforeTop)}  vh=896`);
    await page.screenshot({ path: path.join(outDir, "collapse-1-before-open.png") });

    // Open it.
    await h.click();
    await page.waitForTimeout(900); // expand (0.34s) + reveal scroll (smooth)

    const afterTop = await h.evaluate((el) => el.getBoundingClientRect().top);
    console.log(`top(after)=${Math.round(afterTop)}  moved up by ${Math.round(beforeTop - afterTop)}px`);
    await page.screenshot({ path: path.join(outDir, "collapse-2-after-open.png") });

    // Open a SECOND section to prove multi-open is preserved (none auto-close).
    let second = null as null | number;
    for (let i = 0; i < count; i++) {
      if (i === target) continue;
      const expanded = await headers.nth(i).getAttribute("aria-expanded");
      if (expanded === "false") { second = i; break; }
    }
    if (second !== null) {
      await headers.nth(second).scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await headers.nth(second).click();
      await page.waitForTimeout(900);
      const stillOpen = await headers.nth(target).getAttribute("aria-expanded");
      console.log(`after opening a 2nd section, first section aria-expanded=${stillOpen} (want "true")`);
      await page.screenshot({ path: path.join(outDir, "collapse-3-two-open.png") });
    }

    console.log("SHOTS: collapse-1-before-open.png / collapse-2-after-open.png / collapse-3-two-open.png");
    await page.close(); await ctx.close();
  } finally {
    await browser.close();
    if (server && !server.killed && server.pid) { try { if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" }); else process.kill(server.pid, "SIGTERM"); } catch {} }
  }
}
main().catch((e) => { console.error("crash:", e); process.exit(1); });
