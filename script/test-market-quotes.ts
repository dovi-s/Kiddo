/* eslint-disable no-console */
import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";

const baseUrl = process.env.MARKET_QUOTES_BASE_URL || "http://127.0.0.1:5000";
const HEALTH_TIMEOUT_MS = 90_000;
const HEALTH_POLL_MS = 1_000;

type QuoteRow = {
  symbol: string;
  name: string;
  price: number;
  source: "finnhub" | "alpha_vantage" | "cache" | "estimate";
  isEstimate: boolean;
  asOf: string;
};

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

async function expectJson(path: string, expectedStatus: number) {
  const res = await fetch(`${baseUrl}${path}`);
  assert(res.status === expectedStatus, `${path} expected ${expectedStatus}, got ${res.status}`);
  return res.json();
}

function validateQuote(row: QuoteRow) {
  assert(/^[A-Z.]+$/.test(row.symbol), `invalid symbol ${row.symbol}`);
  assert(typeof row.name === "string" && row.name.length > 0, `${row.symbol} missing name`);
  assert(Number.isFinite(row.price) && row.price > 0, `${row.symbol} invalid price`);
  assert(["finnhub", "alpha_vantage", "cache", "estimate"].includes(row.source), `${row.symbol} invalid source`);
  assert(typeof row.isEstimate === "boolean", `${row.symbol} missing isEstimate boolean`);
  assert(!Number.isNaN(Date.parse(row.asOf)), `${row.symbol} invalid asOf`);
}

async function runChecks() {
  console.log(`Running market quote API checks against ${baseUrl}`);

  const missingSymbols = await expectJson("/api/market/quotes", 400);
  assert(typeof missingSymbols.error === "string", "missing-symbols response should include an error");
  console.log("- rejects missing symbols ... ok");

  const quoteResponse = await expectJson("/api/market/quotes?symbols=AAPL,AMZN,AAPL,NOPE", 200) as { quotes?: QuoteRow[] };
  assert(Array.isArray(quoteResponse.quotes), "quotes response should include quotes array");

  const symbols = quoteResponse.quotes.map((quote) => quote.symbol);
  assert(symbols.includes("AAPL"), "quotes should include AAPL");
  assert(symbols.includes("AMZN"), "quotes should include AMZN");
  assert(!symbols.includes("NOPE"), "quotes should omit unsupported symbols");
  assert(symbols.filter((symbol) => symbol === "AAPL").length === 1, "quotes should dedupe repeated symbols");

  for (const quote of quoteResponse.quotes) validateQuote(quote);
  console.log("- returns validated quote rows ... ok");
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

  try {
    await runChecks();
    console.log("Market quote API checks passed.");
  } finally {
    if (server?.pid) killProcessTree(server.pid);
  }
}

main().catch((error) => {
  console.error("Market quote API checks failed:", error?.message || error);
  process.exit(1);
});
