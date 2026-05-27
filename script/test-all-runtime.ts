/* eslint-disable no-console */
import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";
import process from "node:process";

const HEALTH_URL = process.env.SMOKE_BASE_URL || "http://127.0.0.1:5000";
const HEALTH_PATH = "/api/health";
const HEALTH_TIMEOUT_MS = 90_000;
const HEALTH_POLL_MS = 1_000;

const TEST_STEPS = [
  "test:smoke",
  "test:monetization",
  "test:dashboard-money-math",
  "test:dashboard-summary-refresh",
  "test:sell-quick-amounts",
  "test:dashboard-bundle-budget",
  "test:gift-reconciliation-repair",
  "test:stripe-pipeline:strict",
  "test:founder-claim",
  "test:launch-readiness",
  "test:memory-utils",
  "test:mobile-gifter-logos",
  "test:ui:smoke",
] as const;

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

async function isHealthy(baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}${HEALTH_PATH}`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(baseUrl: string, server?: ChildProcess) {
  const startedAt = Date.now();
  const target = `${baseUrl}${HEALTH_PATH}`;

  while (Date.now() - startedAt < HEALTH_TIMEOUT_MS) {
    if (server && server.exitCode !== null && server.exitCode !== 0) {
      throw new Error(`Dev server exited early with code ${server.exitCode}`);
    }

    if (await isHealthy(baseUrl)) {
      return;
    }

    await delay(HEALTH_POLL_MS);
  }

  throw new Error(`Timed out waiting for ${target}`);
}

function runNpmScript(scriptName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n> Running ${scriptName}`);
    const child = spawnNpm(["run", scriptName], {
      stdio: "inherit",
      env: { ...process.env, SMOKE_BASE_URL: HEALTH_URL },
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${scriptName} failed with exit code ${code}`));
    });
  });
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

async function main() {
  let server: ChildProcess | undefined;
  let spawnedServer = false;

  if (await isHealthy(HEALTH_URL)) {
    console.log(`> Reusing existing server at ${HEALTH_URL}${HEALTH_PATH}`);
  } else {
    console.log("> Starting dev server for runtime test suite");
    server = spawnNpm(["run", "dev"], {
      stdio: "inherit",
      detached: process.platform !== "win32",
      env: process.env,
    });
    spawnedServer = true;

    await waitForHealth(HEALTH_URL, server);
    console.log(`> Health check ready at ${HEALTH_URL}${HEALTH_PATH}`);
  }

  try {
    for (const step of TEST_STEPS) {
      await runNpmScript(step);
    }

    console.log("\nAll runtime tests passed.");
  } finally {
    if (spawnedServer && server && !server.killed) {
      console.log("\n> Stopping dev server");
      killProcessTree(server.pid!);
    }
  }
}

main().catch((error) => {
  console.error("Runtime test suite failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
