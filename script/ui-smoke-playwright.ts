/* eslint-disable no-console */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";
import bcrypt from "bcryptjs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { db, pool } from "../server/db";
import { users } from "../shared/models/auth";
import { funds, subscriptions } from "../shared/schema";
import { eq } from "drizzle-orm";

type CheckResult = {
  name: string;
  ok: boolean;
  detail?: string;
  screenshot?: string;
};

const baseUrl = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "ui-smoke");
const HEALTH_PATH = "/api/health";
const HEALTH_TIMEOUT_MS = 90_000;
const HEALTH_POLL_MS = 1_000;

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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isHealthy() {
  try {
    const res = await fetch(`${baseUrl}${HEALTH_PATH}`);
    return res.ok;
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
    const result = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    if (result.status !== 0 && result.status !== 128) {
      console.warn(`taskkill exited with ${result.status}`);
    }
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

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function screenshot(page: Page, name: string) {
  const filename = `${slugify(name)}.png`;
  const fullPath = path.join(outDir, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  return fullPath;
}

async function runCheck(
  context: BrowserContext,
  results: CheckResult[],
  name: string,
  route: string,
  selector: string,
) {
  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (resp) => {
    if (resp.status() >= 500) {
      failedResponses.push(`${resp.status()} ${resp.url()}`);
    }
  });

  try {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (!response || response.status() >= 500) {
      throw new Error(`route returned status ${response?.status() ?? "no-response"}`);
    }
    await page.waitForSelector(selector, { timeout: 20000 });
    const shot = await screenshot(page, name);
    const detailParts: string[] = [];
    if (pageErrors.length) detailParts.push(`pageErrors=${pageErrors.length}`);
    if (consoleErrors.length) detailParts.push(`consoleErrors=${consoleErrors.length}`);
    results.push({
      name,
      ok: true,
      detail: detailParts.join(", ") || "ok",
      screenshot: shot,
    });
  } catch (error: any) {
    const shot = await screenshot(page, `${name}-fail`);
    const detail = [
      error?.message || String(error),
      pageErrors.length ? `pageErrors=${pageErrors.join(" | ")}` : "",
      consoleErrors.length ? `consoleErrors=${consoleErrors.join(" | ")}` : "",
      failedResponses.length ? `failedResponses=${failedResponses.join(" | ")}` : "",
    ]
      .filter(Boolean)
      .join(" :: ");
    results.push({ name, ok: false, detail, screenshot: shot });
  } finally {
    await page.close();
  }
}

async function runDashboardInteractionCheck(
  context: BrowserContext,
  results: CheckResult[],
  seeded: { fundId: string; secondFundId: string; processingGiftId: string },
) {
  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  const dashboardSummaryRequests: string[] = [];
  const oldWaterfallRequests: string[] = [];
  const oldWaterfallEndpoints = [
    `/api/funds/${seeded.fundId}/holdings`,
    `/api/funds/${seeded.fundId}/gifts`,
    `/api/funds/${seeded.fundId}/history`,
    `/api/funds/${seeded.fundId}/events`,
    `/api/funds/${seeded.fundId}/recurring-gifts`,
    `/api/funds/${seeded.fundId}/parent-contributions`,
    `/api/funds/${seeded.fundId}/investment-preferences`,
    `/api/funds/${seeded.fundId}/large-gift-holds`,
    `/api/funds/${seeded.fundId}/gift-code`,
  ];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (resp) => {
    if (resp.status() >= 500) failedResponses.push(`${resp.status()} ${resp.url()}`);
  });
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(baseUrl)) return;
    const pathname = new URL(url).pathname;
    if (pathname === `/api/funds/${seeded.fundId}/dashboard-summary`) {
      dashboardSummaryRequests.push(url);
    }
    if (oldWaterfallEndpoints.includes(pathname)) {
      oldWaterfallRequests.push(pathname);
    }
  });

  try {
    const response = await page.goto(`${baseUrl}/dashboard?fund=${seeded.fundId}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (!response || response.status() >= 500) {
      throw new Error(`dashboard returned status ${response?.status() ?? "no-response"}`);
    }

    const setupCard = page.getByTestId("card-setup-progress-nudge");
    await setupCard.waitFor({ state: "visible", timeout: 20000 });
    if (dashboardSummaryRequests.length === 0) {
      throw new Error("dashboard initial load did not request dashboard-summary");
    }
    if (oldWaterfallRequests.length > 0) {
      throw new Error(`dashboard initial load hit old waterfall endpoints: ${Array.from(new Set(oldWaterfallRequests)).join(", ")}`);
    }
    const actionNeeded = setupCard.getByText("Action needed", { exact: true }).first();
    if (await actionNeeded.isVisible().catch(() => false)) {
      throw new Error("setup checklist should start collapsed");
    }

    await page.getByTestId("button-toggle-setup-progress").click();
    await actionNeeded.waitFor({ state: "visible", timeout: 5000 });
    await page.getByTestId("button-toggle-setup-progress").click();
    await actionNeeded.waitFor({ state: "hidden", timeout: 5000 });

    const cashWaitingCard = page.getByText("Cash is waiting", { exact: false }).first();
    await cashWaitingCard.waitFor({ state: "visible", timeout: 10000 });
    await page.getByText("$25.00", { exact: false }).first().waitFor({ state: "visible", timeout: 10000 });

    const investResponse = await context.request.post(`${baseUrl}/api/funds/${seeded.fundId}/auto-invest`, {
      data: {
        amount: "25.00",
        ticker: "SPOT",
      },
    });
    if (investResponse.status() !== 200) {
      throw new Error(`auto-invest live refresh setup failed: ${investResponse.status()} ${await investResponse.text()}`);
    }

    const priorSummaryCount = dashboardSummaryRequests.length;
    await page.bringToFront();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    const refreshDeadline = Date.now() + 15000;
    while (dashboardSummaryRequests.length <= priorSummaryCount && Date.now() < refreshDeadline) {
      await page.waitForTimeout(250);
    }
    if (dashboardSummaryRequests.length <= priorSummaryCount) {
      throw new Error("dashboard did not re-request dashboard-summary after live gift investment");
    }
    await page.waitForTimeout(1000);

    await page.getByTestId("sidebar-fund-switcher").click();
    await page.getByTestId(`sidebar-fund-option-${seeded.secondFundId}`).click();
    await page.waitForURL(new RegExp(`fund=${seeded.secondFundId}`), { timeout: 10000 });

    const emptyEventsCta = page.getByTestId("button-view-events");
    await emptyEventsCta.waitFor({ state: "visible", timeout: 5000 });
    const emptyEventsLabel = await emptyEventsCta.innerText();
    if (!/Create event/i.test(emptyEventsLabel)) {
      throw new Error(`empty events CTA label should be "Create event", got "${emptyEventsLabel}"`);
    }
    await emptyEventsCta.click();
    await page.waitForURL(new RegExp(`/event/create\\?fundId=${seeded.secondFundId}`), { timeout: 10000 });
    await page.goto(`${baseUrl}/dashboard?fund=${seeded.fundId}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.getByTestId("button-one-time-contribution").click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByTestId("text-one-time-processing-fee").waitFor({ state: "visible", timeout: 5000 });
    const defaultFee = (await page.getByTestId("text-one-time-processing-fee").innerText()).trim();
    const defaultTotal = (await page.getByTestId("text-one-time-total-charge").innerText()).trim();
    if (defaultFee !== "$1.75") {
      throw new Error(`one-time contribution default processing fee should be $1.75, got "${defaultFee}"`);
    }
    if (defaultTotal !== "$51.75") {
      throw new Error(`one-time contribution default total should be $51.75, got "${defaultTotal}"`);
    }
    await page.getByTestId("button-one-time-payment-bank").click();
    const bankFee = (await page.getByTestId("text-one-time-processing-fee").innerText()).trim();
    const bankTotal = (await page.getByTestId("text-one-time-total-charge").innerText()).trim();
    if (bankFee !== "$0.40") {
      throw new Error(`one-time contribution bank fee should be $0.40, got "${bankFee}"`);
    }
    if (bankTotal !== "$50.40") {
      throw new Error(`one-time contribution bank total should be $50.40, got "${bankTotal}"`);
    }
    const bankRailTotal = (await page.getByTestId("text-one-time-total-bank").innerText()).trim();
    if (!bankRailTotal.includes("$50.40")) {
      throw new Error(`bank rail total should mention $50.40, got "${bankRailTotal}"`);
    }
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 5000 });
    await page.getByTestId("button-one-time-contribution").waitFor({ state: "visible", timeout: 5000 });

    await page.getByTestId("sidebar-fund-switcher").click({ force: true });
    await page.getByTestId("sidebar-add-fund").evaluate((element: HTMLElement) => element.click());
    await page.getByTestId("option-add-child-fund").waitFor({ state: "visible", timeout: 10000 });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/dashboard?fund=${seeded.fundId}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.getByTestId("button-create-event-quick").waitFor({ state: "visible", timeout: 15000 });

    const shot = await screenshot(page, "auth-dashboard-interactions");
    const detailParts: string[] = [
      `dashboardSummaryRequests=${dashboardSummaryRequests.length}`,
      "oldWaterfallRequests=0",
      "processingGiftRefresh=ok",
      "oneTimeFeeEstimates=ok",
      "mobileVisualSmoke=ok",
    ];
    if (pageErrors.length) detailParts.push(`pageErrors=${pageErrors.length}`);
    if (consoleErrors.length) detailParts.push(`consoleErrors=${consoleErrors.length}`);
    if (failedResponses.length) detailParts.push(`failedResponses=${failedResponses.length}`);
    results.push({
      name: "auth-dashboard-interactions",
      ok: true,
      detail: detailParts.join(", ") || "setup toggle, fund switch, add fund sheet ok",
      screenshot: shot,
    });
  } catch (error: any) {
    const shot = await screenshot(page, "auth-dashboard-interactions-fail");
    const detail = [
      error?.message || String(error),
      pageErrors.length ? `pageErrors=${pageErrors.join(" | ")}` : "",
      consoleErrors.length ? `consoleErrors=${consoleErrors.join(" | ")}` : "",
      failedResponses.length ? `failedResponses=${failedResponses.join(" | ")}` : "",
    ]
      .filter(Boolean)
      .join(" :: ");
    results.push({ name: "auth-dashboard-interactions", ok: false, detail, screenshot: shot });
  } finally {
    await page.close();
  }
}

