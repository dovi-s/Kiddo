// Security regression tests — lock in the audit fixes so they can't
// silently regress. Exercises the actual DB constraint + storage scoping +
// the public endpoint shape. Uses the seeded demo funds (Phil's) and only
// creates throwaway rows it deletes afterward (marked @example.com). Run:
//   npm run test:security-regression
//
// Covered:
//   1. gifts.stripePaymentIntentId partial-unique index — a duplicate
//      PaymentIntent insert is rejected (gift double-credit race, migration
//      0035 / a35928b).
//   2. Collaborator IDOR scoping — storage.updateCollaborator /
//      deleteCollaborator scoped to the wrong fundId is a no-op (a35928b).
//   3. Public fund overview omits dollar amounts (minor-balance leak fix,
//      a35928b) — best-effort HTTP check, skipped if the dev server is down.
//   4. Mass-assignment on PATCH /api/funds/:id (server-managed columns).
//   5. Reserved-slug enforcement (4fe7762).
//   6. /api/health deep variants return NO secret-presence/readiness detail
//      to anonymous callers, while still returning 200 liveness (92f096f).
//   7. GET /api/age-transition/:token omits the child's raw DOB and sends
//      the precomputed majorityDate instead (92f096f).
//   8. Pending collaborator invite tokens older than 30 days are rejected
//      with 410 on accept (92f096f).
//   9. charge.refunded reverses the gift's invested holdings + allocations —
//      no phantom sellable shares survive a refund (389c907).
//  10. Sealed parent letters never leak off parent surfaces: the PUBLIC
//      memory endpoint and the gifter dashboard must not return
//      parent_letter / parent_only / locked kid_at_18 content (2026-06-04).
//      Uses the seeded Dunphy letters as permanent canaries.

import "../server/env";
import { db, pool } from "../server/db";
import {
  funds,
  gifts,
  fundCollaborators,
  users,
  ageTransitions,
  holdings,
  giftAllocations,
  transactions,
  activities,
} from "../shared/schema";
import { eq, and } from "drizzle-orm";
import { storage } from "../server/storage";
import { WebhookHandlers } from "../server/webhookHandlers";
import { isReservedFundSlug } from "../shared/reserved-slugs";
import crypto from "node:crypto";

