/* eslint-disable no-console */
// Load .env so ALPACA_BROKER_API_KEY / _SECRET can live there (the standard place,
// alongside the app's other secrets) instead of being passed inline every run.
import "dotenv/config";
// Alpaca Broker API — custodial make-or-break smoke test.
//
// Answers, in ONE command, the two undocumented questions from
// CUSTODIAN_VENDOR_DILIGENCE.md against Alpaca's SANDBOX:
//   (1) Does a custodial account (account_type:"custodial" + minor_identity) open?
//   (2) Does a FRACTIONAL, notional ($50) buy work INSIDE that custodial account?
//
// Self-contained on purpose: it talks to the sandbox directly with synthetic
// test data, so it needs NO database and never touches real money or the app.
//
// Run:
//   set ALPACA_BROKER_API_KEY=...&& set ALPACA_BROKER_API_SECRET=...&& npm run smoke:alpaca-custodial
// (default base URL is the sandbox; override with ALPACA_BROKER_BASE_URL.)

const BASE = String(process.env.ALPACA_BROKER_BASE_URL || "https://broker-api.sandbox.alpaca.markets").replace(/\/+$/, "");
const KEY = process.env.ALPACA_BROKER_API_KEY;
const SECRET = process.env.ALPACA_BROKER_API_SECRET;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function call(method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64"),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-json */ }
  return { ok: res.ok, status: res.status, json, text };
}

