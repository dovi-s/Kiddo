import fs from "fs/promises";
import path from "path";
import { db } from "./db";
import { funds } from "@shared/schema";
import { eq } from "drizzle-orm";

// ETFs only — these are the building blocks of the managed mix.
// A managed mix never contains individual stocks; that's the architectural rule.
export const ETF_ALLOWLIST = [
  "VTI",   // US Total Market
  "VXUS",  // International Stocks
  "BND",   // Bonds
  "VGT",   // Tech ETF
  "VUG",   // Growth ETF
  "VYM",   // Dividend ETF
  "SCHD",  // Dividend Growth
  "QQQ",   // Nasdaq 100
] as const;

// Individual stocks — gifter-pick options only. Never allowed in the managed mix.
// Z (Zillow) intentionally removed: not warm enough for a child-facing curated list.
// Existing recurring schedules and holdings to Z are grandfathered via LEGACY_PICK_META
// in client Dashboard.tsx so parents see the friendly name + emoji on display, but
// no new investments can target Z. Don't re-add without product sign-off.
export const STOCK_ALLOWLIST = [
  "DIS", "AAPL", "NKE", "NFLX", "RBLX", "SBUX", "AMZN", "GOOGL", "SPOT",
  "TGT", "CMCSA", "DUOL", "ABNB", "NTDOY", "DPZ", "CHWY", "ADBE",
] as const;

// Custom managed-mix allocations are restricted to ETFs.
export const CUSTOM_STRATEGY_ALLOWED_TICKERS = ETF_ALLOWLIST;
export const MAX_CUSTOM_STRATEGY_HOLDINGS = 10;
// Server-side sum tolerance. Normalized weights always end at exactly 1.0
// (we divide by total) so this check applies to the RAW input from the
// client BEFORE normalization. The client gates strict 100 (sum == 100),
// but a buggy or malicious client could submit something else; this
// gate is defense in depth. Tolerance covers float rounding.
export const CUSTOM_RAW_WEIGHT_MIN_SUM = 95;
export const CUSTOM_RAW_WEIGHT_MAX_SUM = 105;
export type CustomTicker = (typeof CUSTOM_STRATEGY_ALLOWED_TICKERS)[number];
export type CustomAllocations = Record<string, number>;

// Legacy storage path. Kept for one-time-read migration only —
// see migrateFromFileIfNeeded below. New writes never touch this file.
// On a production deploy with no .local/ directory present, the read
// silently fails and the DB is the only source.
const LEGACY_FUND_STRATEGY_OVERRIDES_PATH = path.join(
  process.cwd(),
  ".local",
  "fund-strategy-overrides.json",
);

// Default custom-mix starter. Dropped VGT 2026-05-31 to match the managed
// presets, which removed the tech-sector sleeve in the 2026-05-28 self-directed
// pivot (a sector tilt is the most advice-like allocation — see the RIA question
// in COUNSEL_ENGAGEMENT_PACKET.md Part 1). Now mirrors the client-side prefill
// (Settings.tsx DEFAULT_CUSTOM_ALLOCATION_ROWS: VTI 62 / VXUS 28 / BND 10) so the
// server fallback and the user-facing starter agree. VGT remains SELECTABLE in a
// custom mix (it's still in ETF_ALLOWLIST); it's just no longer the default.
export const DEFAULT_CUSTOM_ALLOCATIONS: CustomAllocations = {
  VTI: 0.62,
  VXUS: 0.28,
  BND: 0.1,
};

type NormalizeResult =
  | { ok: true; allocations: CustomAllocations }
  | { ok: false; reason: "empty" | "too_many_tickers" | "bad_sum" | "no_valid_tickers" };

/**
 * Normalize + validate a raw allocations map from a client request.
 *
 * Validation gates (any failure returns ok:false with a discriminator):
 *   - All tickers must be in CUSTOM_STRATEGY_ALLOWED_TICKERS (case-
 *     insensitive). Unknown tickers are filtered out before the count
 *     check, so {"VTI": 50, "MSFT": 50} becomes {"VTI": 50} → bad_sum.
 *   - At most MAX_CUSTOM_STRATEGY_HOLDINGS valid entries.
 *   - Raw weights must sum within [CUSTOM_RAW_WEIGHT_MIN_SUM,
 *     CUSTOM_RAW_WEIGHT_MAX_SUM] (95-105, tolerating float drift).
 *     The CLIENT gates strict 100; the server's tolerance is defense
 *     in depth against client bugs or replayed/malformed requests.
 *   - At least one valid ticker with a positive weight.
 *
 * On success, weights are normalized to sum to exactly 1.0 (each
 * input divided by the sum). Output map keys are uppercase tickers.
 *
 * Hardened 2026-05-15: previously returned null on any failure and
 * the caller deleted the existing data. Now returns a discriminated
 * result so the caller can preserve existing data on validation
 * failure. See server/routes.ts strategy PATCH for the new flow.
 */
