/* eslint-disable no-console */
// Founder's-eyes screenshot reel — the engine behind BE_YOUR_OWN_CUSTOMER.md.
//
// This is NOT a regression gate. `test:ui:smoke` asserts exact copy/fees/test-ids
// and is *meant* to rot when the UI changes (you update it with the change). This
// reel does the opposite job: it just walks the real conversion funnel against the
// seeded Dunphy demo and dumps clean, funnel-ordered screenshots the founder can
// flip through — with almost no assertions, so it keeps working as the UI evolves.
//
// Prereqs: a dev server on :5000 (it reuses one if healthy, else spawns) and a
// seeded demo (`npm run reset:dunphys && npm run seed:dunphys`).
// Output: artifacts/founder-reel/NN-surface.png (+ NN-surface-mobile.png).

import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";
import { chromium, type BrowserContext, type Page } from "playwright";

const baseUrl = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "founder-reel");
const HEALTH_PATH = "/api/health";
const HEALTH_TIMEOUT_MS = 180_000;
const HEALTH_POLL_MS = 1_000;
const DEMO_EMAIL = "phil@dunphyfamily.com";
const DEMO_PASSWORD = "dunphyfamily";
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnNpm(args: string[], options: SpawnOptions): ChildProcess {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", `npm ${args.join(" ")}`], options);
  }
  return spawn("npm", args, options);
}

async function isHealthy() {
  try {
    return (await fetch(`${baseUrl}${HEALTH_PATH}`)).ok;
  } catch {
    return false;
  }
}

async function waitForHealth(server?: ChildProcess) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < HEALTH_TIMEOUT_MS) {
    if (server && server.exitCode !== null && server.exitCode !== 0) {
      throw new Error(`Dev server exited early with code ${server.exitCode}`);
    }
    if (await isHealthy()) return;
    await delay(HEALTH_POLL_MS);
  }
  throw new Error(`Timed out waiting for ${baseUrl}${HEALTH_PATH}`);
}

function killProcessTree(pid: number) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already exited
    }
  }
}

async function unlockLaunchGate(context: BrowserContext) {
  // The public surfaces sit behind a "launched" sessionStorage flag (same trick
  // the smoke harness uses) so the pre-launch holding screen doesn't intercept.
  await context.addInitScript(() => {
    sessionStorage.setItem("kora-launched", "1");
  });
}

// Capture one surface. Deliberately forgiving: navigate, let it settle, shoot.
// A surface that errors records a *-MISSING shot and keeps the reel going — one
// broken page never blocks the rest of the walkthrough.
async function capture(context: BrowserContext, label: string, route: string, viewport = DESKTOP) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  const suffix = viewport === MOBILE ? "-mobile" : "";
  try {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    // Let data settle without asserting on any specific test-id (which would rot).
    await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => null);
    // Wait for skeleton placeholders to clear so we shoot real content, not a
    // loading-pulse — the heavy dashboard fetch over the slow dev DB needs this.
    // `.animate-pulse` is the shared Tailwind skeleton marker, so this stays
    // UI-agnostic. Bounded: if it never clears we still shoot (and you'll see why).
    await page
      .waitForFunction(() => document.querySelectorAll(".animate-pulse").length === 0, undefined, { timeout: 15_000 })
      .catch(() => null);
    await page.waitForTimeout(1_200);
    await page.screenshot({ path: path.join(outDir, `${label}${suffix}.png`), fullPage: true });
    console.log(`  ✓ ${label}${suffix}  ${route}`);
  } catch (error: any) {
    await page.screenshot({ path: path.join(outDir, `${label}${suffix}-MISSING.png`), fullPage: true }).catch(() => null);
    console.log(`  ! ${label}${suffix}  ${route}  (${error?.message || error})`);
  } finally {
    await page.close();
  }
}

async function login(context: BrowserContext) {
  const res = await context.request.post(`${baseUrl}/api/auth/login`, {
    data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });
  if (res.status() !== 200) {
    throw new Error(
      `login failed for ${DEMO_EMAIL}: ${res.status()} ${await res.text()}\n` +
        `Did you seed the demo? Run: npm run reset:dunphys && npm run seed:dunphys`,
    );
  }
}

// Pull Phil's funds from the live API so fund ids/slugs survive a reseed (they
// are random per seed). Prefer a still-owned child fund for the gifter + memory
// surfaces; fall back to whatever exists.
async function pickFunds(context: BrowserContext) {
  const res = await context.request.get(`${baseUrl}/api/funds`);
  if (res.status() !== 200) {
    throw new Error(`GET /api/funds failed: ${res.status()} ${await res.text()}`);
  }
  const funds: Array<any> = await res.json();
  if (!Array.isArray(funds) || funds.length === 0) {
    throw new Error("Phil has no funds — reseed the demo before running the reel.");
  }
  const owned = funds.find((f) => f.status !== "transferred" && f.slug) ?? funds[0];
  return { fundId: owned.id as string, fundSlug: owned.slug as string };
}

async function main() {
  mkdirSync(outDir, { recursive: true });

  let server: ChildProcess | undefined;
  let spawnedServer = false;
  if (await isHealthy()) {
    console.log(`> Reusing existing server at ${baseUrl}`);
  } else {
    console.log("> Starting dev server for the reel");
    server = spawnNpm(["run", "dev"], { stdio: "ignore", detached: process.platform !== "win32", env: process.env });
    server.unref();
    spawnedServer = true;
    await waitForHealth(server);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    // The gifter's view — logged out, exactly what a grandparent opening the link sees.
    const publicCtx = await browser.newContext({ viewport: DESKTOP });
    await unlockLaunchGate(publicCtx);
    const authProbe = await browser.newContext({ viewport: DESKTOP });
    await unlockLaunchGate(authProbe);
    await login(authProbe);
    const { fundId, fundSlug } = await pickFunds(authProbe);

    console.log("> Gifter / public surfaces (logged out):");
    await capture(publicCtx, "01-home", "/");
    await capture(publicCtx, "02-pricing", "/pricing");
    await capture(publicCtx, "03-gift-link", `/${fundSlug}`);
    await capture(publicCtx, "03-gift-link", `/${fundSlug}`, MOBILE);
    await publicCtx.close();
    await authProbe.close();

    // The parent's world — logged in as Phil (3 kids, the seeded demo).
    const authCtx = await browser.newContext({ viewport: DESKTOP });
    await unlockLaunchGate(authCtx);
    await login(authCtx);

    console.log("> Parent surfaces (logged in as Phil):");
    await capture(authCtx, "04-dashboard", "/dashboard");
    await capture(authCtx, "04-dashboard", "/dashboard", MOBILE);
    await capture(authCtx, "05-memory-book", `/memory/${fundId}`);
    await capture(authCtx, "06-activity", "/activity");
    await capture(authCtx, "07-settings", "/settings");
    await capture(authCtx, "08-projection", `/projection/${fundId}`);
    await authCtx.close();
  } finally {
    await browser.close();
    if (spawnedServer && server && !server.killed) {
      console.log("> Stopping dev server");
      killProcessTree(server.pid!);
    }
  }

  console.log(`\nReel ready. Flip through them in order:\n  ${outDir}`);
}

main().catch((err) => {
  console.error("Founder reel crashed:", err);
  process.exit(1);
});