function step(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? `  — ${detail}` : ""}`);
}

async function main() {
  if (!KEY || !SECRET) {
    console.log("Set ALPACA_BROKER_API_KEY and ALPACA_BROKER_API_SECRET (sandbox Broker API keys) first.");
    console.log("Sign up: Broker API (Brokerdash) → generate sandbox keys → re-run.");
    process.exit(2);
  }
  console.log(`> Alpaca Broker sandbox: ${BASE}\n`);
  const stamp = Date.now();

  // ── 1) Open a custodial account (the make-or-break #1 prerequisite) ──
  const accountBody = {
    account_type: "custodial",
    contact: {
      email_address: `kiddo.custodian.${stamp}@example.com`,
      phone_number: "555-555-1234",
      street_address: ["20 N San Mateo Dr"],
      city: "San Mateo",
      state: "CA",
      postal_code: "94401",
      country: "USA",
    },
    identity: {
      given_name: "Elena",
      family_name: "Custodian",
      date_of_birth: "1985-01-01",
      tax_id: "676-55-4321",
      tax_id_type: "USA_SSN",
      country_of_citizenship: "USA",
      country_of_birth: "USA",
      country_of_tax_residence: "USA",
      funding_source: ["family"],
      // Financial profile — Alpaca requires these on the custodian identity
      // (sandbox returns 422 "annual_income_min is required" without them).
      // Values mirror Alpaca's own custodial docs sample so the enums are valid.
      annual_income_min: "50000",
      annual_income_max: "100000",
      liquid_net_worth_min: "50000",
      liquid_net_worth_max: "100000",
      total_net_worth_min: "100000",
      total_net_worth_max: "150000",
      liquidity_needs: "does_not_matter",
      investment_experience_with_stocks: "over_5_years",
      risk_tolerance: "conservative",
      investment_objective: "market_speculation",
      investment_time_horizon: "more_than_10_years",
    },
    disclosures: {
      is_control_person: false,
      is_affiliated_exchange_or_finra: false,
      is_politically_exposed: false,
      immediate_family_exposed: false,
    },
    agreements: [
      { agreement: "customer_agreement", signed_at: new Date(stamp).toISOString(), ip_address: "127.0.0.1" },
    ],
    minor_identity: {
      given_name: "Theo",
      family_name: "Custodian",
      email: `kiddo.minor.${stamp}@example.com`,
      date_of_birth: "2015-01-01",
      tax_id: "676-54-4321",
      tax_id_type: "USA_SSN",
      country_of_citizenship: "USA",
      country_of_birth: "USA",
      country_of_tax_residence: "USA",
      state: "CA",
    },
  };
  const acct = await call("POST", "/v1/accounts", accountBody);
  step("Custodial account open", acct.ok, acct.ok ? `id=${acct.json?.id} status=${acct.json?.status}` : `${acct.status} ${acct.text?.slice(0, 300)}`);
  if (!acct.ok) {
    console.log("\nMAKE-OR-BREAK #1 (custodial supported): ❌ — stopping. Check the error above.");
    process.exit(1);
  }
  const accountId = acct.json.id as string;

  // ── 1b) Wait for onboarding to reach ACTIVE. A not-yet-active account makes
  //    funding/trading fail for reasons unrelated to custodial support, which
  //    would turn the verdict below into a false negative. ──
  let acctStatus = String(acct.json?.status || "");
  for (let i = 0; i < 8 && acctStatus !== "ACTIVE" && acctStatus !== "APPROVED"; i++) {
    await delay(1500);
    const a = await call("GET", `/v1/accounts/${accountId}`);
    acctStatus = String(a.json?.status || acctStatus);
  }
  step("Account ACTIVE", acctStatus === "ACTIVE" || acctStatus === "APPROVED", `status=${acctStatus}`);

  // ── 2) Fund it (sandbox ACH — auto-completes) so the buy has buying power ──
  let funded = false;
  try {
    const rel = await call("POST", `/v1/accounts/${accountId}/ach_relationships`, {
      account_owner_name: "Elena Custodian",
      bank_account_type: "CHECKING",
      bank_account_number: "32100123",
      bank_routing_number: "121000358",
      nickname: "smoke-bank",
    });
    step("ACH relationship", rel.ok, rel.ok ? `id=${rel.json?.id}` : `${rel.status} ${rel.text?.slice(0, 200)}`);
    if (rel.ok) {
      const xfer = await call("POST", `/v1/accounts/${accountId}/transfers`, {
        transfer_type: "ach",
        relationship_id: rel.json.id,
        amount: "1000",
        direction: "INCOMING",
      });
      step("Incoming transfer $1000", xfer.ok, xfer.ok ? `status=${xfer.json?.status}` : `${xfer.status} ${xfer.text?.slice(0, 200)}`);
      // Poll for buying power to land.
      for (let i = 0; i < 8 && !funded; i++) {
        await delay(1500);
        const a = await call("GET", `/v1/trading/accounts/${accountId}/account`);
        const bp = parseFloat(a.json?.buying_power || a.json?.cash || "0") || 0;
        if (bp > 0) { funded = true; step("Buying power available", true, `$${bp}`); }
      }
    }
  } catch (e) {
    step("Funding", false, String(e));
  }
  if (!funded) console.log("  (funding didn't settle in time — still attempting the order; a 'fractional not allowed in custodial' error vs an 'insufficient funds' error is itself the answer)");

  // ── 2b) Is the market open? A `market`/`day` notional order placed while the
  //    market is CLOSED is rejected for market-hours reasons — NOT because
  //    fractional-in-custodial is unsupported. Capture it so a closed-market
  //    rejection reads as INCONCLUSIVE below, not as a make-or-break ❌. ──
  const clock = await call("GET", "/v1/clock");
  const marketOpen = clock.ok && clock.json?.is_open === true;
  step("Market open", marketOpen, marketOpen ? "yes" : `no${clock.json?.next_open ? ` — next open ${clock.json.next_open}` : ""}`);

  // ── 3) The make-or-break: a $50 FRACTIONAL notional buy IN the custodial account ──
  const order = await call("POST", `/v1/trading/accounts/${accountId}/orders`, {
    symbol: "AAPL",
    notional: "50.00",
    side: "buy",
    type: "market",
    time_in_force: "day",
    client_order_id: `smoke-${stamp}`,
  });
  step("Fractional $50 notional buy (custodial)", order.ok, order.ok ? `id=${order.json?.id} status=${order.json?.status}` : `${order.status} ${order.text?.slice(0, 300)}`);

  // Classify a FAILURE: only a fractional/notional/custodial rejection answers
  // make-or-break #2. A market-closed / insufficient-funds / not-active failure
  // is INCONCLUSIVE — re-run, don't read it as "Alpaca can't do this."
  const errText = order.text || "";
  const fractionalRejected = /fractional|notional|not.*support|custodial/i.test(errText);
  const inconclusive = !order.ok && !fractionalRejected && (!marketOpen || !funded);

  // ── 4) Readout ──
  const snap = await call("GET", `/v1/trading/accounts/${accountId}/account`);
  if (snap.ok) console.log(`\nAccount: cash=$${snap.json?.cash} equity=$${snap.json?.equity} buying_power=$${snap.json?.buying_power}`);

  const verdict2 = order.ok
    ? "✅ accepted"
    : inconclusive
      ? "⚠️  inconclusive — re-run with market OPEN + funding settled"
      : "❌ rejected as fractional/custodial — see error above";
  console.log("\n— MAKE-OR-BREAK VERDICT —");
  console.log(`  #1 Custodial account opens:        ✅`);
  console.log(`  #2 Fractional buy in custodial:    ${verdict2}`);
  console.log(`  #3 At-majority handoff:            ⚠️  undocumented — confirm with Alpaca (not testable here)`);
  // Exit non-zero ONLY on a definitive fractional/custodial rejection; an
  // inconclusive run (market closed / unfunded) shouldn't read as a hard failure.
  process.exit(order.ok ? 0 : inconclusive ? 2 : 1);
}

main().catch((e) => { console.error("smoke crashed:", e); process.exit(1); });
