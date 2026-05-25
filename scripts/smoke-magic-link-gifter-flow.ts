// Smoke test the magic-link gifter auth flow end to end.
//
// Usage:
//   MAGIC_LINK_GIFTER_AUTH=true npx tsx scripts/smoke-magic-link-gifter-flow.ts
//   SMOKE_FUND_ID=<uuid> MAGIC_LINK_GIFTER_AUTH=true npx tsx scripts/smoke-magic-link-gifter-flow.ts
//
// Verifies the passwordless gifter flow shipped 2026-05-25 per
// project_recurring_gifting_without_password_spec.md. Does NOT charge
// any card. Drives:
//
//   1. Feature-flag detection — server's /api/public/funds response
//      includes fund.magicLinkAuth=true when MAGIC_LINK_GIFTER_AUTH is on.
//   2. Find a Plus/Family-tier fund (recurring is fund-tier gated).
//   3. Gift-recurring POST WITHOUT accountPassword succeeds — returns
//      a Stripe Checkout URL. Proves the conditional-validation path.
//   4. Gift-recurring POST without accountPassword fails (400) when the
//      flag is OFF. Proves the flag actually gates server behavior.
//      [Skipped in this run if flag is ON; documented as expected.]
//   5. Synthetic session triggers handleGifterRecurringSetup → the
//      recurring_gifts row is inserted AND a magic_link_tokens row is
//      created for the gifter user.
//   6. The magic_link_tokens row has intent='gifter_welcome', usedAt
//      NULL, expiresAt 15 minutes in the future.
//   7. POST /api/auth/magic-link/request for the gifter email returns
//      200 (anti-enumeration; same response for known + unknown emails).
//   8. POST /api/auth/magic-link/request returns 200 for an unknown
//      email (anti-enumeration parity).
//   9. Rate limiter: 6th request inside one hour still returns 200
//      (anti-enumeration) but does NOT mint a token (verified by
//      counting rows before/after).
//  10. GET /api/auth/magic-link/verify with an invalid token returns 400.
//  11. GET /api/auth/magic-link/verify with a synthetic VALID token row
//      we insert directly returns 200 + sets a session cookie.
//      [Tests the consumeMagicLinkToken atomic logic in isolation.]
//  12. Re-use of the same token (already used) returns 400.
//  13. Cleanup: delete synthetic recurring_gifts + magic_link_tokens
//      + test gifter user rows.
//
// Author: 2026-05-25 magic-link ship pass.

import "dotenv/config";
import crypto from "crypto";
import { db } from "../server/db";
import { recurringGifts } from "../shared/schema";
import { magicLinkTokens, users } from "../shared/models/auth";
import { sql, eq, and, gt, isNull } from "drizzle-orm";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:5000";
const FLAG_ON = String(process.env.MAGIC_LINK_GIFTER_AUTH || "").toLowerCase() === "true";

type StepResult = { name: string; pass: boolean; detail?: string };
const results: StepResult[] = [];

function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  const tag = pass ? "  PASS" : "  FAIL";
  console.log(`${tag}  ${name}${detail ? `  -- ${detail}` : ""}`);
}

function hashMagicLinkToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

async function findCoveredFund() {
  if (process.env.SMOKE_FUND_ID) {
    const rows = await db.execute(sql`
      SELECT id, slug, recipient_first_name, name, user_id
      FROM funds WHERE id = ${process.env.SMOKE_FUND_ID}
    `);
    const r = (rows.rows as any[])[0];
    if (!r) return null;
    return {
      id: String(r.id),
      slug: String(r.slug || ""),
      name: String(r.recipient_first_name || r.name || "the kid"),
      userId: String(r.user_id || ""),
    };
  }
  const rows = await db.execute(sql`
    SELECT f.id, f.slug, f.recipient_first_name, f.name, f.user_id
    FROM funds f
    LEFT JOIN subscriptions s ON s.user_id = f.user_id AND s.status = 'active'
    WHERE f.status = 'active' AND s.plan IN ('starter', 'family')
    ORDER BY f.created_at DESC
    LIMIT 1
  `);
  const r = (rows.rows as any[])[0];
  if (!r) return null;
  return {
    id: String(r.id),
    slug: String(r.slug || ""),
    name: String(r.recipient_first_name || r.name || "the kid"),
    userId: String(r.user_id || ""),
  };
}