async function runDashboardCachedHeroRefreshCheck(
  context: BrowserContext,
  results: CheckResult[],
  seeded: { fundId: string },
) {
  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (resp) => {
    if (resp.status() >= 500) failedResponses.push(`${resp.status()} ${resp.url()}`);
  });

  try {
    const fundRecord = await db.query.funds.findFirst({ where: eq(funds.id, seeded.fundId) });
    if (!fundRecord) {
      throw new Error(`seed fund ${seeded.fundId} not found`);
    }

    const cachedFundValue = 500;
    const freshFundValue = 650;
    await db
      .update(funds)
      .set({
        balance: freshFundValue.toFixed(2),
        pendingBalance: "0.00",
        cashBalance: "0.00",
        contributorCount: Math.max(Number(fundRecord.contributorCount || 0), 2),
        updatedAt: new Date(),
      })
      .where(eq(funds.id, seeded.fundId));

    let delayedFundsResponse = false;
    await page.route(`${baseUrl}/api/funds`, async (route) => {
      if (delayedFundsResponse) {
        await route.continue();
        return;
      }
      delayedFundsResponse = true;
      const response = await context.request.fetch(route.request());
      const body = await response.text();
      await delay(400);
      await route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body,
      });
    });

    await page.addInitScript(
      ({ targetFundId, cachedFund }) => {
        sessionStorage.setItem("kora-launched", "1");
        localStorage.setItem(
          "kiddo.dashboard.funds.v1",
          JSON.stringify({
            savedAt: new Date().toISOString(),
            value: [cachedFund],
          }),
        );
        localStorage.removeItem(`kiddo.dashboard.summary.v1:${targetFundId}`);
      },
      {
        targetFundId: seeded.fundId,
        cachedFund: {
          id: fundRecord.id,
          name: fundRecord.name,
          slug: fundRecord.slug,
          accountType: fundRecord.accountType,
          status: fundRecord.status,
          recipientFirstName: fundRecord.recipientFirstName,
          recipientRelation: fundRecord.recipientRelation,
          balance: cachedFundValue.toFixed(2),
          pendingBalance: "0.00",
          cashBalance: "0.00",
          contributorCount: Math.max(Number(fundRecord.contributorCount || 0), 2),
        },
      },
    );

    const response = await page.goto(`${baseUrl}/dashboard?fund=${seeded.fundId}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (!response || response.status() >= 500) {
      throw new Error(`dashboard returned status ${response?.status() ?? "no-response"}`);
    }

    const heroBalance = page.getByTestId("text-total-balance");
    await heroBalance.waitFor({ state: "visible", timeout: 10000 });
    const initialBalance = (await heroBalance.innerText()).trim();
    if (!initialBalance.includes("$500.00")) {
      throw new Error(`expected cached hero value to paint first as $500.00, got "${initialBalance}"`);
    }

    await page.waitForFunction(
      () => document.querySelector("[data-testid='text-total-balance']")?.textContent?.includes("$650.00"),
      undefined,
      { timeout: 15000 },
    );
    await page.getByTestId("text-since-last-visit").waitFor({ state: "visible", timeout: 10000 });
    const deltaText = (await page.getByTestId("text-since-last-visit").innerText()).trim();
    if (!deltaText.includes("$150.00 since last visit")) {
      throw new Error(`expected since-last-visit delta to show $150.00, got "${deltaText}"`);
    }

    results.push({
      name: "dashboard-cached-hero-refresh",
      ok: true,
      detail: "cached hero value painted first, then refreshed after paint",
    });
  } catch (error: any) {
    const shot = await screenshot(page, "dashboard-cached-hero-refresh-fail");
    const detail = [
      error?.message || String(error),
      pageErrors.length ? `pageErrors=${pageErrors.join(" | ")}` : "",
      consoleErrors.length ? `consoleErrors=${consoleErrors.join(" | ")}` : "",
      failedResponses.length ? `failedResponses=${failedResponses.join(" | ")}` : "",
    ]
      .filter(Boolean)
      .join(" :: ");
    results.push({
      name: "dashboard-cached-hero-refresh",
      ok: false,
      detail,
      screenshot: shot,
    });
  } finally {
    await page.close();
  }
}

async function runPricingPageCheck(context: BrowserContext, results: CheckResult[]) {
  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (resp) => {
    if (resp.status() >= 500) failedResponses.push(`${resp.status()} ${resp.url()}`);
  });

  try {
    const response = await page.goto(`${baseUrl}/pricing`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (!response || response.status() >= 500) {
      throw new Error(`pricing returned status ${response?.status() ?? "no-response"}`);
    }

    await page.getByText("Simple pricing for something that grows", { exact: false }).waitFor({ state: "visible", timeout: 10000 });
    await page.getByText("The gift amount stays whole. Kiddo does not skim normal gifts.").waitFor({ state: "visible", timeout: 5000 });
    await page.getByText("14 days of full Family access", { exact: false }).first().waitFor({ state: "visible", timeout: 5000 });

    const requiredCopy = [
      "Free",
      "Kiddo Plus",
      "Kiddo Family",
      "Kiddo Legacy",
      "Create your fund",
      "Best for one child",
      "Best for 2+ children",
      "Try the full experience first",
      "Every new family gets 14 days of Kiddo Family",
      "$29/yr",
      "$59/yr",
      "$129/yr",
      "Kid View Lite",
      "Full Kid View",
      "0.10%",
      "Most families use this for birthdays and holidays",
      "Small for families. Aligned with your child's long-term growth",
      "Does Kiddo take a cut of normal gifts?",
      "What is Kid View?",
    ];
    for (const copy of requiredCopy) {
      const visible = await page.getByText(copy, { exact: false }).first().isVisible().catch(() => false);
      if (!visible) throw new Error(`pricing page missing "${copy}"`);
    }

    const shot = await screenshot(page, "public-pricing");
    const detailParts: string[] = ["four plan cards and trust FAQ visible"];
    if (pageErrors.length) detailParts.push(`pageErrors=${pageErrors.length}`);
    if (consoleErrors.length) detailParts.push(`consoleErrors=${consoleErrors.length}`);
    if (failedResponses.length) detailParts.push(`failedResponses=${failedResponses.length}`);
    results.push({ name: "public-pricing", ok: true, detail: detailParts.join(", "), screenshot: shot });
  } catch (error: any) {
    const shot = await screenshot(page, "public-pricing-fail");
    const detail = [
      error?.message || String(error),
      pageErrors.length ? `pageErrors=${pageErrors.join(" | ")}` : "",
      consoleErrors.length ? `consoleErrors=${consoleErrors.join(" | ")}` : "",
      failedResponses.length ? `failedResponses=${failedResponses.join(" | ")}` : "",
    ]
      .filter(Boolean)
      .join(" :: ");
    results.push({ name: "public-pricing", ok: false, detail, screenshot: shot });
  } finally {
    await page.close();
  }
}

async function runSettingsMembershipCheck(
  context: BrowserContext,
  results: CheckResult[],
) {
  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (resp) => {
    if (resp.status() >= 500) failedResponses.push(`${resp.status()} ${resp.url()}`);
  });

  try {
    const response = await page.goto(`${baseUrl}/settings`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (!response || response.status() >= 500) {
      throw new Error(`settings returned status ${response?.status() ?? "no-response"}`);
    }

    await page.getByTestId("heading-settings").waitFor({ state: "visible", timeout: 20000 });
    const completedSetupShareCtaVisible = await page.getByTestId("button-settings-share-gift-link").isVisible().catch(() => false);
    const setupNudgeVisible = completedSetupShareCtaVisible
      ? false
      : await page.getByText("Start here: finish the last setup steps", { exact: false }).isVisible().catch(() => false);
    await page.getByTestId("settings-tab-membership").click();
    await page.getByTestId("settings-membership-panel").waitFor({ state: "visible", timeout: 10000 });
    await page.getByText("You're using the full experience.", { exact: true }).waitFor({ state: "visible", timeout: 5000 });
    await page.getByText("Keep it going after your trial ends.", { exact: true }).waitFor({ state: "visible", timeout: 5000 });
    await page.getByText("Make this feel real every month.", { exact: false }).waitFor({ state: "visible", timeout: 5000 });
    await page.getByText("Manage everything in one place.", { exact: false }).waitFor({ state: "visible", timeout: 5000 });
    await page.getByText("Plan this properly, long term.", { exact: false }).waitFor({ state: "visible", timeout: 5000 });

    const familyCard = page.getByTestId("card-kiddo-family");
    await familyCard.waitFor({ state: "visible", timeout: 5000 });
    await page.getByTestId("button-upgrade-family-compact").waitFor({ state: "visible", timeout: 5000 });

    const familyCardPaint = await familyCard.evaluate((node) => {
      const styles = getComputedStyle(node);
      return {
        backgroundColor: styles.backgroundColor,
        backgroundImage: styles.backgroundImage,
      };
    });
    if (familyCardPaint.backgroundImage === "none") {
      throw new Error(`Kiddo Family card should use a green gradient, got ${JSON.stringify(familyCardPaint)}`);
    }
    if (/rgb\(255,\s*255,\s*255\)/.test(familyCardPaint.backgroundColor)) {
      throw new Error(`Kiddo Family card is still white, got ${JSON.stringify(familyCardPaint)}`);
    }

    const shot = await screenshot(page, "auth-settings-membership");
    const detailParts: string[] = [
      `familyCardBackground=${familyCardPaint.backgroundImage.slice(0, 80)}`,
      completedSetupShareCtaVisible ? "completedSetupShareCta=visible" : `setupNudgeVisible=${setupNudgeVisible}`,
    ];
    if (pageErrors.length) detailParts.push(`pageErrors=${pageErrors.length}`);
    if (consoleErrors.length) detailParts.push(`consoleErrors=${consoleErrors.length}`);
    if (failedResponses.length) detailParts.push(`failedResponses=${failedResponses.length}`);
    results.push({
      name: "auth-settings-membership",
      ok: true,
      detail: detailParts.join(", "),
      screenshot: shot,
    });
  } catch (error: any) {
    const shot = await screenshot(page, "auth-settings-membership-fail");
    const detail = [
      error?.message || String(error),
      pageErrors.length ? `pageErrors=${pageErrors.join(" | ")}` : "",
      consoleErrors.length ? `consoleErrors=${consoleErrors.join(" | ")}` : "",
      failedResponses.length ? `failedResponses=${failedResponses.join(" | ")}` : "",
    ]
      .filter(Boolean)
      .join(" :: ");
    results.push({ name: "auth-settings-membership", ok: false, detail, screenshot: shot });
  } finally {
    await page.close();
  }
}

async function runSettingsNotificationsCheck(
  context: BrowserContext,
  results: CheckResult[],
) {
  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (resp) => {
    if (resp.status() >= 500) failedResponses.push(`${resp.status()} ${resp.url()}`);
  });

  try {
    const response = await page.goto(`${baseUrl}/settings`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (!response || response.status() >= 500) {
      throw new Error(`settings returned status ${response?.status() ?? "no-response"}`);
    }

    await page.getByTestId("heading-settings").waitFor({ state: "visible", timeout: 20000 });
    await page.getByTestId("settings-tab-notifications").click();
    await page.getByTestId("settings-notifications-panel").waitFor({ state: "visible", timeout: 10000 });

    const activationSwitch = page.getByTestId("row-parent-activation-nudges-switch");
    await activationSwitch.waitFor({ state: "visible", timeout: 5000 });
    const initialState = await activationSwitch.getAttribute("data-state");
    await activationSwitch.click();
    const nextState = await activationSwitch.getAttribute("data-state");
    if (initialState === nextState) {
      throw new Error(`activation switch did not toggle, state stayed ${initialState}`);
    }

    await page.getByTestId("row-gifter-birthday-reminders-switch").waitFor({ state: "visible", timeout: 5000 });
    await page.getByTestId("row-gifter-memory-sharing-switch").waitFor({ state: "visible", timeout: 5000 });
    await page.getByTestId("row-gifter-age18-notification-switch").waitFor({ state: "visible", timeout: 5000 });

    const shot = await screenshot(page, "auth-settings-notifications");
    const detailParts: string[] = [`activationSwitch=${initialState}->${nextState}`];
    if (pageErrors.length) detailParts.push(`pageErrors=${pageErrors.length}`);
    if (consoleErrors.length) detailParts.push(`consoleErrors=${consoleErrors.length}`);
    if (failedResponses.length) detailParts.push(`failedResponses=${failedResponses.length}`);
    results.push({
      name: "auth-settings-notifications",
      ok: true,
      detail: detailParts.join(", "),
      screenshot: shot,
    });
  } catch (error: any) {
    const shot = await screenshot(page, "auth-settings-notifications-fail");
    const detail = [
      error?.message || String(error),
      pageErrors.length ? `pageErrors=${pageErrors.join(" | ")}` : "",
      consoleErrors.length ? `consoleErrors=${consoleErrors.join(" | ")}` : "",
      failedResponses.length ? `failedResponses=${failedResponses.join(" | ")}` : "",
    ]
      .filter(Boolean)
      .join(" :: ");
    results.push({ name: "auth-settings-notifications", ok: false, detail, screenshot: shot });
  } finally {
    await page.close();
  }
}

async function runSettingsMoneyCheck(
  context: BrowserContext,
  results: CheckResult[],
) {
  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (resp) => {
    if (resp.status() >= 500) failedResponses.push(`${resp.status()} ${resp.url()}`);
  });

  try {
    const response = await page.goto(`${baseUrl}/settings`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (!response || response.status() >= 500) {
      throw new Error(`settings returned status ${response?.status() ?? "no-response"}`);
    }

    await page.getByTestId("heading-settings").waitFor({ state: "visible", timeout: 20000 });
    await page.getByTestId("settings-tab-money").click();
    await page.getByTestId("settings-money-panel").waitFor({ state: "visible", timeout: 10000 });
    await page.getByTestId("settings-money-strategy-editor").waitFor({ state: "visible", timeout: 5000 });
    await page.getByTestId("option-strategy-balanced").waitFor({ state: "visible", timeout: 5000 });
    await page.getByTestId("settings-money-gifter-rules-editor").waitFor({ state: "visible", timeout: 5000 });

    const stockSwitch = page.getByTestId("switch-allow-gifter-stock-pick");
    await stockSwitch.waitFor({ state: "visible", timeout: 5000 });
    const initialState = await stockSwitch.getAttribute("data-state");
    await stockSwitch.click();
    const nextState = await stockSwitch.getAttribute("data-state");
    if (initialState === nextState) {
      throw new Error(`gifter stock switch did not toggle, state stayed ${initialState}`);
    }

    const saveButton = page.getByTestId("button-save-gifting-rules");
    await saveButton.waitFor({ state: "visible", timeout: 5000 });

    const shot = await screenshot(page, "auth-settings-money");
    const detailParts: string[] = [`gifterStockSwitch=${initialState}->${nextState}`];
    if (pageErrors.length) detailParts.push(`pageErrors=${pageErrors.length}`);
    if (consoleErrors.length) detailParts.push(`consoleErrors=${consoleErrors.length}`);
    if (failedResponses.length) detailParts.push(`failedResponses=${failedResponses.length}`);
    results.push({
      name: "auth-settings-money",
      ok: true,
      detail: detailParts.join(", "),
      screenshot: shot,
    });
  } catch (error: any) {
    const shot = await screenshot(page, "auth-settings-money-fail");
    const detail = [
      error?.message || String(error),
      pageErrors.length ? `pageErrors=${pageErrors.join(" | ")}` : "",
      consoleErrors.length ? `consoleErrors=${consoleErrors.join(" | ")}` : "",
      failedResponses.length ? `failedResponses=${failedResponses.join(" | ")}` : "",
    ]
      .filter(Boolean)
      .join(" :: ");
    results.push({ name: "auth-settings-money", ok: false, detail, screenshot: shot });
  } finally {
    await page.close();
  }
}

async function runEventsPageCheck(
  context: BrowserContext,
  results: CheckResult[],
  seeded: { eventId: string },
) {
  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (resp) => {
    if (resp.status() >= 500) failedResponses.push(`${resp.status()} ${resp.url()}`);
  });

  try {
    const response = await page.goto(`${baseUrl}/events`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (!response || response.status() >= 500) {
      throw new Error(`events returned status ${response?.status() ?? "no-response"}`);
    }

    await page.getByTestId("heading-your-events").waitFor({ state: "visible", timeout: 20000 });
    const sharingModel = page.getByTestId("text-events-sharing-model");
    await sharingModel.waitFor({ state: "visible", timeout: 5000 });
    const sharingModelText = await sharingModel.innerText();
    if (!/One fund code always opens the anytime gift page/i.test(sharingModelText) || !/Event links and QR codes open a specific occasion page/i.test(sharingModelText)) {
      throw new Error(`events sharing model copy missing or changed: "${sharingModelText}"`);
    }

    await page.getByTestId(`button-view-details-${seeded.eventId}`).or(page.getByTestId(/^button-view-details-/).first()).click();
    await page.getByTestId(`text-page-url-${seeded.eventId}`).or(page.getByTestId(/^text-page-url-/).first()).waitFor({ state: "visible", timeout: 5000 });
    const eventLinkVisible = await page.getByText("Event page link", { exact: true }).isVisible().catch(() => false);
    const anytimeLinkVisible = await page.getByText("Anytime gift page", { exact: true }).isVisible().catch(() => false);
    if (!eventLinkVisible && !anytimeLinkVisible) {
      throw new Error("events detail drawer should show either Event page link or Anytime gift page");
    }
    const eventQrVisible = await page.getByText("Event QR code", { exact: true }).isVisible().catch(() => false);
    const anytimeQrVisible = await page.getByText("Anytime page QR code", { exact: true }).isVisible().catch(() => false);
    if (!eventQrVisible && !anytimeQrVisible) {
      throw new Error("events detail drawer should show either Event QR code or Anytime page QR code");
    }
    await page.getByText("Always opens the anytime gift page for this child", { exact: false }).waitFor({ state: "visible", timeout: 5000 });

    const anytimeBadgeVisible = await page.getByText("Anytime page", { exact: true }).first().isVisible().catch(() => false);
    const eventBadgeVisible = await page.getByText("Event page", { exact: true }).first().isVisible().catch(() => false);
    if (!anytimeBadgeVisible && !eventBadgeVisible) {
      throw new Error("events page should show at least one sharing lane badge");
    }

    const shot = await screenshot(page, "auth-events-sharing-model");
    const detailParts: string[] = [];
    if (pageErrors.length) detailParts.push(`pageErrors=${pageErrors.length}`);
    if (consoleErrors.length) detailParts.push(`consoleErrors=${consoleErrors.length}`);
    if (failedResponses.length) detailParts.push(`failedResponses=${failedResponses.length}`);
    results.push({
      name: "auth-events-sharing-model",
      ok: true,
      detail: detailParts.join(", ") || "events page clarifies anytime fund code versus event-specific links and QR codes",
      screenshot: shot,
    });
  } catch (error: any) {
    const shot = await screenshot(page, "auth-events-sharing-model-fail");
    const detail = [
      error?.message || String(error),
      pageErrors.length ? `pageErrors=${pageErrors.join(" | ")}` : "",
      consoleErrors.length ? `consoleErrors=${consoleErrors.join(" | ")}` : "",
      failedResponses.length ? `failedResponses=${failedResponses.join(" | ")}` : "",
    ]
      .filter(Boolean)
      .join(" :: ");
    results.push({ name: "auth-events-sharing-model", ok: false, detail, screenshot: shot });
  } finally {
    await page.close();
  }
}

async function runGiftCheckoutPreviewLogoCheck(
  context: BrowserContext,
  results: CheckResult[],
  seeded: { fundSlug: string },
) {
  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (resp) => {
    if (resp.status() >= 500) failedResponses.push(`${resp.status()} ${resp.url()}`);
  });

  try {
    const response = await page.goto(`${baseUrl}/${seeded.fundSlug}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (!response || response.status() >= 500) {
      throw new Error(`gift checkout returned status ${response?.status() ?? "no-response"}`);
    }

    await page.getByTestId("button-start-gift").click();
    await page.getByTestId("button-continue-to-preview").click();
    await page.getByTestId("input-gifter-stock-search").waitFor({ state: "visible", timeout: 10000 });
    await page.getByTestId("card-family-default-stock").waitFor({ state: "visible", timeout: 5000 });

    const familyDefaultLogo = page.getByTestId("stock-logo-AMZN").first();
    await familyDefaultLogo.waitFor({ state: "visible", timeout: 5000 });
    await page.getByTestId("text-preview-share-estimate").waitFor({ state: "visible", timeout: 5000 });
    const previewEstimateText = await page.getByTestId("text-preview-share-estimate").innerText();
    if (!/estimated price/i.test(previewEstimateText) || !/Final shares may change/i.test(previewEstimateText)) {
      throw new Error(`checkout preview estimate copy missing, got "${previewEstimateText}"`);
    }

    const appleStockButton = page.getByTestId("button-stock-AAPL");
    await appleStockButton.waitFor({ state: "visible", timeout: 5000 });
    await appleStockButton.getByTestId("stock-logo-AAPL").waitFor({ state: "visible", timeout: 5000 });

    const disneyStockButton = page.getByTestId("button-stock-DIS");
    await disneyStockButton.waitFor({ state: "visible", timeout: 5000 });
    await disneyStockButton.getByTestId("stock-logo-DIS").waitFor({ state: "visible", timeout: 5000 });

    await appleStockButton.click();
    await page.getByTestId("card-family-default-stock").waitFor({ state: "hidden", timeout: 5000 });
    await page.getByTestId("input-gifter-stock-search").fill("Amazon");
    await page.getByTestId("button-stock-AMZN").click();
    await page.getByTestId("card-family-default-stock").waitFor({ state: "visible", timeout: 5000 });
    await page.getByTestId("text-family-default-stock-note").waitFor({ state: "visible", timeout: 5000 });

    await page.getByTestId("button-continue-to-payment").click();
    await page.getByTestId("checkout-investment-preview").waitFor({ state: "visible", timeout: 10000 });
    await page.getByTestId("text-checkout-estimated-shares").waitFor({ state: "visible", timeout: 5000 });
    await page.getByTestId("text-payment-share-estimate").waitFor({ state: "visible", timeout: 5000 });
    const paymentEstimateText = await page.getByTestId("text-payment-share-estimate").innerText();
    if (!/Estimated at \$[\d,.]+\/share/i.test(paymentEstimateText) || !/Final shares may change/i.test(paymentEstimateText)) {
      throw new Error(`checkout payment estimate copy missing, got "${paymentEstimateText}"`);
    }
    await page.getByText("Optional premium gift upgrades make the moment more special.", { exact: false }).waitFor({ state: "visible", timeout: 5000 });
    await page.getByTestId("button-gift-addon-special").waitFor({ state: "visible", timeout: 5000 });
    await page.getByTestId("button-gift-addon-rich").waitFor({ state: "visible", timeout: 5000 });
    await page.getByTestId("button-gift-addon-keepsake").click();
    await page.getByTestId("line-premium-gift-upgrade").waitFor({ state: "visible", timeout: 5000 });
    const addOnLine = await page.getByTestId("line-premium-gift-upgrade").innerText();
    if (!/Premium gift upgrade/i.test(addOnLine) || !/\$6\.99/.test(addOnLine)) {
      throw new Error(`premium gift add-on line missing keepsake price, got "${addOnLine}"`);
    }
    const totalCharge = await page.getByTestId("text-total-charge").innerText();
    if (!/\$58\.74/.test(totalCharge)) {
      throw new Error(`premium gift add-on total should preserve gift plus processing plus $6.99, got "${totalCharge}"`);
    }
    await page.getByTestId("section-memory-attachment").waitFor({ state: "visible", timeout: 10000 });
    await page.getByTestId("button-add-memory-photo").waitFor({ state: "visible", timeout: 5000 });
    const tinyPngPath = path.join(outDir, "tiny-memory-photo.png");
    writeFileSync(
      tinyPngPath,
      Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64"),
    );
    await page.getByTestId("input-memory-photo").setInputFiles(tinyPngPath);
    await page.getByTestId("img-memory-photo-preview").waitFor({ state: "visible", timeout: 10000 });

    const shot = await screenshot(page, "gift-checkout-preview-stock-logos");
    const detailParts: string[] = [];
    if (pageErrors.length) detailParts.push(`pageErrors=${pageErrors.length}`);
    if (consoleErrors.length) detailParts.push(`consoleErrors=${consoleErrors.length}`);
    if (failedResponses.length) detailParts.push(`failedResponses=${failedResponses.length}`);
    results.push({
      name: "gift-checkout-preview-stock-logos",
      ok: true,
      detail: detailParts.join(", ") || "family default logos, estimate copy, stock picker logos, gift add-ons, investment preview, and memory photo upload visible",
      screenshot: shot,
    });
  } catch (error: any) {
    const shot = await screenshot(page, "gift-checkout-preview-stock-logos-fail");
    const detail = [
      error?.message || String(error),
      pageErrors.length ? `pageErrors=${pageErrors.join(" | ")}` : "",
      consoleErrors.length ? `consoleErrors=${consoleErrors.join(" | ")}` : "",
      failedResponses.length ? `failedResponses=${failedResponses.join(" | ")}` : "",
    ]
      .filter(Boolean)
      .join(" :: ");
    results.push({ name: "gift-checkout-preview-stock-logos", ok: false, detail, screenshot: shot });
  } finally {
    await page.close();
  }
}

