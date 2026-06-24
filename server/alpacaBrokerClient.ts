// Alpaca Broker API client — custodial (UTMA) account open + fractional trading.
//
// Status: SANDBOX-READY SCAFFOLD. The HTTP calls are REAL (they hit Alpaca's
// Broker API), but the module is INERT until `ALPACA_BROKER_API_KEY` /
// `ALPACA_BROKER_API_SECRET` are set — every entry point throws a clear error
// without them, and nothing imports this unless `CUSTODIAN_PROVIDER=alpaca`.
// Default base URL is the SANDBOX, so first runs can't touch real money.
//
// To prototype (the make-or-break flows from CUSTODIAN_VENDOR_DILIGENCE.md):
//   1. Sign up for the Broker API (Brokerdash) → generate sandbox keys.
//   2. Set ALPACA_BROKER_API_KEY / _SECRET (+ optionally ALPACA_BROKER_BASE_URL).
//   3. Set CUSTODIAN_PROVIDER=alpaca, then exercise getCustodianProvider().
//   VERIFY the two undocumented things: (a) notional/fractional buys work IN a
//   custodial account; (b) the at-majority custodial→individual transfer exists.
//
// Shapes verified against Alpaca docs 2026-06 (POST /v1/accounts custodial body
// w/ minor_identity; POST /v1/trading/accounts/{id}/orders with `notional`).
// Auth = HTTP Basic base64(key:secret). Fractional orders are DAY-only.

import { assembleUTMAAccountPayload, type DriveWealthAccountPayload } from "./driveWealthAccountSetup";

const SANDBOX_BASE = "https://broker-api.sandbox.alpaca.markets";

function baseUrl(): string {
  return String(process.env.ALPACA_BROKER_BASE_URL || SANDBOX_BASE).replace(/\/+$/, "");
}

function authHeader(): string {
  const key = process.env.ALPACA_BROKER_API_KEY;
  const secret = process.env.ALPACA_BROKER_API_SECRET;
  if (!key || !secret) {
    throw new Error(
      "[alpaca] ALPACA_BROKER_API_KEY / ALPACA_BROKER_API_SECRET not set. " +
        "This is a sandbox-ready scaffold — generate Broker API sandbox keys first.",
    );
  }
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
}

