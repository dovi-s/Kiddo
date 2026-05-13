/* eslint-disable no-console */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";
import { chromium, type BrowserContext, type Page } from "playwright";
import { db, pool } from "../server/db";
import { funds } from "../shared/schema";
import { users } from "../shared/models/auth";

type VisualCheck = {
  name: string;
  width: number;
  page: "checkout" | "success";
  ok: boolean;
  details: string[];
  screenshot: string;
};

const baseUrl = process.env.KIDDO_VISUAL_QA_BASE_URL || "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "kiddo-loop-visual-qa");
const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440] as const;

function ensureDir() {
  mkdirSync(outDir, { recursive: true });
}

function spawnNpm(args: string[], options: SpawnOptions): ChildProcess {
  if (process.platform === "win32") {
    const command = `npm ${args.join(" ")}`;
    return spawn("cmd.exe", ["/d", "/s", "/c", command], options);
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
      // Already exited.
    }
  }
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function isHealthy() {
  try {
    const res = await fetch(`${baseUrl}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(server?: ChildProcess) {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    if (server && server.exitCode !== null && server.exitCode !== 0) {
      throw new Error(`Dev server exited early with code ${server.exitCode}`);
    }
    if (await isHealthy()) return;
    await delay(1_000);
  }
  throw new Error(`Timed out waiting for ${baseUrl}/api/health`);
}

function slug(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function heightFor(width: number) {
  if (width <= 430) return 844;
  if (width <= 1024) return 1024;
  return 900;
}

async function seedFund() {
  const email = `kiddo_visual_${Date.now()}@example.com`;
  const [user] = await db.insert(users).values({
    email,
    firstName: "Visual",
    lastName: "QA",
    referralCode: `VQA${String(Date.now()).slice(-10)}`.slice(0, 16),
  }).returning();
  if (!user?.id) throw new Error("Could not seed visual QA user");

  const fundSlug = `emma-visual-qa-${Date.now()}`;
  const [fund] = await db.insert(funds).values({
    userId: user.id,
    name: "Emma",
    slug: fundSlug,
    accountType: "UTMA",
    status: "active",
    recipientFirstName: "Emma",
    recipientRelation: "parent",
    investmentStrategy: "auto_invest",
    isDiscoverable: false,
    balance: "50.00",
    projectedValue: "134.00",
    yearsUntilMaturity: 18,
    recipientBirthdate: new Date("2020-01-01T12:00:00.000Z"),
  }).returning();
  if (!fund?.id) throw new Error("Could not seed visual QA fund");
  return { fundId: String(fund.id), fundSlug };
}

async function silenceAnalytics(context: BrowserContext) {
  await context.route("**/api/referrals/events", async (route) => {
    await route.fulfill({
      status: 204,
      body: "",
    });
  });
}

async function collectPageSignals(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const clientOrServerResponses: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (text.includes("401 (Unauthorized)")) return;
    consoleErrors.push(text);
  });
  page.on("response", (resp) => {
    if (resp.status() === 401 && resp.url().includes("/api/auth/user")) return;
    if (resp.status() >= 400) clientOrServerResponses.push(`${resp.status()} ${resp.url()}`);
  });
  return { pageErrors, consoleErrors, clientOrServerResponses };
}

async function textVisible(page: Page, text: string) {
  return page.getByText(text, { exact: false }).first().isVisible().catch(() => false);
}

async function elementTop(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((node) => node.getBoundingClientRect().top).catch(() => null);
}

async function runCheckoutCheck(context: BrowserContext, fundSlug: string, width: number): Promise<VisualCheck> {
  const page = await context.newPage();
  const signals = await collectPageSignals(page);
  const details: string[] = [];
  const name = `checkout-${width}`;
  const screenshot = path.join(outDir, `${name}.png`);
  let ok = true;
  try {
    await page.setViewportSize({ width, height: heightFor(width) });
    await page.goto(`${baseUrl}/${fundSlug}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForSelector("[data-testid='text-heading']", { timeout: 20_000 });
    await page.screenshot({ path: screenshot, fullPage: true });

    const headlineOk = await textVisible(page, "Emma's future is growing, Add to it.");
    const speedOk = await textVisible(page, "No account needed, Takes 60 seconds.");
    const cta = page.getByTestId("button-start-gift");
    const ctaVisible = await cta.isVisible();
    const ctaText = await cta.textContent();
    const ctaBox = await cta.boundingBox();
    const ctaBg = await cta.evaluate((node) => getComputedStyle(node).backgroundColor).catch(() => "");
    const foldHeight = heightFor(width);
    const trustTop = await elementTop(page, "[data-testid='text-landing-trust-line']");
    const gridVisible = await page.getByTestId("grid-gift-first-answers").isVisible().catch(() => false);

    if (!headlineOk) details.push("missing headline");
    if (!speedOk) details.push("missing 60-second/no-account line");
    if (!ctaVisible || !ctaText?.includes("Gift $50")) details.push("missing Gift $50 CTA");
    if (ctaBox && ctaBox.height < 44) details.push(`CTA tap target too short (${Math.round(ctaBox.height)}px)`);
    if (width <= 430 && ctaBox && ctaBox.y + ctaBox.height > foldHeight) details.push("CTA below mobile first viewport");
    if (width <= 430 && gridVisible) details.push("four-answer grid visible above mobile fold");
    if (width <= 430 && trustTop !== null && trustTop < foldHeight) details.push("trust detail appears above mobile first CTA fold");
    if (!ctaBg || ctaBg === "rgba(0, 0, 0, 0)") details.push("CTA background color not detected");
    ok = details.length === 0 && signals.pageErrors.length === 0 && !signals.clientOrServerResponses.some((entry) => entry.startsWith("5"));
    if (signals.pageErrors.length) details.push(`page errors: ${signals.pageErrors.join(" | ")}`);
    if (signals.consoleErrors.length) details.push(`console errors: ${signals.consoleErrors.join(" | ")}`);
    if (signals.clientOrServerResponses.length) details.push(`400/500 responses: ${signals.clientOrServerResponses.join(" | ")}`);
  } catch (error) {
    ok = false;
    details.push(error instanceof Error ? error.message : String(error));
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => null);
  } finally {
    await page.close();
  }
  return { name, width, page: "checkout", ok, details: details.length ? details : ["ok"], screenshot };
}