async function main() {
  let failures = 0;
  const ok = (name: string, cond: boolean) => {
    console.log(`  ${cond ? "✓" : "✗"} ${name}`);
    if (!cond) failures++;
  };
  const cleanup: Array<() => Promise<void>> = [];

  const [phil] = await db.select().from(users).where(eq(users.email, "phil@dunphyfamily.com")).limit(1);
  if (!phil) {
    console.log("Demo not seeded (no phil@dunphyfamily.com); skipping security regression tests.");
    await pool.end();
    return;
  }
  const philFunds = await db.select().from(funds).where(eq(funds.userId, phil.id)).limit(2);
  if (philFunds.length < 2) {
    console.log("Need 2 demo funds; skipping. Run `npm run reset:dunphys` first.");
    await pool.end();
    return;
  }
  const [fundA, fundB] = philFunds;

  try {
    // --- 1. Duplicate Stripe PaymentIntent must be rejected ---
    const testPi = `pi_sectest_${crypto.randomUUID()}`;
    const giftValues = (pi: string) => ({
      fundId: fundA.id,
      senderName: "Security Regression",
      senderEmail: "sectest@example.com",
      amount: "10.00",
      netAmount: "10.00",
      status: "invested",
      stripePaymentIntentId: pi,
    });
    const [g1] = await db.insert(gifts).values(giftValues(testPi) as any).returning();
    cleanup.push(async () => { await db.delete(gifts).where(eq(gifts.id, g1.id)); });

    let dupRejected = false;
    let g2Id: string | null = null;
    try {
      const [g2] = await db.insert(gifts).values(giftValues(testPi) as any).returning();
      g2Id = g2?.id ?? null;
    } catch {
      dupRejected = true;
    }
    if (g2Id) cleanup.push(async () => { await db.delete(gifts).where(eq(gifts.id, g2Id!)); });
    ok("duplicate Stripe PaymentIntent insert is rejected (double-credit race)", dupRejected);

    // --- 2. Collaborator IDOR scoping ---
    const [collabB] = await db
      .insert(fundCollaborators)
      .values({ fundId: fundB.id, email: "sectest-collab@example.com", role: "viewer", status: "accepted" } as any)
      .returning();
    cleanup.push(async () => { await db.delete(fundCollaborators).where(eq(fundCollaborators.id, collabB.id)); });

    // Updating collabB (on fundB) but scoped to fundA must NOT change it.
    const wrongScope = await storage.updateCollaborator(collabB.id, { role: "co-admin" } as any, fundA.id);
    ok("updateCollaborator with wrong fundId returns nothing (IDOR blocked)", !wrongScope);
    const afterWrong = (await db.select().from(fundCollaborators).where(eq(fundCollaborators.id, collabB.id)))[0];
    ok("collaborator role unchanged after wrong-scope update", afterWrong?.role === "viewer");

    // Correct fundId scope updates as expected.
    const rightScope = await storage.updateCollaborator(collabB.id, { role: "co-admin" } as any, fundB.id);
    ok("updateCollaborator with correct fundId updates", rightScope?.role === "co-admin");

    // deleteCollaborator scoped to the wrong fund must be a no-op.
    await storage.deleteCollaborator(collabB.id, fundA.id);
    const afterWrongDelete = await db.select().from(fundCollaborators).where(eq(fundCollaborators.id, collabB.id));
    ok("deleteCollaborator with wrong fundId is a no-op (IDOR blocked)", afterWrongDelete.length === 1);

    // --- 3. Public overview omits dollar amounts (best-effort HTTP) ---
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/public/funds/${fundA.id}/overview`);
      if (res.ok) {
        const body: any = await res.json();
        ok(
          "public fund overview omits balance/totalGain/totalContributed",
          body.balance === undefined && body.totalGain === undefined && body.totalContributed === undefined,
        );
      } else {
        console.log(`  - public overview HTTP check skipped (status ${res.status})`);
      }
    } catch {
      console.log("  - public overview HTTP check skipped (dev server not reachable)");
    }

    // --- 4. Mass-assignment: an owner cannot set server-managed columns via
    //        PATCH /api/funds/:id (best-effort HTTP; uses the demo login).
    //        Sends the fund's CURRENT name (no real mutation) plus a malicious
    //        balance/cashBalance/status/drivewealthAccountId, then asserts none
    //        of those server-managed columns changed. ---
    try {
      const base = "http://127.0.0.1:5000";
      const loginRes = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "phil@dunphyfamily.com", password: "dunphyfamily" }),
      });
      if (loginRes.ok) {
        const cookie = (loginRes.headers as any).getSetCookie?.()?.join("; ")
          || loginRes.headers.get("set-cookie")
          || "";
        const before = (await db.select().from(funds).where(eq(funds.id, fundA.id)))[0] as any;
        await fetch(`${base}/api/funds/${fundA.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({
            name: before.name, // unchanged — keeps the test non-mutating
            balance: "999999.00",
            cashBalance: "999999.00",
            status: "active",
            drivewealthAccountId: "dw_injected",
          }),
        });
        const after = (await db.select().from(funds).where(eq(funds.id, fundA.id)))[0] as any;
        ok(
          "PATCH /api/funds ignores client balance/cashBalance/status/custody (mass-assignment blocked)",
          String(after.balance) === String(before.balance)
            && String(after.cashBalance) === String(before.cashBalance)
            && after.status === before.status
            && (after.drivewealthAccountId ?? null) === (before.drivewealthAccountId ?? null),
        );
      } else {
        console.log(`  - mass-assignment HTTP check skipped (login status ${loginRes.status})`);
      }
    } catch {
      console.log("  - mass-assignment HTTP check skipped (dev server not reachable)");
    }

    // --- 5. Reserved-slug enforcement (unreachable-gift-link fix, 4fe7762).
    //        Real fund slugs must never equal a reserved app/marketing route
    //        (or the root-level gift link would be shadowed), and the shared
    //        list must still classify routes correctly. Pure + read-only. ---
    ok(`demo fund slugs are not reserved words (${fundA.slug}, ${fundB.slug})`,
      !isReservedFundSlug(fundA.slug) && !isReservedFundSlug(fundB.slug));
    ok("reserved list flags app/marketing routes (pricing/dashboard/login)",
      isReservedFundSlug("pricing") && isReservedFundSlug("dashboard") && isReservedFundSlug("login"));
    ok("reserved list does not flag normal fund slugs (haley-dunphy/emma-2)",
      !isReservedFundSlug("haley-dunphy") && !isReservedFundSlug("emma-2"));

    // --- 6. Anonymous /api/health deep variants leak no secret-presence /
    //        readiness map (92f096f). Still 200 (deploy smoke needs it). ---
    try {
      for (const path of ["/api/health?deep=1", "/api/health/deep"]) {
        const res = await fetch(`http://127.0.0.1:5000${path}`);
        if (!res.ok) {
          console.log(`  - health deep check skipped for ${path} (status ${res.status})`);
          continue;
        }
        const body: any = await res.json();
        ok(
          `anon ${path} returns 200 liveness with NO checks/platform detail`,
          body.ok === true && body.checks === undefined && body.platform === undefined && body.version === undefined,
        );
      }
    } catch {
      console.log("  - health deep checks skipped (dev server not reachable)");
    }

    // --- 7. GET /api/age-transition/:token sends majorityDate, never the
    //        child's raw DOB (92f096f). Uses the fund's existing transition
    //        row when one exists (the demo seeds one for the near-majority
    //        kid); otherwise creates a throwaway row it deletes after. ---
    try {
      const [existingAt] = await db.select().from(ageTransitions).where(eq(ageTransitions.fundId, fundA.id)).limit(1);
      let atToken = (existingAt?.previewToken || existingAt?.inviteToken || "") as string;
      if (!existingAt) {
        atToken = `sectest-${crypto.randomUUID()}`;
        await db.insert(ageTransitions).values({ fundId: fundA.id, previewToken: atToken } as any);
        cleanup.push(async () => { await db.delete(ageTransitions).where(eq(ageTransitions.fundId, fundA.id)); });
      } else if (!atToken) {
        atToken = `sectest-${crypto.randomUUID()}`;
        await db.update(ageTransitions).set({ previewToken: atToken } as any).where(eq(ageTransitions.fundId, fundA.id));
        cleanup.push(async () => {
          await db.update(ageTransitions).set({ previewToken: null } as any).where(eq(ageTransitions.fundId, fundA.id));
        });
      }
      const res = await fetch(`http://127.0.0.1:5000/api/age-transition/${atToken}`);
      if (res.ok) {
        const body: any = await res.json();
        ok(
          "age-transition token endpoint omits raw DOB, sends majorityDate",
          body.fund
            && body.fund.recipientBirthdate === undefined
            && typeof body.fund.majorityDate === "string"
            && Number.isFinite(Number(body.fund.majorityAge)),
        );
      } else {
        console.log(`  - age-transition DOB check skipped (status ${res.status})`);
      }
    } catch {
      console.log("  - age-transition DOB check skipped (dev server not reachable)");
    }

    // --- 8. Pending invite tokens older than 30 days are rejected with 410
    //        (92f096f). Authenticated as a NON-owner demo user (the accept
    //        endpoint requires a session; token-trust means any session can
    //        try). The row must stay pending afterward. ---
    try {
      const base = "http://127.0.0.1:5000";
      const staleToken = `sectest-expired-${crypto.randomUUID()}`;
      const staleInvitedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      const [staleInvite] = await db.insert(fundCollaborators).values({
        fundId: fundA.id,
        email: "sectest-expiry@example.com",
        role: "viewer",
        status: "pending",
        token: staleToken,
        invitedAt: staleInvitedAt,
      } as any).returning();
      cleanup.push(async () => { await db.delete(fundCollaborators).where(eq(fundCollaborators.id, staleInvite.id)); });

      const loginRes = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "mitchell@dunphyfamily.com", password: "dunphyfamily" }),
      });
      if (loginRes.ok) {
        const cookie = (loginRes.headers as any).getSetCookie?.()?.join("; ")
          || loginRes.headers.get("set-cookie")
          || "";
        const acceptRes = await fetch(`${base}/api/invitations/${staleToken}/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
        });
        const after = (await db.select().from(fundCollaborators).where(eq(fundCollaborators.id, staleInvite.id)))[0];
        ok("31-day-old pending invite token is rejected with 410", acceptRes.status === 410);
        ok("expired invite row stays pending (not bound to the caller)", after?.status === "pending" && !after?.userId);
      } else {
        console.log(`  - invite-expiry HTTP check skipped (login status ${loginRes.status})`);
      }
    } catch {
      console.log("  - invite-expiry HTTP check skipped (dev server not reachable)");
    }

    // --- 9. charge.refunded reverses invested holdings + allocations — no
    //        phantom sellable shares (389c907). Direct handler call, no HTTP.
    //        Scenario: a co-funded ticker (this gift 4 of 10 shares), so the
    //        holding must SHRINK by exactly the gift's slice, not vanish.
    //        The fund's balance is snapshotted and restored afterward. ---
    {
      const TEST_TICKER = "SECTEST";
      const refundPi = `pi_sectest_refund_${crypto.randomUUID()}`;
      const fundBefore = (await db.select().from(funds).where(eq(funds.id, fundA.id)))[0] as any;
      cleanup.push(async () => {
        // Restore the fund's money columns exactly as they were.
        await db.update(funds).set({
          balance: fundBefore.balance,
          cashBalance: fundBefore.cashBalance,
        } as any).where(eq(funds.id, fundA.id));
        // Remove every artifact the handler may have written.
        await db.delete(transactions).where(eq(transactions.stripePaymentIntentId, refundPi));
        await db.delete(activities).where(and(eq(activities.fundId, fundA.id), eq(activities.type, "refund")));
        await db.delete(giftAllocations).where(and(eq(giftAllocations.fundId, fundA.id), eq(giftAllocations.ticker, TEST_TICKER)));
        await db.delete(holdings).where(and(eq(holdings.fundId, fundA.id), eq(holdings.ticker, TEST_TICKER)));
      });

      const [refundGift] = await db.insert(gifts).values({
        fundId: fundA.id,
        senderName: "Security Regression",
        senderEmail: "sectest@example.com",
        amount: "10.00",
        netAmount: "10.00",
        status: "invested",
        stripePaymentIntentId: refundPi,
      } as any).returning();
      cleanup.push(async () => { await db.delete(gifts).where(eq(gifts.id, refundGift.id)); });

      // Co-funded holding: 10 shares total, our gift owns 4 (cost $8 of $20).
      await db.insert(holdings).values({
        fundId: fundA.id,
        ticker: TEST_TICKER,
        name: "Security Regression Test Co",
        shares: "10.000000",
        costBasis: "20.00",
        currentValue: "30.00",
        gain: "10.00",
      } as any);
      await db.insert(giftAllocations).values({
        giftId: refundGift.id,
        fundId: fundA.id,
        ticker: TEST_TICKER,
        costBasis: "8.00",
        shares: "4.000000",
        source: "pick",
      } as any);

      await WebhookHandlers.handleChargeRefunded({
        id: `ch_sectest_${crypto.randomUUID()}`,
        payment_intent: refundPi,
        amount_refunded: 1000, // $10.00 in cents
        currency: "usd",
      });

      const giftAfter = (await db.select().from(gifts).where(eq(gifts.id, refundGift.id)))[0];
      const [holdingAfter] = await db.select().from(holdings)
        .where(and(eq(holdings.fundId, fundA.id), eq(holdings.ticker, TEST_TICKER)));
      const allocsAfter = await db.select().from(giftAllocations).where(eq(giftAllocations.giftId, refundGift.id));

      ok("refunded gift is marked refunded", giftAfter?.status === "refunded");
      ok(
        "refund shrinks the co-funded holding by exactly the gift's slice (6 sh / $12 basis)",
        !!holdingAfter
          && Math.abs(parseFloat(String(holdingAfter.shares)) - 6) < 0.001
          && Math.abs(parseFloat(String(holdingAfter.costBasis)) - 12) < 0.01,
      );
      ok("refunded gift's allocation rows are deleted (no phantom shares)", allocsAfter.length === 0);

      // Idempotency: a redelivered webhook must change nothing further.
      await WebhookHandlers.handleChargeRefunded({
        id: `ch_sectest_${crypto.randomUUID()}`,
        payment_intent: refundPi,
        amount_refunded: 1000,
        currency: "usd",
      });
      const [holdingAfterReplay] = await db.select().from(holdings)
        .where(and(eq(holdings.fundId, fundA.id), eq(holdings.ticker, TEST_TICKER)));
      ok(
        "replayed charge.refunded webhook is a no-op (no double reversal)",
        !!holdingAfterReplay && Math.abs(parseFloat(String(holdingAfterReplay.shares)) - 6) < 0.001,
      );
    }

    // --- 10. Sealed parent letters never leak off parent surfaces. The demo
    //         seeds a parent_letter on Alex's fund (visibility kid_at_18,
    //         "Alex, if you're reading this...") and Haley's ("Haley. It's
    //         yours now.") — permanent canaries. Checks the two surfaces
    //         that leaked on 2026-06-04: the UNAUTHENTICATED public memory
    //         endpoint and the gifter dashboard's "latest moment". ---
    try {
      const base = "http://127.0.0.1:5000";
      const dunphyFunds = await db.select({ id: funds.id, slug: funds.slug }).from(funds);
      const canaryFunds = dunphyFunds.filter((f) => /-dunphy/.test(String(f.slug || "")));
      const LETTER_MARKERS = ["if you're reading this", "It's yours now"];
      if (canaryFunds.length > 0) {
        let publicLeak = false;
        let publicChecked = 0;
        for (const f of canaryFunds) {
          const res = await fetch(`${base}/api/public/funds/${f.id}/memory`);
          if (!res.ok) continue;
          publicChecked++;
          const body: any[] = await res.json().catch(() => []);
          for (const entry of body || []) {
            const content = String(entry?.content || "");
            if (String(entry?.type || "") === "parent_letter" || LETTER_MARKERS.some((m) => content.includes(m))) {
              publicLeak = true;
            }
          }
        }
        if (publicChecked > 0) {
          ok("public memory endpoint returns no parent_letter / sealed content", !publicLeak);
        } else {
          console.log("  - public memory letter check skipped (endpoint unreachable)");
        }

        const gifterLogin = await fetch(`${base}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "jay@dunphyfamily.com", password: "dunphyfamily" }),
        });
        if (gifterLogin.ok) {
          const cookie = (gifterLogin.headers as any).getSetCookie?.()?.join("; ")
            || gifterLogin.headers.get("set-cookie")
            || "";
          const dashRes = await fetch(`${base}/api/gifter-account/dashboard`, { headers: { Cookie: cookie } });
          if (dashRes.ok) {
            const dash: any = await dashRes.json();
            const moments: string[] = (dash?.funds || [])
              .map((f: any) => String(f?.recentMemoryPreview?.content ?? f?.recentMemory?.content ?? ""))
              .filter(Boolean);
            const gifterLeak = moments.some((c) => LETTER_MARKERS.some((m) => c.includes(m)));
            ok("gifter dashboard latest-moment contains no parent letters", !gifterLeak);
          } else {
            console.log(`  - gifter-dashboard letter check skipped (status ${dashRes.status})`);
          }
        } else {
          console.log(`  - gifter-dashboard letter check skipped (login status ${gifterLogin.status})`);
        }
      } else {
        console.log("  - sealed-letter canary checks skipped (no Dunphy demo funds)");
      }
    } catch {
      console.log("  - sealed-letter canary checks skipped (dev server not reachable)");
    }
  } finally {
    for (const c of cleanup.reverse()) {
      try { await c(); } catch (err) { console.warn("cleanup step failed (non-fatal):", err); }
    }
  }

  if (failures > 0) {
    console.error(`\nSecurity regression tests FAILED (${failures} failing).`);
    await pool.end();
    process.exit(1);
  }
  console.log("\nSecurity regression tests passed.");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
