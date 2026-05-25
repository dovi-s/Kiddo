// Smoke test the Founder gift flow end to end.
//
// Usage: npx tsx scripts/smoke-founder-gift-flow.ts
//
// Does NOT charge any card. Drives:
//   1. Count current founders in the .local/founding-members.jsonl file
//   2. Endpoint validation: rejects bad inputs with the right 400s
//   3. Self-gift guard: same sponsor/recipient email returns 400
//   4. Valid checkout returns a real Stripe Checkout URL (test mode)
//   5. handleSponsorFounderPurchase invoked with a synthetic session
//      → appends a new founder entry to the jsonl
//   6. Count went up by exactly 1
//   7. Duplicate guard: re-attempt with same recipient → 409
//   8. Webhook double-fire idempotency: re-invoke with same session.id
//      → no new entry written
//   9. Cleanup: strip the synthetic entries from the jsonl
//
// Author: 2026-05-25 smoke test pass after sponsor-Plus smoke shipped.

import "dotenv/config";
import path from "path";
import fs from "fs/promises";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:5000";
const FOUNDING_PATH = path.join(process.cwd(), ".local", "founding-members.jsonl");

type StepResult = { name: string; pass: boolean; detail?: string };
const results: StepResult[] = [];

function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  const tag = pass ? "  PASS" : "  FAIL";
  console.log(`${tag}  ${name}${detail ? `  -- ${detail}` : ""}`);
}

async function countFounders(): Promise<number> {
  try {
    const text = await fs.readFile(FOUNDING_PATH, "utf8");
    return text.split("\n").filter((l) => l.trim()).length;
  } catch (err: any) {
    if (err?.code === "ENOENT") return 0;
    throw err;
  }
}

async function stripeSessionsFromFile(): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const text = await fs.readFile(FOUNDING_PATH, "utf8");
    for (const line of text.split("\n").filter((l) => l.trim())) {
      try {
        const e = JSON.parse(line);
        if (e?.stripeSessionId) out.add(String(e.stripeSessionId));
      } catch { /* skip */ }
    }
  } catch (err: any) {
    if (err?.code !== "ENOENT") throw err;
  }
  return out;
}

async function removeEntriesBySessionId(sessionIds: Set<string>): Promise<number> {
  if (sessionIds.size === 0) return 0;
  let text = "";
  try {
    text = await fs.readFile(FOUNDING_PATH, "utf8");
  } catch (err: any) {
    if (err?.code === "ENOENT") return 0;
    throw err;
  }
  const lines = text.split("\n").filter((l) => l.trim());
  const kept: string[] = [];
  let removed = 0;
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      if (e?.stripeSessionId && sessionIds.has(String(e.stripeSessionId))) {
        removed++;
        continue;
      }
    } catch { /* keep malformed */ }
    kept.push(line);
  }
  await fs.writeFile(FOUNDING_PATH, kept.length ? kept.join("\n") + "\n" : "", "utf8");
  return removed;
}

