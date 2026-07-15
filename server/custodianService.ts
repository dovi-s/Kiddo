// Provider-agnostic CUSTODIAN (brokerage/custody) interface.
//
// Per CLAUDE.md: custody/brokerage is the ONE provider where "swap = engineering
// decision, not rebuild" is worth defending, and ALL custodian API calls must
// live behind an interface — NEVER inlined in routes.ts. As of 2026-06 the field
// narrowed to a real two-horse race:
//   • DriveWealth   — proven custodial/teen accounts, pioneered fractional.
//   • Alpaca Broker — launched custodial (UTMA/UGMA) 2026-05-11; best-in-class DX.
// This interface is what lets the founder PICK — or later SWAP — by config, not by
// rewrite. The Alpaca sandbox prototype drops in as the `alpaca` adapter below.
//
// SCOPE / STATUS (read before extending):
//   - This is a PROPOSAL scaffold. The operation set + neutral types are grounded
//     in Kiddo's real flows (open a UTMA, invest a gift fractionally, liquidate for
//     a refund, hand off at majority). The founder owns the final shape AND the
//     provider decision — don't treat this as settled architecture.
//   - NOTHING here makes a live API call. The default provider is `stub` (no-op
//     scaffold). `drivewealth` delegates to the existing DriveWealth assembly
//     (driveWealthAccountSetup.ts) + transfer queue (custodianTransfer.ts).
//     `alpaca` is unwired — its methods throw, with the endpoint mapping in
//     comments so the sandbox build has a precise starting point.
//   - Going live is gated on the founder's provider pick + counsel sign-off
//     (COUNSEL_ENGAGEMENT_PACKET) + real credentials — not on this file.

import {
  assembleUTMAAccountPayload,
  submitToDriveWealth,
} from "./driveWealthAccountSetup";
import { queueCustodianTransfer } from "./custodianTransfer";
import {
  createCustodialAccount as alpacaCreateCustodialAccount,
  placeNotionalOrder as alpacaPlaceNotionalOrder,
  closeAllPositions as alpacaCloseAllPositions,
  getTradingAccountSnapshot as alpacaGetSnapshot,
} from "./alpacaBrokerClient";

export type CustodianProviderName = "stub" | "drivewealth" | "alpaca";

// ── Neutral domain types (vendor-agnostic — no DW/Alpaca field names leak out) ──

export interface CustodialAccountOpenInput {
  fundId: string;
  /** Child's 9-digit SSN — passed through from the request, NEVER persisted. */
  childSsnDigits: string;
  /** Custodian's SSN, collected at activate-investing time — pass-through, never persisted. */
  custodianSsnDigits?: string;
}

export interface CustodialAccountResult {
  accountId: string;
  /** false while scaffolded / sandbox; true once a real account was opened. */
  live: boolean;
  provider: CustodianProviderName;
}

export interface InvestGiftInput {
  accountId: string;
  /** Ticker — the fund's default managed-ETF mix, or a chosen single stock. */
  symbol: string;
  /** FRACTIONAL by dollar amount — gifts are $25–$100, so notional buys are mandatory. */
  amountUsd: number;
  /** The gift id, so a retry never double-invests the same gift. */
  idempotencyKey: string;
}

export interface LiquidateInput {
  accountId: string;
  /** Partial amount; omit for a full liquidation (refund / withdrawal). */
  amountUsd?: number;
  idempotencyKey: string;
}

export interface OrderResult {
  orderId: string;
  live: boolean;
}

export interface HandoffInput {
  fundId: string;
  accountId: string;
  childUserId?: string | null;
  childEmail?: string | null;
  previousCustodianUserId?: string | null;
  /** YYYY-MM-DD — the at-majority transfer gate (Kiddo's keystone). */
  majorityDate: string;
}

export interface HandoffResult {
  transferred: boolean;
  live: boolean;
}

export interface CustodianAccountSnapshot {
  accountId: string;
  cashUsd: number;
  equityUsd: number;
  positions: Array<{ symbol: string; qty: number; marketValueUsd: number }>;
}

/** The contract every custodian provider must satisfy. Route handlers call THIS,
 *  never a vendor SDK directly. */
export interface CustodianProvider {
  readonly name: CustodianProviderName;
  openCustodialAccount(input: CustodialAccountOpenInput): Promise<CustodialAccountResult>;
  investGift(input: InvestGiftInput): Promise<OrderResult>;
  liquidate(input: LiquidateInput): Promise<OrderResult>;
  getAccount(accountId: string): Promise<CustodianAccountSnapshot>;
  handoffAtMajority(input: HandoffInput): Promise<HandoffResult>;
}

class NotWiredError extends Error {
  constructor(provider: CustodianProviderName, op: string) {
    super(
      `[custodian:${provider}] "${op}" is not wired yet. This is a scaffold — ` +
        `pick a provider, complete counsel sign-off, set credentials, then implement this adapter.`,
    );
    this.name = "NotWiredError";
  }
}