async function runSendStockLogoCheck(context: BrowserContext, results: CheckResult[]) {
  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (resp) => {
    if (resp.status() >= 500) failedResponses.push(`${resp.status()} ${resp.url()}`);
  });

  try {
    const response = await page.goto(`${baseUrl}/send`, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (!response || response.status() >= 500) {
      throw new Error(`send returned status ${response?.status() ?? "no-response"}`);
    }

    await page.getByTestId("input-recipient-name").fill("Ava");
    await page.getByTestId("input-recipient-email").fill("ava@example.com");
    await page.getByTestId("button-continue-step0").click();

    const appleStockButton = page.getByTestId("stock-AAPL");
    await appleStockButton.waitFor({ state: "visible", timeout: 10000 });
    await appleStockButton.getByTestId("stock-logo-AAPL").waitFor({ state: "visible", timeout: 5000 });

    const amazonStockButton = page.getByTestId("stock-AMZN");
    await amazonStockButton.waitFor({ state: "visible", timeout: 5000 });
    await amazonStockButton.getByTestId("stock-logo-AMZN").waitFor({ state: "visible", timeout: 5000 });

    const shot = await screenshot(page, "send-stock-logos");
    const detailParts: string[] = [];
    if (pageErrors.length) detailParts.push(`pageErrors=${pageErrors.length}`);
    if (consoleErrors.length) detailParts.push(`consoleErrors=${consoleErrors.length}`);
    if (failedResponses.length) detailParts.push(`failedResponses=${failedResponses.length}`);
    results.push({
      name: "send-stock-logos",
      ok: true,
      detail: detailParts.join(", ") || "send stock picker logos visible",
      screenshot: shot,
    });
  } catch (error: any) {
    const shot = await screenshot(page, "send-stock-logos-fail");
    const detail = [
      error?.message || String(error),
      pageErrors.length ? `pageErrors=${pageErrors.join(" | ")}` : "",
      consoleErrors.length ? `consoleErrors=${consoleErrors.join(" | ")}` : "",
      failedResponses.length ? `failedResponses=${failedResponses.join(" | ")}` : "",
    ]
      .filter(Boolean)
      .join(" :: ");
    results.push({ name: "send-stock-logos", ok: false, detail, screenshot: shot });
  } finally {
    await page.close();
  }
}