async function alpacaFetch(path: string, init: { method: string; body?: unknown }): Promise<any> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`[alpaca] ${init.method} ${path} -> ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

// "us_citizen" | "permanent_resident" → an Alpaca country code. We only know the
// citizenship country for citizens; non-citizens need the real country collected.
function citizenshipCountry(citizenship: string): string {
  // TODO(alpaca): for permanent_resident, collect + map the actual citizenship
  // country. Defaulting to USA keeps the body structurally valid in sandbox.
  return citizenship === "permanent_resident" ? "USA" : "USA";
}

// Map our validated UTMA payload (the same one DriveWealth uses) onto Alpaca's
// custodial account-open body. Fields Kiddo doesn't yet collect are marked TODO
// with safe defaults so the body is structurally complete for sandbox testing.
function toAlpacaCustodialBody(
  dw: DriveWealthAccountPayload,
  custodianSsnDigits: string | undefined,
  signedIp: string,
): Record<string, unknown> {
  const c = dw.custodian;
  const m = dw.minor;
  const taxId = (custodianSsnDigits || c.ssn || "").replace(/\D/g, "");
  return {
    account_type: "custodial",
    contact: {
      email_address: c.email,
      phone_number: c.phone,
      street_address: [c.address.street],
      city: c.address.city,
      state: c.address.state,
      postal_code: c.address.zip,
      country: "USA",
    },
    identity: {
      given_name: c.legalFirstName,
      family_name: c.legalLastName,
      date_of_birth: c.dob,
      tax_id: taxId,
      tax_id_type: "USA_SSN",
      country_of_citizenship: citizenshipCountry(c.citizenship),
      country_of_birth: "USA", // TODO(alpaca): collect real country of birth
      country_of_tax_residence: "USA",
      // TODO(alpaca): "gift"/"family" funding for a custodial gifting account —
      // confirm the accepted enum; "family" is the closest standard value.
      funding_source: ["family"],
    },
    // TODO(alpaca): capture real attestations in the activate-investing flow.
    disclosures: {
      is_control_person: false,
      is_affiliated_exchange_or_finra: false,
      is_politically_exposed: false,
      immediate_family_exposed: false,
    },
    // Reuse the per-fund UTMA irrevocability acknowledgment as the signed-at
    // anchor. TODO(alpaca): per Alpaca's onboarding webinar (2026-06-24), the
    // customer agreement is HOSTED BY ALPACA — link/present their hosted agreement
    // directly (it auto-updates) rather than our own copy, follow their display +
    // e-signature requirements, and capture the real e-sig timestamp + signing IP
    // at activate-investing time. (Some "optional" account fields are also actually
    // required depending on partnership type — confirm the set with sales.)
    agreements: [
      {
        agreement: "customer_agreement",
        signed_at: dw.irrevocabilityAcknowledgedAt,
        ip_address: signedIp,
      },
    ],
    minor_identity: {
      given_name: m.legalFirstName,
      family_name: m.legalLastName,
      // TODO(alpaca): minors rarely have email — confirm whether it's required;
      // falling back to the custodian's email keeps the sandbox body complete.
      email: c.email,
      date_of_birth: m.dob,
      tax_id: m.ssn,
      tax_id_type: "USA_SSN",
      country_of_citizenship: "USA",
      country_of_birth: "USA",
      country_of_tax_residence: "USA",
      state: m.state,
    },
  };
}

export async function createCustodialAccount(input: {
  fundId: string;
  childSsnDigits: string;
  custodianSsnDigits?: string;
  signedIp?: string;
}): Promise<{ accountId: string; live: boolean }> {
  const dw = await assembleUTMAAccountPayload({
    fundId: input.fundId,
    childSsnDigits: input.childSsnDigits,
  });
  const body = toAlpacaCustodialBody(dw, input.custodianSsnDigits, input.signedIp || "0.0.0.0");
  const account = await alpacaFetch("/v1/accounts", { method: "POST", body });
  return { accountId: String(account.id), live: true };
}

// Fractional by dollar amount. DAY-only for fractional (Alpaca constraint).
export async function placeNotionalOrder(input: {
  accountId: string;
  symbol: string;
  amountUsd: number;
  side: "buy" | "sell";
  idempotencyKey: string;
}): Promise<{ orderId: string; live: boolean }> {
  const order = await alpacaFetch(`/v1/trading/accounts/${input.accountId}/orders`, {
    method: "POST",
    body: {
      symbol: input.symbol,
      notional: input.amountUsd.toFixed(2),
      side: input.side,
      type: "market",
      time_in_force: "day",
      client_order_id: input.idempotencyKey, // idempotency: a retry won't double-fill
    },
  });
  return { orderId: String(order.id), live: true };
}

// Close a whole position (full liquidation for a refund/withdrawal of one holding).
export async function closeAllPositions(accountId: string): Promise<{ live: boolean }> {
  await alpacaFetch(`/v1/trading/accounts/${accountId}/positions`, { method: "DELETE" });
  return { live: true };
}

export async function getTradingAccountSnapshot(accountId: string): Promise<{
  cashUsd: number;
  equityUsd: number;
  positions: Array<{ symbol: string; qty: number; marketValueUsd: number }>;
}> {
  const [account, positions] = await Promise.all([
    alpacaFetch(`/v1/trading/accounts/${accountId}/account`, { method: "GET" }),
    alpacaFetch(`/v1/trading/accounts/${accountId}/positions`, { method: "GET" }),
  ]);
  return {
    cashUsd: parseFloat(account.cash || "0") || 0,
    equityUsd: parseFloat(account.equity || "0") || 0,
    positions: (Array.isArray(positions) ? positions : []).map((p: any) => ({
      symbol: String(p.symbol),
      qty: parseFloat(p.qty || "0") || 0,
      marketValueUsd: parseFloat(p.market_value || "0") || 0,
    })),
  };
}
