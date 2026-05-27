/* eslint-disable no-console */
// E2E for the founding-member claim flow (project_founding_member_claim_flow_spec.md,
// tasks #2/#3). Exercises the real HTTP endpoints against a running server:
//   seed an unclaimed founder -> mint a claim token -> POST /verify ->
//   POST /complete (create+link user, stamp founderTier, sign in) -> assert DB
//   invariants -> replay the token and confirm it's rejected (single-use).
//
// Cleans up the synthetic founder + user it creates (email on the RFC-2606
// @example.com test domain, position far above the 1,000-cap real range).

import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";
import { request, type APIRequestContext } from "playwright";
import { eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import { users, foundingMembers } from "../shared/models/auth";
import { issueFounderClaimToken } from "../server/services/founderClaimAuth";

const baseUrl = process.env.SMOKE_BASE_URL || process.env.FOUNDER_CLAIM_BASE_URL || "http://127.0.0.1:5000";
const HEALTH_TIMEOUT_MS = 90_000;
const HEALTH_POLL_MS = 1_000;

const TEST_EMAIL = `qa_founder_claim_${Date.now()}@example.com`;
// Position far above the 1,000-cap real range so we never collide with a
// genuine founder row (founding_members.position is unique).
const TEST_POSITION = 900_000 + Math.floor(Math.random() * 90_000);

function spawnNpm(args: string[], options: SpawnOptions): ChildProcess {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", `npm ${args.join(" ")}`], options);
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

async function cleanup() {
  // Self-healing: sweep this run's row AND any orphaned qa_founder_claim test
  // users from prior runs. The complete flow creates a user that FKs a
  // subscription + a 'signup' analytics event, so those must be cleared before
  // the user delete. Raw pool queries keep the LIKE-pattern sweep simple.
  const pattern = "qa_founder_claim_%@example.com";
  try {
    const orphans = await pool.query(`SELECT id FROM users WHERE email LIKE $1`, [pattern]);
    for (const row of orphans.rows) {
      await pool.query(`DELETE FROM analytics_events WHERE user_id = $1`, [row.id]).catch(() => undefined);
      await pool.query(`DELETE FROM subscriptions WHERE user_id = $1`, [row.id]).catch(() => undefined);
    }
    await pool.query(`DELETE FROM founding_members WHERE email LIKE $1`, [pattern]).catch(() => undefined);
    await pool.query(`DELETE FROM users WHERE email LIKE $1`, [pattern]).catch(() => undefined);
  } catch (e: any) {
    console.warn("[founder-claim] cleanup warning:", e?.message || e);
  }
}

async function runChecks(api: APIRequestContext) {
  await cleanup(); // fresh slate

  // 1. Seed an unclaimed founder.
  await db.insert(foundingMembers).values({
    email: TEST_EMAIL,
    firstName: "QAFounder",
    position: TEST_POSITION,
    sourceSurface: "e2e-test",
  });

  // 2. Mint a claim token (same DB the server reads).
  const issued = await issueFounderClaimToken(TEST_EMAIL);
  assert(issued, "issueFounderClaimToken returned a token for the seeded founder");
  const rawToken = issued!.rawToken;

  // 3. verify -> founder info (read-only; does not consume).
  const verifyRes = await api.post(`${baseUrl}/api/auth/founder-claim/verify`, { data: { token: rawToken } });
  assert(verifyRes.status() === 200, `verify failed: ${verifyRes.status()} ${await verifyRes.text()}`);
  const vbody = await verifyRes.json();
  assert(vbody.position === TEST_POSITION, `verify position mismatch: ${vbody.position}`);
  assert(String(vbody.email).toLowerCase() === TEST_EMAIL.toLowerCase(), "verify email matches");

  // 4. complete -> create+link user, stamp founderTier, sign in.
  const completeRes = await api.post(`${baseUrl}/api/auth/founder-claim/complete`, { data: { token: rawToken } });
  assert(completeRes.status() === 200, `complete failed: ${completeRes.status()} ${await completeRes.text()}`);
  const cbody = await completeRes.json();
  assert(cbody?.founder?.claimed === true, "complete response marks the founder claimed");

  // 5. DB invariants.
  const [founderRow] = await db
    .select({
      claimedAt: foundingMembers.claimedAt,
      claimToken: foundingMembers.claimToken,
      claimedUserId: foundingMembers.claimedUserId,
    })
    .from(foundingMembers)
    .where(eq(foundingMembers.email, TEST_EMAIL));
  assert(founderRow?.claimedAt, "founder row claimedAt stamped");
  assert(!founderRow?.claimToken, "founder claim token cleared (single-use)");
  assert(founderRow?.claimedUserId, "founder linked to a user");
  const [userRow] = await db
    .select({ founderTier: users.founderTier })
    .from(users)
    .where(eq(users.email, TEST_EMAIL));
  assert(userRow?.founderTier === "plus_founder", `user founderTier should be plus_founder, got ${userRow?.founderTier}`);

  // 6. Replay rejected — token was cleared, so verify/complete fail closed.
  const replayRes = await api.post(`${baseUrl}/api/auth/founder-claim/complete`, { data: { token: rawToken } });
  assert(replayRes.status() !== 200, `replay should be rejected, got ${replayRes.status()}`);

  console.log("Founder claim flow passed.");
}

async function main() {
  let server: ChildProcess | undefined;
  if (!(await isHealthy())) {
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
    api = await request.newContext({ baseURL: baseUrl, extraHTTPHeaders: { Accept: "application/json" } });
    await runChecks(api);
  } finally {
    await cleanup();
    await api?.dispose();
    if (server?.pid) killProcessTree(server.pid);
    await pool.end().catch(() => undefined);
  }
}

main().catch((error: any) => {
  console.error("Founder claim flow failed:", error?.message || error);
  process.exit(1);
});