async function registerAndSeed(context: BrowserContext, seedKey = "primary") {
  const email = `qa_ui_smoke_${seedKey}@example.com`;
  const password = "TestPass123!";
  const login = await context.request.post(`${baseUrl}/api/auth/login`, {
    data: { email, password },
  });
  if (login.status() !== 200) {
    const register = await context.request.post(`${baseUrl}/api/auth/register`, {
      data: { email, password, firstName: "UI", lastName: "QA" },
    });
    if (register.status() !== 201 && register.status() !== 200) {
      if (register.status() === 429) {
        const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (!existingUser) {
          const passwordHash = await bcrypt.hash(password, 10);
          await db.insert(users).values({
            email,
            firstName: "UI",
            lastName: "QA",
            passwordHash,
          });
        }
        await loginExisting(context, email, password);
      } else {
        throw new Error(
          `register/login failed: register=${register.status()} ${await register.text()} :: login=${login.status()} ${await login.text()}`,
        );
      }
    }
  }

  const seededUser = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!seededUser) {
    throw new Error(`seed user ${email} was not found after auth setup`);
  }
  const existingSubscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, seededUser.id),
  });
  if (existingSubscription) {
    await db
      .update(subscriptions)
      .set({
        plan: "family",
        billingInterval: "yearly",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        canceledAt: null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existingSubscription.id));
  } else {
    await db.insert(subscriptions).values({
      userId: seededUser.id,
      plan: "family",
      billingInterval: "yearly",
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  }

  const fundSlug = `qa-ui-fund-${Date.now()}`;
  const fundCreate = await context.request.post(`${baseUrl}/api/funds`, {
    data: {
      name: "UI QA Fund",
      slug: fundSlug,
      accountType: "UTMA",
      status: "active",
      // Per-fund UTMA acknowledgment is the legal-floor gate for non-draft UTMA
      // creation (routes.ts:3339). The real client (AddFundSheet) sends this when
      // the parent checks the box; the fixture must mirror it or creation 400s.
      // (Same requirement the dashboard-summary-refresh fixture already mirrors.)
      utmaAcknowledgedAt: new Date().toISOString(),
      recipientFirstName: "Kid",
      recipientRelation: "parent",
      investmentStrategy: "auto_invest",
      isDiscoverable: false,
    },
  });
  if (fundCreate.status() !== 201 && fundCreate.status() !== 200) {
    throw new Error(`fund create failed: ${fundCreate.status()} ${await fundCreate.text()}`);
  }
  const fund = await fundCreate.json();

  const preferenceUpdate = await context.request.patch(`${baseUrl}/api/funds/${fund.id}/investment-preferences`, {
    data: {
      defaultMode: "stock",
      defaultTicker: "AMZN",
      allowGifterStockPick: true,
      allowGifterCashGift: true,
      autoInvestEnabled: true,
    },
  });
  if (preferenceUpdate.status() !== 200) {
    throw new Error(`investment preferences update failed: ${preferenceUpdate.status()} ${await preferenceUpdate.text()}`);
  }

  const giftCreate = await context.request.post(`${baseUrl}/api/public/gifts`, {
    data: {
      fundId: fund.id,
      senderName: "Grandma Rose",
      senderEmail: "grandma.rose@example.com",
      amount: "50.00",
      processingFee: "0.00",
      koraFee: "0.00",
      netAmount: "50.00",
      message: "For the future you are going to build.",
      executionModel: "stock",
      selectedTicker: "AAPL",
      status: "invested",
    },
  });
  if (giftCreate.status() !== 201 && giftCreate.status() !== 200) {
    throw new Error(`gift create failed: ${giftCreate.status()} ${await giftCreate.text()}`);
  }

  const processingGiftCreate = await context.request.post(`${baseUrl}/api/public/gifts`, {
    data: {
      fundId: fund.id,
      senderName: "Aunt May",
      senderEmail: "aunt.may@example.com",
      amount: "25.00",
      processingFee: "0.00",
      koraFee: "0.00",
      netAmount: "25.00",
      message: "A little extra for later.",
      executionModel: "stock",
      selectedTicker: "SPOT",
      status: "processing",
    },
  });
  if (processingGiftCreate.status() !== 201 && processingGiftCreate.status() !== 200) {
    throw new Error(`processing gift create failed: ${processingGiftCreate.status()} ${await processingGiftCreate.text()}`);
  }
  const processingGift = await processingGiftCreate.json();
  await db
    .update(funds)
    .set({
      pendingBalance: "25.00",
      contributorCount: 2,
      updatedAt: new Date(),
    })
    .where(eq(funds.id, fund.id));

  const memoryCreate = await context.request.post(`${baseUrl}/api/funds/${fund.id}/memory`, {
    data: {
      type: "note",
      content: "This is the first page of the story. We started this fund because gifts should last.",
      authorName: "UI QA",
      visibility: "public",
      isFeatured: true,
    },
  });
  if (memoryCreate.status() !== 201 && memoryCreate.status() !== 200) {
    throw new Error(`memory create failed: ${memoryCreate.status()} ${await memoryCreate.text()}`);
  }

  const eventCreate = await context.request.post(`${baseUrl}/api/events`, {
    data: {
      fundId: fund.id,
      name: "UI QA Birthday",
      slug: `ui-qa-birthday-${Date.now()}`,
      description: "A smoke-test event for route protection.",
      eventType: "birthday",
      theme: "classic",
      status: "active",
      goalAmount: "250",
    },
  });
  if (eventCreate.status() !== 201 && eventCreate.status() !== 200) {
    throw new Error(`event create failed: ${eventCreate.status()} ${await eventCreate.text()}`);
  }
  const event = await eventCreate.json();

  const secondFundSlug = `qa-ui-second-fund-${Date.now()}`;
  const secondFundCreate = await context.request.post(`${baseUrl}/api/funds`, {
    data: {
      name: "Second QA Fund",
      slug: secondFundSlug,
      accountType: "UTMA",
      status: "active",
      // Same UTMA legal-floor ack as the first fund create above.
      utmaAcknowledgedAt: new Date().toISOString(),
      recipientFirstName: "Ava",
      recipientRelation: "parent",
      investmentStrategy: "auto_invest",
      isDiscoverable: false,
    },
  });
  if (secondFundCreate.status() !== 201 && secondFundCreate.status() !== 200) {
    throw new Error(`second fund create failed: ${secondFundCreate.status()} ${await secondFundCreate.text()}`);
  }
  const secondFund = await secondFundCreate.json();

  return {
    email,
    fundId: fund.id as string,
    secondFundId: secondFund.id as string,
    fundSlug,
    eventId: event.id as string,
    processingGiftId: processingGift.id as string,
  };
}

async function runPrivateApiOwnershipCheck(
  browser: Browser,
  results: CheckResult[],
  seeded: { fundId: string; eventId: string },
) {
  const otherContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    await registerAndSeed(otherContext, "secondary");

    const checks = [
      { name: "api-ownership-fund", path: `/api/funds/${seeded.fundId}` },
      { name: "api-ownership-memory", path: `/api/funds/${seeded.fundId}/memory` },
      { name: "api-ownership-event", path: `/api/events/${seeded.eventId}` },
      { name: "api-ownership-investment-preferences", path: `/api/funds/${seeded.fundId}/investment-preferences` },
    ];

    for (const check of checks) {
      const response = await otherContext.request.get(`${baseUrl}${check.path}`);
      if (response.status() !== 403) {
        results.push({
          name: check.name,
          ok: false,
          detail: `expected 403 for ${check.path}, got ${response.status()} ${await response.text()}`,
        });
      } else {
        results.push({ name: check.name, ok: true, detail: "cross-account access blocked" });
      }
    }
  } catch (error: any) {
    results.push({
      name: "api-ownership-private-routes",
      ok: false,
      detail: error?.message || String(error),
    });
  } finally {
    await otherContext.close();
  }
}