export function normalizeCustomAllocations(input: any): NormalizeResult {
  if (!input || typeof input !== "object") {
    return { ok: false, reason: "empty" };
  }
  const filtered: Record<string, number> = {};
  let rawSum = 0;
  for (const [tickerRaw, raw] of Object.entries(input)) {
    const ticker = String(tickerRaw || "").trim().toUpperCase();
    if (!CUSTOM_STRATEGY_ALLOWED_TICKERS.includes(ticker as CustomTicker)) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) continue;
    filtered[ticker] = n;
    rawSum += n;
  }
  const tickers = Object.keys(filtered);
  if (tickers.length === 0) return { ok: false, reason: "no_valid_tickers" };
  if (tickers.length > MAX_CUSTOM_STRATEGY_HOLDINGS) return { ok: false, reason: "too_many_tickers" };
  if (rawSum < CUSTOM_RAW_WEIGHT_MIN_SUM || rawSum > CUSTOM_RAW_WEIGHT_MAX_SUM) {
    return { ok: false, reason: "bad_sum" };
  }
  const normalized: Record<string, number> = {};
  for (const t of tickers) {
    normalized[t] = filtered[t] / rawSum;
  }
  return { ok: true, allocations: normalized };
}

/**
 * One-time read from the legacy .local/fund-strategy-overrides.json
 * file. Returns the entry for fundId if it exists; null otherwise
 * (file missing, JSON malformed, fund not in file).
 *
 * Called from getFundCustomAllocations ONLY when the DB column is
 * NULL. If a value is found in the file, the caller copies it into
 * the DB column, then never touches the file again for that fund.
 * The file therefore acts as a transparent one-time-read migration
 * source: any dev-server state from before the DB migration is
 * preserved on first read.
 *
 * In production where .local/ doesn't exist, this returns null
 * silently and the DB is the only source.
 */
async function readLegacyFile(fundId: string): Promise<CustomAllocations | null> {
  try {
    const raw = await fs.readFile(LEGACY_FUND_STRATEGY_OVERRIDES_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object") return null;
    const entry = (parsed as Record<string, any>)[fundId];
    if (!entry) return null;
    const normalized = normalizeCustomAllocations(entry);
    return normalized.ok ? normalized.allocations : null;
  } catch {
    return null;
  }
}

/**
 * Read this fund's custom allocations. Source of truth is the
 * funds.custom_allocations jsonb column. Falls back to the legacy
 * .local/ file for one-time migration on first read after the
 * Ring A 2026-05-15 schema change.
 *
 * Returns null when the fund has no saved custom mix. Callers
 * generally fall back to DEFAULT_CUSTOM_ALLOCATIONS in that case
 * (DEFAULT_CUSTOM_ALLOCATIONS is the {VTI 62, VXUS 28, BND 10}
 * starter mix exported above — VGT-free since 2026-05-31).
 */
export async function getFundCustomAllocations(fundId: string): Promise<CustomAllocations | null> {
  if (!fundId) return null;
  const rows = await db
    .select({ customAllocations: funds.customAllocations })
    .from(funds)
    .where(eq(funds.id, fundId))
    .limit(1);
  const dbValue = rows[0]?.customAllocations as CustomAllocations | null | undefined;
  if (dbValue && typeof dbValue === "object" && Object.keys(dbValue).length > 0) {
    return dbValue;
  }
  // One-time migration path: DB has nothing, file might. If we find
  // a value in the file, copy it into the DB so subsequent reads come
  // straight from the column. Best-effort — a failure to write back
  // means we'll try again on the next read.
  const legacy = await readLegacyFile(fundId);
  if (!legacy) return null;
  try {
    await db
      .update(funds)
      .set({ customAllocations: legacy as any, updatedAt: new Date() })
      .where(eq(funds.id, fundId));
  } catch (err: any) {
    console.warn(`[fundStrategyConfig] Legacy backfill write failed for fund ${fundId}:`, err?.message);
  }
  return legacy;
}

type SetResult =
  | { ok: true; allocations: CustomAllocations }
  | { ok: false; reason: "missing_fund_id" | NormalizeResult extends { ok: false; reason: infer R } ? R : never };

/**
 * Save a fund's custom allocations. Returns a discriminated result so
 * the caller can distinguish "saved successfully" from "validation
 * failed; existing data preserved" from "fund id missing."
 *
 * IMPORTANT BEHAVIOR CHANGE (Ring B, 2026-05-15):
 * Previously this function deleted the existing mix on any validation
 * failure. Now it preserves existing data on failure. The caller MUST
 * check result.ok before assuming the new mix is live.
 *
 * Passing null/undefined for allocations is the explicit "clear this
 * fund's custom mix" path (e.g., the parent switched away from
 * custom strategy). That branch always succeeds.
 */
export async function setFundCustomAllocations(
  fundId: string,
  allocations: Record<string, number> | null | undefined,
): Promise<SetResult> {
  if (!fundId) return { ok: false, reason: "missing_fund_id" } as SetResult;
  if (allocations === null || allocations === undefined) {
    // Explicit clear path. Used when the parent switches AWAY from
    // custom strategy. The custom_allocations column gets nulled.
    await db
      .update(funds)
      .set({ customAllocations: null, updatedAt: new Date() })
      .where(eq(funds.id, fundId));
    return { ok: true, allocations: {} };
  }
  const result = normalizeCustomAllocations(allocations);
  if (!result.ok) {
    return { ok: false, reason: result.reason } as SetResult;
  }
  await db
    .update(funds)
    .set({ customAllocations: result.allocations as any, updatedAt: new Date() })
    .where(eq(funds.id, fundId));
  return { ok: true, allocations: result.allocations };
}
