/* eslint-disable no-console */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";
import { chromium, type BrowserContext, type Page } from "playwright";

const baseUrl = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "signup-session-flow");
const healthUrl = `${baseUrl}/api/health`;
const password = "TestPass123!";
const dashboardWidths = [320, 375, 390, 430, 768, 1024, 1280, 1440] as const;

function ensureDir() {
  mkdirSync(outDir, { recursive: true });
}

function spawnNpm(args: string[], options: SpawnOptions): ChildProcess {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", `npm ${args.join(" ")}`], options);
  }
  return spawn("npm", args, options);
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
      // already stopped
    }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isHealthy() {
  try {
    const response = await fetch(healthUrl);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(server?: ChildProcess) {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    if (server?.exitCode !== null && server?.exitCode !== 0) {
      throw new Error(`dev server exited early with code ${server.exitCode}`);
    }
    if (await isHealthy()) return;
    await delay(1_000);
  }
  throw new Error(`timed out waiting for ${healthUrl}`);
}

async function screenshot(page: Page, name: string) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function heightFor(width: number) {
  if (width <= 430) return 844;
  if (width <= 1024) return 1024;
  return 900;
}

async function assertAuthed(context: BrowserContext, expectedEmail: string) {
  const response = await context.request.get(`${baseUrl}/api/auth/user`);
  if (response.status() !== 200) {
    throw new Error(`expected authenticated user, got ${response.status()} ${await response.text()}`);
  }
  const user = await response.json();
  if (String(user.email).toLowerCase() !== expectedEmail.toLowerCase()) {
    throw new Error(`expected ${expectedEmail}, got ${user.email}`);
  }
  return user;
}

async function assertLoggedOut(context: BrowserContext) {
  const response = await context.request.get(`${baseUrl}/api/auth/user`);
  if (response.status() !== 200) {
    throw new Error(`expected 200 for logged out user, got ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();
  if (body !== null) {
    throw new Error(`expected null body for logged out user, got ${JSON.stringify(body)}`);
  }
}

async function createFund(context: BrowserContext) {
  const slug = `qa-session-${Date.now()}`;
  const response = await context.request.post(`${baseUrl}/api/funds`, {
    data: {
      name: "Session QA Fund",
      slug,
      accountType: "UTMA",
      status: "active",
      recipientFirstName: "Session",
      recipientRelation: "parent",
      investmentStrategy: "auto_invest",
      isDiscoverable: false,
    },
  });
  if (response.status() !== 201 && response.status() !== 200) {
    throw new Error(`fund create failed: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

async function verifyFooterContact(page: Page) {
  await page.goto(`${baseUrl}/about`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("link-footer-contact").scrollIntoViewIfNeeded();
  await page.getByTestId("link-footer-contact").click();
  await page.waitForURL("**/contact", { timeout: 10_000 });
  await page.waitForSelector("text=Contact", { timeout: 10_000 });
}

async function signupThroughUi(page: Page, email: string) {
  await page.goto(`${baseUrl}/get-started`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='button-welcome-continue']", { timeout: 20_000 });
  await page.getByTestId("button-welcome-continue").click();
  await page.waitForSelector("[data-testid='input-email']", { timeout: 10_000 });
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill(password);
  await page.getByTestId("button-welcome-continue").click();
  await page.waitForSelector("[data-testid='option-child-fund']", { timeout: 20_000 });
}

async function loginThroughUi(page: Page, email: string) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='input-login-email']", { timeout: 20_000 });
  await page.getByTestId("input-login-email").fill(email);
  await page.getByTestId("input-login-password").fill(password);
  await page.getByTestId("button-login").click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
  await page.waitForSelector("[data-testid='button-create-event']", { timeout: 20_000 });
}

async function verifyDashboardBreakpoints(page: Page) {
  const screenshots: Record<string, string> = {};
  for (const width of dashboardWidths) {
    await page.setViewportSize({ width, height: heightFor(width) });
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='button-create-event']", { timeout: 20_000 });

    const file = await screenshot(page, `dashboard-${width}`);
    screenshots[String(width)] = file;

    const bodyText = await page.locator("body").innerText();
    const forbidden = [
      "The foundation is in place",
      "Where the money goes",
      "Thank Yous",
      "unsent drafts",
      "Contribute now",
      "Real recurring bank transfers coming soon",
    ];
    const foundForbidden = forbidden.filter((text) => bodyText.includes(text));
    if (foundForbidden.length > 0) {
      throw new Error(`dashboard ${width} still contains old copy: ${foundForbidden.join(", ")}`);
    }

    if (width <= 430) {
      const giftVisible = await page.getByTestId("nav-gift").isVisible().catch(() => false);
      if (!giftVisible) throw new Error(`dashboard ${width} missing mobile Gift action`);
      const adminVisible = await page.getByTestId("nav-admin").isVisible().catch(() => false);
      if (adminVisible) throw new Error(`dashboard ${width} shows Admin in mobile parent nav`);
    }
  }
  return screenshots;
}

async function main() {
  ensureDir();
  let server: ChildProcess | undefined;
  let spawnedServer = false;

  if (!(await isHealthy())) {
    console.log("> Starting dev server");
    server = spawnNpm(["run", "dev"], {
      stdio: "ignore",
      detached: process.platform !== "win32",
      env: process.env,
    });
    server.unref();
    spawnedServer = true;
    await waitForHealth(server);
  } else {
    console.log("> Reusing existing dev server");
  }

  const browser = await chromium.launch({ headless: true });
  const report: Record<string, unknown> = {
    baseUrl,
    generatedAt: new Date().toISOString(),
    checks: [],
  };

  try {
    const publicContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await publicContext.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
    const publicPage = await publicContext.newPage();
    await verifyFooterContact(publicPage);
    (report.checks as string[]).push("footer contact navigates to /contact");
    await publicContext.close();

    const email = `qa_signup_session_${Date.now()}@example.com`;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
    const page = await context.newPage();

    await signupThroughUi(page, email);
    await assertAuthed(context, email);
    (report.checks as string[]).push("browser signup creates authenticated session");

    const fund = await createFund(context);
    (report as any).fundId = fund.id;
    (report as any).fundSlug = fund.slug;
    (report.checks as string[]).push("authenticated user can create fund");

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='button-create-event']", { timeout: 20_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='button-create-event']", { timeout: 20_000 });
    (report.checks as string[]).push("dashboard session persists across reload");

    const logout = await context.request.post(`${baseUrl}/api/auth/logout`);
    if (logout.status() !== 200) {
      throw new Error(`logout failed: ${logout.status()} ${await logout.text()}`);
    }
    await assertLoggedOut(context);
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='input-login-email']", { timeout: 20_000 });
    (report.checks as string[]).push("logout clears session and protected routes require login");

    await loginThroughUi(page, email);
    await assertAuthed(context, email);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='button-create-event']", { timeout: 20_000 });
    (report.checks as string[]).push("browser login restores session and persists across reload");
    (report as any).dashboardScreenshots = await verifyDashboardBreakpoints(page);
    (report.checks as string[]).push("authenticated dashboard screenshots pass at 320, 375, 390, 430, 768, 1024, 1280, and 1440");

    (report as any).email = email;
    (report as any).screenshot = await screenshot(page, "dashboard-after-login");
    await context.close();
  } finally {
    await browser.close();
    if (spawnedServer && server?.pid) {
      killProcessTree(server.pid);
    }
  }

  const reportPath = path.join(outDir, "report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Signup/session flow passed. Report: ${reportPath}`);
}

main().catch((error) => {
  console.error("Signup/session flow failed:", error);
  process.exit(1);
});