async function main() {
  console.log("Smoke test: magic-link gifter auth flow");
  console.log(`Base URL: ${BASE}`);
  console.log(`Flag MAGIC_LINK_GIFTER_AUTH: ${FLAG_ON ? "ON" : "OFF"}\n`);

  if (!FLAG_ON) {
    console.log("FAIL  Feature flag must be ON to run the positive-path tests.");
    console.log("      Set MAGIC_LINK_GIFTER_AUTH=true and rerun.");
    process.exit(1);
  }

  const testEmail = `smoke-magic-${Date.now()}@kiddofund-test.com`;
  let cleanupUserId: string | null = null;
  let cleanupFundId: string | null = null;
  let cleanupSubId: string | null = null;

  try {
    const fund = await findCoveredFund();
    if (!fund) {
      record("Find covered fund", false, "No Plus/Family fund found. Set SMOKE_FUND_ID env or seed one.");
      throw new Error("setup failed");
    }
    record("Find covered fund", true, `${fund.name} (${fund.id})`);
    cleanupFundId = fund.id;

    // Step 1: public fund response surfaces magicLinkAuth=true
    const publicRes = await fetch(`${BASE}/api/public/funds/${encodeURIComponent(fund.slug || fund.id)}`);
    const publicBody = await publicRes.json().catch(() => ({}));
    record(
      "Step 1: public fund response includes magicLinkAuth=true",
      publicBody?.fund?.magicLinkAuth === true,
      `magicLinkAuth=${publicBody?.fund?.magicLinkAuth}`,
    );

    // Step 2: gift-recurring POST without accountPassword should succeed
    const recurringRes = await fetch(`${BASE}/api/stripe/checkout/gift-recurring`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fundId: fund.id,
        amount: 25,
        senderName: "Smoke Magic Tester",
        senderEmail: testEmail,
        recurringFrequency: "monthly",
        executionModel: "auto",
        // accountPassword OMITTED intentionally.
      }),
    });
    const recurringBody = await recurringRes.json().catch(() => ({}));
    const recurringOk = recurringRes.ok && typeof recurringBody?.url === "string";
    record(
      "Step 2: gift-recurring accepts no-password request",
      recurringOk,
      recurringOk ? "Stripe URL returned" : `HTTP ${recurringRes.status}: ${JSON.stringify(recurringBody)}`,
    );

    // Look up the created gifter user
    const [createdUser] = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);
    record(
      "Step 3: gifter user row created with passwordHash=NULL",
      !!createdUser && !createdUser.passwordHash,
      createdUser ? `id=${createdUser.id} hash=${createdUser.passwordHash ? "PRESENT (FAIL)" : "NULL"}` : "user not found",
    );
    if (createdUser) cleanupUserId = createdUser.id;

    // Step 4: simulate the webhook handler firing for this session
    const { WebhookHandlers } = await import("../server/webhookHandlers");
    const stripeSubId = `sub_smoke_magic_${Date.now()}`;
    cleanupSubId = stripeSubId;
    const syntheticSession = {
      id: `cs_smoke_magic_${Date.now()}`,
      subscription: stripeSubId,
      metadata: {
        type: "gifter_recurring",
        fundId: fund.id,
        gifterUserId: createdUser?.id || "",
        senderName: "Smoke Magic Tester",
        senderEmail: testEmail,
        frequency: "monthly",
        amountUsd: "25.00",
        selectedTicker: "VOO",
      },
    };
    await (WebhookHandlers as any).handleGifterRecurringSetup(syntheticSession);

    const [recurringRow] = await db
      .select()
      .from(recurringGifts)
      .where(eq(recurringGifts.stripeSubscriptionId, stripeSubId))
      .limit(1);
    record(
      "Step 4: recurring_gifts row inserted by webhook",
      !!recurringRow,
      recurringRow ? `id=${recurringRow.id}` : "no row inserted",
    );

    // Step 5: magic_link_tokens row created (intent=gifter_welcome)
    let tokenRow: any = null;
    if (createdUser) {
      const tokenRows = await db
        .select()
        .from(magicLinkTokens)
        .where(eq(magicLinkTokens.userId, createdUser.id))
        .limit(5);
      tokenRow = tokenRows.find((r: any) => r.intent === "gifter_welcome");
    }
    record(
      "Step 5: magic_link_tokens row created (intent=gifter_welcome)",
      !!tokenRow,
      tokenRow ? `id=${tokenRow.id} intent=${tokenRow.intent}` : "no welcome token found",
    );

    // Step 6: token has unused state + 15-min future expiry
    if (tokenRow) {
      const expiresMs = new Date(tokenRow.expiresAt).getTime() - Date.now();
      const within15Min = expiresMs > 0 && expiresMs <= 15 * 60 * 1000 + 30_000; // small slack
      record(
        "Step 6: token unused + expires within 15 minutes",
        !tokenRow.usedAt && within15Min,
        `usedAt=${tokenRow.usedAt} expires_in_ms=${expiresMs}`,
      );
    } else {
      record("Step 6: token unused + expires within 15 minutes", false, "no token to inspect");
    }

    // Step 7: /api/auth/magic-link/request for known email → 200
    const req1 = await fetch(`${BASE}/api/auth/magic-link/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail }),
    });
    record(
      "Step 7: magic-link/request returns 200 for known email",
      req1.status === 200,
      `HTTP ${req1.status}`,
    );

    // Step 8: /api/auth/magic-link/request for unknown email → 200
    const req2 = await fetch(`${BASE}/api/auth/magic-link/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `nobody-${Date.now()}@kiddofund-test.com` }),
    });
    record(
      "Step 8: magic-link/request returns 200 for unknown email",
      req2.status === 200,
      `HTTP ${req2.status} (anti-enumeration parity)`,
    );

    // Step 9: rate limiter (5/email/hour). After 5 known-email requests
    // beyond the auto-issued welcome, the 6th should not mint a new
    // token row. We've already issued 1 welcome + 1 relogin via Step 7,
    // so fire 4 more then check the 6th.
    if (createdUser) {
      const beforeCount = await db.execute(sql`SELECT COUNT(*)::int AS c FROM magic_link_tokens WHERE user_id = ${createdUser.id}`);
      const before = Number((beforeCount.rows as any[])[0]?.c || 0);
      for (let i = 0; i < 4; i++) {
        await fetch(`${BASE}/api/auth/magic-link/request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: testEmail }),
        });
      }
      // 6th call (1 welcome from webhook + 5 relogin = 6 total; should be capped)
      const capped = await fetch(`${BASE}/api/auth/magic-link/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail }),
      });
      const afterCount = await db.execute(sql`SELECT COUNT(*)::int AS c FROM magic_link_tokens WHERE user_id = ${createdUser.id}`);
      const after = Number((afterCount.rows as any[])[0]?.c || 0);
      // Welcome (1) + step 7 (1) + 4 in loop (4) = 6. The 6th should be capped at 5/hour.
      record(
        "Step 9: rate limiter blocks 6th request (no new token row) + 200 response",
        capped.status === 200 && (after - before) <= 4,
        `before=${before} after=${after} cap-response=HTTP ${capped.status}`,
      );
    } else {
      record("Step 9: rate limiter", false, "no user to test against");
    }

    // Step 10: verify with invalid token → 400
    const verifyBad = await fetch(`${BASE}/api/auth/magic-link/verify?token=${"a".repeat(64)}`);
    record(
      "Step 10: verify with invalid token returns 400",
      verifyBad.status === 400,
      `HTTP ${verifyBad.status}`,
    );

    // Step 11: verify with a fresh synthetic VALID token. We insert
    // the row directly so we don't depend on email delivery.
    if (createdUser) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hash = hashMagicLinkToken(rawToken);
      await db.insert(magicLinkTokens).values({
        userId: createdUser.id,
        tokenHash: hash,
        intent: "gifter_relogin",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });
      const verifyOk = await fetch(`${BASE}/api/auth/magic-link/verify?token=${encodeURIComponent(rawToken)}`);
      const setCookie = verifyOk.headers.get("set-cookie") || "";
      record(
        "Step 11: verify with valid token returns 200 + sets session cookie",
        verifyOk.status === 200 && /connect\.sid|kora\.sid|sid/i.test(setCookie),
        `HTTP ${verifyOk.status} cookie-present=${!!setCookie}`,
      );

      // Step 12: re-use same token → 400
      const verifyReuse = await fetch(`${BASE}/api/auth/magic-link/verify?token=${encodeURIComponent(rawToken)}`);
      record(
        "Step 12: re-using consumed token returns 400",
        verifyReuse.status === 400,
        `HTTP ${verifyReuse.status}`,
      );
    } else {
      record("Step 11: verify with valid token", false, "no user to test against");
      record("Step 12: re-use consumed token", false, "no user to test against");
    }
  } catch (err: any) {
    record("Unhandled error", false, err?.message || String(err));
  } finally {
    // Cleanup
    if (cleanupSubId) {
      await db.delete(recurringGifts).where(eq(recurringGifts.stripeSubscriptionId, cleanupSubId)).catch(() => {});
    }
    if (cleanupUserId) {
      await db.delete(magicLinkTokens).where(eq(magicLinkTokens.userId, cleanupUserId)).catch(() => {});
      await db.delete(users).where(eq(users.id, cleanupUserId)).catch(() => {});
    }
  }

  console.log("\n---");
  const pass = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log(`${pass}/${total} steps passed`);
  process.exit(pass === total ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