async function main() {
  console.log("Smoke test: Founder gift flow");
  console.log(`Base URL: ${BASE}\n`);

  const startingCount = await countFounders();
  console.log(`Starting founder count: ${startingCount}\n`);

  // Unique addresses per run so we never collide with real waitlist
  // entries or with a previous smoke-test run that didn't clean up.
  const stamp = Date.now();
  const sponsorEmail = `smoke-sponsor-${stamp}@example.com`;
  const recipientEmail = `smoke-recipient-${stamp}@example.com`;
  const recipientName = "Smoke Recipient";

  // Step 1: missing sponsor email
  {
    const r = await fetch(`${BASE}/api/stripe/checkout/sponsor-founder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sponsorName: "Smoke", recipientEmail, recipientName }),
    });
    record("checkout: rejects missing sponsor email with 400", r.status === 400);
  }

  // Step 2: invalid sponsor email
  {
    const r = await fetch(`${BASE}/api/stripe/checkout/sponsor-founder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sponsorEmail: "not-an-email", sponsorName: "Smoke", recipientEmail, recipientName }),
    });
    record("checkout: rejects invalid sponsor email shape with 400", r.status === 400);
  }

  // Step 3: missing sponsor name
  {
    const r = await fetch(`${BASE}/api/stripe/checkout/sponsor-founder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sponsorEmail, recipientEmail, recipientName }),
    });
    record("checkout: rejects missing sponsor name with 400", r.status === 400);
  }

  // Step 4: missing recipient email
  {
    const r = await fetch(`${BASE}/api/stripe/checkout/sponsor-founder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sponsorEmail, sponsorName: "Smoke", recipientName }),
    });
    record("checkout: rejects missing recipient email with 400", r.status === 400);
  }

  // Step 5: invalid recipient email
  {
    const r = await fetch(`${BASE}/api/stripe/checkout/sponsor-founder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sponsorEmail, sponsorName: "Smoke", recipientEmail: "not-an-email", recipientName }),
    });
    record("checkout: rejects invalid recipient email shape with 400", r.status === 400);
  }

  // Step 6: missing recipient name
  {
    const r = await fetch(`${BASE}/api/stripe/checkout/sponsor-founder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sponsorEmail, sponsorName: "Smoke", recipientEmail }),
    });
    record("checkout: rejects missing recipient name with 400", r.status === 400);
  }

  // Step 7: self-gift guard
  {
    const r = await fetch(`${BASE}/api/stripe/checkout/sponsor-founder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sponsorEmail, sponsorName: "Smoke",
        recipientEmail: sponsorEmail, recipientName,
      }),
    });
    const body = await r.json();
    const pass = r.status === 400 && /can't gift.*to yourself|gift.*yourself/i.test(String(body.error || ""));
    record("checkout: rejects self-gift with 400", pass, body.error);
  }

  // Step 8: valid checkout returns Stripe URL OR 404 (price not seeded)
  {
    const r = await fetch(`${BASE}/api/stripe/checkout/sponsor-founder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sponsorEmail, sponsorName: "Smoke Test Sponsor",
        recipientEmail, recipientName,
        message: "Welcome to Kiddo, friend",
      }),
    });
    const body = await r.json();
    if (r.status === 200 && typeof body.url === "string") {
      record("checkout: valid inputs return Stripe Checkout URL", true, body.url.slice(0, 60) + "...");
    } else if (r.status === 404 && /price not found/i.test(String(body.error || ""))) {
      record("checkout: Stripe price not seeded (expected in some dev envs)", true, body.error);
    } else {
      record("checkout: valid inputs returned UNEXPECTED response", false, `status=${r.status} body=${JSON.stringify(body)}`);
    }
  }

  // Step 9: simulate the webhook by invoking handleSponsorFounderPurchase
  // with a synthetic session. Exercises the real append + idempotency +
  // analytics + recipient-email code path.
  const { WebhookHandlers } = await import("../server/webhookHandlers");
  const syntheticSessionId = `cs_smoke_founder_${stamp}`;
  const syntheticSession = {
    id: syntheticSessionId,
    customer_email: sponsorEmail,
    customer_details: { email: sponsorEmail, name: "Smoke Test Sponsor" },
    amount_total: 1900,
    currency: "usd",
    metadata: {
      type: "sponsor_founder",
      sponsorEmail,
      sponsorName: "Smoke Test Sponsor",
      recipientEmail,
      recipientName,
      message: "Welcome to Kiddo, friend",
    },
  };
  try {
    await WebhookHandlers.handleSponsorFounderPurchase(syntheticSession);
    record("webhook: handleSponsorFounderPurchase ran without throwing", true);
  } catch (err: any) {
    record("webhook: handleSponsorFounderPurchase THREW", false, err?.message || String(err));
  }

  // Step 10: count went up by exactly 1
  const afterFirstWebhook = await countFounders();
  record(
    `jsonl: count incremented by 1 after webhook (was ${startingCount}, now ${afterFirstWebhook})`,
    afterFirstWebhook === startingCount + 1,
    `start=${startingCount} after=${afterFirstWebhook}`,
  );

  // Step 11: duplicate recipient guard → 409
  {
    const r = await fetch(`${BASE}/api/stripe/checkout/sponsor-founder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sponsorEmail: `different-sponsor-${stamp}@example.com`,
        sponsorName: "Different Sponsor",
        recipientEmail, // same recipient
        recipientName,
      }),
    });
    const body = await r.json();
    const pass = r.status === 409 && body.error === "recipient_already_founder";
    record("dup guard: second gift for same recipient returns 409", pass, JSON.stringify(body));
  }

  // Step 12: webhook double-fire idempotency → no new entry
  try {
    await WebhookHandlers.handleSponsorFounderPurchase(syntheticSession);
    const afterDoubleFire = await countFounders();
    record(
      "idempotency: webhook re-fired with same session.id does NOT add a row",
      afterDoubleFire === afterFirstWebhook,
      `count after double-fire = ${afterDoubleFire}`,
    );
  } catch (err: any) {
    record("idempotency: webhook re-fire threw", false, err?.message);
  }

  // Cleanup: strip our synthetic session ID from the jsonl
  const removed = await removeEntriesBySessionId(new Set([syntheticSessionId]));
  console.log(`\nCleanup: removed ${removed} synthetic entries from founding-members.jsonl`);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} steps passed.`);
  if (failed.length > 0) {
    console.log("FAILURES:");
    failed.forEach((f) => console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ""}`));
    process.exit(1);
  }
  console.log("All Founder gift smoke steps green.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
