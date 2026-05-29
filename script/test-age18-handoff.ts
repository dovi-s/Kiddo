/* eslint-disable no-console */
// E2E for the age-of-majority (18/21) HANDOFF flow. Exercises the real HTTP
// endpoints against a running server, end to end:
//
//   seed parent + a fund whose child is PAST majority (majorityAge 21, kid 22)
//   + an active parent recurring contribution + a co-parent collaborator
//   -> mint an invite token (patchAgeTransitionRecord, same writer the app uses)
//   -> register the KID (session established)
//   -> POST /api/age-transition/:token/claim  (kid claims)
//   -> POST /api/age-transition/:token/complete  (atomic ownership transfer)
//   -> assert every cascade fired:
//        * fund.userId flipped to the kid; accountType=Personal; relation=self
//        * fund.transferredAt + previousOwnerId stamped
//        * age_transitions.ownershipTransferredAt / *ByUserId / formerCustodian
//        * co-parent collaborators revoked (count 0)
//        * parent recurring contribution paused with reason 'majority_handoff'
//   -> POST /api/funds/:fundId/welcome-complete  (kid finishes the walkthrough)
//   -> assert fund.kidWelcomeCompletedAt stamped
//   -> replay /complete and confirm it's idempotent (already-transferred)
//
// This is the app-layer guarantee. When DriveWealth custody is wired, ADD
// assertions here that the real brokerage account transfer fired (today it
// queues to an outbox — see CUSTODIAN_SOURCE_OF_TRUTH.md). Until then the test
// locks in everything Kiddo controls about the handoff.
//
// Uses RFC-2606 @example.com emails + a qa-handoff-* slug so the self-healing
// cleanup can sweep this run's rows (and any orphans from a crashed prior run).

import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";
import { randomUUID } from "node:crypto";
import { request, type APIRequestContext } from "playwright";
import { pool } from "../server/db";
import { storage } from "../server/storage";
import { patchAgeTransitionRecord, getAgeTransitionRecord } from "../server/ageTransitionStore";

const baseUrl = process.env.SMOKE_BASE_URL || process.env.AGE18_HANDOFF_BASE_URL || "http://127.0.0.1:5000";
const HEALTH_TIMEOUT_MS = 90_000;
const HEALTH_POLL_MS = 1_000;
const PASSWORD = "TestPass123!";
const stamp = Date.now();
const PARENT_EMAIL = `qa_handoff_parent_${stamp}@example.com`;
const KID_EMAIL = `qa_handoff_kid_${stamp}@example.com`;
const COPARENT_EMAIL = `qa_handoff_coparent_${stamp}@example.com`;
const FUND_SLUG = `qa-handoff-${stamp}`;

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
  // Self-healing sweep: this run's rows + any orphaned qa_handoff_* rows from a
  // crashed prior run. Delete dependents before parents to respect FKs.
  const userPattern = "qa_handoff_%@example.com";
  try {
    const usersRes = await pool.query(`SELECT id FROM users WHERE email LIKE $1`, [userPattern]);
    const userIds = usersRes.rows.map((r) => r.id);
    const fundsRes = await pool.query(
      `SELECT id FROM funds WHERE slug LIKE 'qa-handoff-%'
         ${userIds.length ? "OR user_id = ANY($1::varchar[])" : ""}`,
      userIds.length ? [userIds] : [],
    );
    const fundIds = fundsRes.rows.map((r) => r.id);

    if (fundIds.length) {
      await pool.query(`DELETE FROM activities WHERE fund_id = ANY($1::varchar[])`, [fundIds]).catch(() => undefined);
      await pool.query(`DELETE FROM parent_contributions WHERE fund_id = ANY($1::varchar[])`, [fundIds]).catch(() => undefined);
      await pool.query(`DELETE FROM fund_collaborators WHERE fund_id = ANY($1::varchar[])`, [fundIds]).catch(() => undefined);
      await pool.query(`DELETE FROM age_transitions WHERE fund_id = ANY($1::varchar[])`, [fundIds]).catch(() => undefined);
      await pool.query(`DELETE FROM events WHERE fund_id = ANY($1::varchar[])`, [fundIds]).catch(() => undefined);
      await pool.query(`DELETE FROM funds WHERE id = ANY($1::varchar[])`, [fundIds]).catch(() => undefined);
    }
    if (userIds.length) {
      await pool.query(`DELETE FROM activities WHERE user_id = ANY($1::varchar[])`, [userIds]).catch(() => undefined);
      await pool.query(`DELETE FROM analytics_events WHERE user_id = ANY($1::varchar[])`, [userIds]).catch(() => undefined);
      await pool.query(`DELETE FROM subscriptions WHERE user_id = ANY($1::varchar[])`, [userIds]).catch(() => undefined);
      // bank_accounts after parent_contributions (FK: pc.bank_account_id -> bank).
      await pool.query(`DELETE FROM bank_accounts WHERE user_id = ANY($1::varchar[])`, [userIds]).catch(() => undefined);
      await pool.query(`DELETE FROM users WHERE id = ANY($1::varchar[])`, [userIds]).catch(() => undefined);
    }
  } catch (e: any) {
    console.warn("[age18-handoff] cleanup warning:", e?.message || e);
  }
}

