import fs from "fs/promises";
import path from "path";

type DefaultMode = "managed" | "stock" | "cash";
type ManagedStrategy = "growth" | "balanced" | "conservative" | "custom";

export type FundInvestmentPreferences = {
  defaultMode: DefaultMode;
  managedStrategy: ManagedStrategy;
  defaultTicker: string;
  allowGifterStockPick: boolean;
  allowGifterCashGift: boolean;
  autoInvestEnabled: boolean;
  updatedAt: string;
};

type FundPreferenceState = Record<string, FundInvestmentPreferences>;

const STATE_PATH = path.join(process.cwd(), ".local", "fund-investment-preferences.json");

const DEFAULTS: Omit<FundInvestmentPreferences, "managedStrategy" | "updatedAt"> = {
  defaultMode: "managed",
  defaultTicker: "DIS",
  // Stock-pick default flipped to true 2026-05-18. The Cam-Disney
  // 'love mark' Memory Book moment depends on a gifter being able
  // to pick a specific stock (grandma chooses Disney for her
  // granddaughter; the personal fingerprint is the unique-voice
  // differentiator nobody else in the space has). Parents who want
  // strict adherence to the family default can flip this off in
  // one tap from Settings.
  allowGifterStockPick: true,
  // Cash-sending default stays false: 'Cash gifts disappear, Kiddo
  // gifts last' is the locked brand promise. Defaulting cash ON
  // would contradict the product's reason to exist. Parents with
  // edge-case needs (saving for an almost-grown kid who wants
  // withdrawable cash) can opt in deliberately.
  allowGifterCashGift: false,
  autoInvestEnabled: true,
};

function normalizeManagedStrategy(raw?: string | null): ManagedStrategy {
  const normalized = String(raw || "").toLowerCase();
  if (normalized === "balanced") return "balanced";
  if (normalized === "conservative") return "conservative";
  if (normalized === "custom") return "custom";
  return "growth";
}

function normalizeDefaultMode(raw?: string | null): DefaultMode {
  const normalized = String(raw || "").toLowerCase();
  if (normalized === "stock") return "stock";
  if (normalized === "cash") return "cash";
  return "managed";
}

function normalizeTicker(raw?: string | null): string {
  const ticker = String(raw || "").trim().toUpperCase();
  return ticker || DEFAULTS.defaultTicker;
}

function readBooleanPreference(source: any, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    if (!source || !(key in source)) continue;
    const value = source[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
    if (typeof value === "number") return value !== 0;
  }
  return undefined;
}

async function readState(): Promise<FundPreferenceState> {
  try {
    const raw = await fs.readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as FundPreferenceState : {};
  } catch {
    return {};
  }
}

async function writeState(state: FundPreferenceState) {
  await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

export async function getFundInvestmentPreferences(
  fundId: string,
  investmentStrategy?: string | null,
): Promise<FundInvestmentPreferences> {
  const state = await readState();
  const existing = state[fundId];
  const managedStrategy = normalizeManagedStrategy(investmentStrategy);

  if (!existing) {
    return {
      ...DEFAULTS,
      managedStrategy,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    defaultMode: normalizeDefaultMode(
      existing.defaultMode ||
      (existing as any).mode ||
      (existing as any).default_mode,
    ),
    managedStrategy,
    defaultTicker: normalizeTicker(
      existing.defaultTicker ||
      (existing as any).ticker ||
      (existing as any).default_ticker,
    ),
    allowGifterStockPick:
      readBooleanPreference(
        existing,
        "allowGifterStockPick",
        "allow_gifter_stock_pick",
        "gifterStockPick",
        "allowStockPick",
      ) ?? DEFAULTS.allowGifterStockPick,
    allowGifterCashGift:
      readBooleanPreference(
        existing,
        "allowGifterCashGift",
        "allow_gifter_cash_gift",
        "gifterCashGift",
        "allowCashGift",
      ) ?? DEFAULTS.allowGifterCashGift,
    autoInvestEnabled:
      readBooleanPreference(
        existing,
        "autoInvestEnabled",
        "auto_invest_enabled",
        "autoInvest",
      ) ?? DEFAULTS.autoInvestEnabled,
    updatedAt: existing.updatedAt || new Date().toISOString(),
  };
}

export async function setFundInvestmentPreferences(
  fundId: string,
  input: Partial<Omit<FundInvestmentPreferences, "managedStrategy" | "updatedAt">>,
  investmentStrategy?: string | null,
): Promise<FundInvestmentPreferences> {
  const state = await readState();
  const current = await getFundInvestmentPreferences(fundId, investmentStrategy);

  const next: FundInvestmentPreferences = {
    defaultMode: input.defaultMode ? normalizeDefaultMode(input.defaultMode) : current.defaultMode,
    managedStrategy: normalizeManagedStrategy(investmentStrategy),
    defaultTicker: input.defaultTicker ? normalizeTicker(input.defaultTicker) : current.defaultTicker,
    allowGifterStockPick:
      typeof input.allowGifterStockPick === "boolean"
        ? input.allowGifterStockPick
        : current.allowGifterStockPick,
    allowGifterCashGift:
      typeof input.allowGifterCashGift === "boolean"
        ? input.allowGifterCashGift
        : current.allowGifterCashGift,
    autoInvestEnabled:
      typeof input.autoInvestEnabled === "boolean"
        ? input.autoInvestEnabled
        : current.autoInvestEnabled,
    updatedAt: new Date().toISOString(),
  };

  state[fundId] = next;
  await writeState(state);
  return next;
}