async function loginExisting(context: BrowserContext, email: string, password: string) {
  const login = await context.request.post(`${baseUrl}/api/auth/login`, {
    data: { email, password },
  });
  if (login.status() !== 200) {
    throw new Error(`login failed for ${email}: ${login.status()} ${await login.text()}`);
  }
}

async function warmUpContext(context: BrowserContext) {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1200);
  } finally {
    await page.close();
  }
}

async function ensureAdminUser(context: BrowserContext) {
  const email = "qa_admin_ui@example.com";
  const password = "TestPass123!";
  const login = await context.request.post(`${baseUrl}/api/auth/login`, {
    data: { email, password },
  });
  if (login.status() !== 200) {
    const register = await context.request.post(`${baseUrl}/api/auth/register`, {
      data: { email, password, firstName: "UI", lastName: "Admin" },
    });
    if (register.status() !== 201 && register.status() !== 200) {
      if (register.status() === 429 || register.status() === 409) {
        const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (!existingUser) {
          const passwordHash = await bcrypt.hash(password, 10);
          await db.insert(users).values({
            email,
            firstName: "UI",
            lastName: "Admin",
            passwordHash,
          });
        }
        await loginExisting(context, email, password);
      } else {
        throw new Error(
          `admin register/login failed: register=${register.status()} ${await register.text()} :: login=${login.status()} ${await login.text()}`,
        );
      }
    }
  }

  await db.update(users).set({ isAdmin: true }).where(eq(users.email, email));
  await loginExisting(context, email, password);
  return { email };
}

