/* eslint-disable no-console */
// Load .env so ALPACA_BROKER_API_KEY / _SECRET resolve.
import "dotenv/config";
// Alpaca Broker API — what we CAN validate in sandbox WITHOUT the custodial
// entitlement. Opens a REGULAR (non-custodial) account, funds it, and places a
// fractional ($50) notional buy — confirming auth + account-open + funding +
// the fractional/notional MECHANISM all work with our keys. The only thing this
// can't prove is fractional INSIDE a custodial account (that's gated on Alpaca
// enabling custodial creation for our correspondent). Companion to
// alpaca-custodial-smoke.ts. No real money (sandbox).

const BASE = String(process.env.ALPACA_BROKER_BASE_URL || "https://broker-api.sandbox.alpaca.markets").replace(/\/+$/, "");
const KEY = process.env.ALPACA_BROKER_API_KEY;
const SECRET = process.env.ALPACA_BROKER_API_SECRET;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
const step = (label: string, ok: boolean, detail = "") =>
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? `  — ${detail}` : ""}`);

async function main() {
  if (!KEY || !SECRET) { console.log("Set ALPACA_BROKER_API_KEY/_SECRET in .env first."); process.exit(2); }
  console.log(`> Alpaca Broker sandbox: ${BASE}\n`);
  const stamp = Date.now();

  // 1) Open a REGULAR account (no account_type:custodial, no minor_identity).
  const acct = await call("POST", "/v1/accounts", {
    contact: {
      email_address: `kiddo.probe.${stamp}@example.com`,
      phone_number: "555-555-1234",
      street_address: ["20 N San Mateo Dr"],
      city: "San Mateo", state: "CA", postal_code: "94401", country: "USA",
    },
    identity: {
      given_name: "Probe", family_name: "Investor", date_of_birth: "1985-01-01",
      tax_id: "676-55-4322", tax_id_type: "USA_SSN",
      country_of_citizenship: "USA", country_of_birth: "USA", country_of_tax_residence: "USA",
      funding_source: ["employment_income"],
    },
    disclosures: { is_control_person: false, is_affiliated_exchange_or_finra: false, is_politically_exposed: false, immediate_family_exposed: false },
    agreements: [{ agreement: "customer_agreement", signed_at: new Date(stamp).toISOString(), ip_address: "127.0.0.1" }],
  });
  step("Regular account open", acct.ok, acct.ok ? `id=${acct.json?.id} status=${acct.json?.status}` : `${acct.status} ${acct.text?.slice(0, 300)}`);
  if (!acct.ok) { console.log("\nAccount open failed — integration/credentials issue, not custodial-related."); process.exit(1); }
  const id = acct.json.id as string;

  // 1b) Wait for ACTIVE/APPROVED.
  let s = String(acct.json?.status || "");
  for (let i = 0; i < 30 && s !== "ACTIVE" && s !== "APPROVED"; i++) { await delay(2000); const a = await call("GET", `/v1/accounts/${id}`); s = String(a.json?.status || s); }
  step("Account ACTIVE", s === "ACTIVE" || s === "APPROVED", `status=${s}`);

  // 2) Fund via sandbox ACH.
  let funded = false;
  const rel = await call("POST", `/v1/accounts/${id}/ach_relationships`, {
    account_owner_name: "Probe Investor", bank_account_type: "CHECKING",
    bank_account_number: "32100123", bank_routing_number: "121000358", nickname: "probe-bank",
  });
  step("ACH relationship", rel.ok, rel.ok ? `id=${rel.json?.id}` : `${rel.status} ${rel.text?.slice(0, 200)}`);
  if (rel.ok) {
    const xfer = await call("POST", `/v1/accounts/${id}/transfers`, { transfer_type: "ach", relationship_id: rel.json.id, amount: "1000", direction: "INCOMING" });
    step("Incoming transfer $1000", xfer.ok, xfer.ok ? `status=${xfer.json?.status}` : `${xfer.status} ${xfer.text?.slice(0, 200)}`);
    for (let i = 0; i < 20 && !funded; i++) { await delay(2000); const a = await call("GET", `/v1/trading/accounts/${id}/account`); const bp = parseFloat(a.json?.buying_power || a.json?.cash || "0") || 0; if (bp > 0) { funded = true; step("Buying power available", true, `$${bp}`); } }
  }

  // 3) Market hours (notional/fractional needs market OPEN).
  const clock = await call("GET", "/v1/clock");
  const open = clock.ok && clock.json?.is_open === true;
  step("Market open", open, open ? "yes" : `no${clock.json?.next_open ? ` — next open ${clock.json.next_open}` : ""}`);

  // 4) The mechanism: a $50 FRACTIONAL NOTIONAL buy (regular account).
  const order = await call("POST", `/v1/trading/accounts/${id}/orders`, {
    symbol: "VOO", notional: "50.00", side: "buy", type: "market", time_in_force: "day", client_order_id: `probe-${stamp}`,
  });
  step("Fractional $50 notional buy (regular)", order.ok, order.ok ? `id=${order.json?.id} status=${order.json?.status} qty=${order.json?.qty}` : `${order.status} ${order.text?.slice(0, 300)}`);
  const fractionalRejected = /fractional|notional|not.*support/i.test(order.text || "");
  const inconclusive = !order.ok && !fractionalRejected && (!open || !funded);

  console.log("\n— SANDBOX PRE-VALIDATION (no custodial entitlement needed) —");
  console.log(`  Auth + regular account open:   ✅`);
  console.log(`  Funding (ACH):                 ${funded ? "✅" : "⚠️  didn't settle in time"}`);
  console.log(`  Fractional/notional buy works: ${order.ok ? "✅ accepted — the mechanism works on Alpaca" : inconclusive ? "⚠️  inconclusive (market closed / unfunded) — re-run market-open" : "❌ rejected as fractional/notional — see error"}`);
  console.log(`  STILL GATED on Alpaca enabling custodial for 'frvq': fractional INSIDE custodial + the at-majority handoff.`);
  process.exit(order.ok ? 0 : inconclusive ? 2 : 1);
}
main().catch((e) => { console.error("probe crashed:", e); process.exit(1); });
