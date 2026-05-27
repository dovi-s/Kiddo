/* eslint-disable no-console */
import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";
import bcrypt from "bcryptjs";
import { request, type APIRequestContext } from "playwright";
import { db, pool } from "../server/db";
import { users } from "../shared/models/auth";
import { funds as fundsTable, subscriptions } from "../shared/schema";
import { eq } from "drizzle-orm";

const baseUrl = process.env.DASHBOARD_SUMMARY_BASE_URL || "http://127.0.0.1:5000";
const HEALTH_TIMEOUT_MS = 90_000;
const HEALTH_POLL_MS = 1_000;

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
    const res = await fetch(`${baseUrl}/api/health`);
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
  throw new Error(`Timed out waiting for ${baseUrl}/api/health`);
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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function loginExisting(api: APIRequestContext, email: string, password: string) {
  const login = await api.post(`${baseUrl}/api/auth/login`, {
    data: { email, password },
  });
  if (login.status() !== 200) {
    throw new Error(`login failed for ${email}: ${login.status()} ${await login.text()}`);
  }
}

async function createAuthedApiContext() {
  const api = await request.newContext({
    baseURL: baseUrl,
    extraHTTPHeaders: {
      Accept: "application/json",
    },
  });

  const email = "qa_dashboard_summary_refresh@example.com";
  const password = "TestPass123!";
  const login = await api.post(`${baseUrl}/api/auth/login`, {
    data: { email, password },
  });
  if (login.status() !== 200) {
    const register = await api.post(`${baseUrl}/api/auth/register`, {
      data: { email, password, firstName: "API", lastName: "QA" },
    });
    if (register.status() !== 201 && register.status() !== 200) {
      if (register.status() === 429) {
        const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (!existingUser) {
          const passwordHash = await bcrypt.hash(password, 10);
          await db.insert(users).values({
            email,
            firstName: "API",
            lastName: "QA",
            passwordHash,
          });
        }
        await loginExisting(api, email, password);
      } else {
        throw new Error(
          `register/login failed: register=${register.status()} ${await register.text()} :: login=${login.status()} ${await login.text()}`,
        );
      }
    }
  }

  const apiUser = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!apiUser) {
    throw new Error(`seed user ${email} was not found after auth setup`);
  }

  const existingSubscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, apiUser.id),
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
      userId: apiUser.id,
      plan: "family",
      billingInterval: "yearly",
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  }

  return { api };
}

async function runChecks(api: APIRequestContext) {
  const slug = `qa-dashboard-summary-${Date.now()}`;
  const fundCreate = await api.post(`${baseUrl}/api/funds`, {
    data: {
      name: "Dashboard Summary QA Fund",
      slug,
      accountType: "UTMA",
      status: "active",
      // Non-draft UTMA creation requires the per-fund UTMA acknowledgment (the
      // "legal floor" gate in POST /api/funds). The real client (AddFundSheet)
      // sends this when the parent checks the box; the test must mirror it or
      // fund creation 400s with "Per-fund UTMA acknowledgment is required".
      utmaAcknowledgedAt: new Date().toISOString(),
      recipientFirstName: "Mia",
      recipientRelation: "parent",
      investmentStrategy: "auto_invest",
      isDiscoverable: false,
    },
  });
  assert(
    fundCreate.status() === 201 || fundCreate.status() === 200,
    `fund create failed: ${fundCreate.status()} ${await fundCreate.text()}`,
  );
  const fund = await fundCreate.json();

  const processingGiftCreate = await api.post(`${baseUrl}/api/public/gifts`, {
    data: {
      fundId: fund.id,
      senderName: "Grandma Refresh",
      senderEmail: "grandma.refresh@example.com",
      amount: "25.00",
      processingFee: "0.00",
      koraFee: "0.00",
      netAmount: "25.00",
      message: "For the next chapter.",
      executionModel: "stock",
      selectedTicker: "SPOT",
      status: "processing",
    },
  });
  assert(
    processingGiftCreate.status() === 201 || processingGiftCreate.status() === 200,
    `processing gift create failed: ${processingGiftCreate.status()} ${await processingGiftCreate.text()}`,
  );
  const processingGift = await processingGiftCreate.json();

  await db
    .update(fundsTable)
    .set({
      pendingBalance: "25.00",
      cashBalance: "0.00",
      balance: "0.00",
      contributorCount: 1,
      updatedAt: new Date(),
    })
    .where(eq(fundsTable.id, fund.id));

  const beforeSummaryResponse = await api.get(`${baseUrl}/api/funds/${fund.id}/dashboard-summary`);
  assert(beforeSummaryResponse.status() === 200, `dashboard summary before refresh failed: ${beforeSummaryResponse.status()}`);
  const beforeSummary = await beforeSummaryResponse.json();
  assert(Array.isArray(beforeSummary.holdings), "dashboard summary should include holdings array");
  assert(beforeSummary.holdings.length === 0, "processing-only fund should have no holdings before investment");
  assert(
    Array.isArray(beforeSummary.gifts) &&
      beforeSummary.gifts.some((gift: any) => String(gift.id) === String(processingGift.id) && String(gift.status).toLowerCase() === "processing"),
    "dashboard summary should reflect the processing gift before refresh",
  );

  const autoInvest = await api.post(`${baseUrl}/api/funds/${fund.id}/auto-invest`, {
    data: {
      amount: "25.00",
      ticker: "SPOT",
    },
  });
  assert(autoInvest.status() === 200, `auto-invest failed: ${autoInvest.status()} ${await autoInvest.text()}`);

  const afterSummaryResponse = await api.get(`${baseUrl}/api/funds/${fund.id}/dashboard-summary`);
  assert(afterSummaryResponse.status() === 200, `dashboard summary after refresh failed: ${afterSummaryResponse.status()}`);
  const afterSummary = await afterSummaryResponse.json();
  const spotHolding = (afterSummary.holdings || []).find((holding: any) => {
    const symbol = String(holding.ticker || holding.symbol || holding.name || "").toUpperCase();
    return symbol.includes("SPOT");
  });
  assert(spotHolding, "dashboard summary should include a SPOT holding after auto-invest refresh");
  assert(
    Array.isArray(afterSummary.transactions) &&
      afterSummary.transactions.length >= (beforeSummary.transactions?.length || 0),
    "dashboard summary should include refreshed transactions after auto-invest",
  );

  console.log("Dashboard summary refresh semantics passed.");
}

async function main() {
  let server: ChildProcess | undefined;
  const alreadyHealthy = await isHealthy();

  if (!alreadyHealthy) {
    server = spawnNpm(["run", "dev"], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_OPTIONS: "--use-system-ca", NODE_ENV: "development" },
      stdio: "ignore",
      detached: process.platform !== "win32",
    });
    await waitForHealth(server);
  }

  let api: APIRequestContext | undefined;

  try {
    const context = await createAuthedApiContext();
    api = context.api;
    await runChecks(api);
  } finally {
    await api?.dispose();
    if (server?.pid) killProcessTree(server.pid);
    await pool.end().catch(() => null);
  }
}

main().catch((error) => {
  console.error("Dashboard summary refresh semantics failed:", error?.message || error);
  process.exit(1);
});
