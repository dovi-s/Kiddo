// Smoke test the sponsor-Plus flow end to end.
//
// Usage: npx tsx scripts/smoke-sponsor-flow.ts
//
// Does NOT charge any card. Drives:
//   1. Find a Free-tier fund (recurringSupported === false)
//   2. Hit GET /api/funds/:id/sponsor-plus/status → expect empty
//   3. Hit POST /api/stripe/checkout/sponsor-plus with bad inputs → 400
//   4. Hit POST with valid inputs → expect Stripe URL OR demo URL
//   5. Invoke handleSponsorPlusPurchase with a synthetic completed
//      session → expect a sponsored_subscriptions row inserted
//   6. Re-hit status → expect sponsored populated
//   7. Re-hit checkout for same fund → expect 409 fund_already_covered
//   8. Clean up: delete the synthetic sponsored_subscriptions row
//
// Author: 2026-05-25 smoke test pass after IA restructure ship.

import "dotenv/config";
import { db } from "../server/db";
import { funds, sponsoredSubscriptions } from "../shared/schema";
import { sql, eq, and } from "drizzle-orm";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:5000";

type StepResult = { name: string; pass: boolean; detail?: string };
const results: StepResult[] = [];

function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  const tag = pass ? "  PASS" : "  FAIL";
  console.log(`${tag}  ${name}${detail ? `  -- ${detail}` : ""}`);
}

async function findFreeFund() {
  // SMOKE_FUND_ID env override skips the search.
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
  // We want a fund whose owner is NOT on Plus/Family AND not on a
  // trial. Join subscriptions table to filter at the SQL level rather
  // than spraying 200 HTTP requests.
  const rows = await db.execute(sql`
    SELECT f.id, f.slug, f.recipient_first_name, f.name, f.user_id
    FROM funds f
    LEFT JOIN subscriptions s ON s.user_id = f.user_id AND s.status = 'active'
    WHERE f.status = 'active'
      AND (s.plan IS NULL OR s.plan = 'free')
    ORDER BY f.created_at DESC
    LIMIT 30
  `);
  for (const row of (rows.rows as any[])) {
    const fundId = String(row.id);
    const r2 = await fetch(`${BASE}/api/funds/${fundId}/sponsor-plus/status`);
    if (!r2.ok) continue;
    const body = await r2.json();
    if (!body.directlyCovered && !body.sponsored) {
      return {
        id: fundId,
        slug: String(row.slug || ""),
        name: String(row.recipient_first_name || row.name || "the kid"),
        userId: String(row.user_id || ""),
      };
    }
  }
  return null;
}

