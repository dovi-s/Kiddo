import fs from "fs/promises";
import path from "path";

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
export type CustomTicker = (typeof CUSTOM_STRATEGY_ALLOWED_TICKERS)[number];
export type CustomAllocations = Record<string, number>;

const FUND_STRATEGY_OVERRIDES_PATH = path.join(process.cwd(), ".local", "fund-strategy-overrides.json");

export const DEFAULT_CUSTOM_ALLOCATIONS: CustomAllocations = {
  VTI: 0.5,
  VXUS: 0.25,
  BND: 0.15,
  VGT: 0.1,
};

function normalizeCustomAllocations(input: any): CustomAllocations | null {
  const next: Record<string, number> = {};
  let total = 0;
  for (const [tickerRaw, raw] of Object.entries(input || {})) {
    const ticker = String(tickerRaw || "").trim().toUpperCase();
    if (!CUSTOM_STRATEGY_ALLOWED_TICKERS.includes(ticker as CustomTicker)) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      continue;
    }
    next[ticker] = n;
    total += n;
  }
  if (Object.keys(next).length > MAX_CUSTOM_STRATEGY_HOLDINGS) return null;
  if (total <= 0) return null;
  const normalized: Record<string, number> = {};
  for (const ticker of Object.keys(next)) {
    normalized[ticker] = next[ticker] / total;
  }
  return normalized;
}

async function loadOverridesRaw(): Promise<Record<string, CustomAllocations>> {
  try {
    const raw = await fs.readFile(FUND_STRATEGY_OVERRIDES_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, CustomAllocations> = {};
    for (const [fundId, alloc] of Object.entries(parsed)) {
      const normalized = normalizeCustomAllocations(alloc);
      if (normalized) out[fundId] = normalized;
    }
    return out;
  } catch {
    return {};
  }
}

async function saveOverridesRaw(data: Record<string, CustomAllocations>) {
  await fs.mkdir(path.dirname(FUND_STRATEGY_OVERRIDES_PATH), { recursive: true });
  await fs.writeFile(FUND_STRATEGY_OVERRIDES_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function getFundCustomAllocations(fundId: string): Promise<CustomAllocations | null> {
  if (!fundId) return null;
  const all = await loadOverridesRaw();
  return all[fundId] || null;
}

export async function setFundCustomAllocations(
  fundId: string,
  allocations: Record<string, number> | null | undefined,
): Promise<CustomAllocations | null> {
  if (!fundId) return null;
  const all = await loadOverridesRaw();
  if (!allocations) {
    delete all[fundId];
    await saveOverridesRaw(all);
    return null;
  }
  const normalized = normalizeCustomAllocations(allocations);
  if (!normalized) {
    delete all[fundId];
    await saveOverridesRaw(all);
    return null;
  }
  all[fundId] = normalized;
  await saveOverridesRaw(all);
  return normalized;
}