// ── stub: the safe default. Mirrors the current scaffold behavior — never live. ──
const stubProvider: CustodianProvider = {
  name: "stub",
  async openCustodialAccount(input) {
    console.log(`[custodian:stub] would open UTMA account for fund=${input.fundId}`);
    return { accountId: `stub_${input.fundId.slice(0, 8)}`, live: false, provider: "stub" };
  },
  async investGift(input) {
    console.log(`[custodian:stub] would invest $${input.amountUsd} of ${input.symbol} into ${input.accountId}`);
    return { orderId: `stub_order_${input.idempotencyKey.slice(0, 8)}`, live: false };
  },
  async liquidate(input) {
    console.log(`[custodian:stub] would liquidate ${input.amountUsd ?? "ALL"} from ${input.accountId}`);
    return { orderId: `stub_liq_${input.idempotencyKey.slice(0, 8)}`, live: false };
  },
  async getAccount(accountId) {
    return { accountId, cashUsd: 0, equityUsd: 0, positions: [] };
  },
  async handoffAtMajority(input) {
    console.log(`[custodian:stub] would hand off fund=${input.fundId} at ${input.majorityDate}`);
    return { transferred: false, live: false };
  },
};

// ── drivewealth: delegates to the existing DriveWealth assembly + transfer queue.
//    Account-open is real-shaped (payload validated today); trading is still a
//    scaffold until the DW order API is wired. ──
const driveWealthProvider: CustodianProvider = {
  name: "drivewealth",
  async openCustodialAccount(input) {
    const payload = await assembleUTMAAccountPayload({
      fundId: input.fundId,
      childSsnDigits: input.childSsnDigits,
    });
    const { accountId, live } = await submitToDriveWealth(payload, { fundId: input.fundId });
    return { accountId, live, provider: "drivewealth" };
  },
  async investGift() {
    // TODO(drivewealth): POST /accounts/{id}/orders — fractional by `amountCash`.
    throw new NotWiredError("drivewealth", "investGift");
  },
  async liquidate() {
    // TODO(drivewealth): POST /accounts/{id}/orders — SELL by amount, or full liquidation.
    throw new NotWiredError("drivewealth", "liquidate");
  },
  async getAccount() {
    // TODO(drivewealth): GET /accounts/{id} + /accounts/{id}/positions.
    throw new NotWiredError("drivewealth", "getAccount");
  },
  async handoffAtMajority(input) {
    const res = await queueCustodianTransfer({
      type: "age18_handoff_requested",
      fundId: input.fundId,
      childUserId: input.childUserId ?? null,
      childEmail: input.childEmail ?? null,
      previousCustodianUserId: input.previousCustodianUserId ?? null,
      ownershipTransferredAt: new Date().toISOString(),
    });
    return { transferred: res.delivered, live: res.delivered };
  },
};

// ── alpaca: UNWIRED. Endpoint mapping below is the sandbox build's starting point.
//    Alpaca Broker API custodial: account_type:"custodial" + a `minor_identity`
//    object (given/family name, email, dob, tax_id, citizenship, country, state).
//    KYC runs on the adult custodian; the minor is the beneficiary only. ──
const alpacaProvider: CustodianProvider = {
  name: "alpaca",
  async openCustodialAccount(input) {
    const { accountId, live } = await alpacaCreateCustodialAccount({
      fundId: input.fundId,
      childSsnDigits: input.childSsnDigits,
      custodianSsnDigits: input.custodianSsnDigits,
    });
    return { accountId, live, provider: "alpaca" };
  },
  async investGift(input) {
    return alpacaPlaceNotionalOrder({
      accountId: input.accountId,
      symbol: input.symbol,
      amountUsd: input.amountUsd,
      side: "buy",
      idempotencyKey: input.idempotencyKey,
    });
  },
  async liquidate(input) {
    // Partial → notional SELL; full (no amount) → close every position.
    if (input.amountUsd && input.amountUsd > 0) {
      // NOTE: a single-symbol partial sell needs the symbol; multi-position
      // partials must be split upstream. Wire the symbol through when used.
      throw new NotWiredError("alpaca", "liquidate(partial — needs symbol)");
    }
    await alpacaCloseAllPositions(input.accountId);
    return { orderId: `alpaca_liq_${input.idempotencyKey.slice(0, 8)}`, live: true };
  },
  async getAccount(accountId) {
    const snap = await alpacaGetSnapshot(accountId);
    return { accountId, ...snap };
  },
  async handoffAtMajority(input) {
    // 🔴 UNDOCUMENTED as of 2026-06 — VERIFY the custodial→individual transfer
    // mechanism with Alpaca. Until confirmed, record the event via the same
    // transfer queue DriveWealth uses so nothing is silently dropped.
    const res = await queueCustodianTransfer({
      type: "age18_handoff_requested",
      fundId: input.fundId,
      childUserId: input.childUserId ?? null,
      childEmail: input.childEmail ?? null,
      previousCustodianUserId: input.previousCustodianUserId ?? null,
      ownershipTransferredAt: new Date().toISOString(),
    });
    return { transferred: res.delivered, live: false };
  },
};

const PROVIDERS: Record<CustodianProviderName, CustodianProvider> = {
  stub: stubProvider,
  drivewealth: driveWealthProvider,
  alpaca: alpacaProvider,
};

/** The single entry point. Route handlers call `getCustodianProvider().<op>(...)`,
 *  never a vendor SDK. Selected by env `CUSTODIAN_PROVIDER` (default `stub`), so
 *  swapping providers is a config change, not a code change. */
export function getCustodianProvider(): CustodianProvider {
  const name = String(process.env.CUSTODIAN_PROVIDER || "stub").toLowerCase() as CustodianProviderName;
  return PROVIDERS[name] ?? stubProvider;
}