async function main() {
  console.log("Smoke test: sponsor-Plus flow");
  console.log(`Base URL: ${BASE}\n`);

  const fund = await findFreeFund();
  if (!fund) {
    console.log("No Free-tier fund found in the first 30 active funds. Create one first.");
    process.exit(2);
  }
  console.log(`Using fund: ${fund.name} (${fund.id})\n`);

  // Step 1: status endpoint returns empty for a Free fund
  {
    const r = await fetch(`${BASE}/api/funds/${fund.id}/sponsor-plus/status`);
    const body = await r.json();
    const pass = r.status === 200 && body.sponsored === null && body.directlyCovered === false;
    record("status: free fund returns sponsored=null + directlyCovered=false", pass, JSON.stringify(body));
  }

  // Step 2a: checkout rejects missing fundId
  {
    const r = await fetch(`${BASE}/api/stripe/checkout/sponsor-plus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sponsorEmail: "smoke@example.com", sponsorName: "Smoke Test" }),
    });
    record("checkout: rejects missing fundId with 400", r.status === 400);
  }

  // Step 2b: checkout rejects missing/invalid email
  {
    const r = await fetch(`${BASE}/api/stripe/checkout/sponsor-plus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fundId: fund.id, sponsorName: "Smoke" }),
    });
    record("checkout: rejects missing email with 400", r.status === 400);
  }
  {
    const r = await fetch(`${BASE}/api/stripe/checkout/sponsor-plus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fundId: fund.id, sponsorEmail: "not-an-email", sponsorName: "Smoke" }),
    });
    record("checkout: rejects invalid email shape with 400", r.status === 400);
  }

  // Step 2c: checkout rejects missing name
  {
    const r = await fetch(`${BASE}/api/stripe/checkout/sponsor-plus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fundId: fund.id, sponsorEmail: "smoke@example.com" }),
    });
    record("checkout: rejects missing name with 400", r.status === 400);
  }

  // Step 2d: checkout rejects unknown fund with 404
  {
    const r = await fetch(`${BASE}/api/stripe/checkout/sponsor-plus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fundId: "00000000-0000-0000-0000-000000000000", sponsorEmail: "smoke@example.com", sponsorName: "Smoke" }),
    });
    record("checkout: rejects unknown fund with 404", r.status === 404);
  }

  // Step 3: valid checkout returns either Stripe URL or 404 if price not seeded
  let createdStripeSession = false;
  {
    const r = await fetch(`${BASE}/api/stripe/checkout/sponsor-plus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fundId: fund.id,
        tier: "starter",
        sponsorEmail: "smoke@example.com",
        sponsorName: "Smoke Test Sponsor",
      }),
    });
    const body = await r.json();
    if (r.status === 200 && typeof body.url === "string") {
      createdStripeSession = true;
      record("checkout: valid inputs return Stripe Checkout URL", true, body.url.slice(0, 60) + "...");
    } else if (r.status === 404 && /price not found/i.test(String(body.error || ""))) {
      record("checkout: Stripe price not seeded (expected in dev without seed)", true, body.error);
    } else {
      record("checkout: valid inputs returned UNEXPECTED response", false, `status=${r.status} body=${JSON.stringify(body)}`);
    }
  }

  // Step 4: simulate the webhook by directly invoking handleSponsorPlusPurchase
  // with a synthetic session. This bypasses Stripe but exercises the
  // exact post-payment code path: row insertion, activity, status flip.
  const { WebhookHandlers } = await import("../server/webhookHandlers");
  const syntheticSessionId = `cs_smoke_${Date.now()}`;
  const sponsorEmail = "smoke@example.com";
  const syntheticSession = {
    id: syntheticSessionId,
    customer_email: sponsorEmail,
    customer_details: { email: sponsorEmail, name: "Smoke Test Sponsor" },
    amount_total: 2900,
    currency: "usd",
    metadata: {
      type: "sponsor_plus",
      fundId: fund.id,
      tier: "starter",
      sponsorEmail,
      sponsorName: "Smoke Test Sponsor",
    },
  };
  try {
    await WebhookHandlers.handleSponsorPlusPurchase(syntheticSession);
    record("webhook: handleSponsorPlusPurchase ran without throwing", true);
  } catch (err: any) {
    record("webhook: handleSponsorPlusPurchase THREW", false, err?.message || String(err));
  }

  // Step 5: verify row was inserted
  let insertedRowId: string | null = null;
  {
    const rows = await db
      .select()
      .from(sponsoredSubscriptions)
      .where(eq(sponsoredSubscriptions.stripeSessionId, syntheticSessionId));
    if (rows.length === 1) {
      insertedRowId = String(rows[0].id);
      record("db: sponsored_subscriptions row inserted", true, `id=${insertedRowId} fund=${rows[0].fundId} tier=${rows[0].tier} status=${rows[0].status}`);
    } else {
      record("db: sponsored_subscriptions row NOT inserted", false, `found ${rows.length} rows`);
    }
  }

  // Step 6: status endpoint now shows sponsored
  {
    const r = await fetch(`${BASE}/api/funds/${fund.id}/sponsor-plus/status`);
    const body = await r.json();
    const pass = r.status === 200 && body.sponsored != null && body.sponsored.tier === "starter";
    record("status: after sponsorship, returns sponsored populated", pass, JSON.stringify(body));
  }

  // Step 7: re-attempt checkout for same fund → 409 fund_already_covered
  {
    const r = await fetch(`${BASE}/api/stripe/checkout/sponsor-plus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fundId: fund.id,
        tier: "starter",
        sponsorEmail: "smoke2@example.com",
        sponsorName: "Different Sponsor",
      }),
    });
    const body = await r.json();
    const pass = r.status === 409 && body.error === "fund_already_covered" && /covered through/i.test(String(body.message || ""));
    record("stacking guard: second sponsorship attempt returns 409", pass, JSON.stringify(body));
  }

  // Step 8: clean up
  if (insertedRowId) {
    await db.delete(sponsoredSubscriptions).where(eq(sponsoredSubscriptions.id, insertedRowId));
    console.log(`\nCleanup: deleted sponsored_subscriptions row ${insertedRowId}`);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} steps passed.`);
  if (failed.length > 0) {
    console.log("FAILURES:");
    failed.forEach((f) => console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ""}`));
    process.exit(1);
  }
  console.log("All sponsor-Plus smoke steps green.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