async function runSuccessCheck(context: BrowserContext, fundId: string, width: number): Promise<VisualCheck> {
  const page = await context.newPage();
  const signals = await collectPageSignals(page);
  const details: string[] = [];
  const name = `success-${width}`;
  const screenshot = path.join(outDir, `${name}.png`);
  let ok = true;
  try {
    await page.setViewportSize({ width, height: heightFor(width) });
    const url = `${baseUrl}/gift/success?fundId=${encodeURIComponent(fundId)}&amount=50&senderName=Grandma&fundName=Emma&executionModel=auto`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForSelector("[data-testid='text-success-heading']", { timeout: 20_000 });
    await page.screenshot({ path: screenshot, fullPage: true });

    const provenanceOk = await textVisible(page, "Invested in Emma's future with Kiddo.");
    const brandMomentOk = await textVisible(page, "This gift was invested with Kiddo");
    const promptOk = await textVisible(page, "Want to set up a fund for your own child or grandchild?");
    const projectionVisible = await page.getByText("historical market returns", { exact: false }).first().isVisible().catch(() => false);
    const promptTop = await elementTop(page, "[data-testid='card-start-fund-primary']");

    if (!provenanceOk) details.push("missing Kiddo provenance");
    if (!brandMomentOk) details.push("missing gifts-that-last brand moment");
    if (!promptOk) details.push("missing optional post-gift fund prompt");
    if (projectionVisible) details.push("unlabeled performance projection visible");
    if (promptTop !== null && promptTop < 0) details.push("post-gift prompt is clipped above viewport");
    ok = details.length === 0 && signals.pageErrors.length === 0 && !signals.clientOrServerResponses.some((entry) => entry.startsWith("5"));
    if (signals.pageErrors.length) details.push(`page errors: ${signals.pageErrors.join(" | ")}`);
    if (signals.consoleErrors.length) details.push(`console errors: ${signals.consoleErrors.join(" | ")}`);
    if (signals.clientOrServerResponses.length) details.push(`400/500 responses: ${signals.clientOrServerResponses.join(" | ")}`);
  } catch (error) {
    ok = false;
    details.push(error instanceof Error ? error.message : String(error));
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => null);
  } finally {
    await page.close();
  }
  return { name, width, page: "success", ok, details: details.length ? details : ["ok"], screenshot };
}

async function main() {
  ensureDir();
  let server: ChildProcess | undefined;
  let spawnedServer = false;
  if (await isHealthy()) {
    console.log(`> Reusing existing server at ${baseUrl}/api/health`);
  } else {
    console.log("> Starting dev server for Kiddo loop visual QA");
    server = spawnNpm(["run", "dev"], {
      stdio: "ignore",
      detached: process.platform !== "win32",
      env: process.env,
    });
    server.unref();
    spawnedServer = true;
    await waitForHealth(server);
  }

  const browser = await chromium.launch({ headless: true });
  const report: VisualCheck[] = [];
  try {
    const seeded = await seedFund();

    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: heightFor(width) } });
      await context.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
      await silenceAnalytics(context);
      report.push(await runCheckoutCheck(context, seeded.fundSlug, width));
      report.push(await runSuccessCheck(context, seeded.fundId, width));
      await context.close();
    }
  } finally {
    await browser.close();
    if (spawnedServer && server && !server.killed) killProcessTree(server.pid!);
  }

  const reportPath = path.join(outDir, "report.json");
  writeFileSync(reportPath, JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), results: report }, null, 2));
  await pool.end().catch(() => null);
  const failures = report.filter((item) => !item.ok);
  console.log(`Kiddo loop visual QA complete. ${report.length - failures.length}/${report.length} checks passed.`);
  console.log(`Report: ${reportPath}`);
  if (failures.length) {
    for (const failure of failures) {
      console.log(`- ${failure.name}: ${failure.details.join("; ")}`);
    }
    process.exit(1);
  }
}

main().catch(async (error) => {
  await pool.end().catch(() => null);
  console.error("Kiddo loop visual QA crashed:", error);
  process.exit(1);
});