async function main() {
  ensureDir();
  let server: ChildProcess | undefined;
  let spawnedServer = false;
  if (await isHealthy()) {
    console.log(`> Reusing existing server at ${baseUrl}${HEALTH_PATH}`);
  } else {
    console.log("> Starting dev server for UI smoke");
    server = spawnNpm(["run", "dev"], {
      stdio: "ignore",
      detached: process.platform !== "win32",
      env: process.env,
    });
    server.unref();
    spawnedServer = true;
    await waitForHealth(server);
    console.log(`> Health check ready at ${baseUrl}${HEALTH_PATH}`);
  }

  const browser = await chromium.launch({ headless: true });
  const results: CheckResult[] = [];

  try {
    const publicContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await publicContext.addInitScript(() => {
      sessionStorage.setItem("kora-launched", "1");
    });
    await warmUpContext(publicContext);

    await runCheck(publicContext, results, "public-home", "/", "body");
    await runCheck(publicContext, results, "public-login", "/login", "[data-testid='input-login-email']");
    await runPricingPageCheck(publicContext, results);
    // Phase 7 surface smoke — pages shipped in the 2026-05-23 session
    // (sponsor-Plus + Founder gifting). Page-renders only; full
    // payment flow requires real Stripe and is verified manually
    // via the locked smoke checklist. These checks catch
    // route-wiring regressions + missing imports + 5xx errors.
    await runCheck(publicContext, results, "public-founding-members", "/founding-members", "[data-testid='text-founding-headline']");
    await runCheck(publicContext, results, "public-founding-members-open-gift", "/founding-members", "[data-testid='button-open-gift-founder']");
    await runCheck(publicContext, results, "public-sponsor-success-page", "/sponsor-success?demo=1&fundId=00000000-0000-4000-8000-000000000000&tier=starter", "[data-testid='text-sponsor-success-headline']");
    await runCheck(publicContext, results, "public-activity-redirect-login", "/activity", "[data-testid='input-login-email']");
    await runCheck(publicContext, results, "public-dashboard-redirect-login", "/dashboard", "[data-testid='input-login-email']");
    await runCheck(publicContext, results, "public-events-redirect-login", "/events", "[data-testid='input-login-email']");
    await runCheck(publicContext, results, "public-settings-redirect-login", "/settings", "[data-testid='input-login-email']");
    await runCheck(publicContext, results, "public-admin-redirect-login", "/admin", "[data-testid='input-login-email']");
    await runCheck(publicContext, results, "public-memory-redirect-login", "/memory/00000000-0000-4000-8000-000000000000", "[data-testid='input-login-email']");
    await runCheck(publicContext, results, "public-transition-fund-redirect-login", "/transition/fund/00000000-0000-4000-8000-000000000000", "[data-testid='input-login-email']");
    await publicContext.close();

    const authContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await authContext.addInitScript(() => {
      sessionStorage.setItem("kora-launched", "1");
    });
    await warmUpContext(authContext);
    const seeded = await registerAndSeed(authContext, "primary");

    await runCheck(authContext, results, "auth-dashboard", "/dashboard", "[data-testid='button-create-event-quick']");
    await runCheck(authContext, results, "auth-activity", "/activity", "[data-testid='heading-activity']");
    await runCheck(authContext, results, "auth-settings", "/settings", "[data-testid='heading-settings']");
    await runEventsPageCheck(authContext, results, seeded);
    await runSettingsMembershipCheck(authContext, results);
    await runSettingsNotificationsCheck(authContext, results);
    await runSettingsMoneyCheck(authContext, results);
    await runCheck(authContext, results, "auth-memory-book", `/memory/${seeded.fundId}`, "[data-testid='memory-story-controls']");
    await runDashboardInteractionCheck(authContext, results, seeded);
    await runDashboardCachedHeroRefreshCheck(authContext, results, seeded);
    await runPrivateApiOwnershipCheck(browser, results, seeded);
    await runCheck(authContext, results, "gift-checkout-fund", `/${seeded.fundSlug}`, "[data-testid='text-heading']");
    await runGiftCheckoutPreviewLogoCheck(authContext, results, seeded);
    await runSendStockLogoCheck(authContext, results);
    await authContext.close();

    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await adminContext.addInitScript(() => {
      sessionStorage.setItem("kora-launched", "1");
    });
    await warmUpContext(adminContext);
    try {
      await ensureAdminUser(adminContext);
      await runCheck(adminContext, results, "admin-overview", "/admin", "[data-testid='heading-system-health']");
      await runCheck(adminContext, results, "admin-plg-motions", "/admin", "[data-testid='heading-plg-motions-levers']");
    } catch (error: any) {
      results.push({
        name: "admin-login-and-pages",
        ok: false,
        detail: error?.message || String(error),
      });
    } finally {
      await adminContext.close();
    }
  } finally {
    await browser.close();
    if (spawnedServer && server && !server.killed) {
      console.log("> Stopping dev server");
      killProcessTree(server.pid!);
    }
    await pool.end().catch(() => null);
  }

  const reportPath = path.join(outDir, "report.json");
  writeFileSync(reportPath, JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), results }, null, 2));

  const failures = results.filter((r) => !r.ok);
  console.log(`UI smoke complete. ${results.length - failures.length}/${results.length} checks passed.`);
  console.log(`Report: ${reportPath}`);
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) {
      console.log(`- ${f.name}: ${f.detail || "unknown failure"}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("UI smoke crashed:", err);
  process.exit(1);
});