// Register a user via the real endpoint in a throwaway context (so its session
// doesn't clobber the caller's). Returns the new user id.
async function registerUser(email: string): Promise<string> {
  const ctx = await request.newContext({ baseURL: baseUrl, extraHTTPHeaders: { Accept: "application/json" } });
  try {
    const res = await ctx.post(`${baseUrl}/api/auth/register`, { data: { email, password: PASSWORD, firstName: "QA" } });
    assert(res.status() === 201, `register ${email} failed: ${res.status()} ${await res.text()}`);
    const body = await res.json();
    assert(body?.id, `register ${email} returned no id`);
    return body.id as string;
  } finally {
    await ctx.dispose();
  }
}

async function runChecks() {
  await cleanup(); // fresh slate

  // 1. Parent (owns the fund). Registered via API so all user defaults are set.
  const parentId = await registerUser(PARENT_EMAIL);

  // 2. Fund whose child is PAST majority: majorityAge 21, birthdate ~22y ago,
  //    so getAgeMilestoneState(...).inviteEligible is true.
  const birthdate = new Date(Date.now() - 22 * 365.25 * 86_400_000);
  const fund = await storage.createFund({
    userId: parentId,
    name: "QA Handoff Fund",
    slug: FUND_SLUG,
    recipientFirstName: "QAChild",
    recipientRelation: "daughter",
    recipientBirthdate: birthdate,
    majorityAge: 21,
    accountType: "UTMA",
    status: "active",
    balance: "1000.00",
  } as any);
  assert(fund?.id, "createFund returned a fund id");

  // 3. An active parent recurring contribution (should auto-pause at handoff).
  const contrib = await storage.createParentContribution({
    fundId: fund.id,
    userId: parentId,
    amount: "50.00",
    frequency: "monthly",
    status: "active",
  } as any);
  assert(contrib?.id, "createParentContribution returned an id");

  // 4. A co-parent collaborator (should be revoked at handoff).
  await storage.createCollaborator({
    fundId: fund.id,
    email: COPARENT_EMAIL,
    role: "co-admin",
    status: "accepted",
  } as any);

  // 5. Mint an invite token via the same writer the app uses (plaintext token,
  //    looked up by findAgeTransitionByToken).
  const inviteToken = randomUUID();
  await patchAgeTransitionRecord(fund.id, {
    inviteToken,
    invitedAt: new Date().toISOString(),
  });

  // 6. The KID registers (this context becomes authenticated as the kid).
  const kid = await request.newContext({ baseURL: baseUrl, extraHTTPHeaders: { Accept: "application/json" } });
  try {
    const regRes = await kid.post(`${baseUrl}/api/auth/register`, { data: { email: KID_EMAIL, password: PASSWORD, firstName: "QAKid" } });
    assert(regRes.status() === 201, `kid register failed: ${regRes.status()} ${await regRes.text()}`);
    const kidId = (await regRes.json()).id as string;
    assert(kidId, "kid register returned no id");

    // 7. Claim.
    const claimRes = await kid.post(`${baseUrl}/api/age-transition/${inviteToken}/claim`);
    assert(claimRes.status() === 200, `claim failed: ${claimRes.status()} ${await claimRes.text()}`);
    const afterClaim = await getAgeTransitionRecord(fund.id);
    assert(afterClaim?.childClaimedByUserId === kidId, `claim should stamp childClaimedByUserId=kid (got ${afterClaim?.childClaimedByUserId})`);

    // 8. Complete the transfer.
    const completeRes = await kid.post(`${baseUrl}/api/age-transition/${inviteToken}/complete`);
    assert(completeRes.status() === 200, `complete failed: ${completeRes.status()} ${await completeRes.text()}`);

    // 9. Assert every cascade.
    const movedFund = await storage.getFund(fund.id);
    assert(movedFund, "fund still exists after transfer");
    assert((movedFund as any).userId === kidId, `fund.userId should flip to kid (got ${(movedFund as any).userId})`);
    assert(String((movedFund as any).accountType).toLowerCase() === "personal", `accountType should be Personal (got ${(movedFund as any).accountType})`);
    assert(String((movedFund as any).recipientRelation).toLowerCase() === "self", `recipientRelation should be self (got ${(movedFund as any).recipientRelation})`);
    assert((movedFund as any).transferredAt, "fund.transferredAt should be stamped");
    assert((movedFund as any).previousOwnerId === parentId, `fund.previousOwnerId should be the parent (got ${(movedFund as any).previousOwnerId})`);

    const rec = await getAgeTransitionRecord(fund.id);
    assert(rec?.ownershipTransferredAt, "age_transitions.ownershipTransferredAt should be stamped");
    assert(rec?.ownershipTransferredByUserId === kidId, `ownershipTransferredByUserId should be kid (got ${rec?.ownershipTransferredByUserId})`);
    assert(rec?.formerCustodianUserId === parentId, `formerCustodianUserId should be parent (got ${rec?.formerCustodianUserId})`);

    const collabCount = await pool.query(`SELECT COUNT(*)::int AS n FROM fund_collaborators WHERE fund_id = $1`, [fund.id]);
    assert(collabCount.rows[0].n === 0, `co-parent collaborators should be revoked (found ${collabCount.rows[0].n})`);

    const pcRow = await pool.query(`SELECT status, pause_reason FROM parent_contributions WHERE id = $1`, [contrib.id]);
    assert(pcRow.rows[0]?.status === "paused", `recurring should be paused (got ${pcRow.rows[0]?.status})`);
    assert(pcRow.rows[0]?.pause_reason === "majority_handoff", `pause_reason should be majority_handoff (got ${pcRow.rows[0]?.pause_reason})`);

    // 10. Welcome walkthrough completion.
    const welcomeRes = await kid.post(`${baseUrl}/api/funds/${fund.id}/welcome-complete`);
    assert(welcomeRes.status() === 200, `welcome-complete failed: ${welcomeRes.status()} ${await welcomeRes.text()}`);
    const welcomedFund = await storage.getFund(fund.id);
    assert((welcomedFund as any).kidWelcomeCompletedAt, "fund.kidWelcomeCompletedAt should be stamped");

    // 11. Replay /complete — idempotent (already transferred returns success).
    const replayRes = await kid.post(`${baseUrl}/api/age-transition/${inviteToken}/complete`);
    assert(replayRes.status() === 200, `replay complete should be idempotent 200 (got ${replayRes.status()})`);

    // 12. Owner-recurring: the now-adult owner sets up their OWN recurring for
    //     FREE (no Plus) — subscription retires at majority, AUM is the
    //     post-handoff revenue. The kid is on the free plan (no coverage), so a
    //     201 here proves the post-handoff-owner exception (not a paid plan).
    //     Recurring needs a linked bank for EVERYONE (parent + owner alike), so
    //     seed one for the kid first — the owner flow is parity with the parent.
    const kidBank = await storage.createBankAccount({ userId: kidId, bankName: "QA Bank", accountLast4: "1111" } as any);
    const ownerRecurringRes = await kid.post(`${baseUrl}/api/funds/${fund.id}/parent-contributions`, {
      data: { amount: "25", frequency: "monthly", executionModel: "auto", bankAccountId: kidBank.id },
    });
    assert(ownerRecurringRes.status() === 201, `owner should create recurring free post-handoff (got ${ownerRecurringRes.status()} ${await ownerRecurringRes.text()})`);
    const ownerListRes = await kid.get(`${baseUrl}/api/funds/${fund.id}/parent-contributions`);
    assert(ownerListRes.status() === 200, `owner recurring GET should be 200, not gated (got ${ownerListRes.status()})`);
    const ownerList = await ownerListRes.json();
    assert(
      Array.isArray(ownerList) && ownerList.some((c: any) => parseFloat(c.amount) === 25 && c.userId === kidId && c.status === "active"),
      "the owner's own new recurring should appear in the list, owned by the kid, active",
    );
    // And the parent's old plan is still there as paused/majority_handoff (read-only history).
    assert(
      ownerList.some((c: any) => c.pauseReason === "majority_handoff"),
      "the parent's handed-off plan should still be present as majority_handoff history",
    );

    // 13. Post-handoff lockout: the FORMER PARENT still owns their old record,
    //     but the fund transferred to the kid — so the record-scoped routes must
    //     refuse (fund.userId !== record.userId). Prove resume + contribute-now
    //     both 403, so a direct-API former parent can't reanimate a charge on a
    //     fund they no longer own.
    const parentCtx = await request.newContext({ baseURL: baseUrl, extraHTTPHeaders: { Accept: "application/json" } });
    try {
      const loginRes = await parentCtx.post(`${baseUrl}/api/auth/login`, { data: { email: PARENT_EMAIL, password: PASSWORD } });
      assert(loginRes.status() === 200, `parent login failed: ${loginRes.status()} ${await loginRes.text()}`);
      const resumeRes = await parentCtx.patch(`${baseUrl}/api/parent-contributions/${contrib.id}`, { data: { status: "active" } });
      assert(resumeRes.status() === 403, `former parent resume should be 403 fund_transferred (got ${resumeRes.status()})`);
      const contribNowRes = await parentCtx.post(`${baseUrl}/api/parent-contributions/${contrib.id}/contribute-now`);
      assert(contribNowRes.status() === 403, `former parent contribute-now should be 403 fund_transferred (got ${contribNowRes.status()})`);
      // The record is still paused (the blocked resume didn't take).
      const stillPaused = await pool.query(`SELECT status FROM parent_contributions WHERE id = $1`, [contrib.id]);
      assert(stillPaused.rows[0]?.status === "paused", `parent's old plan should remain paused (got ${stillPaused.rows[0]?.status})`);
    } finally {
      await parentCtx.dispose();
    }

    console.log("Age-18/21 handoff flow passed (claim -> complete -> cascades -> welcome -> replay -> owner recurring free -> former-parent lockout).");
  } finally {
    await kid.dispose();
  }
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

  try {
    await runChecks();
  } finally {
    await cleanup();
    if (server?.pid) killProcessTree(server.pid);
    await pool.end().catch(() => undefined);
  }
}

main().catch((error: any) => {
  console.error("Age-18/21 handoff flow failed:", error?.message || error);
  process.exit(1);
});
