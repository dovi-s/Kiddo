import { Fragment, lazy, Suspense, useState, useEffect, useMemo, useRef, useCallback } from "react";

function stripHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/<[^>]*>/g, "").trim();
}

type ChartRange = "1W" | "1M" | "YTD" | "1Y" | "5Y" | "ALL";

// Returns the start-of-window cutoff timestamp for a given range, or null
// for "ALL" (entire fund history). For 5Y, clamp to fund creation when the
// fund is younger than 5 years so the chart doesn't render years of zero
// runway before the first real data point.
function getChartRangeCutoff(
  range: ChartRange,
  now: Date,
  fundCreatedAt?: number | null,
): number | null {
  if (range === "ALL") return null;
  if (range === "YTD") return new Date(now.getFullYear(), 0, 1).getTime();
  if (range === "5Y") {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - 5);
    const cutoff = d.getTime();
    if (fundCreatedAt && Number.isFinite(fundCreatedAt) && fundCreatedAt > cutoff) {
      return fundCreatedAt;
    }
    return cutoff;
  }
  const days = range === "1W" ? 7 : range === "1M" ? 30 : range === "1Y" ? 365 : 0;
  return now.getTime() - days * 24 * 60 * 60 * 1000;
}

function getChartRangeLabel(range: ChartRange): string {
  switch (range) {
    case "ALL": return "All time";
    case "1W": return "Past week";
    case "1M": return "Past month";
    case "YTD": return "Year to date";
    case "1Y": return "Past year";
    case "5Y": return "Past 5 years";
  }
}
import { Link, useLocation, useSearch } from "wouter";
import { ADD_FUND_EVENT, ACTIVE_FUND_CHANGE_EVENT, getActiveFundId, setActiveFundId } from "@/hooks/use-active-fund";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { useCreateEvent, useUpdateEvent } from "@/hooks/use-events";
import { capFirst } from "@/lib/format-name";
import { AddFundSheet } from "@/components/AddFundSheet";
import { FeatureWallModal } from "@/components/FeatureWallModal";
import { CreateEventSheet, type EditEventData } from "@/components/CreateEventSheet";
// (Removed 2026-05-15: GrowthStory import. The component was never
// rendered anywhere in Dashboard's JSX — grepped to confirm zero
// instantiation. Its file at client/src/components/GrowthStory.tsx
// also got deleted in the same commit. Found during the projection-
// math audit because GrowthStory carried its own broken projection
// math — raw 7% (not netted), hardcoded 18-year horizon. Rather than
// fix dead code, delete it.)
import { EventGateModal } from "@/components/EventGateModal";
import { ThankYouManager } from "@/components/ThankYouManager";
import { InvestCashModal, type CashContext } from "@/components/InvestCashModal";
import { GiftReceivedToast } from "@/components/ui/plg-loops";
import { isGiftToastDismissed, markGiftToastDismissed } from "@/lib/gift-toast-dismissed";
import {
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Banknote,
  Gift,
  Share2,
  Hash,
  Calendar,
  BookOpen,
  Plus,
  Wallet,
  Copy,
  Sprout,
  Repeat,
  Pencil,
  Lock,
  TimerReset,
  LifeBuoy,
  PartyPopper,
  GraduationCap,
  TreeDeciduous,
  Heart,
  Eye,
  Smile,
  Info,
  Trophy,
  Loader2,
  MoreVertical,
  Pause,
  // Sparkles import removed 2026-05-12 — banned per feedback_no_ai_slop.md.
  // Last usage was on "Create new occasion" pill; replaced with CalendarClock
  // (the locked-correct icon for "Calendar event with time" per
  // feedback_iconography_consistency.md).
  CalendarClock,
  History,
  ChevronRight,
} from "lucide-react";
import { DetailHistoryModal, type DetailStat, type DetailScheduledRow } from "@/components/DetailHistoryModal";
import { FirstSellTaxExplainerModal, type FirstSellTaxExplainerPayload } from "@/components/FirstSellTaxExplainerModal";
import {
  type FeedActivity,
  parseMetadata as parseActivityMetadata,
  parseSafeDate as parseActivitySafeDate,
  parseAmount as parseActivityAmount,
  normalizeActivityType,
} from "@/lib/activity-helpers";
import { useActivities } from "@/hooks/use-activities";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { haptic } from "@/lib/haptics";
import { scrollToTestId } from "@/lib/scroll-to-element";
import { getPronouns } from "@/lib/pronouns";
import { getDeepLinkHighlightCardStyle, HIGHLIGHT_HOLD_MS } from "@/lib/deep-link-highlight";
import { AppHeader } from "@/components/layout/AppHeader";
import { useCachedFirstNumber } from "@/hooks/use-cached-first-number";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { MilestoneMoment } from "@/components/MilestoneMoment";
import { toast } from "@/hooks/use-toast";
import { CollaboratorInvite, CollaboratorInviteModal } from "@/components/ui/plg-loops";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { SetupProgressNudge, TrustMicroStrip } from "@/components/ui/ux-foundations";
import { ActionItemList } from "@/components/ActionItemCard";
import { useActionItems } from "@/hooks/use-action-items";
import { ShareModal, type SharePage } from "@/components/ui/share-modal";
import { StockLogo } from "@/components/ui/stock-logo";
import { KIDDO_AUM_FEE_RATE } from "@shared/monetization";
import { MemoryMediaPicker, EMPTY_MEMORY_MEDIA, type MemoryMediaValue } from "@/components/MemoryMediaPicker";
import { KidAt18WelcomeBanner } from "@/components/dashboard/KidAt18WelcomeBanner";
import { buildSetupProgress } from "@/lib/setup-progress";
import { formatAgeTransitionDate, getAge18Transition } from "@/lib/age-transition";
import { buildSellDollarQuickAmountOptions } from "@/lib/sell-quick-amounts";
import { LOCAL_CACHE_KEYS, readLocalCache, writeLocalCache, removeLocalCache, removeLocalCachePrefix } from "@/lib/local-cache";
import { projectFundValue } from "@shared/projection";
import type { Fund, Holding, Gift as GiftType, Event, RecurringGift } from "@shared/schema";
import {
  calculateKoraContributionFee,
  calculatePaymentProcessingFee,
  estimateGiftCheckoutCharge,
  KORA_STARTER_MONTHLY,
  MONETIZATION_TRIGGER_IDS,
  type FundCoverageState,
  type PaymentMethodPreference,
} from "@shared/monetization";
import { calculateDashboardMoneyMath } from "@shared/dashboard-money-math";
import { sumMonthlyEquivalent, toMonthlyEquivalent } from "@shared/recurring-math";
import { MONEY_CROSS_THRESHOLDS } from "@shared/milestones";
import { prefetchMemoryBook, prefetchActivity, onIdle } from "@/lib/prefetch";
import { getCulturalSuggestions, TRADITION_LABELS, TRADITION_ICONS, type CulturalBackground, type CulturalTradition } from "@/lib/cultural-calendar";
import { getEventCoverTheme } from "@/lib/event-cover-themes";
import { friendlyHoldingName } from "@/lib/ticker-names";
import { QRCodeSVG } from "qrcode.react";

const DashboardTrendChart = lazy(() => import("@/components/DashboardTrendChart"));
import type { DashboardTrendPoint } from "@/components/DashboardTrendChart";
const HoldingDetailSheet = lazy(() =>
  import("@/components/HoldingDetailSheet").then((module) => ({ default: module.HoldingDetailSheet })),
);
const FUND_ACTIVE_STALE_MS = 10_000;
// Background polling cadence for the dashboard summary + funds list.
// History: 60s (felt broken — "I reload to see new gifts") → 20s →
// 6s (worked but burned ~10 req/min/active tab) → SSE primary, 30s
// poll as safety net.
//
// Arrival path TODAY is Server-Sent Events. `useRealtimeEvents` below
// subscribes to /api/me/events; the webhook handler publishes
// `gift.arrived` after completeGiftPostPayment and the client
// invalidates this query within the same round-trip. So in the happy
// case the parent sees the count-up and gift-strip animation within
// a second of Stripe firing, not the next poll boundary.
//
// Polling stays on at 30s as a safety net for: (a) SSE connections
// that drop silently behind picky reverse proxies, (b) backgrounded
// tabs that don't run the visibility-change reopen until focused,
// (c) price-tick updates from the market quote job that don't go
// through realtime today, and (d) the cold-load "I came back to the
// tab after lunch" case where focus refetch + reconnect cover the
// immediate need but a slow trickle keeps things current. If you're
// reading this because the cadence felt too slow during a test:
// confirm SSE is connected first (EventSource readyState in the
// Network panel) — almost every "stale dashboard" report is going to
// be a dropped SSE connection, not a polling-interval problem.
const FUND_LIVE_REFRESH_MS = 30_000;
const DASHBOARD_SUMMARY_CACHE_PREFIX = "kiddo.dashboard.summary.v1:";
type FundHistoryPoint = {
  snapshotDate: string;
  investedValue: string;
  cashValue: string;
  totalValue: string;
  principalBasis: string;
};

const MANAGED_STRATEGY_ALLOCATIONS: Record<string, Array<{ ticker: string; name: string; weight: number }>> = {
  // Three age-tiered defaults. The picker uses years-until-18 to recommend one:
  //   10+ years → Growth (low bonds, lots of equity)
  //   5-10 years → Balanced
  //   under 5 years → Conservative (heavy bonds, capital preservation)
  growth: [
    { ticker: "VTI",  name: "US Total Market", weight: 50 },
    { ticker: "VXUS", name: "International",    weight: 25 },
    { ticker: "BND",  name: "Bonds",            weight: 15 },
    { ticker: "VGT",  name: "Tech",             weight: 10 },
  ],
  balanced: [
    { ticker: "VTI",  name: "US Total Market", weight: 35 },
    { ticker: "VXUS", name: "International",    weight: 15 },
    { ticker: "BND",  name: "Bonds",            weight: 35 },
    { ticker: "VGT",  name: "Tech",             weight: 15 },
  ],
  conservative: [
    { ticker: "VTI",  name: "US Total Market", weight: 30 },
    { ticker: "BND",  name: "Bonds",            weight: 40 },
    { ticker: "VXUS", name: "International",    weight: 20 },
    { ticker: "VGT",  name: "Tech",             weight: 10 },
  ],
};

const AUTO_INVEST_STOCKS = [
  { symbol: "DIS",   name: "Disney",    price: 106.42, tagline: "The magic factory",          emoji: "🏰" },
  { symbol: "AAPL",  name: "Apple",     price: 214.38, tagline: "Tech they'll grow up with",  emoji: "🍎" },
  { symbol: "NKE",   name: "Nike",      price: 92.14,  tagline: "For the ones who go for it", emoji: "👟" },
  { symbol: "AMZN",  name: "Amazon",    price: 184.85, tagline: "The everything engine",      emoji: "📦" },
  { symbol: "GOOGL", name: "Google",    price: 172.63, tagline: "For the curious ones",       emoji: "🔍" },
  { symbol: "NFLX",  name: "Netflix",   price: 612.9,  tagline: "For the storytellers",       emoji: "🎬" },
  { symbol: "SPOT",  name: "Spotify",   price: 618.92, tagline: "For the music lovers",       emoji: "🎵" },
  { symbol: "RBLX",  name: "Roblox",    price: 37.44,  tagline: "For the gamers",             emoji: "🎮" },
  { symbol: "SBUX",  name: "Starbucks", price: 89.63,  tagline: "For the everyday wins",      emoji: "☕" },
  { symbol: "TGT",   name: "Target",    price: 152.20, tagline: "For the everyday families",  emoji: "🎯" },
  { symbol: "CMCSA", name: "Comcast",   price: 41.18,  tagline: "For the entertainers",       emoji: "🎪" },
  { symbol: "DUOL",  name: "Duolingo",  price: 198.55, tagline: "For the learners",           emoji: "🦉" },
  { symbol: "ABNB",  name: "Airbnb",    price: 144.32, tagline: "For the adventurers",        emoji: "🌍" },
  { symbol: "NTDOY", name: "Nintendo",  price: 12.85,  tagline: "For the playful",            emoji: "🎮" },
  { symbol: "DPZ",   name: "Domino's",  price: 478.40, tagline: "For the pizza lovers",       emoji: "🍕" },
  { symbol: "CHWY",  name: "Chewy",     price: 32.11,  tagline: "For the animal lovers",      emoji: "🐾" },
  { symbol: "ADBE",  name: "Adobe",     price: 552.07, tagline: "For the artists",            emoji: "🎨" },
] as const;

// Tickers that USED to be in AUTO_INVEST_STOCKS but were removed from the picker (e.g.
// Zillow — not warm enough for the approved list). Existing recurring schedules and gift
// holdings can still reference them, so we keep their friendly name + emoji available
// for display only. Not selectable. New investments can't pick from here.
const LEGACY_PICK_META: Record<string, { name: string; emoji: string }> = {
  Z: { name: "Zillow", emoji: "🏠" },
};

// Static brand emoji + name map — the RESILIENT fallback when async price data
// hasn't loaded yet. quotedAutoInvestStocks comes from a server market-quotes
// call and on first paint may be empty, which made buttons like "Add $50 to
// Starbucks again" render without the ☕. This map ensures every ticker in the
// picker (and its retired neighbors) has a guaranteed warm name + emoji
// regardless of network state. Keep in sync with AUTO_INVEST_STOCKS below and
// LEGACY_PICK_META above. Source of truth for "what does this brand look like
// in the parent + gifter view." (Kid view uses its own map in KidView.tsx —
// 🍎 fruit-style — because the kid translation is intentional, not redundant.)
const STATIC_TICKER_META: Record<string, { name: string; emoji: string }> = {
  DIS:   { name: "Disney",     emoji: "🏰" },
  AAPL:  { name: "Apple",      emoji: "📱" },
  NKE:   { name: "Nike",       emoji: "👟" },
  NFLX:  { name: "Netflix",    emoji: "🎬" },
  RBLX:  { name: "Roblox",     emoji: "🎮" },
  SBUX:  { name: "Starbucks",  emoji: "☕" },
  AMZN:  { name: "Amazon",     emoji: "📦" },
  GOOGL: { name: "Google",     emoji: "🔍" },
  SPOT:  { name: "Spotify",    emoji: "🎵" },
  TGT:   { name: "Target",     emoji: "🎯" },
  CMCSA: { name: "Comcast",    emoji: "📺" },
  DUOL:  { name: "Duolingo",   emoji: "🦉" },
  ABNB:  { name: "Airbnb",     emoji: "🏠" },
  NTDOY: { name: "Nintendo",   emoji: "🎮" },
  DPZ:   { name: "Domino's",   emoji: "🍕" },
  CHWY:  { name: "Chewy",      emoji: "🐶" },
  ADBE:  { name: "Adobe",      emoji: "🎨" },
  TSLA:  { name: "Tesla",      emoji: "🚗" },
  Z:     { name: "Zillow",     emoji: "🏠" },
};

function lookupPickMeta(ticker: string | null | undefined, quotedStocks: AutoInvestStock[]):
  { name: string; emoji: string | null } | null {
  if (!ticker) return null;
  const sym = String(ticker).toUpperCase();
  // Prefer live quote data when present (it's the source of truth for current
  // pricing context), but fall back to the static map immediately otherwise so
  // the warm emoji always renders even on first paint or rate-limited quotes.
  const fromActive = quotedStocks.find((s) => s.symbol === sym);
  if (fromActive) return { name: fromActive.name, emoji: fromActive.emoji };
  const fromStatic = STATIC_TICKER_META[sym];
  if (fromStatic) return { name: fromStatic.name, emoji: fromStatic.emoji };
  const fromLegacy = LEGACY_PICK_META[sym];
  if (fromLegacy) return { name: fromLegacy.name, emoji: fromLegacy.emoji };
  return { name: sym, emoji: null };
}

// Canonical strategy meta — single source of truth for friendly name + emoji.
// The 🌱 sprout is reserved as the Kiddo brand mark; never use it here as a strategy
// emoji or it dilutes the category. Adding a new strategy? Add it to this map.
// "cash" is intentionally lowercase + no emoji — it's a holding state, not a strategy.
const STRATEGY_META: Record<string, { name: string; emoji: string }> = {
  growth:       { name: "Growth Mix",       emoji: "📈" },
  balanced:     { name: "Steady & Balanced", emoji: "🌿" },
  conservative: { name: "Conservative Mix", emoji: "⚖️" },
  custom:       { name: "Custom ETF Mix",   emoji: "🎯" },
  cash:         { name: "cash",             emoji: "" },
};

// Friendly label for a fund's investment strategy. Used to label managed/auto recurring
// contributions where there's no specific ticker — instead of vague "into Emma's fund",
// the row tells the parent which mix the money is actually flowing into ("into Growth Mix").
// Mirrors the strategy keys from Settings (growth | balanced | conservative | custom | cash).
function friendlyStrategyName(key: string | null | undefined): string {
  const k = String(key || "growth").toLowerCase();
  return STRATEGY_META[k]?.name ?? STRATEGY_META.growth.name;
}

function strategyEmoji(key: string | null | undefined): string {
  const k = String(key || "growth").toLowerCase();
  return STRATEGY_META[k]?.emoji ?? "";
}

// Per-strategy soft tint for the StrategyIcon container — gives each mix its own
// at-a-glance visual identity without shouting. Pulled into a constant so the
// recurring section, action sheets, and any future strategy-card surface all read
// consistently. Keep tints muted (NOT red/alarm); the parent surface is Apple-
// Settings-discoverable per the design lens.
const STRATEGY_TINTS: Record<string, { bg: string; border: string }> = {
  growth:       { bg: "hsl(var(--kiddo-evergreen) / 0.10)", border: "hsla(157,42%,18%,0.12)" },
  balanced:     { bg: "hsl(var(--kiddo-evergreen) / 0.07)", border: "hsla(157,42%,18%,0.10)" },
  conservative: { bg: "hsl(var(--kiddo-cream))",            border: "hsla(36,38%,82%,0.55)" },
  custom:       { bg: "hsl(var(--kiddo-gold) / 0.10)",      border: "hsla(43,75%,52%,0.18)" },
  cash:         { bg: "rgba(26,23,16,0.05)",                border: "rgba(26,23,16,0.10)" },
};

// Visual marker for a managed-mix schedule. Replaces the generic Repeat icon —
// the canonical strategy emoji at scale inside a soft tinted square, parallel to
// the StockLogo treatment used for picks. The "this is recurring" signal still
// reads via the $X /mo line and cadence metadata; the icon now tells you WHICH
// mix instead of just WHAT category. Paused state mutes both background and
// emoji opacity — same desaturated look the StockLogo gets when paused so the
// icon types match each other.
function StrategyIcon({
  strategyKey,
  size = 40,
  paused = false,
  className,
}: {
  strategyKey: string | null | undefined;
  size?: number;
  paused?: boolean;
  className?: string;
}) {
  const k = String(strategyKey || "growth").toLowerCase();
  const emoji = STRATEGY_META[k]?.emoji ?? "📈";
  const tint = STRATEGY_TINTS[k] ?? STRATEGY_TINTS.growth;
  const emojiSize = Math.round(size * 0.5);
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl border transition-all duration-300 ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: paused ? "hsl(43,80%,94%)" : tint.bg,
        borderColor: paused ? "rgba(184,121,26,0.18)" : tint.border,
        opacity: paused ? 0.85 : 1,
      }}
      aria-hidden="true"
      data-strategy={k}
    >
      <span style={{ fontSize: emojiSize, lineHeight: 1 }}>{emoji}</span>
    </div>
  );
}

// Possessive-aware label for a strategy in the parent's voice: "Emma's Conservative Mix".
// Falls back to the bare friendly name when no child name is available so we never render
// "their Conservative Mix" (clinical) — just "Conservative Mix" (still warm).
//
// The canonical strategy emoji used to ride at the end of the label, but it now lives
// inside the StrategyIcon container instead — stacking the emoji inline AND in the icon
// reads as redundant in the parent register. The emoji is still the source of truth via
// strategyEmoji() for that icon container; just don't double it up in the label.
function strategyLabelFor(strategyKey: string | null | undefined, childFirstName?: string | null): string {
  const name = friendlyStrategyName(strategyKey);
  const possessive = childFirstName
    ? `${childFirstName}${childFirstName.endsWith("s") ? "'" : "'s"} `
    : "";
  return `${possessive}${name}`;
}

// Canonical mix identity — preset-agnostic, kid-possessive, used wherever
// we want the bucket NAME without baking the current strategy into it
// ("Emma's mix" vs "Emma's Conservative Mix"). Pairs naturally with the
// strategy chip / icon that lives elsewhere on the surface, so the
// preset is still surfaced — just not entangled with identity. Locked
// memory rule: never use "auto-invest" in user-facing copy. Falls back
// gracefully when no kid name is available.
function mixIdentityFor(childFirstName?: string | null): string {
  if (!childFirstName) return "the mix";
  const possessive = `${childFirstName}${childFirstName.endsWith("s") ? "'" : "'s"} `;
  return `${possessive}mix`;
}

// Event-type → emoji canonical map. Used by the dynamic Occasion quick link
// to show the right anchor for the most-relevant active occasion. Keep aligned
// with the eventType values stored on the events table (shared/schema.ts).
// Default 🎉 catches any future event type we haven't mapped yet — the row
// degrades gracefully rather than rendering an empty tile.
const EVENT_TYPE_EMOJI: Record<string, string> = {
  birthday:         "🎂",
  graduation:       "🎓",
  holiday:          "🎄",
  christmas:        "🎄",
  hanukkah:         "🕎",
  religious_holiday: "✡️",
  baby:             "🍼",
  baby_shower:      "🍼",
  wedding:          "💍",
  car:              "🚗",
  first_car:        "🚗",
  college:          "🎓",
  home:             "🏡",
  travel:           "✈️",
  trip:             "✈️",
  business:         "💼",
  emergency:        "🛡️",
  custom:           "✨",
  just_because:     "💚",
};
function eventEmoji(eventType: string | null | undefined): string {
  return EVENT_TYPE_EMOJI[String(eventType || "").toLowerCase()] || "🎉";
}

// Most-relevant active occasion picker. Deterministic rule so the Occasion
// quick link's behavior is predictable:
//   1. ≤7 days away wins (urgency beats everything else)
//   2. Otherwise, most-upcoming with an eventDate
//   3. Otherwise, the oldest active occasion with no date (e.g. open-ended
//      college fund) as a soft fallback
//   4. Otherwise null → caller renders "New occasion ✨" creator state
// The shape mirrors what the schema gives us; we keep the return loose so
// callers don't fight types when reading event.slug / .name / .eventType.
//
// Both gifting occasions AND savings goals are eligible — GiftCheckout
// renders both correctly at /:fund/:slug (the savings_goal branch has its
// own headline + goal-progress framing). Ranking: dated upcoming gifting
// occasions first (most time-sensitive), then undated gifting occasions,
// then savings goals (background pursuit, less urgent to share). Ensures a
// next-week birthday wins over a "first car" goal that has no deadline.
function pickActiveOccasion(events: any[]): any | null {
  const active = (events || []).filter(e => e && e.status === "active" && !e.isPermanent);
  if (active.length === 0) return null;
  const now = Date.now();
  const isGifting = (e: any) => String(e?.eventCategory || "gifting_occasion") !== "savings_goal";
  const dated = active
    .filter(e => e.eventDate && isGifting(e))
    .map(e => ({ e, days: Math.ceil((new Date(e.eventDate).getTime() - now) / 86400000) }))
    .filter(({ days }) => days >= 0)
    .sort((a, b) => a.days - b.days);
  if (dated.length > 0) return dated[0].e;
  const undatedGifting = active
    .filter(e => !e.eventDate && isGifting(e))
    .sort((a, b) => {
      const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ad - bd;
    });
  if (undatedGifting.length > 0) return undatedGifting[0];
  const savingsGoals = active
    .filter(e => !isGifting(e))
    .sort((a, b) => {
      const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bd - ad; // newest goal wins (the one the parent just made)
    });
  if (savingsGoals.length > 0) return savingsGoals[0];
  return null;
}

type AutoInvestStock = Omit<(typeof AUTO_INVEST_STOCKS)[number], "price"> & {
  price: number;
  quoteSource?: string;
  quoteAsOf?: string;
  isEstimate?: boolean;
};
type MarketQuoteResponse = {
  quotes: Array<{
    symbol: string;
    price: number;
    source?: string;
    asOf?: string;
    isEstimate?: boolean;
  }>;
};
type ParentContribution = { id: string; bankAccountId?: string | null; amount: string; frequency: string; status: string; nextRunDate?: string; lastRunDate?: string | Date | null; totalContributed?: string | null; executionModel?: string | null; selectedTicker?: string | null; createdAt?: string | Date | null };
type DashboardTransaction = {
  id: string;
  type: string;
  amount: string;
  status: string;
  description?: string | null;
  metadata?: string | null;
  giftId?: string | null;
  eventId?: string | null;
  fundId?: string | null;
  completedAt?: string | Date | null;
  createdAt?: string | Date | null;
};
type GiftAllocationLite = {
  id: string;
  giftId: string;
  ticker: string;
  costBasis: string;
  shares: string | null;
  source: "pick" | "auto" | "rebalance" | string;
};

type DashboardSummary = {
  fundId: string;
  holdings: Holding[];
  gifts: GiftType[];
  events: Event[];
  history: FundHistoryPoint[];
  investmentPreferences: any;
  giftCode: { code: string; lookupUrl: string; createdAt: string; updatedAt: string };
  eventGiftCodes?: Record<string, { code: string; lookupUrl: string }>;
  largeGiftHolds: any;
  recurringGifts: RecurringGift[];
  parentContributions: ParentContribution[];
  transactions: DashboardTransaction[];
  giftAllocations?: GiftAllocationLite[];
  // ISO timestamp the current viewer claimed this fund as the at-18
  // recipient. Server gates on (childClaimedByUserId === viewer.id) AND
  // (claimedAt within the last 60 days). Drives the one-time at-18
  // welcome banner above the hero. Null for parent viewers and for kids
  // whose claim is stale.
  kidClaimedAt?: string | null;
};

function getFundTotalValue(fund?: Partial<Fund> | null): number {
  if (!fund) return 0;
  return (
    parseFloat(String(fund.balance || "0")) +
    parseFloat(String(fund.pendingBalance || "0")) +
    parseFloat(String((fund as any).cashBalance || "0"))
  );
}

function readCachedFunds(): Fund[] | undefined {
  return readLocalCache<Fund[]>(LOCAL_CACHE_KEYS.funds);
}

const FUND_BALANCE_CACHE_PREFIX = "kiddo.fund.balance.v1:";
// Same Acorns-style cached-seed pattern as the balance, applied to the
// hero's "$X at 65" projection peek. The previous live value is seeded
// from localStorage so the next visit paints instantly and counts up to
// the new projection — same emotional anchor as the balance, different
// time horizon.
const FUND_PROJECTION_AT_65_CACHE_PREFIX = "kiddo.fund.projectionAt65.v1:";

function readCachedFundValue(fundId: string): number | null {
  // Per-fund balance key is written on every successful load - more current than funds list.
  const dedicated = readLocalCache<number>(`${FUND_BALANCE_CACHE_PREFIX}${fundId}`);
  if (dedicated != null && Number.isFinite(dedicated) && dedicated > 0) return dedicated;
  const cachedFund = readCachedFunds()?.find((fund) => String(fund.id) === String(fundId));
  if (!cachedFund) return null;
  return getFundTotalValue(cachedFund);
}

function readCachedProjectionAt65(fundId: string): number | null {
  const cached = readLocalCache<number>(`${FUND_PROJECTION_AT_65_CACHE_PREFIX}${fundId}`);
  if (cached != null && Number.isFinite(cached) && cached > 0) return cached;
  return null;
}

function readCachedDashboardSummary(fundId: string): DashboardSummary | undefined {
  if (!fundId) return undefined;
  return readLocalCache<DashboardSummary>(`${DASHBOARD_SUMMARY_CACHE_PREFIX}${fundId}`);
}

// Local skeleton helper. Color + animation match the global KiddoSkeleton
// primitive (bg-primary/10 + animate-pulse) so loading states across the
// app share a single visual signature. Kept local for the borderRadius
// override convenience the loading regions need.
function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-primary/10 rounded-lg animate-pulse ${className}`}
      role="status"
      aria-label="Loading…"
    />
  );
}

// Per-fund local-storage latch for SSN collection. We set this to the
// fund id immediately after a successful POST. The dashboard then hides
// the banner whenever EITHER the server says "collected" OR this latch
// says we've already submitted for this fund. This makes the dismissal
// immune to:
//   - the server returning a partial fund object (stale Drizzle schema in
//     a long-running dev process that never reloaded after schema changes)
//   - a refetch overriding the optimistic update with a response that
//     doesn't include recipientSsnCollectedAt
//   - the user pressing "save" twice and hitting a stale cache mid-flight
// The latch is fund-scoped so it doesn't bleed across kids, and we don't
// store anything sensitive — just a "we've sent the digits" marker.
const SSN_LATCH_PREFIX = "kiddo.ssn-collected.v1:";
function readSsnLatched(fundId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.localStorage.getItem(SSN_LATCH_PREFIX + fundId);
  } catch {
    return false;
  }
}
function writeSsnLatched(fundId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SSN_LATCH_PREFIX + fundId, new Date().toISOString());
  } catch {
    // ignore (private mode, quota, etc.) — server-side flag still wins on next refetch
  }
}

// Snooze latch — separate from the "collected" latch so dismissing for now
// doesn't claim the SSN was actually saved. 24-hour TTL: long enough that
// the parent isn't nagged on every page view, short enough that it
// reappears the next day if they still haven't completed it. The banner is
// load-bearing for tax compliance, so a permanent dismiss isn't safe — but
// being shown "right now" on every load reads as nagging.
const SSN_SNOOZE_PREFIX = "kiddo.ssn-snooze.v1:";
const SSN_SNOOZE_TTL_MS = 24 * 60 * 60 * 1000;
function isSsnSnoozed(fundId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(SSN_SNOOZE_PREFIX + fundId);
    if (!raw) return false;
    const ts = Date.parse(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < SSN_SNOOZE_TTL_MS;
  } catch {
    return false;
  }
}
function snoozeSsn(fundId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SSN_SNOOZE_PREFIX + fundId, new Date().toISOString());
  } catch {
    // ignore
  }
}

// Per-fund SSN collection nudge. Shows on the dashboard for any UTMA fund
// where the child's full SSN has not yet been collected. Required before
// first real investment for 1099 tax reporting. Server only stores last4
// + a "collected" timestamp; the full digits are never persisted at rest.
function SsnCollectionNudge({
  fundId,
  childFirst,
  hasMultipleFunds,
  onCollected,
}: {
  fundId: string;
  childFirst: string;
  // True when the parent has more than one fund. Drives a one-line
  // clarification that each fund is a separate UTMA account requiring its
  // own SSN, so users with multiple kids don't think setting one dismisses
  // the others. Hidden when there's only one fund (no clarification needed).
  hasMultipleFunds: boolean;
  onCollected: (updatedFund: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [ssn, setSsn] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const valid = /^\d{9}$/.test(ssn) && !/^(\d)\1{8}$/.test(ssn);
  const formatted = ssn.length >= 5
    ? `${ssn.slice(0, 3)}-${ssn.slice(3, 5)}-${ssn.slice(5)}`
    : ssn.length >= 3
      ? `${ssn.slice(0, 3)}-${ssn.slice(3)}`
      : ssn;
  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/funds/${fundId}/recipient-ssn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ssn }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setServerError(data?.error || "Could not save. Try again.");
        return;
      }
      // Server returns the updated fund row. Hand it to the parent so it can
      // patch the cache with authoritative data — no optimistic guessing,
      // no invalidate, no race against a pre-write refetch.
      const updatedFund = await res.json().catch(() => null);
      // Local latch — survives any future refetch that happens to return
      // a fund object missing recipientSsnCollectedAt. The banner condition
      // honors EITHER the server flag OR this latch.
      writeSsnLatched(fundId);
      haptic("success");
      // Toast wording is fund-scoped on purpose. With multiple kids, a vague
      // "Tax info saved" reads as "the SSN requirement is satisfied" and
      // people get confused when the next fund's banner still shows.
      toast({
        title: `${childFirst}'s SSN saved`,
        description: hasMultipleFunds
          ? `Locked in for ${childFirst}'s UTMA account. Each child's account stays separate, and the IRS issues 1099s per account.`
          : `Locked in for tax reporting. We don't store the full digits at rest.`,
      });
      setSsn("");
      setOpen(false);
      onCollected(updatedFund);
    } catch {
      setServerError("Network hiccup. Try again.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="rounded-2xl border border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-cream))] p-4" data-testid="nudge-collect-recipient-ssn">
      <div className="flex items-start gap-3">
        <Lock size={15} className="mt-0.5 flex-shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">
            Add {childFirst}'s SSN to enable investing
          </p>
          <p className="mt-1 text-[11.5px] text-muted-foreground leading-relaxed">
            Required by the IRS for 1099-DIV / 1099-B forms tied to {childFirst}'s UTMA account. One-time. Encrypted in transit. Last 4 digits stored, not the full number.
          </p>
          {hasMultipleFunds && (
            <p className="mt-1.5 text-[10.5px] text-muted-foreground/80 leading-relaxed">
              Each child's account is its own UTMA. Set once for {childFirst}, separately from your other kids.
            </p>
          )}
          {!open ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { haptic("light"); setOpen(true); }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen-deep))] text-white px-3 py-1.5 text-[12px] font-semibold transition-colors"
                data-testid="button-open-ssn-collection"
              >
                Add SSN
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic("light");
                  snoozeSsn(fundId);
                  // Force the dashboard to re-evaluate the banner condition
                  // immediately. Without this the user has to refresh to see
                  // the dismissal.
                  toast({ title: "Got it. We'll remind you tomorrow." });
                  // Dispatch a synthetic event the dashboard can listen for
                  // OR just trigger a re-render via the parent's onCollected
                  // path with no-op data (no fund mutation, just rerender).
                  window.dispatchEvent(new CustomEvent("kiddo:ssn-snoozed", { detail: { fundId } }));
                }}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5"
                data-testid="button-snooze-ssn"
              >
                Remind me tomorrow
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={formatted}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
                  setSsn(digits);
                  setServerError(null);
                }}
                placeholder="123-45-6789"
                aria-label={`${childFirst}'s Social Security Number`}
                className="w-full h-11 px-3 rounded-xl border-2 border-border bg-card text-sm font-mono tabular-nums tracking-wider focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                data-testid="input-recipient-ssn"
              />
              {serverError && (
                <p className="text-[11px] text-destructive">{serverError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={!valid || submitting}
                  className="rounded-xl px-3 py-1.5 text-xs font-bold text-white bg-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen)/0.92)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  data-testid="button-submit-recipient-ssn"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => { setSsn(""); setOpen(false); setServerError(null); }}
                  className="text-xs text-muted-foreground px-2 py-1.5"
                  data-testid="button-cancel-recipient-ssn"
                >
                  Not now
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                Encrypted submission. Used only for IRS-required tax forms tied to {childFirst}'s custodial account.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Friendlier money formatter for action labels and warm-context UI: drops the
// .00 cents on whole amounts ("$50" not "$50.00") but preserves cents when
// they're meaningful ("$50.42 (+$0.42)" — the 42¢ is the whole story of the
// gain badge). Use this in CTAs, marketing copy, and emotional UI; use the
// standard formatCurrency in financial summaries, receipts, and breakdowns
// where the decimal alignment matters for reconciliation.
function formatMoneyFriendly(value: number): string {
  // Pre-round to 2dp before handing to Intl. Belt-and-suspenders against
  // any locale/runtime where maximumFractionDigits doesn't bite — fixes
  // the "$24.167/month" report where a yearly-divided-by-12 value with a
  // repeating decimal slipped through. Math.round on (value * 100) avoids
  // .toFixed() string conversion + reparse pattern.
  const rounded = Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 0.005;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getGiftStatusConfig(status?: string) {
  switch ((status || "").toLowerCase()) {
    case "pending":
      return { label: "On its way", className: "bg-orange-100 text-orange-700" };
    case "host_hold":
      return { label: "Waiting on host", className: "bg-amber-100 text-amber-800" };
    case "processing":
      return { label: "Processing", className: "bg-blue-100 text-blue-700" };
    case "invested":
      return { label: "Invested", className: "bg-green-100 text-green-700" };
    case "settled":
      return { label: "Settled", className: "bg-green-100 text-green-700" };
    case "failed":
      return { label: "Failed", className: "bg-red-100 text-red-700" };
    default:
      return { label: "Received", className: "bg-muted text-muted-foreground" };
  }
}

function getGiftExecutionLabel(executionModel?: string | null, selectedTicker?: string | null): string {
  const raw = String(executionModel || "").toLowerCase();
  if (raw.includes("pick")) return selectedTicker ? `Invested in ${String(selectedTicker).toUpperCase()}` : "Gifter chose";
  if (raw.includes("family")) return "Family choice";
  return "Invested";
}

// capFirst moved to client/src/lib/format-name.ts on 2026-05-15.
// Smart multi-segment version (handles "mary anne" / "mary-anne") +
// preserves intentional mid-word casing (McAdams, DeAngelo). The
// local helper used to live here as a single-letter cap.

// Prefer the explicit isAnonymous flag from the gift row when
// available. Fall back to the legacy string-matching pattern for
// pre-migration data (rows that don't have is_anonymous set yet,
// or callers who haven't been updated to pass the flag).
//
// Per feedback_anonymous_as_explicit_flag.md: privacy choices are
// explicit booleans, not inferred from string patterns. The string
// fallback exists only for backward compat with older gift rows.
function displayGifterName(name?: string | null, isAnonymous?: boolean): string {
  if (isAnonymous === true) return "Anonymous";
  const normalized = String(name || "").trim();
  if (!normalized || /^someone who loves/i.test(normalized) || normalized.toLowerCase() === "anonymous") {
    return "Anonymous";
  }
  return normalized;
}

function stripStockSuffix(name?: string | null): string {
  return String(name || "").replace(/\s+stock$/i, "").trim();
}

type GifterProfile = {
  name: string;
  initials: string;
  colorIdx: number;
  giftCount: number;
  totalNetAmount: number;
  lastGiftDate: string | null;
  gifts: GiftType[];
};

// Avatar background palette for named gifters. Hash-based assignment
// (gifterColorIdx) so the same name always lands on the same color.
//
// One slot was previously brand gold (`rgb(184,121,26)`), which collided
// with the Share CTA register — gold/orange is RESERVED for that single
// action color. An avatar background using the same gold made every
// "Grandpa"-style hash bucket look like a button. Replaced with a warm
// terracotta that keeps the kid-palette warmth without competing with
// the Share button.
//
// Other accent uses of gold (recurring ↻ badge, first-gifter ⭐ badge,
// strategy chip dot) are kept — those are small, intentional one-time
// signals, not ambient surface color.
const GIFTER_AVATAR_COLORS = [
  { bg: "rgb(26,61,43)",   text: "white" }, // Evergreen (brand primary — fine on small avatars)
  { bg: "rgb(180,90,60)",  text: "white" }, // Terracotta (was brand gold — replaced)
  { bg: "rgb(67,101,82)",  text: "white" }, // Sage green
  { bg: "rgb(90,65,45)",   text: "white" }, // Coffee brown
  { bg: "rgb(58,55,92)",   text: "white" }, // Indigo
];

function gifterColorIdx(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0x7fffffff;
  return h % GIFTER_AVATAR_COLORS.length;
}

function getTransactionTimestamp(transaction?: DashboardTransaction | null): number {
  const raw = transaction?.completedAt || transaction?.createdAt;
  if (!raw) return 0;
  const timestamp = new Date(raw).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getFundTransactionLabel(transaction: DashboardTransaction): string {
  const amount = formatCurrency(parseFloat(transaction.amount || "0"));
  switch (String(transaction.type || "").toLowerCase()) {
    case "sell":
      return `Moved ${amount} to cash`;
    case "buy":
      return `Bought ${amount} of investments`;
    case "gift":
      return `Gift received: ${amount}`;
    case "subscription":
      return `Subscription payment: ${amount}`;
    case "withdrawal":
      return `Withdrawal started: ${amount}`;
    case "refund":
      return `Refunded ${amount}`;
    default:
      return transaction.description || `${amount} activity`;
  }
}

function getFundTransactionTone(transaction: DashboardTransaction): string {
  switch (String(transaction.type || "").toLowerCase()) {
    case "sell":
      return "text-amber-700";
    case "buy":
    case "gift":
      return "text-[hsl(var(--kiddo-evergreen))]";
    case "withdrawal":
    case "refund":
      return "text-red-600";
    default:
      return "text-foreground";
  }
}

function getGiftDisplayAmountForTransaction(transaction: DashboardTransaction, gifts: GiftType[]): number {
  if (String(transaction.type || "").toLowerCase() !== "gift" || !transaction.giftId) {
    return parseFloat(transaction.amount || "0");
  }
  const matchingGift = gifts.find((gift) => gift.id === transaction.giftId);
  const netAmount = parseFloat(matchingGift?.netAmount || matchingGift?.amount || transaction.amount || "0");
  return Number.isFinite(netAmount) ? netAmount : parseFloat(transaction.amount || "0");
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: subscription } = useSubscription();
  const queryClient = useQueryClient();

  // Closed-tab fallback for the at-handoff welcome walkthrough. If the
  // kid completed the ownership transfer but closed the tab before
  // finishing the walkthrough at /welcome-at-18, the server still has
  // their fund flagged kidWelcomeCompletedAt=null. Dashboard mount
  // checks for that and routes them back to the walkthrough — the
  // moment is too high-leverage to let a closed tab skip. Per
  // AGE_18_HANDOFF_SPEC.md bucket 1 closed-tab fallback.
  useEffect(() => {
    if (!isAuthenticated || authLoading) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/pending-handoff-welcome", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data?.fundId) {
          setLocation(`/welcome-at-18?fundId=${encodeURIComponent(data.fundId)}`);
        }
      } catch {
        // Non-fatal — just stay on dashboard if the check fails.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  // Action items — surfaces todos that the SetupProgressNudge doesn't
  // cover (KYC failures, payment-failed, large-gift holds) and that
  // need their own Fix + Remind-tomorrow affordances. SetupProgressNudge
  // stays for the broader "where are you in setup" picture; this list
  // sits alongside it for the per-item urgency cluster. See
  // project_action_items_architecture for the read-vs-resolved split.
  const { items: actionItems } = useActionItems();
  const [selectedFundId, setSelectedFundId] = useState<string>(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    return params.get("fund") || getActiveFundId() || "";
  });


  useEffect(() => {
    const params = new URLSearchParams(search || "");
    const nextFundId = params.get("fund") || getActiveFundId() || "";
    setSelectedFundId((current) => (current === nextFundId ? current : nextFundId));
  }, [search]);
  const selectFund = (id: string) => {
    setSelectedFundId(id);
    setActiveFundId(id);
    const params = new URLSearchParams(window.location.search);
    if (id) params.set("fund", id); else params.delete("fund");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  };
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedGiftCode, setCopiedGiftCode] = useState(false);
  const [copiedKidLink, setCopiedKidLink] = useState(false);
  const [addFundOpen, setAddFundOpen] = useState(false);
  // Second-fund FeatureWallModal — fires when a free or Plus
  // user (single-fund plans) tries to add another fund. The
  // AddFundSheet has its own in-flow "upgrade-family" step as a
  // defensive fallback (kept), but the modal here intercepts at
  // the trigger so the parent doesn't enter a multi-step flow
  // only to discover they can't finish it. Dismissal tracked via
  // dismissedFeatureWalls so a repeat encounter shows softer copy.
  const [secondFundWallOpen, setSecondFundWallOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  // Re-render trigger when the user snoozes the SSN nudge. Just an
  // incrementing number — the banner condition reads `isSsnSnoozed(fundId)`
  // (localStorage-backed) and the bump forces re-evaluation without a page
  // refresh. Cleaner than the previous string-sentinel pattern.
  const [ssnSnoozeTick, setSsnSnoozeTick] = useState(0);
  useEffect(() => {
    const handler = () => setSsnSnoozeTick((n) => n + 1);
    window.addEventListener("kiddo:ssn-snoozed", handler);
    return () => window.removeEventListener("kiddo:ssn-snoozed", handler);
  }, []);

  // Force a re-render once per minute so Date.now()-derived labels (Quick
  // Links occasion countdown "in Xd / Today / Tomorrow", at-18 countdown, etc.)
  // stay accurate when the dashboard is left open across the midnight boundary
  // — without waiting for a polling refetch or a manual navigation.
  const [, setMinuteTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setMinuteTick((t) => (t + 1) % 1_000_000), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Idle-time prefetch of next-likely pages used to live here, but
  // depended on funds/fundsDataUpdatedAt (declared further down in
  // the function body) for the staleness guard. Moved below the
  // funds destructuring + activeFundId derivation so the prefetch
  // can use the SAME validated activeFundId every fund-scoped query
  // uses. Locked 2026-05-21 after the prefetch was identified as the
  // 403-storm trigger that bypassed the activeFundId guard.

  useEffect(() => {
    setLetterInlineOpen(false);
    setLetterDraft("");
    setLetterDiscardConfirm(false);
    setLetterDeleteConfirm(false);
  }, [selectedFundId]);

  // Refs hold the latest funds + plan so the global ADD_FUND_EVENT
  // listener (bound once below) can read current values at fire time
  // without re-binding on every render. The actual sync from
  // funds/effectivePlan into these refs happens further down in the
  // function body, after those values are declared — separating
  // listener-binding from value-reading avoids TDZ ordering issues
  // (funds is declared ~350 lines after this useEffect runs).
  const fundsRef = useRef<Fund[] | null>(null);
  const effectivePlanRef = useRef<string>("free");
  useEffect(() => {
    const handleActiveFundChange = (event: globalThis.Event) => {
      const id = String((event as globalThis.CustomEvent<{ id?: string }>).detail?.id || getActiveFundId() || "");
      setSelectedFundId((current) => (current === id ? current : id));
    };
    // The ADD_FUND_EVENT (kiddo:add-fund) is the canonical signal
    // for "user just tapped Add Fund somewhere in the app." Gate
    // here, not at every fire site, so the limit-aware branch
    // applies uniformly: AppHeader, sidebar, account page, etc.
    // all route through this single handler.
    const handleAddFund = () => {
      const latestFunds = fundsRef.current ?? [];
      const latestPlan = effectivePlanRef.current;
      const ownedChildFunds = latestFunds.filter(
        (f) => (f as any).fundType !== "personal" && (f as any).accessRole !== "previous_owner",
      );
      const atLimit =
        latestPlan !== "family" && latestPlan !== "legacy" && ownedChildFunds.length >= 1;
      if (atLimit) {
        setSecondFundWallOpen(true);
        return;
      }
      setAddFundOpen(true);
    };
    window.addEventListener(ACTIVE_FUND_CHANGE_EVENT, handleActiveFundChange);
    window.addEventListener(ADD_FUND_EVENT, handleAddFund as EventListener);
    return () => {
      window.removeEventListener(ACTIVE_FUND_CHANGE_EVENT, handleActiveFundChange);
      window.removeEventListener(ADD_FUND_EVENT, handleAddFund as EventListener);
    };
  }, []);
  const [eventGateOpen, setEventGateOpen] = useState(false);
  const [createEventSheetOpen, setCreateEventSheetOpen] = useState(false);
  const [editEventTarget, setEditEventTarget] = useState<EditEventData | null>(null);
  const [expandedTileIdV2, setExpandedTileIdV2] = useState<string | null>(null);
  // Per-nudge UI state. Lets the in-app strategy nudge show a spinner + "Switching..." text
  // immediately on tap, and optimistically hide the banner the moment the request goes out
  // — so the user never wonders whether anything happened during the network round-trip.
  const [nudgeSwitchLoading, setNudgeSwitchLoading] = useState<string | null>(null);
  const [nudgeOptimisticallyDismissed, setNudgeOptimisticallyDismissed] = useState<Set<string>>(new Set());
  const [showArchivedTilesV2, setShowArchivedTilesV2] = useState(false);
  const [eventShareTarget, setEventShareTarget] = useState<SharePage[] | null>(null);
  const [investCashOpen, setInvestCashOpen] = useState(false);
  const [investCashInitialTicker, setInvestCashInitialTicker] = useState("");
  // Intra-page deep-link halo target. Set by the "Emma's fund so far"
  // summary-card row clicks (Your recurring investments / Your one-time
  // additions / In cash uninvested) — scrolls to the matching section
  // below and lights it with the locked deep-link gold halo. Auto-clears
  // after HIGHLIGHT_HOLD_MS so it reads as intentional, not persistent
  // state. Locked register per `project_deep_link_scroll_pattern.md`.
  const [summaryHaloTarget, setSummaryHaloTarget] = useState<"recurring" | "onetime" | "cash" | null>(null);
  // Helper to deep-link from a summary row to a Dashboard section.
  // Single source of truth so all three summary rows behave identically.
  const summaryScrollTo = useCallback((target: "recurring" | "onetime" | "cash") => {
    const testIdByTarget: Record<typeof target, string> = {
      recurring: "recurring-list-view",
      onetime: "card-one-time-contribution-v2",
      cash: "button-invest-cash",
    };
    haptic("selection");
    setSummaryHaloTarget(target);
    const cancel = scrollToTestId(testIdByTarget[target], {
      onFound: () => {
        window.setTimeout(() => setSummaryHaloTarget((cur) => (cur === target ? null : cur)), HIGHLIGHT_HOLD_MS);
      },
      onMissed: () => {
        // Target didn't render in time — silently clear the halo so we don't
        // leave a stuck highlight. Fallback navigation is the row's existing
        // semantic (we keep it scoped to intra-page; no page-change fallback
        // because all three targets live on the Dashboard itself).
        setSummaryHaloTarget(null);
      },
    });
    return cancel;
  }, []);
  const [sellingHolding, setSellingHolding] = useState<Holding | null>(null);
  const [managedSellWarning, setManagedSellWarning] = useState<Holding | null>(null);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [holdingsV2Page, setHoldingsV2Page] = useState(0);
  const [investPickerOpen, setInvestPickerOpen] = useState(false);
  const holdingsV2ScrollRef = useRef<HTMLDivElement | null>(null);
  const holdingsSectionRef = useRef<HTMLElement | null>(null);
  const carouselPage1Ref = useRef<HTMLDivElement | null>(null);
  const carouselPage2Ref = useRef<HTMLDivElement | null>(null);
  // 2026-05-12: The wrong-shape two-page horizontal-scroll-snap carousel
  // (Page 1 Holdings list + Page 2 donut breakdown + Holdings/Breakdown
  // segmented switcher) was surgically removed. The Holdings LIST itself
  // (Chosen with love + Managed mix) stays — rendered directly without
  // the carousel wrapper. The donut, switcher, and scroll-snap mechanism
  // are gone. See project_dashboard_holdings_carousel_hidden.md.
  //
  // The following refs/state vars remain DECLARED but are now unused:
  // - holdingsV2ScrollRef, carouselPage1Ref, carouselPage2Ref
  // - holdingsV2Page, carouselHeight (and their setters)
  // - donutActiveSegment (only used by donut, now removed)
  // The carousel-height useEffect at ~line 2660 will silently no-op since
  // its observed refs are now null. Cleanup of these orphaned declarations
  // is a separate pass; leaving them avoids cascading edits across the
  // file in this surgery.
  const [carouselHeight, setCarouselHeight] = useState<number | undefined>(undefined);
  const [donutActiveSegment, setDonutActiveSegment] = useState<string | null>(null);
  const [selectedGifter, setSelectedGifter] = useState<GifterProfile | null>(null);
  // Avatar overflow: when there are many named gifters, cap at AVATAR_VISIBLE
  // and reveal the rest behind a "+N more" affordance. Toggle-able so the
  // parent can either keep the at-a-glance focus or expand to scan the
  // full community when they want.
  const [avatarsExpanded, setAvatarsExpanded] = useState<boolean>(false);
  // (Removed 2026-05-15: inviteSheetOpen state. The orphan InviteSheet
  // block it gated was never opened from anywhere in the app. See the
  // comment block below where the JSX used to live.)
  const [letterInlineOpen, setLetterInlineOpen] = useState(false);
  const [letterDraft, setLetterDraft] = useState("");
  const [letterSaving, setLetterSaving] = useState(false);
  const [letterDiscardConfirm, setLetterDiscardConfirm] = useState(false);
  const [letterDeleteConfirm, setLetterDeleteConfirm] = useState(false);
  const [heroGiftIdx, setHeroGiftIdx] = useState(0);
  const [sellShares, setSellShares] = useState("");
  const [sellMode, setSellMode] = useState<"shares" | "dollars">("dollars");
  const [sellLoading, setSellLoading] = useState(false);
  const [sellSuccess, setSellSuccess] = useState(false);
  const [contribActionLoading, setContribActionLoading] = useState<Record<string, string | null>>({});
  const [contribConfirmCancel, setContribConfirmCancel] = useState<string | null>(null);
  const [pauseOptionsContribId, setPauseOptionsContribId] = useState<string | null>(null);
  const [optimisticContribStatus, setOptimisticContribStatus] = useState<Record<string, string>>({});
  const [showCollabInvite, setShowCollabInvite] = useState(true);
  const [collabModalOpen, setCollabModalOpen] = useState(false);
  const effectivePlan = subscription?.effectivePlan ?? "free";
  const isFamily = effectivePlan === "family" || effectivePlan === "legacy" || effectivePlan === "trial";
  const isStarter = effectivePlan === "starter";
  const updateEventMutation = useUpdateEvent();
  // `giftToastDismissed` is the current-render gate — once the user
  // dismisses for this mount, suppress until they navigate away or
  // a NEW gift arrives. The persistent set in
  // gift-toast-dismissed.ts handles cross-session / cross-tab /
  // cross-fund-switch dismissals so the same gift's toast doesn't
  // re-surface (was a real bug pre-2026-05-11: single-value
  // sessionStorage + per-tab scope let dismissed toasts come back).
  const [giftToastDismissed, setGiftToastDismissed] = useState(false);
  const [recentGiftForToast, setRecentGiftForToast] = useState<GiftType | null>(null);
  const [showCoverageUpgradeModal, setShowCoverageUpgradeModal] = useState(false);
  const [startingCoverageCheckout, setStartingCoverageCheckout] = useState(false);
  const [culturalBgPickerOpen, setCulturalBgPickerOpen] = useState(false);
  const [culturalBgSelections, setCulturalBgSelections] = useState<string[]>([]);
  const [savingCulturalBg, setSavingCulturalBg] = useState(false);
  const [kidViewConfigOpen, setKidViewConfigOpen] = useState(false);
  const [kidViewConfigStep, setKidViewConfigStep] = useState<"settings" | "done">("settings");
  const [kidViewEnabled, setKidViewEnabled] = useState(false);
  const [kidViewPin, setKidViewPin] = useState("");
  const [kidViewPinHint, setKidViewPinHint] = useState("");
  const [savingKidView, setSavingKidView] = useState(false);
  const [disclosureOpen, setDisclosureOpen] = useState<"growth" | "projection" | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>("1M");
  const [previewFundId, setPreviewFundId] = useState<string>("");
  const [autoInvestModalOpen, setAutoInvestModalOpen] = useState(false);
  const [autoInvestUpgradeOpen, setAutoInvestUpgradeOpen] = useState(false);
  const [editingContribId, setEditingContribId] = useState<string | null>(null);
  const [autoInvestAmount, setAutoInvestAmount] = useState("25");
  // (Removed: autoInvestCarouselIndex / autoInvestSwipeDir / recurringViewMode
  // state machinery. The recurring-investment section used to support both
  // a swipeable card deck AND a list view, with a Cards/List toggle and a
  // dynamic default based on count. The History detail modal is now the
  // canonical "rich view" for any schedule, so the card deck became
  // redundant — list view scales 1 → many and the modal carries the
  // emotional weight the deck used to. Dropping ~250 lines of card-deck
  // JSX + the toggle + the dynamic-default useEffect made the surface
  // simpler and the parent's mental model singular.)
  // Action sheet for list-view rows. Tapping a list row (or its 3-dot menu) opens a dialog
  // with Edit / Pause-or-Resume / Cancel. Cancel uses the same dialog for confirmation
  // (two-step inside the sheet) instead of a separate modal so the flow stays contained.
  const [listActionContribId, setListActionContribId] = useState<string | null>(null);
  const [listActionConfirmCancel, setListActionConfirmCancel] = useState(false);

  // Gentle nudges — observation + opportunity pattern, never warnings. The first
  // instance is "duplicate recurring schedules into the same ticker" but the same
  // shape will host other observations later (stale notes, concentration, long
  // pauses). Dismissals persist via localStorage with key shape:
  //   kora:dismissed:gentle-nudge:{nudgeKey}
  // value: ISO timestamp of dismissal (was: "1" forever — too sticky).
  //
  // 30-day expiry: a parent who dismisses today and revisits in 6 months
  // probably wants the reminder back. The right model isn't "ignore forever"
  // — it's "ignore for a while." 30 days is enough to stop being annoying
  // for the duplicate they intentionally kept, short enough that a real
  // forgotten duplicate eventually re-surfaces.
  const NUDGE_DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(() => {
    try {
      const next = new Set<string>();
      const now = Date.now();
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith("kora:dismissed:gentle-nudge:")) continue;
        const value = localStorage.getItem(k) || "";
        const dismissedAt = Date.parse(value);
        // Legacy "1" values (no parsable date) are treated as still-dismissed
        // for backwards compat — until the next dismiss-tap rewrites them
        // with a real timestamp. New dismissals always use ISO.
        if (Number.isFinite(dismissedAt) && (now - dismissedAt) > NUDGE_DISMISS_TTL_MS) {
          // Expired — clear and re-surface the nudge.
          try { localStorage.removeItem(k); } catch { /* noop */ }
          continue;
        }
        next.add(k.slice("kora:dismissed:gentle-nudge:".length));
      }
      return next;
    } catch { return new Set<string>(); }
  });
  const dismissNudge = (nudgeKey: string) => {
    setDismissedNudges(prev => { const n = new Set(prev); n.add(nudgeKey); return n; });
    try { localStorage.setItem(`kora:dismissed:gentle-nudge:${nudgeKey}`, new Date().toISOString()); } catch { /* storage unavailable */ }
  };

  // Highlight a specific ticker's recurring rows briefly when the parent taps
  // "See combined view" on a duplicate-detection nudge. Switching to list
  // view alone wasn't enough — if they were already in list view the click
  // felt like a no-op. Now we explicitly scroll the section into view AND
  // glow-ring the matching rows for 4 seconds so the duplicates are
  // physically obvious. State clears itself via the timeout.
  const [highlightedRecurringTicker, setHighlightedRecurringTicker] = useState<string | null>(null);
  const recurringSectionRef = useRef<HTMLDivElement | null>(null);
  const highlightDuplicateSchedules = useCallback((ticker: string) => {
    // List view is now the only view, so no view-mode switch needed —
    // the highlight glow is enough.
    setHighlightedRecurringTicker(ticker.toUpperCase());
    // Scroll on the next frame so the list view has a chance to mount first.
    requestAnimationFrame(() => {
      recurringSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    setTimeout(() => setHighlightedRecurringTicker(null), 4000);
  }, []);
  const closeListAction = () => {
    setListActionContribId(null);
    setListActionConfirmCancel(false);
  };
  const autoInvestDragStartX = useRef<number | null>(null);
  const [autoInvestFrequency, setAutoInvestFrequency] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [savingAutoInvest, setSavingAutoInvest] = useState(false);
  const [autoInvestStep, setAutoInvestStep] = useState<"amount" | "target" | "bank" | "legal" | "note" | "done">("amount");
  const [autoInvestSelectedBankId, setAutoInvestSelectedBankId] = useState<string>("");
  const [autoInvestExecutionModel, setAutoInvestExecutionModel] = useState<"auto" | "pick">("auto");
  const [autoInvestTicker, setAutoInvestTicker] = useState<string>("");
  const [autoInvestMemoryNote, setAutoInvestMemoryNote] = useState("");
  const [autoInvestNoteSaved, setAutoInvestNoteSaved] = useState(false);
  const [autoInvestMedia, setAutoInvestMedia] = useState<MemoryMediaValue>(EMPTY_MEMORY_MEDIA);
  // The id of the most-recently-saved recurring schedule. Captured after
  // create/update so the "note" step can PATCH the schedule's note column,
  // making the worker stamp that note onto each future auto-fire (gift.message
  // + memory_entries on success). Reset whenever the modal opens.
  const [lastSavedContribId, setLastSavedContribId] = useState<string | null>(null);
  const [savingMemoryNote, setSavingMemoryNote] = useState(false);
  const [showFamilyOverview, setShowFamilyOverview] = useState(true);
  const [contributingNow, setContributingNow] = useState(false);
  // Note-prompt sheet for "Add $X" on a recurring schedule card. Mirrors the
  // one-time modal's note→Memory Book pattern so a manual fire from the schedule
  // card never lands mute in the gifts table.
  const [addFromScheduleSheet, setAddFromScheduleSheet] = useState<{ planId: string; amount: string } | null>(null);
  const [addFromScheduleNote, setAddFromScheduleNote] = useState("");
  const [addFromScheduleMedia, setAddFromScheduleMedia] = useState<MemoryMediaValue>(EMPTY_MEMORY_MEDIA);
  const [smartNudge, setSmartNudge] = useState<{
    scenario: "outperforming" | "consistent" | "milestone";
    returnPct?: number;
    streakMonths?: number;
    currentMonthlyAmt?: number;
    doubledAmt?: number;
    currentProjection?: number;
    doubledProjection?: number;
    milestoneAmt?: number;
    // The NEXT milestone above the one just crossed. Used in the
    // "at your current pace, the next $X arrives in N months" copy
    // so the number we promise matches the threshold we're projecting
    // toward, not the one we just hit. Added 2026-05-15 timing audit.
    nextMilestoneAmt?: number;
    monthsAtCurrentRate?: number;
    monthsDoubled?: number;
  } | null>(null);
  const [oneTimeModalOpen, setOneTimeModalOpen] = useState(false);
  const [oneTimeStep, setOneTimeStep] = useState<"amount" | "target" | "confirm">("amount");
  const [oneTimeAmount, setOneTimeAmount] = useState("50");
  const [oneTimeExecutionModel, setOneTimeExecutionModel] = useState<"auto" | "pick" | "cash">("auto");
  const [oneTimeTicker, setOneTimeTicker] = useState("");
  const [oneTimePaymentMethod, setOneTimePaymentMethod] = useState<"apple_pay" | "card" | "cashapp" | "paypal" | "bank">("apple_pay");
  const [oneTimeMemoryNote, setOneTimeMemoryNote] = useState("");
  const [oneTimeNoteSaved, setOneTimeNoteSaved] = useState(false);
  const [oneTimeMedia, setOneTimeMedia] = useState<MemoryMediaValue>(EMPTY_MEMORY_MEDIA);
  const [startingOneTime, setStartingOneTime] = useState(false);
  // Mirror of the recurring "done" step but for the one-time flow. The
  // one-time path leaves the app for Stripe checkout and returns via
  // ?parentContrib=1, so we can't end on a step transition the way recurring
  // does — we open this dialog on return instead. Same locked confirmation
  // pattern (sprout + "[Child]'s fund is growing." + tagline) for parity.
  const [parentContribDoneOpen, setParentContribDoneOpen] = useState(false);
  // (Removed: `pendingGiftNotice` state. Powered the routine "Your gift
  // is pending. This is normal." banner that has been replaced by the
  // status pill on each pending gift row + a `$X settling` summary line
  // below "Total gifts." Banner pattern was the wrong shape for routine
  // settlement awareness — alerts are for things that need attention.
  // Plus its inline "1 to 2 business days" copy was ACH-specific while
  // most gifts settle in seconds via card/Apple Pay/Cash App. The
  // large-gift-hold banner stays — that one IS actionable.)
  const [coverageReturnNotice, setCoverageReturnNotice] = useState<{
    type: "success" | "canceled";
    title: string;
    description: string;
  } | null>(null);
  const oneTimeContributionAmount = Number.parseFloat(oneTimeAmount || "0");
  const oneTimeEstimatedRailOptions = useMemo(() => {
    const amount = Number.isFinite(oneTimeContributionAmount) ? Math.max(0, oneTimeContributionAmount) : 0;
    const methods: PaymentMethodPreference[] = ["apple_pay", "card", "cashapp", "paypal", "bank"];
    return Object.fromEntries(
      methods.map((method) => [method, estimateGiftCheckoutCharge(amount, method)]),
    ) as Record<PaymentMethodPreference, ReturnType<typeof estimateGiftCheckoutCharge>>;
  }, [oneTimeContributionAmount]);
  const oneTimeSelectedEstimate = oneTimeEstimatedRailOptions[oneTimePaymentMethod];
  const oneTimeCardLikeFee = calculatePaymentProcessingFee(oneTimeContributionAmount, "card");
  const oneTimeAchSavings =
    oneTimePaymentMethod === "bank"
      ? Math.max(0, oneTimeCardLikeFee - oneTimeSelectedEstimate.processingFee)
      : 0;

  const { data: inboxData } = useQuery<{ items: Array<{ id: string; tone: "info" | "success" | "warning"; title: string; description: string; ctaLabel: string | null; ctaHref: string | null }> }>({
    queryKey: ["/api/inbox", selectedFundId],
    queryFn: async () => {
      const url = selectedFundId ? `/api/inbox?fundId=${encodeURIComponent(selectedFundId)}` : "/api/inbox";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return { items: [] };
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 120000,
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  const {
    data: funds = [],
    isLoading: fundsLoading,
    isError: fundsError,
    refetch: refetchFunds,
    isFetching: fundsFetching,
    isSuccess: fundsSuccess,
    // dataUpdatedAt = 0 while we're showing initialData (the cached
    // funds list from localStorage); flips to a real timestamp the
    // moment the network fetch resolves. Used below to gate
    // selectedFundId validation — we can't trust the validation
    // against a possibly-stale cache, so until the network confirms
    // the truthful funds list we fall back to "first owned fund."
    dataUpdatedAt: fundsDataUpdatedAt,
  } = useQuery<Fund[]>({
    queryKey: ["/api/funds"],
    queryFn: async () => {
      const res = await fetch("/api/funds", { credentials: "include" });
      if (res.status === 401) {
        throw new Error("Session expired. Please log in again.");
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `Failed to load funds (HTTP ${res.status})`);
      }
      return res.json();
    },
    enabled: isAuthenticated,
    initialData: readCachedFunds,
    initialDataUpdatedAt: 0,
    retry: 2,
    staleTime: FUND_ACTIVE_STALE_MS,
    refetchInterval: FUND_LIVE_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!fundsSuccess) return;
    writeLocalCache(LOCAL_CACHE_KEYS.funds, funds);
  }, [funds, fundsSuccess]);

  // Self-heal stale activeFundId. If the localStorage-cached fund ID
  // points to a fund the current user doesn't own (post reset-dunphys
  // reseed with fresh UUIDs, account switch in the same browser,
  // fund closed in another tab, etc.), every fund-scoped query 403s
  // on cold load before the page-level fallback (`funds[0]`) can
  // settle — the stale ID gets baked into `activeFundId` at line
  // ~1680 because the OR-fallback only kicks in when `selectedFundId`
  // is empty, not when it's "set but wrong." Detect the mismatch
  // once `funds` loads and swap to the first owned fund. This also
  // clears the localStorage entry + URL `?fund=` param so the next
  // load doesn't reproduce the storm. Locked 2026-05-21 after the
  // reset-dunphys reseed surfaced the 403 cascade on every Dashboard
  // query (dashboard-summary / memory / parent-contributions / etc.).
  useEffect(() => {
    if (fundsLoading || !fundsSuccess) return;
    if (!selectedFundId) return;
    if (funds.length === 0) return;
    if (funds.some((f) => f.id === selectedFundId)) return;
    const fallback = funds[0]?.id ?? "";
    setSelectedFundId(fallback);
    setActiveFundId(fallback);
    const params = new URLSearchParams(window.location.search);
    if (fallback) params.set("fund", fallback); else params.delete("fund");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    // Also blow away the per-fund local caches keyed by the stale ID
    // so the next page load doesn't briefly render against ghost data
    // either. The funds-list cache itself stays valid (the funds query
    // just refreshed it with the truthful list); only the fund-scoped
    // caches under the obsolete UUID need eviction. Locked 2026-05-21
    // after the second 403-storm report — the previous fix only
    // cleared kiddo_active_fund_id; per-fund caches under the stale
    // UUID survived and could resurface as initialData on the next
    // mount.
    removeLocalCachePrefix(`kora.dashboard-summary.`);
    removeLocalCachePrefix(`kiddo.fund-balance.`);
    removeLocalCache(`kora.activity.recent.${selectedFundId}`);
  }, [fundsLoading, fundsSuccess, selectedFundId, funds]);

  // Mirror latest funds + plan into refs so the ADD_FUND_EVENT
  // handler (bound once above) reads current snapshots at fire
  // time without re-binding on every render.
  useEffect(() => {
    fundsRef.current = funds;
  }, [funds]);
  useEffect(() => {
    effectivePlanRef.current = effectivePlan;
  }, [effectivePlan]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && !fundsLoading && funds.length === 0) {
      setLocation("/get-started");
    }
  }, [authLoading, isAuthenticated, fundsLoading, funds.length, setLocation]);

  useEffect(() => {
    let canceledEffect = false;
    const params = new URLSearchParams(search || "");
    const coverage = params.get("coverage");
    const returnedFundId = params.get("fundId");
    if (!coverage) return;

    const run = async () => {
      try {
        if (coverage === "success") {
          try {
            await fetch("/api/subscription/sync-stripe", {
              method: "POST",
              credentials: "include",
            });
          } catch {
            // Best effort; refreshes below still help pick up local state.
          }
        }

        if (canceledEffect) return;
        if (coverage === "success") {
          const upgradedFund = funds.find((fund) => String(fund.id) === String(returnedFundId));
          setCoverageReturnNotice({
            type: "success",
            title: "Coverage activated",
            description: upgradedFund
              ? `${upgradedFund.name} is now covered. Platform fees are waived and gifting controls are active.`
              : "Your fund is now covered. Platform fees are waived and gifting controls are active.",
          });
          haptic("success");
        } else if (coverage === "canceled") {
          setCoverageReturnNotice({
            type: "canceled",
            title: "Checkout canceled",
            description: "No billing changes were made.",
          });
        }
      } finally {
        if (!canceledEffect) {
          void queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
          void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
          void queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          const nextParams = new URLSearchParams(search || "");
          nextParams.delete("coverage");
          nextParams.delete("fundId");
          const nextSearch = nextParams.toString();
          window.history.replaceState({}, "", `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
        }
      }
    };

    void run();
    return () => {
      canceledEffect = true;
    };
  }, [funds, queryClient, search]);

  // Handle return from the parent contribution Stripe checkout.
  useEffect(() => {
    const params = new URLSearchParams(search || "");
    const contribution = params.get("contribution");
    if (contribution !== "success") return;
    haptic("success");
    toast({ title: "Gift added", description: "Your gift is being processed and will appear in your activity shortly." });

    // Use fundId from the URL if present, fall back to selectedFundId
    const fundIdToRefresh = params.get("fundId") || selectedFundId;

    const invalidateAll = (fid: string | null) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      // Scheduled tab's totalContributed / "Fired N times" / "last [date]"
      // all derive from /api/me/scheduled — invalidate so the Add-Now
      // mutation surfaces in the recurring schedule's stats immediately.
      void queryClient.invalidateQueries({ queryKey: ["/api/me/scheduled"] });
      if (fid) {
        void queryClient.invalidateQueries({ queryKey: ["/api/funds", fid, "dashboard-summary"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/funds", fid, "holdings"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/funds", fid, "gifts"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/funds", fid, "history"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/funds", fid, "transactions"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/funds", fid, "recurring-gifts"] });
        void queryClient.invalidateQueries({ queryKey: ["memory", fid] });
      }
    };

    invalidateAll(fundIdToRefresh);
    void refetchParentContributions();

    // Webhook may land a few seconds after the redirect - re-invalidate to catch it
    const t = setTimeout(() => invalidateAll(fundIdToRefresh), 5000);

    const next = new URLSearchParams(search || "");
    next.delete("contribution");
    next.delete("fundId");
    const nextSearch = next.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`);

    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bank accounts query. Caching trio added 2026-05-20 to match the
  // Settings.tsx instance (same query key, same data, same setup-
  // progress consumer). Both Dashboard and Settings render rows that
  // flip label/state based on hasBank; without initialData either
  // page mounting first would flash the empty 'no bank' state before
  // the network resolved. Same anti-pattern as CoParentAccessCard
  // (commit f347fe2). User-reported on the Settings instance 2026-
  // 05-20 ('Link withdrawals to unlock full fund protection still
  // loading briefly even though it's done'); Dashboard fixed in
  // parallel because the same query backs the Dashboard setup-
  // progress nudges too.
  const { data: bankAccounts = [], isLoading: bankLoading } = useQuery<any[]>({
    queryKey: ["/api/bank-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/bank-accounts", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      writeLocalCache("kiddo.bank-accounts.v1", data);
      return data;
    },
    enabled: isAuthenticated,
    initialData: () => readLocalCache<any[]>("kiddo.bank-accounts.v1"),
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });
  const autoInvestQuoteSymbols = useMemo(() => AUTO_INVEST_STOCKS.map((stock) => stock.symbol).join(","), []);
  const { data: autoInvestQuoteData } = useQuery<MarketQuoteResponse>({
    queryKey: ["market-quotes", autoInvestQuoteSymbols],
    queryFn: async () => {
      const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(autoInvestQuoteSymbols)}`);
      if (!res.ok) throw new Error("Could not load quote estimates");
      return res.json();
    },
    staleTime: 60_000,
  });
  const quotedAutoInvestStocks = useMemo<AutoInvestStock[]>(() => {
    const quotes = new Map<string, MarketQuoteResponse["quotes"][number]>();
    for (const quote of autoInvestQuoteData?.quotes || []) {
      quotes.set(quote.symbol.toUpperCase(), quote);
    }
    return AUTO_INVEST_STOCKS.map((stock) => {
      const quote = quotes.get(stock.symbol);
      return {
        ...stock,
        price: quote?.price || stock.price,
        quoteSource: quote?.source,
        quoteAsOf: quote?.asOf,
        isEstimate: quote?.isEstimate ?? true,
      };
    });
  }, [autoInvestQuoteData]);

  // Validate selectedFundId against the loaded funds list. When it's
  // in the list (cached or fresh), use it. When it's not, fall back
  // to funds[0]. The previous fundsDataUpdatedAt > 0 gate was too
  // aggressive — it forced a brief "no active fund" loading state on
  // every cold page load even when the cached funds were valid,
  // making the main app feel sluggish for the 99% case to defend
  // against the rare stale-ID case.
  //
  // The defenses for the stale-ID case live elsewhere:
  //   - The global 403 wrapper in main.tsx purges the offending ID
  //     from localStorage on any /api/funds/<uuid>/... 403, so a
  //     stale ID self-heals after one bad request rather than
  //     requiring proactive validation.
  //   - The self-heal effect below clears localStorage + URL when
  //     funds loads and the selectedFundId isn't in it.
  // Locked 2026-05-21 after the over-aggressive guard introduced a
  // loading-state regression for the common case.
  const selectedOwnedByUser =
    funds.length > 0 && Boolean(selectedFundId) && funds.some((f) => f.id === selectedFundId);
  const activeFundId = (selectedOwnedByUser ? selectedFundId : funds[0]?.id) || "";
  const activeFund = funds.find((f) => f.id === activeFundId) || funds[0];

  // Idle-time prefetch of next-likely pages — relocated here from
  // earlier in the function body 2026-05-21 so it can gate on the
  // validated activeFundId. The parent on Dashboard will probably
  // tap Memory Book / Activity within a session; pre-warm those
  // queries during browser idle so the eventual click feels instant.
  // Re-fires when activeFundId changes (Memory Book / thank-yous
  // are fund-scoped). Critical: must NOT fire with selectedFundId
  // directly — that bypasses the network-fresh + owned-by-user
  // validation and was the 403-storm trigger on the second incident
  // report.
  useEffect(() => {
    if (!activeFundId) return;
    const cancel = onIdle(() => {
      prefetchMemoryBook(queryClient, activeFundId);
      prefetchActivity(queryClient, 50);
    });
    return cancel;
  }, [activeFundId, queryClient]);

  // Display-capitalize the kid's first name once, use it everywhere.
  // Single derived variable so every kid-name rendering on this page
  // respects the parent's intent ("lauren" typed lowercase still
  // renders as "Lauren") without inline capFirst() wrapping at every
  // site. Locked 2026-05-15 per the projection-step audit and the
  // broader name-display sweep that followed. Storage stays as the
  // parent typed it; this is display-time only. Helper from
  // client/src/lib/format-name.ts.
  const recipientFirstNameDisplay = capFirst(activeFund?.recipientFirstName);
  // Pronouns for the active fund's kid. Single source of truth so every
  // user-visible pronoun on this page respects the fund's setting (per
  // feedback_no_marketing_teaser_quotes.md: every user-visible pronoun
  // must use getPronouns(), never hardcoded or inferred from the name).
  const childPronouns = getPronouns((activeFund as any)?.pronoun);
  // State-specific UTMA majority age (18-21 by state). Every user-visible
  // "18" in copy below must derive from this. Same locked discipline as
  // Projection.tsx / Age18Plan.tsx — see
  // project_state_majority_age_sweep.md. Defaults to 18 (universal UTMA
  // default) when fund.majorityAge isn't set.
  const majorityAge = Number((activeFund as any)?.majorityAge) || 18;
  const majorityOrdinal = (() => {
    const n = majorityAge;
    const lastTwo = n % 100;
    if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
    const lastOne = n % 10;
    if (lastOne === 1) return `${n}st`;
    if (lastOne === 2) return `${n}nd`;
    if (lastOne === 3) return `${n}rd`;
    return `${n}th`;
  })();
  // Access role for the active fund. /api/funds now returns this tag on
  // each row: 'owner' for funds the parent owns, 'co-admin' or 'viewer'
  // for funds they've been invited into. Drives both the badge in the
  // fund switcher and the viewer-mode CTA hides below. Falls back to
  // 'owner' for funds without the tag (older cached responses) so the
  // dashboard never goes view-only on stale data — strict mode would
  // be the wrong failure direction here.
  const activeFundAccessRole: 'owner' | 'co-admin' | 'viewer' | 'previous_owner' =
    ((activeFund as any)?.accessRole === 'co-admin' || (activeFund as any)?.accessRole === 'viewer' || (activeFund as any)?.accessRole === 'previous_owner')
      ? (activeFund as any).accessRole
      : 'owner';
  const isViewerOnly = activeFundAccessRole === 'viewer';
  const isPreviousOwner = activeFundAccessRole === 'previous_owner';
  // Read-only union: viewers AND previous owners (post-handoff parents)
  // both lose write capabilities. Used to gate every CTA that would
  // mutate fund state — Share / Add Gift / Recurring Investments /
  // strategy changes / occasions / etc. The previous-owner case is
  // post-2026-05-14 transferred-fund UX MVP (commit bc4312d). The
  // viewer case is the existing collaborator role.
  const isReadOnlyFund = isViewerOnly || isPreviousOwner;
  const isSharedFund = activeFundAccessRole !== 'owner';
  const cachedHeroFundValue = useMemo(
    () => (activeFundId ? readCachedFundValue(activeFundId) : null),
    [activeFundId],
  );

  const invalidateActiveFundFreshness = useCallback(() => {
    if (!activeFundId) return;
    void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "dashboard-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "gifts"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "holdings"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "history"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "events"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "parent-contributions"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "transactions"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "large-gift-holds"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "thank-yous"] });
    void queryClient.invalidateQueries({ queryKey: ["memory", activeFundId] });
    void queryClient.invalidateQueries({ queryKey: ["fund", activeFundId] });
  }, [activeFundId, queryClient]);

  const {
    data: dashboardSummary,
    isLoading: dashboardSummaryLoading,
    isError: dashboardSummaryError,
  } = useQuery<DashboardSummary>({
    queryKey: ["/api/funds", activeFundId, "dashboard-summary"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundId}/dashboard-summary`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load dashboard summary");
      return res.json();
    },
    enabled: !!activeFundId,
    initialData: () => readCachedDashboardSummary(activeFundId),
    initialDataUpdatedAt: 0,
    staleTime: FUND_ACTIVE_STALE_MS,
    refetchInterval: FUND_LIVE_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!activeFundId || !dashboardSummary) return;
    writeLocalCache(`${DASHBOARD_SUMMARY_CACHE_PREFIX}${activeFundId}`, dashboardSummary);
    queryClient.setQueryData(["/api/funds", activeFundId, "gift-code"], dashboardSummary.giftCode);
    queryClient.setQueryData(["/api/funds", activeFundId, "investment-preferences"], dashboardSummary.investmentPreferences);
    queryClient.setQueryData(["/api/funds", activeFundId, "large-gift-holds"], dashboardSummary.largeGiftHolds);
    queryClient.setQueryData(["/api/funds", activeFundId, "holdings"], dashboardSummary.holdings);
    queryClient.setQueryData(["/api/funds", activeFundId, "gifts"], dashboardSummary.gifts);
    queryClient.setQueryData(["/api/funds", activeFundId, "history"], dashboardSummary.history);
    queryClient.setQueryData(["/api/funds", activeFundId, "events"], dashboardSummary.events);
    queryClient.setQueryData(["/api/funds", activeFundId, "recurring-gifts"], dashboardSummary.recurringGifts);
    queryClient.setQueryData(["/api/funds", activeFundId, "parent-contributions"], dashboardSummary.parentContributions);
    queryClient.setQueryData(["/api/funds", activeFundId, "transactions"], dashboardSummary.transactions);
  }, [activeFundId, dashboardSummary, queryClient]);

  useEffect(() => {
    if (!activeFundId || typeof window === "undefined") return;
    const refreshVisibleFund = () => {
      if (document.visibilityState && document.visibilityState !== "visible") return;
      invalidateActiveFundFreshness();
    };
    window.addEventListener("focus", refreshVisibleFund);
    document.addEventListener("visibilitychange", refreshVisibleFund);
    return () => {
      window.removeEventListener("focus", refreshVisibleFund);
      document.removeEventListener("visibilitychange", refreshVisibleFund);
    };
  }, [activeFundId, invalidateActiveFundFreshness]);

  // Realtime nudge from the server. The webhook handler publishes
  // `gift.arrived` after a Stripe payment-intent (or the recurring worker)
  // completes; the client invalidates the dashboard-summary for the named
  // fund so the count-up + gift-strip arrival lands within the round-trip
  // instead of the 30s safety-net poll.
  //
  // The hook is now backed by a shared RealtimeProvider near the App
  // root — one EventSource per tab, fanned out to every subscriber. The
  // previous `enabled` arg is gone because the provider gates on auth
  // (no signed-in user, no stream). Events for non-active funds are
  // still ignored HERE — NotificationsPanel handles the cross-fund
  // bell-badge case so the parent sees a red dot when a gift lands on
  // a fund they're not currently looking at.
  useRealtimeEvents((event) => {
    if (event.type === "gift.arrived" && event.fundId === activeFundId) {
      invalidateActiveFundFreshness();
    } else if (event.type === "fund.updated" && event.fundId === activeFundId) {
      invalidateActiveFundFreshness();
    }
  });

  // Keep localStorage in sync so other pages (Memory Book, Settings) load the right fund
  useEffect(() => {
    if (activeFundId) setActiveFundId(activeFundId);
  }, [activeFundId]);

  const cashBalance = parseFloat((activeFund as any)?.cashBalance || "0");
  // Hero balance derives from sum(holdings.currentValue) + cash + pending —
  // NOT from f.balance + cash + pending. Earlier this read f.balance, but
  // f.balance is only incremented manually on gift settlement (cost-basis
  // terms) and isn't kept in sync with price moves; sum(holdings.current
  // Value) is updated by the price job. The drift caused the hero number
  // to disagree with the holdings card totals on the same screen — parent
  // saw "$1,575 today" up top and "Total: $1,252.88 + $564.53 = $1,817.41"
  // a few rows down. Both numbers were sourced legitimately, but they
  // don't get to disagree. Falls back to f.balance when holdings haven't
  // loaded yet (initial cached render, or dashboard summary errored).
  const summaryHoldings = (dashboardSummary as any)?.holdings as { currentValue?: string }[] | undefined;
  const investedMarketValue = Array.isArray(summaryHoldings) && summaryHoldings.length > 0
    ? summaryHoldings.reduce((s, h) => s + parseFloat(String(h?.currentValue || "0")), 0)
    : parseFloat(activeFund?.balance || "0");
  const rawTotalValue = investedMarketValue + parseFloat(activeFund?.pendingBalance || "0") + cashBalance;
  // familyTotal is the cross-fund overview; we don't have other funds'
  // holdings loaded here, so it stays on f.balance. Acceptable approximation
  // for the multi-fund roll-up; only the active fund's hero needs the
  // pixel-perfect-with-section-totals consistency.
  const familyTotal = funds.reduce((sum, f) => {
    return sum + parseFloat(f.balance || "0") + parseFloat(f.pendingBalance || "0") + parseFloat((f as any).cashBalance || "0");
  }, 0);
  const prevValueRef = useRef(rawTotalValue);
  const {
    displayValue: displayHeroBalance,
    delta: rawSinceLastVisitDelta,
    shouldAnimate: showFresheningCue,
    isAnimating: balanceAnimating,
  } = useCachedFirstNumber({
    seedValue: cachedHeroFundValue,
    liveValue: rawTotalValue,
    // 1200ms (vs the hook's 900ms default) — the hero balance is the focal
    // count-up element; the longer ladder rung gives the parent time to
    // perceive the rise from cached → live. Per
    // project_count_up_animation_consistency.md: "Duration ladder + 'from'
    // anchor rules" — hero balances are the slowest tier in the ladder.
    duration: 1200,
  });

  // Chart-scrub state (Revolut-style tactile chart). When the parent
  // hovers or finger-drags across the trend chart, this holds the
  // active point so the hero balance, "Today" kicker, and the Growth
  // pill below the chart all swap to the scrubbed-time values
  // simultaneously. When null, every consumer falls back to live state
  // — no scrubbing in progress.
  //
  // Why state lives at this level (not inside the chart): it has to
  // drive surfaces in three different parts of the page (hero balance,
  // hero kicker, lifetime stats Growth pill). Bubbling up via a
  // prop-callback keeps the chart component agnostic of the hero's
  // existence and lets the same chart render unchanged on any future
  // surface where there's no scrub-aware hero.
  const [scrubbedTrendPoint, setScrubbedTrendPoint] = useState<DashboardTrendPoint | null>(null);
  const isScrubbing = scrubbedTrendPoint !== null;
  const sinceLastVisitDelta = Math.abs(rawSinceLastVisitDelta) >= 0.01 ? rawSinceLastVisitDelta : 0;
  // Update prevValueRef AFTER render so MilestoneMoment sees the old value during the render it compares
  useEffect(() => {
    prevValueRef.current = rawTotalValue;
  }, [rawTotalValue]);
  // Persist the live balance per-fund so the next session seeds the count-up from the last known value.
  useEffect(() => {
    if (!activeFundId || !rawTotalValue || !Number.isFinite(rawTotalValue) || rawTotalValue <= 0) return;
    writeLocalCache(`${FUND_BALANCE_CACHE_PREFIX}${activeFundId}`, rawTotalValue);
  }, [activeFundId, rawTotalValue]);

  // Per-fund cached seed for the hero's "$X at 65" projection peek. Same
  // Acorns-style pattern as the balance: paint the last known projection
  // immediately, then count up to the new live projection if higher. Skips
  // the count-down animation when the projection drops (market dip,
  // recurring schedule pause, etc.) — never makes the parent watch a
  // future-fund number shrink during a routine load.
  const cachedHeroProjectionAt65 = useMemo(
    () => (activeFundId ? readCachedProjectionAt65(activeFundId) : null),
    [activeFundId],
  );

  // Per-fund Kiddo+ check. This must come after activeFundId is declared.
  const activeFundMembership = activeFundId ? (subscription?.starterByFund?.[activeFundId] as any) : null;
  const activeFundHasStarter = activeFundMembership?.status === "active" ||
    (activeFundMembership?.status === "canceled" && activeFundMembership?.currentPeriodEnd && new Date(activeFundMembership.currentPeriodEnd).getTime() > Date.now());
  // Locked open 2026-05-21 per the Plus pricing reframe (see
  // project_plus_pricing_reframe.md). Recurring contributions are
  // free across all tiers. Plus's actual gate moved to custom-mix
  // design (resolveAllowedFundStrategy server-side). The previous
  // gate (`isFamily || isStarter || activeFundHasStarter`) is
  // preserved here as a code-comment in case the reframe is
  // reverted; the inline plan-derived flags stay valid for other
  // downstream uses (subscription card, upgrade nudges, etc.) but
  // recurring access is no longer one of them.
  const hasAutoInvestAccess = true;
  void isFamily; void isStarter; void activeFundHasStarter;
  const { data: parentLetter } = useQuery<{ id: string; content: string; type: string; authorName?: string } | null>({
    queryKey: ["memory", activeFundId, "parent_letter"],
    queryFn: async () => {
      if (!activeFundId) return null;
      const res = await fetch(`/api/funds/${activeFundId}/memory`, { credentials: "include" });
      if (!res.ok) return null;
      const entries: any[] = await res.json();
      return entries.find((e) => e.type === "parent_letter") ?? null;
    },
    enabled: !!activeFundId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: giftCodeData } = useQuery<{ code: string; lookupUrl: string }>({
    queryKey: ["/api/funds", activeFundId, "gift-code"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundId}/gift-code`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load gift code");
      return res.json();
    },
    enabled: !!activeFundId && dashboardSummaryError,
    initialData: () => dashboardSummary?.giftCode,
    staleTime: 1000 * 60 * 10,
  });
  const { data: kidViewSettings } = useQuery<any>({
    queryKey: ["/api/funds", activeFundId, "kid-view-settings"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundId}/kid-view-settings`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load kid view settings");
      return res.json();
    },
    enabled: !!activeFundId && activeFund?.accountType === "UTMA",
  });
  const { data: investPrefs, refetch: refetchInvestPrefs } = useQuery<any>({
    queryKey: ["/api/funds", activeFundId, "investment-preferences"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundId}/investment-preferences`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!activeFundId && dashboardSummaryError,
    initialData: () => dashboardSummary?.investmentPreferences,
    staleTime: 60_000,
  });
  const isCustomStrategy = investPrefs?.managedStrategy === "custom";
  const { data: fundStrategy } = useQuery<{ strategy: string; customAllocations: Record<string, number> | null }>({
    queryKey: ["/api/funds", activeFundId, "strategy"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundId}/strategy`, { credentials: "include" });
      if (!res.ok) return { strategy: "growth", customAllocations: null };
      return res.json();
    },
    enabled: !!activeFundId && isCustomStrategy,
    staleTime: 30_000,
  });

  const { data: largeGiftHolds } = useQuery<any>({
    queryKey: ["/api/funds", activeFundId, "large-gift-holds"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundId}/large-gift-holds`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load large gift holds");
      return res.json();
    },
    enabled: !!activeFundId && dashboardSummaryError,
    initialData: () => dashboardSummary?.largeGiftHolds,
    refetchInterval: 60_000,
  });
  const coverageByFund = (subscription?.coverageByFund || {}) as Record<string, FundCoverageState>;
  const activeCoverageState = (coverageByFund[String(activeFundId)] || "uncovered") as FundCoverageState;
  const isFundCovered =
    activeCoverageState === "covered_starter" ||
    activeCoverageState === "covered_family" ||
    activeCoverageState === "trial_active";

  useEffect(() => {
    if (activeFundId) setPreviewFundId(activeFundId);
  }, [activeFundId]);

  useEffect(() => {
    setKidViewEnabled(Boolean(kidViewSettings?.enabled));
    setKidViewPinHint(String(kidViewSettings?.pinHint || ""));
  }, [kidViewSettings]);

  const { data: holdingsFetched = [], isLoading: holdingsQueryLoading } = useQuery<Holding[]>({
    queryKey: ["/api/funds", activeFundId, "holdings"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundId}/holdings`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeFundId && dashboardSummaryError,
  });
  // Derive directly from dashboardSummary so fund switches always show correct holdings immediately.
  // Fall back to the independently-fetched data only when the summary failed to load.
  const holdings: Holding[] = dashboardSummary?.holdings ?? holdingsFetched;
  const holdingsLoading = holdingsQueryLoading || (!!activeFundId && dashboardSummaryLoading && !dashboardSummary);

  const { data: giftsFetched = [], isLoading: giftsQueryLoading } = useQuery<GiftType[]>({
    queryKey: ["/api/funds", activeFundId, "gifts"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundId}/gifts`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeFundId && dashboardSummaryError,
  });
  const gifts: GiftType[] = dashboardSummary?.gifts ?? giftsFetched;
  const giftsLoading = giftsQueryLoading || (!!activeFundId && dashboardSummaryLoading && !dashboardSummary);
  const giftAllocations: GiftAllocationLite[] = dashboardSummary?.giftAllocations ?? [];

  // Broader "ever-managed" ticker set — UNION of every preset strategy's
  // basket (Growth/Balanced/Conservative) PLUS the user's custom
  // allocations when present. Used by the per-gift "Now in: managed
  // mix · NFLX" classifier so a position bought during a previous
  // strategy still reads as "managed mix" rather than as an isolated
  // ticker. Hoisted above computeGiftCurrentValue so the closure can
  // reference it without a temporal-dead-zone violation.
  const everManagedTickerSet = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    for (const presetKey of Object.keys(MANAGED_STRATEGY_ALLOCATIONS)) {
      for (const a of MANAGED_STRATEGY_ALLOCATIONS[presetKey]) {
        set.add(a.ticker.toUpperCase());
      }
    }
    if (fundStrategy?.customAllocations) {
      for (const t of Object.keys(fundStrategy.customAllocations)) {
        set.add(t.toUpperCase());
      }
    }
    return set;
  }, [fundStrategy?.customAllocations]);

  // Per-gift current-value resolver. Used by the per-gifter and anonymous
  // dialogs to compute "Now worth $X" honestly when a gift's original
  // ticker has been sold and the money rebalanced into other holdings.
  //
  // The previous version computed `sharesAcquired × livePrice(originalTicker)`
  // — which silently broke when the original position was sold (e.g.,
  // anonymous gifted SBUX → SBUX sold → cash → VTI). The HoldingDetailSheet
  // for VTI correctly attributes a slice of that gift to VTI via
  // giftAllocations. The dialog needs to use the same source of truth.
  //
  // Algorithm:
  //   1. Look up all giftAllocations for this gift.
  //   2. For each allocation, compute live value (shares × livePrice) or
  //      fall back to the allocation's recorded costBasis.
  //   3. Sum to get "this gift's money is currently worth $X."
  //   4. Track which tickers the money is in NOW vs originally — surface
  //      a reallocation hint when those differ.
  // When no allocations exist (legacy gifts), falls back to the
  // original-ticker math so older data still renders something sensible.
  const computeGiftCurrentValue = useCallback((g: GiftType) => {
    const giftIdStr = g.id ? String(g.id) : null;
    const originalTicker = String((g as any).selectedTicker || "").toUpperCase();
    const allocs = giftIdStr
      ? giftAllocations.filter(a => String(a.giftId) === giftIdStr)
      : [];
    if (allocs.length === 0) {
      const sharesAcq = (g as any).sharesAcquired ? parseFloat(String((g as any).sharesAcquired)) : null;
      const livePrice = originalTicker
        ? quotedAutoInvestStocks.find(s => s.symbol === originalTicker)?.price
        : null;
      if (sharesAcq && livePrice && Number.isFinite(livePrice) && sharesAcq > 0) {
        return {
          todayValue: sharesAcq * livePrice,
          isReallocated: false,
          currentTickers: originalTicker ? [originalTicker] : [],
          otherTickers: [] as string[],
          nowInLabel: null as string | null,
        };
      }
      return {
        todayValue: null as number | null,
        isReallocated: false,
        currentTickers: [] as string[],
        otherTickers: [] as string[],
        nowInLabel: null as string | null,
      };
    }
    let total = 0;
    const currentTickers = new Set<string>();
    for (const a of allocs) {
      const aTicker = String(a.ticker || "").toUpperCase();
      if (aTicker) currentTickers.add(aTicker);
      const aShares = a.shares ? parseFloat(String(a.shares)) : 0;
      const aCostBasis = parseFloat(String(a.costBasis || "0"));
      const livePrice = quotedAutoInvestStocks.find(s => s.symbol === aTicker)?.price;
      if (livePrice && Number.isFinite(livePrice) && aShares > 0) {
        total += aShares * livePrice;
      } else {
        total += aCostBasis;
      }
    }
    const tickerArr = Array.from(currentTickers);
    const isReallocated = !!originalTicker && !currentTickers.has(originalTicker);
    const otherTickers = tickerArr.filter(t => t !== originalTicker);
    // Build a human-friendly "Now in: …" label that COLLAPSES managed-
    // mix ETFs (VTI/VXUS/BND/VGT or any preset/custom) into the single
    // phrase "{child}'s mix" and surfaces individual chosen-stock
    // destinations explicitly. Without this, the list reads as a flat
    // "VXUS · NFLX · VTI · BND · VGT" — confusing because half are
    // managed ETFs and half are the user's chosen picks. The grouped
    // version reads as "Emma's mix · NFLX" which matches the canonical
    // bucket-naming pattern used everywhere else in the app (holdings
    // list section header, donut chart legend, gifter detail per-row).
    // Was previously the clinical "managed mix" — internal language
    // leaking into a user-facing surface.
    const otherInManaged = otherTickers.filter(t => everManagedTickerSet.has(t));
    const otherInChosen = otherTickers.filter(t => !everManagedTickerSet.has(t));
    const labelParts: string[] = [];
    if (otherInManaged.length > 0) {
      const childFirst = recipientFirstNameDisplay?.trim();
      labelParts.push(childFirst ? `${childFirst}'s mix` : "Managed mix");
    }
    labelParts.push(...otherInChosen);
    const nowInLabel = labelParts.length > 0 ? labelParts.join(" · ") : null;
    return {
      todayValue: total,
      isReallocated,
      currentTickers: tickerArr,
      otherTickers,
      nowInLabel,
    };
  }, [giftAllocations, quotedAutoInvestStocks, everManagedTickerSet, recipientFirstNameDisplay]);

  const { data: fundHistory = [] } = useQuery<FundHistoryPoint[]>({
    queryKey: ["/api/funds", activeFundId, "history"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundId}/history`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeFundId && dashboardSummaryError,
    initialData: () => dashboardSummary?.history,
  });

  const { data: events = [], isLoading: eventsQueryLoading } = useQuery<Event[]>({
    queryKey: ["/api/funds", activeFundId, "events"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundId}/events`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeFundId && dashboardSummaryError,
    initialData: () => dashboardSummary?.events,
  });
  const eventsLoading = eventsQueryLoading || (!!activeFundId && dashboardSummaryLoading && !dashboardSummary);

  // Context-aware memory-note placeholder for parent contribution flows
  // (one-time, recurring kickoff, "add now" from schedule). When the
  // parent has an upcoming non-permanent event with a target date, the
  // placeholder's prompt language reflects what's coming up — e.g.,
  // "What I want Emma to know about saving for her first car" instead
  // of the generic "Why I'm doing this for Emma." Doesn't earmark the
  // contribution to the event (money is fungible, one fund); just
  // makes the note prompt resonant. Honors the locked product rule
  // ("All occasions and goals go into the same fund 🌱"): contributions
  // remain undirected; only the placeholder copy is event-aware.
  const contextEvent = useMemo(() => {
    if (!events || events.length === 0) return null;
    const now = Date.now();
    type EventWithTs = { event: Event; ts: number };
    const ranked: EventWithTs[] = [];
    for (const e of events) {
      const status = String((e as any).status || "active").toLowerCase();
      if (status !== "active") continue;
      if ((e as any).isPermanent) continue;
      const target = (e as any).targetDate || (e as any).eventDate || null;
      if (!target) continue;
      const ts = new Date(String(target)).getTime();
      if (!Number.isFinite(ts) || ts < now) continue;
      ranked.push({ event: e, ts });
    }
    if (ranked.length === 0) return null;
    ranked.sort((a, b) => a.ts - b.ts);
    return ranked[0].event;
  }, [events]);

  // Builds the placeholder string for a given flow context. The flow
  // arg lets each surface tweak the verb ("doing this" vs "adding this"
  // vs "started this") while sharing the event-aware tail.
  const noteFlowPlaceholder = useCallback((flow: "one-time" | "add-now" | "recurring-kickoff") => {
    const childName = recipientFirstNameDisplay || "them";
    const verb = flow === "recurring-kickoff" ? "started this" : flow === "add-now" ? "adding this" : "doing this";
    const generic = flow === "recurring-kickoff"
      ? `Why I started this for ${childName}. What I hope for them. What they mean to me.`
      : `Why I'm ${verb} for ${childName}...`;
    if (!contextEvent) return generic;
    const eventName = String((contextEvent as any).name || "").trim();
    const eventType = String((contextEvent as any).eventType || "").toLowerCase();
    // Event-type-aware prompts. Falls back to event-name framing when
    // type isn't recognized. Generic safety net at the bottom.
    if (eventType === "car" || /\bcar\b/i.test(eventName)) {
      return `What I want ${childName} to know about saving for their first car...`;
    }
    if (eventType === "college" || eventType === "education" || /\bcollege\b/i.test(eventName) || /\beducation\b/i.test(eventName)) {
      return `Tell ${childName} what this investment means for college...`;
    }
    if (eventType === "graduation" || /\bgraduation\b/i.test(eventName)) {
      return `What I want ${childName} to know by graduation day...`;
    }
    if (eventType === "birthday" || /\bbirthday\b/i.test(eventName)) {
      return `What ${childName}'s next birthday means to you...`;
    }
    if (eventType === "wedding" || /\bwedding\b/i.test(eventName)) {
      return `What you hope for ${childName} on their wedding day...`;
    }
    if (eventName) {
      return `What ${eventName} means to you. What you hope for ${childName}...`;
    }
    return generic;
  }, [contextEvent, recipientFirstNameDisplay]);

  const { data: fundTransactions = [] } = useQuery<DashboardTransaction[]>({
    queryKey: ["/api/funds", activeFundId, "transactions"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundId}/transactions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeFundId && dashboardSummaryError,
    initialData: () => dashboardSummary?.transactions || [],
  });

  // Build share pages from the active fund summary instead of loading every event for the user.
  const sharePages: SharePage[] = useMemo(() => {
    if (!activeFund?.slug) return [];
    const origin = window.location.origin;
    const pages: SharePage[] = [{
      label: `${recipientFirstNameDisplay || activeFund.name}'s gift link`,
      description: "Always-on gift link",
      url: `${origin}/${activeFund.slug}`,
      giftCode: giftCodeData?.code,
      isPermanent: true,
    }];
    const fundEvents = events.filter(
      (event) => !event.isPermanent && String(event.status || "active") === "active"
    );
    const eventCodes = dashboardSummary?.eventGiftCodes ?? {};
    for (const event of fundEvents) {
      if (!event.slug) continue;
      pages.push({
        label: event.name,
        url: `${origin}/${activeFund.slug}/${event.slug}`,
        giftCode: eventCodes[event.id]?.code,
        themeId: (event as any).theme || undefined,
      });
    }
    return pages;
  }, [activeFund?.name, recipientFirstNameDisplay, activeFund?.slug, events, giftCodeData?.code, dashboardSummary?.eventGiftCodes]);

  useEffect(() => {
    if (!activeFundId) return;
    const params = new URLSearchParams(search || "");
    if (params.get("syncGifts") !== "1") return;
    let cancelled = false;

    const reconcile = async () => {
      try {
        const res = await fetch(`/api/funds/${activeFundId}/reconcile-stripe-gifts`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          toast({
            title: "Gift sync failed",
            description: text?.slice(0, 120) || "Could not sync Stripe gifts yet.",
            variant: "destructive",
          });
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data?.processed > 0) {
          invalidateActiveFundFreshness();
        }
        const next = new URLSearchParams(search || "");
        next.delete("syncGifts");
        const nextSearch = next.toString();
        window.history.replaceState({}, "", `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
      } catch {
        if (!cancelled) {
          toast({
            title: "Gift sync failed",
            description: "Could not reach Stripe sync. Retrying on next refresh.",
            variant: "destructive",
          });
        }
      }
    };

    reconcile();
    return () => {
      cancelled = true;
    };
  }, [activeFundId, invalidateActiveFundFreshness, search]);

  // Parent one-time contribution return - show warm confirmation and refresh memory book.
  //
  // The flow: user finishes Stripe checkout → Stripe redirects with
  // ?parentContrib=1&syncGifts=1. The companion `syncGifts` effect above
  // POSTs to /reconcile-stripe-gifts which finds the new Stripe session and
  // creates the gift row server-side. THIS effect then refreshes the client
  // queries.
  //
  // Why we bypass cache + poll: the dashboard-summary endpoint sets
  // Cache-Control: private, max-age=20. If the user returns within 20 seconds,
  // a plain refetch hits the browser's HTTP cache and returns the OLD
  // response (no new gift). Plus webhook delivery is async, so the gift may
  // not exist yet when we first refetch. We:
  //   1. Drop both relevant query caches.
  //   2. Force a fresh fetch with `cache: "no-store"` so the browser HTTP
  //      cache can't serve stale data.
  //   3. Poll a few times over the next ~10s — each refetch is no-store and
  //      stops as soon as the parent's email shows up in the gift list.
  // Without this, "I just contributed and nothing appeared" is the predictable
  // UX bug.
  useEffect(() => {
    const params = new URLSearchParams(search || "");
    if (params.get("parentContrib") !== "1") return;
    const ownerEmailLower = String(user?.email || "").trim().toLowerCase();
    // Lands the parent on the locked confirmation pattern (sprout + tagline)
    // — same register the recurring "done" step uses, same register every
    // gifter sees after gifting. The toast we used to show here was honest
    // ("Your money is on its way") but didn't carry the brand register; for a
    // success moment as load-bearing as "I just gave money to my kid's fund,"
    // a toast is too quiet.
    setParentContribDoneOpen(true);
    if (!activeFundId) return;
    // Comprehensive cache invalidation. Was only invalidating memory +
    // (implicitly) dashboard-summary via the polling below. That left
    // /api/activities (Activity feed + notifications bell + mobile
    // activity-tab unread dot), /api/me/scheduled (Scheduled tab's
    // totalContributed / lastRunDate / cycle count), and /api/funds
    // (balance reads, gifter rosters) all frozen with stale data — so
    // the parent saw the contribution land in Dashboard's gift list but
    // not in Activity or the bell. Invalidating everything that could
    // possibly carry contribution-derived data here means the new
    // parent_contribution row + any milestone rows (money_cross,
    // returning_gifter, unique_gifters, first_voice/photo) propagate
    // everywhere within one render cycle.
    void queryClient.invalidateQueries({ queryKey: ["memory", activeFundId] });
    void queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/me/scheduled"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "recurring-gifts"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "gifter-notifications"] });

    let cancelled = false;
    const summaryKey = ["/api/funds", activeFundId, "dashboard-summary"];
    const fetchFresh = async (): Promise<boolean> => {
      try {
        const res = await fetch(`/api/funds/${activeFundId}/dashboard-summary`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (cancelled) return true;
        queryClient.setQueryData(summaryKey, data);
        // True when the parent's contribution shows up — used as the
        // polling stop condition.
        const giftsList: Array<{ senderEmail?: string | null }> = Array.isArray(data?.gifts) ? data.gifts : [];
        const arrived = !ownerEmailLower
          ? giftsList.length > 0
          : giftsList.some((g) => String(g.senderEmail || "").trim().toLowerCase() === ownerEmailLower);
        // Webhook just finished writing the gift — that's also the moment
        // the parent_contribution activity row + any milestone rows are
        // landing. Re-invalidate the activity-side caches so they pull
        // the fresh state. Without this second invalidation, the FIRST
        // invalidation at the top of the effect ran when the webhook
        // hadn't finished yet, repopulated those queries with stale data,
        // and they wouldn't refetch again for 60s (staleTime).
        if (arrived) {
          void queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
          void queryClient.invalidateQueries({ queryKey: ["/api/me/scheduled"] });
          void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
        }
        return arrived;
      } catch {
        return false;
      }
    };
    // Backoff: 0s, 2s, 5s, 10s. Stops as soon as the gift appears so we
    // don't keep hammering after success.
    const delays = [0, 2_000, 5_000, 10_000];
    (async () => {
      for (const delay of delays) {
        if (cancelled) return;
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        const found = await fetchFresh();
        if (found) return;
      }
    })();

    const next = new URLSearchParams(search || "");
    next.delete("parentContrib");
    const nextSearch = next.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Sidebar "Share Emma's link" from non-dashboard page navigates here with ?openShare=1
  useEffect(() => {
    const params = new URLSearchParams(search || "");
    if (params.get("openShare") !== "1") return;
    const next = new URLSearchParams(search || "");
    next.delete("openShare");
    const nextSearch = next.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
    if (activeFund?.slug) {
      setShareModalOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, activeFund?.slug]);

  // Sidebar "Emma's View" from non-dashboard page navigates here with ?openKidView=1
  useEffect(() => {
    const params = new URLSearchParams(search || "");
    if (params.get("openKidView") !== "1") return;
    const next = new URLSearchParams(search || "");
    next.delete("openKidView");
    const nextSearch = next.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
    setKidViewConfigStep(kidViewSettings?.enabled ? "done" : "settings");
    setKidViewConfigOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, kidViewSettings?.enabled]);

  // Notification deep link: ?openAutoInvest=1
  useEffect(() => {
    const params = new URLSearchParams(search || "");
    if (params.get("openAutoInvest") !== "1") return;
    const next = new URLSearchParams(search || "");
    next.delete("openAutoInvest");
    const nextSearch = next.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
    if (hasAutoInvestAccess) {
      setEditingContribId(null);
      setAutoInvestStep("amount");
      setAutoInvestModalOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, hasAutoInvestAccess]);

  // Notification deep link: ?section=holdings - scroll to holdings after data loads
  useEffect(() => {
    const params = new URLSearchParams(search || "");
    if (params.get("section") !== "holdings") return;
    const next = new URLSearchParams(search || "");
    next.delete("section");
    const nextSearch = next.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
    const el = holdingsSectionRef.current;
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data: recurringGifts = [], isLoading: recurringLoading } = useQuery<RecurringGift[]>({
    queryKey: ["/api/funds", activeFundId, "recurring-gifts"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundId}/recurring-gifts`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeFundId && isFamily && dashboardSummaryError,
    initialData: () => dashboardSummary?.recurringGifts,
  });

  const { data: dashboardThankYous = [] } = useQuery<any[]>({
    queryKey: ["/api/funds", activeFundId, "thank-yous"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundId}/thank-yous`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeFundId && isAuthenticated,
    staleTime: 60_000,
  });

  const dashboardThankYouByGiftId = useMemo(() => {
    const map = new Map<string, any>();
    for (const ty of dashboardThankYous) {
      if (ty.giftId) map.set(String(ty.giftId), ty);
    }
    return map;
  }, [dashboardThankYous]);

  const { data: parentContributions = [], refetch: refetchParentContributions } = useQuery<ParentContribution[]>({
    queryKey: ["/api/funds", activeFundId, "parent-contributions"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundId}/parent-contributions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeFundId && hasAutoInvestAccess,
    staleTime: Infinity, // data is fed by dashboardSummary effect; only fetches on explicit refetch/invalidation
    initialData: () => dashboardSummary?.parentContributions,
  });
  const activeAutoInvest = parentContributions.find((c) => c.status === "active");
  const pausedAutoInvest = parentContributions.find((c) => c.status === "paused");

  // ===== Detail history modal (per-schedule + all-contributions) =====
  // Same generic modal Activity uses, mounted at Dashboard's page root so
  // tapping the History icon on a recurring card OR the "View all
  // contributions →" link on the Last contribution card opens the rich
  // detail view without forcing a navigation to /activity. Activity feed
  // is pulled from the same query Activity uses (cache-shared).
  const { data: dashboardActivityFeed = [] } = useActivities(
    200,
    !!activeFundId && isAuthenticated,
    activeFundId,
  );
  type DetailScope =
    | { kind: "schedule"; scheduleId: string }
    | { kind: "contributions" }
    | null;
  const [detailScope, setDetailScope] = useState<DetailScope>(null);
  const [contributionsSubFilter, setContributionsSubFilter] = useState<"all" | "recurring" | "onetime">("all");
  // Honor ?detail= on first mount so notification deep-links land directly
  // inside the right scope without a second tap. URL gets cleaned on close.
  const detailSearchString = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(detailSearchString);
    const raw = params.get("detail");
    if (!raw) return;
    if (raw === "contributions") {
      setDetailScope({ kind: "contributions" });
      return;
    }
    const m = raw.match(/^schedule:(.+)$/);
    if (m && m[1]) setDetailScope({ kind: "schedule", scheduleId: m[1] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Honor ?openManage={id} so other surfaces (Activity's detail modal,
  // notification deep-links, etc.) can open Dashboard's Edit / Pause /
  // Cancel action sheet directly. Param is consumed once per mount and
  // stripped from the URL so back-then-forward doesn't reopen.
  useEffect(() => {
    const params = new URLSearchParams(detailSearchString);
    const id = params.get("openManage");
    if (!id) return;
    setListActionConfirmCancel(false);
    setListActionContribId(id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("openManage");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // best-effort URL cleanup
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeDetailScope = useCallback(() => {
    setDetailScope(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("detail");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // best-effort URL cleanup
    }
  }, []);
  const openDetailScope = useCallback((scope: NonNullable<DetailScope>) => {
    haptic("selection");
    setDetailScope(scope);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set(
        "detail",
        scope.kind === "schedule" ? `schedule:${scope.scheduleId}` : "contributions",
      );
      window.history.replaceState({}, "", url.toString());
    } catch {
      // best-effort URL cleanup
    }
  }, []);
  const milestoneAutoInvestLevel = rawTotalValue >= 5000
    ? 5000
    : rawTotalValue >= 1000
      ? 1000
      : rawTotalValue >= 500
        ? 500
        : 0;
  const shouldShowMilestoneAutoInvestPrompt = milestoneAutoInvestLevel > 0 && !activeAutoInvest;
  const activeAutoInvestBank = activeAutoInvest?.bankAccountId
    ? bankAccounts.find((bank: any) => bank.id === activeAutoInvest.bankAccountId)
    : null;

  useEffect(() => {
    if (giftToastDismissed || !gifts.length) return;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    // Iterate every recent gift (not just the first) and pick the
    // newest that hasn't already been dismissed. Previously `.find()`
    // returned only the first match; if it had been dismissed, we
    // never looked at the next-newest candidate, so a freshly-arrived
    // gift could fail to surface its toast.
    const recent = gifts.find((g) => {
      const createdAt = g.createdAt ? new Date(g.createdAt).getTime() : 0;
      if (createdAt <= oneDayAgo) return false;
      return !isGiftToastDismissed(String(g.id || ""));
    });
    if (recent) {
      setRecentGiftForToast(recent);
      // Persist dismissal the moment we queue the toast. The toast
      // appearing IS the surfacing; we should not require an explicit
      // user interaction (manual X, View activity, or the 7s auto-
      // dismiss timer) for the dismissal to stick. Same model iOS uses
      // for notifications on the lock screen: showing it counts.
      //
      // Why this matters: user-reported 2026-05-20 that they saw the
      // gift toast yesterday and it re-appeared today as if the gift
      // were new. Root cause was passive non-dismissal (close tab
      // without clicking) leaving the gift id out of the dismissed
      // set. Within the 24-hour window the toast re-fires on next
      // session. The 7-second auto-dismiss timer was supposed to
      // catch this but the GiftReceivedToast's [onDismiss] effect
      // dep was re-running the timer on every parent render (inline
      // arrow function = new identity), so the timer almost never
      // reached zero in practice.
      //
      // Persisting on queue rather than on dismiss is the more
      // defensive design. The gift is durably visible in the bell
      // panel, Memory Book, and Activity feed regardless of whether
      // the toast was seen, so losing the toast to passive close is
      // acceptable. The toast is a transient nudge, not the
      // canonical surfacing.
      markGiftToastDismissed(String(recent.id || ""));
    }
  }, [gifts, giftToastDismissed]);

  // (Removed: the effect that surfaced `pendingGiftNotice`. See note on
  // the deleted state above — the banner pattern was the wrong shape for
  // routine settlement awareness, and the status pill on each pending
  // gift + the new `$X settling` summary line cover the same job
  // without screaming.)

  useEffect(() => {
    if (!activeFundId || !recentGiftForToast || isFundCovered) return;
    const giftId = String(recentGiftForToast.id || "");
    if (!giftId) return;
    const storageKey = `kora:coverage-prompt:${giftId}`;
    if (window.localStorage.getItem(storageKey) === "shown") return;
    const timer = window.setTimeout(() => {
      setShowCoverageUpgradeModal(true);
      window.localStorage.setItem(storageKey, "shown");
    }, 900);
    return () => window.clearTimeout(timer);
  }, [activeFundId, recentGiftForToast, isFundCovered]);

  const recentGifts30Days = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return gifts.filter((gift) => {
      const createdAt = gift.createdAt ? new Date(gift.createdAt).getTime() : 0;
      return Number.isFinite(createdAt) && createdAt >= cutoff;
    });
  }, [gifts]);

  const chosenTickerSet = useMemo(() => new Set(
    gifts
      .filter(g => String(g.executionModel || "").toLowerCase() === "pick" && g.selectedTicker)
      .map(g => String(g.selectedTicker).toUpperCase())
  ), [gifts]);

  // Most recent one-time gift FROM THE PARENT themselves.
  // Used to seed the One-time card with last-gift context + a "Send again" repeat CTA.
  // Filters: senderEmail matches the logged-in user, status is invested, executionModel is pick or auto
  // (excludes family/legacy redirects). Returns null if the parent hasn't sent a one-time gift yet.
  const lastOwnGift = useMemo(() => {
    const ownerEmail = String(user?.email || "").trim().toLowerCase();
    if (!ownerEmail) return null;
    const candidates = gifts
      .filter(g => {
        const status = String(g.status || "").toLowerCase();
        if (status !== "invested" && status !== "settled") return false;
        const exec = String(g.executionModel || "").toLowerCase();
        if (exec !== "pick" && exec !== "auto") return false;
        const email = String((g as any).senderEmail || "").trim().toLowerCase();
        return email === ownerEmail;
      })
      .sort((a, b) => new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime());
    if (candidates.length === 0) return null;
    const g = candidates[0];
    const amount = parseFloat(String(g.netAmount || g.amount || "0"));
    const ticker = String((g as any).selectedTicker || "").toUpperCase();
    const shares = (g as any).sharesAcquired ? parseFloat(String((g as any).sharesAcquired)) : null;
    // Resolve via the shared helper so LEGACY tickers (e.g. Z → Zillow 🏠) keep their
    // name + emoji even when removed from the active picker.
    const meta = ticker ? lookupPickMeta(ticker, quotedAutoInvestStocks) : null;
    return {
      id: g.id,
      amount,
      ticker: ticker || null,
      tickerName: meta?.name || (ticker || null),
      tickerEmoji: meta?.emoji || null,
      executionModel: String(g.executionModel || "auto").toLowerCase(),
      shares,
      createdAt: g.createdAt ? String(g.createdAt) : null,
    };
  }, [gifts, user?.email, quotedAutoInvestStocks]);

  // Tickers that the ACTIVE managed strategy currently buys.
  // Used to gate sell-confirmations (managed-mix holdings get a warm warning + "Customize instead" CTA).
  const managedStrategyTickerSet = useMemo<Set<string>>(() => {
    const strategyName = investPrefs?.managedStrategy ?? "growth";
    const allocs = strategyName === "custom" && fundStrategy?.customAllocations
      ? Object.keys(fundStrategy.customAllocations).map(t => t.toUpperCase())
      : (MANAGED_STRATEGY_ALLOCATIONS[strategyName] ?? MANAGED_STRATEGY_ALLOCATIONS.growth).map(a => a.ticker.toUpperCase());
    return new Set(allocs);
  }, [investPrefs?.managedStrategy, fundStrategy?.customAllocations]);
  // (Note: everManagedTickerSet — the broader "ever-managed" union —
  // is hoisted above into the giftAllocations / computeGiftCurrentValue
  // block so the resolver can use it. See its declaration up there.)

  const gifterRoster = useMemo<GifterProfile[]>(() => {
    const map = new Map<string, GifterProfile>();
    for (const g of gifts) {
      const status = String(g.status || "").toLowerCase();
      if (status === "failed" || status === "refunded") continue;
      const rawName = displayGifterName(g.senderName, (g as any).isAnonymous);
      const key = rawName.toLowerCase();
      const net = parseFloat(String(g.netAmount || g.amount || "0"));
      const existing = map.get(key);
      if (existing) {
        existing.giftCount += 1;
        existing.totalNetAmount += Number.isFinite(net) ? net : 0;
        if (g.createdAt) {
          const ts = new Date(String(g.createdAt)).getTime();
          if (!existing.lastGiftDate || ts > new Date(existing.lastGiftDate).getTime()) {
            existing.lastGiftDate = String(g.createdAt);
          }
        }
        existing.gifts.push(g);
      } else {
        const parts = rawName.trim().split(/\s+/);
        const initials = parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : rawName.slice(0, 2).toUpperCase();
        map.set(key, {
          name: rawName,
          initials,
          colorIdx: gifterColorIdx(rawName),
          giftCount: 1,
          totalNetAmount: Number.isFinite(net) ? net : 0,
          lastGiftDate: g.createdAt ? String(g.createdAt) : null,
          gifts: [g],
        });
      }
    }
    // Sort by RECENCY (most recent gift first), not total amount. Sorting
    // by amount made the most generous gifter appear first — leaderboard
    // energy that contradicts the memory rule "each gift is sacred
    // regardless of size." Recency answers a warmer question: "who's
    // loving Emma lately?" Anonymous group is filtered out at render
    // time and placed last, so its position here doesn't matter.
    return Array.from(map.values()).sort((a, b) => {
      const ta = a.lastGiftDate ? new Date(a.lastGiftDate).getTime() : 0;
      const tb = b.lastGiftDate ? new Date(b.lastGiftDate).getTime() : 0;
      return tb - ta;
    });
  }, [gifts]);

  const recentGiftsFeed = useMemo(() => {
    return [...gifts]
      .filter(g => {
        const status = String(g.status || "").toLowerCase();
        return status !== "failed" && status !== "refunded";
      })
      .sort((a, b) => new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime());
  }, [gifts]);

  // Reset hero gift index when switching funds
  useEffect(() => { setHeroGiftIdx(0); }, [activeFundId]);

  // New-gift arrival cue. Watches the id at index 0 of the recent-gifts
  // feed: when it changes (and it's not the first paint or a fund swap),
  // a fresh gift just landed via the polling tick. We:
  //   1. Snap the carousel to index 0 so the parent sees the new gift,
  //      not whatever was rotating in.
  //   2. Hold the carousel there for ~3.8s by pausing the auto-cycle
  //      below — the prior 4.5s cycle could swap the new gift away
  //      before the parent's eyes returned to the hero.
  //   3. Flip `newGiftFlash` true for the same ~3.8s, which a) keeps the
  //      balance's gold/glow cue lit past the ~900ms count-up so the
  //      arrival lingers, and b) wraps the gift card in a gold border +
  //      soft halo so the eye gets pulled there without sparkles or
  //      confetti (banned per animation primitives).
  // The card itself is keyed by gift id (see render below), so even when
  // the user is already parked on index 0, swapping to a different gift
  // id still drives an enter/exit animation rather than silently
  // re-rendering the contents.
  const lastSeenGiftIdRef = useRef<string | null>(null);
  const [newGiftFlash, setNewGiftFlash] = useState(false);
  const latestGiftId = recentGiftsFeed[0]?.id ?? null;
  useEffect(() => {
    if (!latestGiftId) return;
    if (lastSeenGiftIdRef.current === null) {
      lastSeenGiftIdRef.current = latestGiftId;
      return;
    }
    if (latestGiftId === lastSeenGiftIdRef.current) return;
    lastSeenGiftIdRef.current = latestGiftId;
    setHeroGiftIdx(0);
    setNewGiftFlash(true);
    const t = setTimeout(() => setNewGiftFlash(false), 3800);
    return () => clearTimeout(t);
  }, [latestGiftId]);

  // When the parent switches funds, reset the arrival baseline so the
  // newly-active fund's index-0 gift doesn't read as a fresh arrival on
  // the next render (it isn't — it's just a different fund being shown).
  useEffect(() => {
    lastSeenGiftIdRef.current = null;
    setNewGiftFlash(false);
  }, [activeFundId]);

  // Carousel container height: locks to the ACTIVE page's offsetHeight, with
  // a CSS `transition: height 0.22s ease` on the container animating between
  // page heights as the user swipes. Each page sits at its natural height; no
  // empty space below the shorter page. (Earlier max(p1,p2) variant reserved
  // the taller page's height permanently — empty space below Page 2.)
  //
  // 2026-05-12: Page 1 (Holdings) now stacks chosen-with-love above managed
  // mix on ALL viewports (was md:flex-row md:items-start). The previous
  // side-by-side desktop layout could leave a column-imbalance gap inside p1
  // when one section had more rows than the other — that gap sat below the
  // shorter column, inside the carousel container, before the page switcher.
  // Stack-always eliminates the imbalance entirely.
  useEffect(() => {
    const p1 = carouselPage1Ref.current;
    const p2 = carouselPage2Ref.current;
    if (!p1 || !p2) return;
    const update = () => {
      // Carousel height tracks the ACTIVE page, not the max of both.
      // Previously used Math.max(p1, p2) to avoid clipping during swipe,
      // but that reserved the taller page's height permanently — leaving
      // visible whitespace below the shorter page (the donut Breakdown,
      // and after the section-summary lines shipped, sometimes the
      // Holdings list too). The CSS `transition: height 0.22s ease` on
      // the carousel container animates the height change as the user
      // swipes between pages, so each page sits at its natural height
      // and the gap is gone. Off-screen page content is horizontally
      // scrolled away and the container's overflowY: hidden clips any
      // vertical bleed during transition — no visual artifact.
      const activePage = holdingsV2Page === 0 ? p1 : p2;
      const h = activePage.offsetHeight;
      if (h > 0) setCarouselHeight(h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(p1);
    ro.observe(p2);
    return () => ro.disconnect();
  }, [holdings.length, holdingsV2Page]);

  // Auto-cycle through recent gifts in the hero. Paused while
  // `newGiftFlash` is true so a freshly-arrived gift stays on screen
  // long enough for the parent to read it — without this, the 4.5s
  // cycle could rotate the new gift off before they looked back at
  // the hero.
  useEffect(() => {
    if (recentGiftsFeed.length <= 1) return;
    if (newGiftFlash) return;
    const timer = setInterval(() => {
      setHeroGiftIdx(i => (i + 1) % Math.min(recentGiftsFeed.length, 5));
    }, 4500);
    return () => clearInterval(timer);
  }, [recentGiftsFeed.length, newGiftFlash]);

  const uncoveredFeesThisMonth = useMemo(() => {
    if (isFundCovered) return 0;
    return recentGifts30Days.reduce((sum, gift) => {
      const amount = parseFloat(gift.amount || "0");
      return sum + calculateKoraContributionFee(amount, "free").total;
    }, 0);
  }, [isFundCovered, recentGifts30Days]);
  const shouldShowCumulativeCoveragePrompt =
    !isFundCovered &&
    recentGifts30Days.length >= 3 &&
    uncoveredFeesThisMonth >= KORA_STARTER_MONTHLY;

  useEffect(() => {
    if (!activeFundId || !recentGiftForToast || isFundCovered) return;
    void trackMonetizationTrigger(MONETIZATION_TRIGGER_IDS.contributionLanding, "viewed", {
      coverageState: activeCoverageState,
    });
  }, [activeFundId, recentGiftForToast, isFundCovered, activeCoverageState]);

  useEffect(() => {
    if (!activeFundId || !shouldShowCumulativeCoveragePrompt) return;
    void trackMonetizationTrigger(MONETIZATION_TRIGGER_IDS.cumulativeFees, "viewed", {
      giftCount30Days: recentGifts30Days.length,
      feesThisMonth: uncoveredFeesThisMonth,
    });
  }, [activeFundId, shouldShowCumulativeCoveragePrompt, recentGifts30Days.length, uncoveredFeesThisMonth]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SkeletonBlock className="w-12 h-12 rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const balance = parseFloat(activeFund?.balance || "0");
  const pendingBalance = parseFloat(activeFund?.pendingBalance || "0");
  const totalGain = parseFloat(activeFund?.totalGain || "0");
  const gainPercent = parseFloat(activeFund?.gainPercent || "0");
  // `invested` and `totalValue` derive from holdings.currentValue (current
  // market value) — same source as the holdings card's chosen + managed
  // section totals, so all three numbers on the dashboard agree. Earlier
  // these used f.balance directly, which created drift vs the section
  // totals (f.balance is the manually-incremented cost-basis-style field;
  // sum of holdings.currentValue reflects current market). Falls back to
  // f.balance when holdings array is empty (brand new fund or pre-fetch).
  const investedCurrentValue = holdings.reduce((sum, h) => sum + parseFloat(h.currentValue || "0"), 0);
  const investedCostBasis = holdings.reduce((sum, h) => sum + parseFloat(h.costBasis || "0"), 0);
  const invested = holdings.length > 0 ? investedCurrentValue : balance;
  const cash = cashBalance;
  const settling = pendingBalance;
  const uninvestedCash = cash + settling;
  const totalValue = invested + pendingBalance + cashBalance;
  // Compute gain from holdings data (more reliable than server-side totalGain which may be stale)
  const computedInvestedGain = investedCurrentValue - investedCostBasis;
  const computedInvestedGainPct = investedCostBasis > 0 ? (computedInvestedGain / investedCostBasis) * 100 : 0;
  // Prefer server-side gain if it's non-zero (updated by price job), fall back to computed
  const displayGain = (totalGain !== 0 || gainPercent !== 0) ? totalGain : computedInvestedGain;
  const displayGainPct = (totalGain !== 0 || gainPercent !== 0) ? gainPercent : computedInvestedGainPct;
  const isGain = displayGain >= 0;

  const age18Transition = getAge18Transition(
    activeFund?.recipientBirthdate,
    Number((activeFund as any)?.majorityAge) || 18,
  );

  // Hero projection-at-65 — same two-phase model the inline IIFE near
  // line 4160 was computing locally, lifted here so the cached-first-
  // number hook (which can't be called inside an IIFE) can drive the
  // count-up animation. Inputs available at this scope: totalValue,
  // age18Transition, parentContributions, sumMonthlyEquivalent. 7%
  // assumption matches every other long-horizon projection in the app
  // (Age18Plan, Projection page, smart nudges) — one number, one
  // disclaimer line everywhere.
  const heroProjectedAt65 = useMemo(() => {
    const annualRate = 0.07;
    const monthRate = annualRate / 12;
    const yearsTo18 = age18Transition
      ? Math.max(0, age18Transition.daysUntil18 / 365.25)
      : 0;
    const currentAge = age18Transition ? Math.max(0, 18 - yearsTo18) : 0;
    const yearsTo65 = Math.max(0, 65 - currentAge);
    const activeMonthly = sumMonthlyEquivalent(
      (parentContributions as any[]).filter(
        (c) => String(c?.status || "").toLowerCase() === "active",
      ),
    );
    const phase1Months = Math.round(Math.min(yearsTo18, yearsTo65) * 12);
    const phase2Months = Math.max(0, Math.round((yearsTo65 - yearsTo18) * 12));
    const phase1Lump = totalValue * Math.pow(1 + monthRate, phase1Months);
    const phase1Annuity =
      activeMonthly > 0 && monthRate > 0 && phase1Months > 0
        ? activeMonthly * ((Math.pow(1 + monthRate, phase1Months) - 1) / monthRate)
        : 0;
    const valueAt18 = phase1Lump + phase1Annuity;
    return Math.max(0, Math.round(valueAt18 * Math.pow(1 + monthRate, phase2Months)));
  }, [totalValue, age18Transition, parentContributions]);

  const {
    displayValue: displayHeroProjectedAt65,
  } = useCachedFirstNumber({
    seedValue: cachedHeroProjectionAt65,
    liveValue: heroProjectedAt65,
    // 1200ms matches the hero balance — both numbers belong to the same
    // focal hero moment and should ride the same duration ladder rung
    // (per project_count_up_animation_consistency.md).
    duration: 1200,
  });

  // Persist the live projection per-fund so the next session seeds the
  // count-up from the last known projection. Same pattern as the balance
  // cache write above.
  useEffect(() => {
    if (!activeFundId || !heroProjectedAt65 || !Number.isFinite(heroProjectedAt65) || heroProjectedAt65 <= 0) return;
    writeLocalCache(`${FUND_PROJECTION_AT_65_CACHE_PREFIX}${activeFundId}`, heroProjectedAt65);
  }, [activeFundId, heroProjectedAt65]);

  // Smart nudge: fire once per month on positive signals (performance, streak, milestone)
  // Must live AFTER activeAutoInvest, totalValue, and age18Transition are declared.
  // Suppress entirely for read-only roles (previous owner, viewer) — the nudge's CTA
  // is "Adjust recurring", which is a parent-control action the role can't perform.
  useEffect(() => {
    if (!activeFundId || !hasAutoInvestAccess || !activeAutoInvest || fundHistory.length < 2) return;
    if (isReadOnlyFund) return;
    const NUDGE_KEY = `kiddo.smartNudge.lastShown.${activeFundId}`;
    const lastShown = localStorage.getItem(NUDGE_KEY);
    const now = Date.now();
    if (lastShown && now - parseInt(lastShown, 10) < 30 * 24 * 60 * 60 * 1000) return;
    const fundCreated = activeFund?.createdAt ? new Date(activeFund.createdAt).getTime() : now;
    if (now - fundCreated < 30 * 24 * 60 * 60 * 1000) return;

    const monthlyAmt = parseFloat(activeAutoInvest.amount || "0");
    const daysUntil18 = age18Transition?.daysUntil18 ?? null;
    const yearsLeft = daysUntil18 ? daysUntil18 / 365.25 : null;
    // Smart-nudge projections now route through projectFundValue so the
    // "if you doubled your recurring, your fund would be worth $X
    // instead" math uses the same fee-netted, effective-rate-compounded
    // assumptions as every other surface. Migrated from raw
    // Math.pow(1.07, yearsLeft) plus an inline FV-of-annuity formula
    // (with yearly-not-monthly compounding inside) on 2026-05-21 as
    // part of the projection-helper consolidation sweep. Previously
    // the smart-nudge numbers ran slightly higher than the Dashboard
    // hero / Age 18 Plan / Calculator projections; now consistent.
    const currentProjection = yearsLeft && totalValue > 0
      ? projectFundValue({
          startingValue: totalValue,
          monthlyContribution: monthlyAmt > 0 ? monthlyAmt : 0,
          yearsAhead: yearsLeft,
        })
      : null;
    const doubledProjection = yearsLeft && currentProjection && monthlyAmt > 0
      ? projectFundValue({
          startingValue: totalValue,
          monthlyContribution: monthlyAmt * 2,
          yearsAhead: yearsLeft,
        })
      : null;

    // Scenario 1: outperforming (9%+)
    const oldest = fundHistory[fundHistory.length - 1];
    const newest = fundHistory[0];
    const principal = parseFloat(newest?.principalBasis || oldest?.principalBasis || "0");
    const oneYearReturn = principal > 0 && totalValue > 0
      ? ((totalValue - principal) / principal) * 100
      : 0;
    if (oneYearReturn >= 9 && currentProjection && doubledProjection && monthlyAmt > 0) {
      setSmartNudge({ scenario: "outperforming", returnPct: Math.round(oneYearReturn * 10) / 10, currentMonthlyAmt: monthlyAmt, doubledAmt: monthlyAmt * 2, currentProjection, doubledProjection });
      localStorage.setItem(NUDGE_KEY, String(now));
      return;
    }

    // Scenario 2: consistent streak (3+ months)
    const createdAt = activeAutoInvest.createdAt ? new Date(activeAutoInvest.createdAt).getTime() : null;
    const monthsRunning = createdAt ? Math.floor((now - createdAt) / (30 * 24 * 60 * 60 * 1000)) : 0;
    if (monthsRunning >= 3 && currentProjection && doubledProjection && monthlyAmt > 0 && oneYearReturn >= 0) {
      setSmartNudge({ scenario: "consistent", streakMonths: monthsRunning, currentMonthlyAmt: monthlyAmt, doubledAmt: monthlyAmt * 2, currentProjection, doubledProjection });
      localStorage.setItem(NUDGE_KEY, String(now));
      return;
    }

    // Scenario 3: milestone hit — never show when fund is down.
    //
    // Two bug fixes here (2026-05-15 timing audit):
    //
    //  1. THRESHOLDS aligned with the server. The local list was a
    //     subset [500, 1K, 5K, 10K] of the server's canonical
    //     MONEY_CROSS_THRESHOLDS [100, 500, 1K, 2.5K, 5K, 10K, 25K, ...].
    //     A fund crossing $100, $2,500, $25K+ fired an activity row
    //     on the server but no client celebration nudge — the parent
    //     felt the milestone silently happen. Now sourced from
    //     shared/milestones.ts so both surfaces are in lockstep.
    //
    //  2. monthsToNext math was lying. The old code computed
    //     `ceil(hitMilestone / monthlyAmt)` — months for contributions
    //     ALONE to accumulate ANOTHER chunk equal to the current
    //     milestone. So a fund just crossed $500 with $50/month said
    //     "the next $500 in 10 months" but ignored: existing balance,
    //     compound growth, and the actual next threshold ($1,000 from
    //     this list, not another $500). The honest computation
    //     simulates month-by-month: starting from current balance,
    //     applies 7% net-of-fee monthly growth plus monthly
    //     contribution, counts months until next threshold is hit.
    //     Capped at 120 months — anything past 10 years is too far
    //     out to read as "at your current pace."
    const prevValue = parseFloat(fundHistory[1]?.totalValue || "0");
    // Skip the milestone nudge when prevValue is 0 (or missing). A
    // brand-new fund with sparse history sets fundHistory[1] to
    // either undefined or a snapshot from before any gifts settled,
    // so prevValue collapses to 0. The find() below would then
    // return the SMALLEST threshold ≤ totalValue — a fund at
    // $1,917 would celebrate "just crossed $100" even though it
    // crossed $100 months ago. With prevValue > 0 required, the
    // smart-nudge only fires when we have a real previous snapshot
    // to anchor the crossing claim to. The server-side milestone
    // engine (server/milestones.ts fireMoneyCrossMilestones) still
    // fires the activity row + Memory Book entry on legitimate
    // first-gift crossings — this gate only suppresses the
    // SECONDARY "Adjust recurring" nudge, not the celebration row.
    const hitMilestone = prevValue > 0
      ? MONEY_CROSS_THRESHOLDS.find((m) => totalValue >= m && prevValue < m)
      : undefined;
    if (hitMilestone && monthlyAmt > 0 && currentProjection && oneYearReturn >= 0) {
      const nextMilestone = MONEY_CROSS_THRESHOLDS.find((m) => m > hitMilestone) ?? null;
      // Month-by-month simulation. Uses the locked Kiddo projection
      // rule: 7% historical average annual return, 0.10% AUM fee
      // netted, monthly compounding. Same math the rest of the app
      // uses via shared/projection.ts.
      const monthsToReach = (target: number, monthly: number): number | null => {
        if (!target || target <= totalValue) return 0;
        const monthlyRate = (0.07 - 0.001) / 12; // 7% gross minus 0.10% AUM fee
        let balance = totalValue;
        for (let m = 1; m <= 120; m += 1) {
          balance = balance * (1 + monthlyRate) + monthly;
          if (balance >= target) return m;
        }
        return null; // beyond 10 years; don't claim an estimate
      };
      const monthsAtCurrent = nextMilestone ? monthsToReach(nextMilestone, monthlyAmt) : null;
      const monthsDoubled = nextMilestone ? monthsToReach(nextMilestone, monthlyAmt * 2) : null;
      // Skip the entire nudge if monthsToReach returned 0 (fund is
      // already past the next milestone too — stale celebration
      // attempt). Also skip if no next milestone exists (fund is at
      // the top $100K threshold — no projection to show). Without
      // these guards we'd show an empty/awkward modal and trigger
      // the React-renders-0-as-text bug that motivated this fix.
      if (!nextMilestone || !monthsAtCurrent || monthsAtCurrent <= 0) {
        return;
      }
      setSmartNudge({
        scenario: "milestone",
        milestoneAmt: hitMilestone,
        nextMilestoneAmt: nextMilestone,
        currentMonthlyAmt: monthlyAmt,
        doubledAmt: monthlyAmt * 2,
        currentProjection,
        doubledProjection: doubledProjection ?? undefined,
        monthsAtCurrentRate: monthsAtCurrent,
        // Only carry the doubled-pace months if it's a real positive
        // estimate. 0 (already past) or null (>10 years out) suppress
        // the "At $X/mo, in N months" trailing copy.
        monthsDoubled: monthsDoubled && monthsDoubled > 0 ? monthsDoubled : undefined,
      });
      localStorage.setItem(NUDGE_KEY, String(now));
    }
  }, [activeFundId, fundHistory, activeAutoInvest, totalValue, age18Transition, hasAutoInvestAccess, activeFund?.createdAt, isReadOnlyFund]);

  const cashContext: CashContext = (() => {
    if (activeFund?.status !== "active") return "kyc_pending";
    if (activeFund?.investmentStrategy === "cash") return "held_as_cash";
    return "gifts_settled";
  })();

  const activeEvents = events.filter((e) => e.status === "active" && !e.isPermanent);
  const archivedEvents = events.filter((e) => (e.status === "archived" || e.status === "closed") && !e.isPermanent);

  const recentGifts = [...gifts]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);
  const recentFundTransactions = [...fundTransactions]
    .sort((a, b) => getTransactionTimestamp(b) - getTransactionTimestamp(a))
    .slice(0, 6);
  // Contributor count: each named gifter = 1, each anonymous gift = 1 contributor.
  // Anonymous gifts are treated as distinct people since we can't link them.
  const contributorCount = (() => {
    const named = gifterRoster.filter(g => g.name !== "Anonymous").length;
    const anonGifts = gifterRoster.find(g => g.name === "Anonymous")?.giftCount ?? 0;
    return named + anonGifts;
  })();
  const giftsThisMonth = gifts.filter((gift) => {
    const createdAt = gift.createdAt ? new Date(gift.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
    const now = new Date();
    return createdAt.getFullYear() === now.getFullYear() && createdAt.getMonth() === now.getMonth();
  }).length;
  const heroMomentumLine =
    contributorCount >= 2
      ? `${contributorCount} people have gifted`
      : giftsThisMonth >= 2
        ? `${giftsThisMonth} gifts this month`
        : gifts.length === 1
          ? "The first gift has landed"
          : null;
  const dashboardMoneyMath = calculateDashboardMoneyMath({
    invested,
    cash,
    settling,
    investedCostBasis,
    gifts,
    parentContributions,
  });
  const investedPrincipal = dashboardMoneyMath.investedPrincipal;
  const currentFundBasis = dashboardMoneyMath.currentFundBasis;
  const displayContributionValue = dashboardMoneyMath.displayContributionValue;
  const contributionLabel = dashboardMoneyMath.contributionLabel;
  const startOfToday = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }, []);
  const todaysSellTotal = fundTransactions.reduce((sum, transaction) => {
    if (String(transaction.type || "").toLowerCase() !== "sell") return sum;
    const timestamp = getTransactionTimestamp(transaction);
    if (timestamp < startOfToday) return sum;
    const amount = parseFloat(transaction.amount || "0");
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const todaysBuyTotal = fundTransactions.reduce((sum, transaction) => {
    if (String(transaction.type || "").toLowerCase() !== "buy") return sum;
    const timestamp = getTransactionTimestamp(transaction);
    if (timestamp < startOfToday) return sum;
    const amount = parseFloat(transaction.amount || "0");
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const cashMovementLine = todaysSellTotal > 0
    ? `${formatCurrency(todaysSellTotal)} moved to cash today`
    : todaysBuyTotal > 0
      ? `${formatCurrency(todaysBuyTotal)} invested today`
      : null;
  const principalBasis = currentFundBasis;
  const totalReturnVsPrincipal = dashboardMoneyMath.totalReturnVsPrincipal;
  const totalReturnPctVsPrincipal = currentFundBasis > 0 ? (totalReturnVsPrincipal / currentFundBasis) * 100 : 0;
  // Parent-facing growth — `currentValue − contributions`. Used by the
  // headline Growth stat and hero gain badge so a parent reading "you gave
  // $1,350, the fund is now worth $1,550" naturally lands on +$200, not
  // the cost-basis-relative −$225 (which can diverge when sales /
  // reinvestments / test data inflate basis).
  const totalReturnVsContributions = dashboardMoneyMath.totalReturnVsContributions;
  const lifetimeContribPrincipal = dashboardMoneyMath.lifetimeContributionPrincipal;
  const totalReturnPctVsContributions = lifetimeContribPrincipal > 0 ? (totalReturnVsContributions / lifetimeContribPrincipal) * 100 : 0;
  const usableFundHistory = useMemo(() => {
    if (totalValue <= 0) return fundHistory;
    const maxReasonablePriorValue = Math.max(totalValue * 4, totalValue + 5000);
    return fundHistory.filter((point) => {
      const value = parseFloat(point.totalValue || "0");
      return !Number.isFinite(value) || value <= maxReasonablePriorValue;
    });
  }, [fundHistory, totalValue]);

  // Today's change: compare current value to the most recent prior-day snapshot
  const todayChange = useMemo(() => {
    if (!usableFundHistory.length || totalValue === 0) return null;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sorted = [...usableFundHistory]
      .map((p) => ({ ts: new Date(p.snapshotDate || 0).getTime(), value: parseFloat(p.totalValue || "0") }))
      .filter((p) => Number.isFinite(p.ts) && p.ts > 0)
      .sort((a, b) => b.ts - a.ts);
    const priorSnapshot = sorted.find((p) => p.ts < todayStart.getTime());
    if (!priorSnapshot || priorSnapshot.value === 0) return null;
    const rawDelta = totalValue - priorSnapshot.value;
    if (todaysSellTotal > 0 && Math.abs(rawDelta - todaysSellTotal) <= Math.max(1, todaysSellTotal * 0.03)) {
      return null;
    }
    const delta = rawDelta;
    const pct = (delta / priorSnapshot.value) * 100;
    return { delta, pct };
  }, [usableFundHistory, totalValue, todaysSellTotal]);

  // Range gain: gain over the selected chart period (synced to the chart range selector)
  const rangeGain = useMemo(() => {
    if (!usableFundHistory.length || totalValue === 0) return null;
    const now = new Date();
    const createdTs = activeFund?.createdAt ? new Date(activeFund.createdAt).getTime() : null;
    const cutoff = getChartRangeCutoff(chartRange, now, createdTs);
    const sorted = [...usableFundHistory]
      .map((p) => ({ ts: new Date(p.snapshotDate || 0).getTime(), value: parseFloat(p.totalValue || "0") }))
      .filter((p) => Number.isFinite(p.ts) && p.ts > 0)
      .sort((a, b) => a.ts - b.ts);
    const inRange = cutoff ? sorted.filter((p) => p.ts >= cutoff) : sorted;
    const startSnapshot = inRange[0];
    if (!startSnapshot || startSnapshot.value === 0) return null;
    const rawDelta = totalValue - startSnapshot.value;
    if (todaysSellTotal > 0 && Math.abs(rawDelta - todaysSellTotal) <= Math.max(1, todaysSellTotal * 0.03)) {
      return null;
    }
    const delta = rawDelta;
    const pct = (delta / startSnapshot.value) * 100;
    return { delta, pct, label: getChartRangeLabel(chartRange) };
  }, [usableFundHistory, totalValue, chartRange, todaysSellTotal, activeFund?.createdAt]);


  const trendData = useMemo(() => {
    const now = new Date();
    const createdTs = activeFund?.createdAt ? new Date(activeFund.createdAt).getTime() : NaN;
    const cutoff = getChartRangeCutoff(chartRange, now, Number.isFinite(createdTs) ? createdTs : null);
    const addZeroBaseline = (rows: Array<{ ts: number; label: string; principal: number; value: number }>) => {
      if (rows.length === 0) return rows;
      const baselineTs =
        chartRange === "ALL"
          ? (Number.isFinite(createdTs) ? createdTs : NaN)
          : (Number.isFinite(cutoff || NaN) ? (cutoff as number) : NaN);
      if (!Number.isFinite(baselineTs)) return rows;
      if (baselineTs >= rows[0].ts) return rows;
      return [
        {
          ts: baselineTs,
          label: new Date(baselineTs).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          principal: 0,
          value: 0,
        },
        ...rows,
      ];
    };
    const points = [...usableFundHistory]
      .map((p) => {
        const ts = new Date(p.snapshotDate || 0).getTime();
        return {
          ts,
          date: new Date(ts),
          principal: parseFloat(p.principalBasis || "0"),
          value: parseFloat(p.totalValue || "0"),
        };
      })
      .filter((p) => Number.isFinite(p.ts) && p.ts > 0)
      .sort((a, b) => a.ts - b.ts);

    const filtered = cutoff ? points.filter((p) => p.ts >= cutoff) : points;
    // Snapshot dates are stored date-only and parse as UTC midnight; format in UTC
    // so users in negative UTC offsets don't see every label shifted back a day.
    const formatLabel = (date: Date) => {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    };

    if (filtered.length >= 2) {
      const earliestGift = [...gifts].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())[0];
      const firstGiftSender = earliestGift ? displayGifterName(earliestGift.senderName, (earliestGift as any).isAnonymous) : null;
      const firstGiftAmount = earliestGift ? parseFloat(earliestGift.netAmount || earliestGift.amount || "0") : 0;
      let firstNonZeroFound = false;
      const rows = filtered.map((p) => {
        const isFirstNonZero = !firstNonZeroFound && p.value > 0;
        if (isFirstNonZero) firstNonZeroFound = true;
        return {
          ts: p.ts,
          label: formatLabel(p.date),
          principal: p.principal,
          value: p.value,
          event: isFirstNonZero
            ? { label: "First gift", detail: firstGiftSender && firstGiftAmount > 0 ? `${formatCurrency(firstGiftAmount)} from ${firstGiftSender}` : "" }
            : undefined,
        };
      });
      return addZeroBaseline(rows as Parameters<typeof addZeroBaseline>[0]);
    }

    // If snapshot history is sparse (common right after onboarding),
    // build a temporary trend from real gift timestamps so the chart is still useful.
    const giftPoints = [...gifts]
      .map((g) => {
        const ts = g.createdAt ? new Date(g.createdAt).getTime() : 0;
        const net = parseFloat(g.netAmount || g.amount || "0");
        return { ts, net, senderName: g.senderName };
      })
      .filter((g) => Number.isFinite(g.ts) && g.ts > 0 && Number.isFinite(g.net) && g.net > 0)
      .sort((a, b) => a.ts - b.ts);
    const filteredGiftPoints = cutoff ? giftPoints.filter((g) => g.ts >= cutoff) : giftPoints;
    if (filteredGiftPoints.length >= 2) {
      let cumulative = 0;
      const baselineTs = Number.isFinite(cutoff || NaN) ? (cutoff as number) : (Number.isFinite(createdTs) ? createdTs : NaN);
      const baselineRow = Number.isFinite(baselineTs) && baselineTs < filteredGiftPoints[0].ts
        ? [{ ts: baselineTs, label: new Date(baselineTs).toLocaleDateString("en-US", { month: "short", day: "numeric" }), principal: 0, value: 0, event: undefined }]
        : [];
      const giftRows = filteredGiftPoints.map((g, i) => {
        cumulative += g.net;
        const val = Math.min(cumulative, principalBasis > 0 ? principalBasis : totalValue);
        const senderLabel = displayGifterName(g.senderName, (g as any).isAnonymous);
        return {
          ts: g.ts,
          label: formatLabel(new Date(g.ts)),
          principal: val,
          value: val,
          event: {
            label: i === 0 ? "First gift" : "Gift",
            detail: `${formatCurrency(g.net)} from ${senderLabel}`,
          },
        };
      });
      return [...baselineRow, ...giftRows];
    }

    if (filtered.length === 0) {
      const rows = [
        {
          ts: now.getTime(),
          label: now.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          principal: principalBasis > 0 ? principalBasis : totalValue,
          value: totalValue,
        },
      ];
      return addZeroBaseline(rows);
    }

    // Single real snapshot: render it while waiting for more time-series points.
    const rows = filtered.map((p) => ({
      ts: p.ts,
      label: formatLabel(p.date),
      principal: p.principal,
      value: p.value,
    }));
    return addZeroBaseline(rows);
  }, [usableFundHistory, gifts, chartRange, principalBasis, totalValue, activeFund?.createdAt]);
  const trendMode = useMemo(() => {
    const now = new Date();
    const createdTs = activeFund?.createdAt ? new Date(activeFund.createdAt).getTime() : null;
    const cutoff = getChartRangeCutoff(chartRange, now, createdTs);
    const historyPoints = [...usableFundHistory]
      .map((p) => new Date(p.snapshotDate || 0).getTime())
      .filter((ts) => Number.isFinite(ts) && ts > 0)
      .sort((a, b) => a - b);
    const historyInRange = cutoff ? historyPoints.filter((ts) => ts >= cutoff) : historyPoints;
    if (historyInRange.length >= 2) return "history";

    const giftPoints = [...gifts]
      .map((g) => (g.createdAt ? new Date(g.createdAt).getTime() : 0))
      .filter((ts) => Number.isFinite(ts) && ts > 0)
      .sort((a, b) => a - b);
    const giftsInRange = cutoff ? giftPoints.filter((ts) => ts >= cutoff) : giftPoints;
    if (giftsInRange.length >= 2) return "gifts";
    if (historyInRange.length === 1) return "single";
    return "waiting";
  }, [usableFundHistory, gifts, chartRange, activeFund?.createdAt]);

  const setup = buildSetupProgress({
    fund: activeFund || null,
    hasBank: bankAccounts.length > 0,
    hasProfile: Boolean(user?.firstName?.trim()),
  });
  const fundCreatedTs = activeFund?.createdAt ? new Date(activeFund.createdAt).getTime() : 0;
  const fundAgeDays =
    Number.isFinite(fundCreatedTs) && fundCreatedTs > 0
      ? Math.max(0, Math.floor((Date.now() - fundCreatedTs) / (24 * 60 * 60 * 1000)))
      : null;
  const hasMeaningfulGiftMomentum = gifts.length >= 5 || totalValue >= 1000;
  const shouldShowAge18Spotlight =
    activeFund?.accountType === "UTMA" &&
    Boolean(activeFundId) &&
    (
      (typeof fundAgeDays === "number" && fundAgeDays <= 14) ||
      age18Transition?.stage === "approaching" ||
      age18Transition?.stage === "imminent" ||
      hasMeaningfulGiftMomentum
    );
  const trackLifecycleSignal = async (
    action:
      | "first_gift_received"
      | "event_ready_to_share_1h"
      | "event_created_no_share_24h"
      | "share_no_checkout_48h"
      | "no_gift_14d"
      | "share"
      | "fund_link_shared"
      | "parent_returned_after_first_gift"
      | "parent_shared_again",
    metadata?: Record<string, unknown>,
  ) => {
    try {
      await fetch("/api/referrals/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refCode: activeFund?.slug || activeFundId || "internal",
          fundId: activeFundId || null,
          eventId: null,
          action,
          channel: "dashboard",
          metadata: metadata || {},
        }),
      });
    } catch {
      // non-blocking analytics signal
    }
  };
  const trackMonetizationTrigger = async (
    triggerId: string,
    stage: "viewed" | "clicked" | "dismissed" | "checkout_started",
    metadata?: Record<string, unknown>,
  ) => {
    try {
      await fetch("/api/monetization/triggers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggerId,
          stage,
          fundId: activeFundId || null,
          sourceSurface: "dashboard",
          amount: recentGiftForToast ? parseFloat(recentGiftForToast.amount || "0") : null,
          metadata: metadata || {},
        }),
      });
    } catch {
      // non-blocking analytics signal
    }
  };

  const handleCoverActiveFund = async (triggerId: string) => {
    if (!activeFundId || startingCoverageCheckout) return;
    setStartingCoverageCheckout(true);
    void trackMonetizationTrigger(triggerId, "checkout_started", {
      coverageState: activeCoverageState,
    });
    try {
      const res = await fetch("/api/stripe/checkout/starter-plan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundId: activeFundId,
          returnTo: `/dashboard?coverage=success&fundId=${encodeURIComponent(activeFundId)}`,
          cancelTo: `/dashboard?coverage=canceled`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Could not start checkout");
      }
      window.location.href = data.url;
    } catch (error) {
      toast({
        title: "Could not start coverage checkout",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setStartingCoverageCheckout(false);
    }
  };

  const handleShareLink = useCallback(() => {
    if (!activeFund?.slug) {
      haptic("error");
      toast({ title: "Could not open share", description: "Fund link is not ready yet.", variant: "destructive" });
      return;
    }
    haptic("light");
    trackLifecycleSignal("share", { source: "dashboard_share_link" });
    trackLifecycleSignal("fund_link_shared", {
      baselineEvent: "fund_link_shared",
      source: "dashboard_share_link",
      giftCount: gifts.length,
    });
    if (gifts.length > 0) {
      trackLifecycleSignal("parent_shared_again", {
        baselineEvent: "parent_returns_to_shares_again",
        source: "dashboard_share_link",
        giftCount: gifts.length,
      });
    }
    setShareModalOpen(true);
  }, [activeFund?.slug, gifts.length, trackLifecycleSignal]);

  useEffect(() => {
    const handler = () => handleShareLink();
    window.addEventListener("kiddo:open-share-modal", handler);
    return () => window.removeEventListener("kiddo:open-share-modal", handler);
  }, [handleShareLink]);

  useEffect(() => {
    const handler = () => {
      if (isFamily || isStarter) setCreateEventSheetOpen(true); else setEventGateOpen(true);
    };
    window.addEventListener("kiddo:create-event", handler);
    return () => window.removeEventListener("kiddo:create-event", handler);
  }, [isFamily, isStarter]);

  useEffect(() => {
    // Mirror the pill row's behavior — when kid view is already enabled,
    // jump to the "done" step (share link + suggestions) instead of the
    // "settings" step (which has the PIN field). The sidebar previously
    // always opened at "settings", which made parents feel like they were
    // being asked for the PIN again every time they opened Emma's View.
    const handler = () => {
      setKidViewConfigStep(kidViewSettings?.enabled ? "done" : "settings");
      setKidViewConfigOpen(true);
    };
    window.addEventListener("kiddo:open-kid-view-config", handler);
    return () => window.removeEventListener("kiddo:open-kid-view-config", handler);
  }, [kidViewSettings?.enabled]);

  const handleCopyGiftCode = async () => {
    if (!giftCodeData?.code) {
      toast({ title: "Gift code not ready", description: "Try again in a moment.", variant: "destructive" });
      return;
    }
    const shareText = `${giftCodeData.code} at ${giftCodeData.lookupUrl}`;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedGiftCode(true);
      haptic("success");
      toast({
        title: "Gift code copied!",
        description: "Share this code verbally or send it to anyone who wants to gift without the link.",
      });
      setTimeout(() => setCopiedGiftCode(false), 2000);
    } catch {
      window.prompt("Copy this gift code:", shareText);
      haptic("light");
    }
  };

  useEffect(() => {
    if (!activeFundId) return;
    const fundCreatedTs = activeFund?.createdAt ? new Date(activeFund.createdAt).getTime() : 0;
    const now = Date.now();
    const hasAnyGift = gifts.length > 0;
    const hasAnyEvent = events.length > 0;
    const firstGiftKey = `kora_signal_first_gift_${activeFundId}`;
    const event1hKey = `kora_signal_event_1h_${activeFundId}`;
    const event24Key = `kora_signal_event_24h_${activeFundId}`;
    const share48Key = `kora_signal_share_48h_${activeFundId}`;
    const noGift14Key = `kora_signal_no_gift_14d_${activeFundId}`;

    // The first-gift signal must only fire when the fund is actually
    // experiencing its first-gift moment. localStorage alone is not a
    // sufficient gate: a parent on a fresh device / incognito / new
    // browser arrives with localStorage empty and the signal would
    // otherwise fire even on a fund that has had gifts for years.
    // Adding a gifts.length <= 2 gate makes the client check
    // semantically correct (allows for the rare race where two gifts
    // arrive in quick succession before the parent ever opens the
    // dashboard). The server has an authoritative gift-count guard
    // as well — see server/routes.ts lifecycle nudge handler. Defense
    // in depth: client gate saves a network call, server gate is the
    // source-of-truth.
    if (hasAnyGift && gifts.length <= 2 && !window.localStorage.getItem(firstGiftKey)) {
      const firstGift = [...gifts]
        .map((g) => (g.createdAt ? new Date(g.createdAt).getTime() : 0))
        .filter((ts) => Number.isFinite(ts) && ts > 0)
        .sort((a, b) => a - b)[0];
      const hoursToFirstGift = firstGift && fundCreatedTs ? (firstGift - fundCreatedTs) / (1000 * 60 * 60) : null;
      trackLifecycleSignal("first_gift_received", {
        gifts: gifts.length,
        hoursToFirstGift: hoursToFirstGift !== null ? Number(hoursToFirstGift.toFixed(2)) : null,
      });
      trackLifecycleSignal("parent_returned_after_first_gift", {
        baselineEvent: "first_gift_received_to_parent_returns",
        gifts: gifts.length,
        hoursToFirstGift: hoursToFirstGift !== null ? Number(hoursToFirstGift.toFixed(2)) : null,
      });
      window.localStorage.setItem(firstGiftKey, "1");
    } else if (hasAnyGift && gifts.length > 2 && !window.localStorage.getItem(firstGiftKey)) {
      // Fund has been receiving gifts long enough that we missed the
      // first-gift moment for this device. Set the localStorage flag
      // anyway so we do not keep re-evaluating this branch on every
      // dashboard mount. The flag's job here is "do not send the
      // signal again from this device," and we honor it by also
      // suppressing future re-evaluations.
      window.localStorage.setItem(firstGiftKey, "1");
    }

    if (hasAnyEvent && !hasAnyGift) {
      const oldestEventTs = [...events]
        .map((e) => (e.createdAt ? new Date(e.createdAt).getTime() : 0))
        .filter((ts) => Number.isFinite(ts) && ts > 0)
        .sort((a, b) => a - b)[0];
      if (oldestEventTs && now - oldestEventTs >= 60 * 60 * 1000 && !window.localStorage.getItem(event1hKey)) {
        trackLifecycleSignal("event_ready_to_share_1h", {
          events: events.length,
          oldestEventHours: Number(((now - oldestEventTs) / (1000 * 60 * 60)).toFixed(1)),
        });
        window.localStorage.setItem(event1hKey, "1");
      }
      if (oldestEventTs && now - oldestEventTs >= 24 * 60 * 60 * 1000 && !window.localStorage.getItem(event24Key)) {
        trackLifecycleSignal("event_created_no_share_24h", {
          events: events.length,
          oldestEventHours: Number(((now - oldestEventTs) / (1000 * 60 * 60)).toFixed(1)),
        });
        window.localStorage.setItem(event24Key, "1");
      }
      if (oldestEventTs && now - oldestEventTs >= 48 * 60 * 60 * 1000 && !window.localStorage.getItem(share48Key)) {
        trackLifecycleSignal("share_no_checkout_48h", {
          events: events.length,
          oldestEventHours: Number(((now - oldestEventTs) / (1000 * 60 * 60)).toFixed(1)),
        });
        window.localStorage.setItem(share48Key, "1");
      }
    }

    if (!hasAnyGift && fundCreatedTs && now - fundCreatedTs >= 14 * 24 * 60 * 60 * 1000 && !window.localStorage.getItem(noGift14Key)) {
      trackLifecycleSignal("no_gift_14d", {
        fundAgeDays: Number(((now - fundCreatedTs) / (1000 * 60 * 60 * 24)).toFixed(1)),
        events: events.length,
      });
      window.localStorage.setItem(noGift14Key, "1");
    }
  }, [activeFundId, activeFund?.createdAt, activeFund?.slug, events, gifts]);

  useEffect(() => {
    const heldGiftId = searchParams.get("releaseHeldGift");
    if (!heldGiftId || !activeFundId) return;
    void handleReleaseHeldGift(heldGiftId);
    const next = new URLSearchParams(searchParams);
    next.delete("releaseHeldGift");
    const nextSearch = next.toString();
    setLocation(nextSearch ? `/dashboard?${nextSearch}` : "/dashboard");
  }, [activeFundId]);

  const handleKidViewLink = async () => {
    try {
      const res = await fetch(`/api/funds/${activeFundId}/kid-view-link`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setKidViewConfigOpen(true);
        throw new Error(data?.error || "Turn on Kid View and set a PIN first.");
      }
      await navigator.clipboard.writeText(data.shareLink);
      setCopiedKidLink(true);
      haptic("success");
      toast({ title: "Kid View link copied!", description: "Share this link and PIN so your child can see their fund grow." });
      setTimeout(() => setCopiedKidLink(false), 2000);
    } catch (error) {
      haptic("error");
      toast({ title: "Could not copy Kid View link", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  };

  const handleToggleAutoInvestPref = async (enabled: boolean) => {
    if (!activeFundId) return;
    try {
      const res = await fetch(`/api/funds/${activeFundId}/investment-preferences`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoInvestEnabled: enabled }),
      });
      if (res.ok) {
        await refetchInvestPrefs();
        toast({
          title: enabled ? "Recurring investment turned on" : "Recurring investment turned off",
          description: enabled
            ? "Future cash will invest automatically per the fund default."
            : "Cash will sit until you manually invest it.",
        });
      }
    } catch {
      toast({ title: "Could not update", description: "Please try again.", variant: "destructive" });
    }
  };

  const handleSaveCulturalBg = async () => {
    if (!activeFundId) return;
    setSavingCulturalBg(true);
    try {
      const newBg = culturalBgSelections.length > 0 ? { traditions: culturalBgSelections } : null;
      const res = await fetch(`/api/funds/${activeFundId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ culturalBackground: newBg }),
      });
      if (!res.ok) throw new Error("Could not save.");
      const updatedFund = await res.json().catch(() => null);
      // Optimistically update the funds cache so UI reflects the change immediately
      queryClient.setQueryData(["/api/funds"], (old: Fund[] | undefined) => {
        if (!old) return old;
        return old.map(f => f.id === activeFundId ? { ...f, ...(updatedFund || { culturalBackground: newBg }) } : f);
      });
      // Also kick a background refetch to make sure we're fully in sync
      void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
      setCulturalBgPickerOpen(false);
      if (culturalBgSelections.length > 0) {
        const labels = culturalBgSelections.slice(0, 2).map(t => TRADITION_LABELS[t as CulturalTradition]).join(" and ");
        toast({ title: "Traditions saved", description: `${labels} suggestions are ready.` });
      } else {
        toast({ title: "Traditions cleared" });
      }
    } catch {
      toast({ title: "Could not save", variant: "destructive" });
    } finally {
      setSavingCulturalBg(false);
    }
  };

  const handleSaveKidView = async () => {
    if (!activeFundId) return;
    if (kidViewEnabled && !kidViewSettings?.hasPin && !kidViewPin.trim()) {
      toast({ title: "Set a PIN first", description: "Kid View needs a PIN before it can be shared.", variant: "destructive" });
      return;
    }
    try {
      setSavingKidView(true);
      const res = await fetch(`/api/funds/${activeFundId}/kid-view-settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: kidViewEnabled,
          pin: kidViewPin.trim() || undefined,
          pinHint: kidViewPinHint.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save Kid View settings.");
      setKidViewPin("");
      queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "kid-view-settings"] });
      if (kidViewEnabled) {
        setKidViewConfigStep("done");
      } else {
        setKidViewConfigOpen(false);
        toast({ title: "Kid View turned off", description: "The link is now inactive." });
      }
    } catch (error) {
      toast({ title: "Could not save Kid View", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setSavingKidView(false);
    }
  };

  const handleReleaseHeldGift = async (giftId: string) => {
    try {
      const res = await fetch(`/api/funds/${activeFundId}/large-gift-holds/${giftId}/release`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not release this gift.");
      toast({
        title: "Gift released",
        description: data?.appliedPlan === "free" ? "The gift was released on the free plan." : "The held gift was released with your upgraded coverage.",
      });
      invalidateActiveFundFreshness();
    } catch (error) {
      toast({ title: "Could not release gift", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  };

  const handleUpgradeHeldGift = async (giftId: string) => {
    if (!activeFundId || startingCoverageCheckout) return;
    try {
      setStartingCoverageCheckout(true);
      const res = await fetch("/api/stripe/checkout/starter-plan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundId: activeFundId,
          returnTo: `/dashboard?releaseHeldGift=${encodeURIComponent(giftId)}`,
          cancelTo: "/dashboard",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) throw new Error(data?.error || "Could not start the Kiddo+ upgrade.");
      window.location.href = data.url;
    } catch (error) {
      toast({ title: "Could not start upgrade", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
      setStartingCoverageCheckout(false);
    }
  };

  // Optimistic per-suggestion state so the badge flips IMMEDIATELY on click,
  // not after the round-trip. Maps suggestion id → "approved" | "declined".
  // Cleared on data refetch since the server's reviewedStatus then matches.
  const [suggestionPending, setSuggestionPending] = useState<Record<string, "approved" | "declined">>({});

  const handleReviewKidSuggestion = async (suggestionId: string, reviewedStatus: "approved" | "declined") => {
    setSuggestionPending(prev => ({ ...prev, [suggestionId]: reviewedStatus }));
    try {
      const res = await fetch(`/api/funds/${activeFundId}/kid-view-suggestions/${suggestionId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not update suggestion.");
      // Invalidate the canonical key — sidebar now shares this key (was
      // -sidebar-suffixed previously), so a single invalidate refreshes
      // both the dashboard config sheet AND the sidebar suggestions count.
      await queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "kid-view-settings"] });
      toast({ title: reviewedStatus === "approved" ? "Suggestion approved" : "Suggestion declined" });
    } catch (error) {
      // Roll back the optimistic flip on failure so the row's status
      // matches reality (still pending) and the parent can retry.
      setSuggestionPending(prev => { const n = { ...prev }; delete n[suggestionId]; return n; });
      toast({ title: "Could not review suggestion", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  };

  const handleSaveAutoInvest = async () => {
    if (!activeFundId || savingAutoInvest) return;
    const amt = parseFloat(autoInvestAmount);
    if (isNaN(amt) || amt < 1) {
      toast({ title: "Enter a valid amount", description: "Minimum $1 per gift.", variant: "destructive" });
      return;
    }
    setSavingAutoInvest(true);
    try {
      const selectedBank =
        bankAccounts.find((b: any) => b.id === autoInvestSelectedBankId) ||
        bankAccounts.find((b: any) => b.isDefault && (b.connectionStatus || "active") === "active") ||
        bankAccounts.find((b: any) => (b.connectionStatus || "active") === "active") ||
        bankAccounts[0];
      const isEditing = !!editingContribId;
      const url = isEditing
        ? `/api/parent-contributions/${editingContribId}`
        : `/api/funds/${activeFundId}/parent-contributions`;
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          frequency: autoInvestFrequency,
          bankAccountId: selectedBank?.id,
          executionModel: autoInvestExecutionModel,
          selectedTicker: autoInvestExecutionModel === "pick" ? autoInvestTicker : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save recurring investment.");
      haptic("success");
      // Capture the saved plan id so the next step ("note") can PATCH the note
      // column onto THIS schedule. Edits already have editingContribId; creates
      // get the id from the POST response.
      const savedId = isEditing ? editingContribId : (data?.id ? String(data.id) : null);
      setLastSavedContribId(savedId);
      setEditingContribId(null);
      await refetchParentContributions();
      invalidateActiveFundFreshness();
      // If editing, hydrate the note field from the existing plan so the parent
      // can edit (or clear) the recurring note rather than starting from blank.
      if (isEditing && savedId) {
        const existing = parentContributions.find(c => c.id === savedId);
        const existingNote = (existing as any)?.note;
        setAutoInvestMemoryNote(typeof existingNote === "string" ? existingNote : "");
      } else {
        setAutoInvestMemoryNote("");
      }
      setAutoInvestNoteSaved(false);
      setAutoInvestStep("note");
    } catch (error) {
      toast({ title: "Could not save plan", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setSavingAutoInvest(false);
    }
  };

  const handleSaveAutoInvestMemoryNote = async (): Promise<boolean> => {
    const note = autoInvestMemoryNote.trim();
    if (!note || !activeFundId || savingMemoryNote) return false;
    setSavingMemoryNote(true);
    try {
      // Two writes for one note:
      //   1. A "kickoff" memory_entries row, written immediately so the parent
      //      sees their note in the Memory Book today. Includes any attached
      //      media (photo / video / voice) — voice especially is the moat.
      //   2. The text note persisted to parent_contributions.note, so the
      //      worker stamps it on every future auto-fire (gift.message + a new
      //      memory_entries row each cycle). Per "recurring stamps once" —
      //      ONLY text note repeats, never media. 216 identical photos over
      //      18 years would pollute the Memory Book.
      // Best-effort: the kickoff write is the louder failure (parent watching
      // for it). The schedule PATCH is silent on failure.
      const res = await fetch(`/api/funds/${activeFundId}/memory`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "parent_note",
          content: note,
          authorName: (user as any)?.preferredName?.trim() || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "A parent",
          photoUrl: autoInvestMedia.photoUrl.trim() || undefined,
          videoUrl: autoInvestMedia.videoUrl.trim() || undefined,
          audioUrl: autoInvestMedia.audioUrl.trim() || undefined,
          audioTranscript: autoInvestMedia.audioTranscript || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      haptic("success");
      setAutoInvestNoteSaved(true);
      void queryClient.invalidateQueries({ queryKey: ["memory", activeFundId] });
      void queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "dashboard-summary"] });

      if (lastSavedContribId) {
        await fetch(`/api/parent-contributions/${lastSavedContribId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        }).catch(() => {});
        void refetchParentContributions();
      }
      return true;
    } catch {
      toast({ title: "Could not save note", description: "Please try again.", variant: "destructive" });
      return false;
    } finally {
      setSavingMemoryNote(false);
    }
  };

  const handleContributeNow = async (planId: string, note?: string, media?: MemoryMediaValue) => {
    if (contributingNow) return;
    setContributingNow(true);
    haptic("medium");
    try {
      // Memory Book entry pattern (same as handleStartOneTimeContribution):
      // write the parent's note + any media BEFORE the Stripe redirect, so
      // even if checkout is abandoned the love-letter survives. Standalone
      // memory entry — not linked to the resulting gift, since the gift is
      // created server-side post-webhook.
      const noteTrim = (note || "").trim();
      const mediaPhoto = media?.photoUrl.trim() || "";
      const mediaVideo = media?.videoUrl.trim() || "";
      const mediaAudio = media?.audioUrl.trim() || "";
      const hasContent = noteTrim || mediaPhoto || mediaVideo || mediaAudio;
      if (hasContent && activeFundId) {
        const parentName = (user as any)?.preferredName?.trim()
          || [user?.firstName, user?.lastName].filter(Boolean).join(" ")
          || "A parent";
        await fetch(`/api/funds/${activeFundId}/memory`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "parent_note",
            content: noteTrim,
            authorName: parentName,
            photoUrl: mediaPhoto || undefined,
            videoUrl: mediaVideo || undefined,
            audioUrl: mediaAudio || undefined,
            audioTranscript: media?.audioTranscript || undefined,
          }),
        }).catch(() => {});
      }
      const res = await fetch(`/api/parent-contributions/${planId}/contribute-now`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) throw new Error(data?.error || "Could not process.");
      window.location.href = data.url;
    } catch (error) {
      // "[Child]'s fund is safe" framing — money-movement failures need reassurance
      // BEFORE the technical detail, since "did my kid's money disappear?" is the
      // parent's first thought.
      toast({
        title: recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s fund is safe` : "Your fund is safe",
        description: error instanceof Error ? error.message : "We couldn't add that just now. Try again in a moment.",
        variant: "destructive",
      });
      setContributingNow(false);
    }
  };

  const handleStartOneTimeContribution = async () => {
    const amt = parseFloat(oneTimeAmount);
    if (isNaN(amt) || amt < 5 || !activeFundId) return;
    setStartingOneTime(true);
    haptic("medium");
    try {
      // Save memory entry (note + any attached media) before Stripe redirect
      // — awaited so the full row exists in case checkout is abandoned. The
      // entry is standalone (not gift-linked) since the gift is created
      // server-side post-webhook. Photo / video / voice are pulled from the
      // shared MemoryMediaPicker state.
      const oneTimeHasContent = oneTimeMemoryNote.trim()
        || oneTimeMedia.photoUrl.trim()
        || oneTimeMedia.videoUrl.trim()
        || oneTimeMedia.audioUrl.trim();
      if (oneTimeHasContent) {
        const parentName = (user as any)?.preferredName?.trim() || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "A parent";
        await fetch(`/api/funds/${activeFundId}/memory`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "parent_note",
            content: oneTimeMemoryNote.trim(),
            authorName: parentName,
            photoUrl: oneTimeMedia.photoUrl.trim() || undefined,
            videoUrl: oneTimeMedia.videoUrl.trim() || undefined,
            audioUrl: oneTimeMedia.audioUrl.trim() || undefined,
            audioTranscript: oneTimeMedia.audioTranscript || undefined,
          }),
        }).catch(() => {});
      }

      const res = await fetch("/api/stripe/checkout/gift", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundId: activeFundId,
          amount: amt,
          senderName: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Parent",
          senderEmail: user?.email || "",
          coverFees: true,
          paymentMethod: oneTimePaymentMethod,
          executionModel: oneTimeExecutionModel,
          selectedTicker: oneTimeExecutionModel === "pick" ? oneTimeTicker : undefined,
          isParentContribution: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) throw new Error(data?.error || "Could not start checkout.");
      window.location.href = data.url;
    } catch (error) {
      toast({
        title: recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s fund is safe` : "Your fund is safe",
        description: error instanceof Error ? error.message : "We couldn't start checkout just now. Try again in a moment.",
        variant: "destructive",
      });
      setStartingOneTime(false);
    }
  };

  const handleUpdateAutoInvestStatus = async (planId: string, status: "active" | "paused" | "cancelled") => {
    const actionKey = status === "active" ? "resume" : status === "paused" ? "pause" : "cancel";
    // Optimistic visual on the card itself (already in state).
    setOptimisticContribStatus(s => ({ ...s, [planId]: status }));
    setContribActionLoading(l => ({ ...l, [planId]: actionKey }));

    // Optimistically flip the schedule's status across every cache that reads
    // it: per-fund parent-contributions, dashboard-summary's parentContributions
    // sub-array, and the global recurring queries. Without this, the hero
    // projection ("On track for $X at 18") and the "$X/mo combined" recurring
    // summary line wait for a network round-trip before reflecting the change.
    // Same race-safe pattern as the archive flow: cancel in-flight refetches
    // so a polling tick can't overwrite our write with stale data.
    const contribsKey = ["/api/funds", activeFundId, "parent-contributions"];
    const summaryKey = ["/api/funds", activeFundId, "dashboard-summary"];
    await Promise.all([
      queryClient.cancelQueries({ queryKey: contribsKey }),
      queryClient.cancelQueries({ queryKey: summaryKey }),
    ]);
    const prevContribs = queryClient.getQueryData<any[]>(contribsKey);
    const prevSummary = queryClient.getQueryData<any>(summaryKey);
    const flip = (rows: any[] | undefined) =>
      Array.isArray(rows) ? rows.map((r) => (r?.id === planId ? { ...r, status } : r)) : rows;
    queryClient.setQueryData<any[]>(contribsKey, (prev) => flip(prev) ?? prev);
    queryClient.setQueryData<any>(summaryKey, (prev: any) =>
      prev && Array.isArray(prev.parentContributions)
        ? { ...prev, parentContributions: flip(prev.parentContributions) }
        : prev,
    );

    try {
      const res = await fetch(`/api/parent-contributions/${planId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not update plan.");
      haptic(status === "active" ? "success" : "light");
      toast({
        title:
          status === "active" ? "Recurring investment resumed"
          : status === "paused" ? "Paused. Resume anytime."
          : "Recurring investment cancelled",
        description: status === "paused" ? "The fund is safe." : undefined,
      });
      // Background refetch reconciles with server truth (e.g. nextRunAt timestamps).
      await refetchParentContributions();
      invalidateActiveFundFreshness();
    } catch (error) {
      // Revert both optimistic writes — card visual AND cache flip.
      setOptimisticContribStatus(s => { const n = { ...s }; delete n[planId]; return n; });
      if (prevContribs !== undefined) queryClient.setQueryData(contribsKey, prevContribs);
      if (prevSummary !== undefined) queryClient.setQueryData(summaryKey, prevSummary);
      toast({ title: "Something went wrong", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setContribActionLoading(l => ({ ...l, [planId]: null }));
      if (status === "cancelled") setContribConfirmCancel(null);
      // Clear optimistic after refetch settles
      setTimeout(() => setOptimisticContribStatus(s => { const n = { ...s }; delete n[planId]; return n; }), 800);
    }
  };

  const handleCancelAutoInvest = (planId: string) => {
    // Routes any cancel intent (from a card, the list, or the pauseOptions "Cancel instead"
    // button) into the unified action sheet's two-step confirmation. One canonical path so
    // there's never a stranded state where contribConfirmCancel is set but no UI shows it.
    setListActionContribId(planId);
    setListActionConfirmCancel(true);
  };

  const handleSaveLetter = async () => {
    if (!letterDraft.trim() || !activeFundId) return;
    setLetterSaving(true);
    haptic("medium");
    try {
      const parentName = (user as any)?.preferredName?.trim() ||
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "A parent";
      if (parentLetter?.id) {
        await fetch(`/api/memory/${parentLetter.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content: letterDraft.trim() }),
        });
      } else {
        await fetch(`/api/funds/${activeFundId}/memory`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            type: "parent_letter",
            content: letterDraft.trim(),
            authorName: parentName,
            fundId: activeFundId,
          }),
        });
      }
      haptic("success");
      void queryClient.invalidateQueries({ queryKey: ["memory", activeFundId, "parent_letter"] });
      setLetterInlineOpen(false);
    } catch {
      haptic("error");
    } finally {
      setLetterSaving(false);
    }
  };

  const handleDeleteLetter = async () => {
    if (!parentLetter?.id || !activeFundId) return;
    setLetterSaving(true);
    haptic("medium");
    try {
      const res = await fetch(`/api/memory/${parentLetter.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("delete failed");
      haptic("success");
      toast({ title: "Letter cleared", description: "You can write a new one anytime." });
      void queryClient.invalidateQueries({ queryKey: ["memory", activeFundId, "parent_letter"] });
      setLetterDraft("");
      setLetterDeleteConfirm(false);
      setLetterDiscardConfirm(false);
      setLetterInlineOpen(false);
    } catch {
      haptic("error");
      toast({ title: "Could not clear the letter", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setLetterSaving(false);
    }
  };


  // First-sell tax explainer state — opened when server returns 409
  // "first_sell_tax_explainer_required" on a kid-owner's first sale.
  // Carries the payload (gain, tax estimate, etc.) the modal renders
  // plus the original sell params so the confirm action can re-fire
  // the request with confirmTaxExplainer:true. Per AGE_18_HANDOFF_SPEC.md
  // bucket 2.
  const [sellTaxExplainer, setSellTaxExplainer] = useState<{
    payload: FirstSellTaxExplainerPayload;
    sharesToSell: number;
  } | null>(null);

  const handleSellHolding = async (sharesToSell?: number, opts: { confirmTaxExplainer?: boolean } = {}) => {
    if (!sellingHolding || sellLoading) return;
    const maxShares = parseFloat(sellingHolding.shares || "0");
    const shares = sharesToSell ?? parseFloat(sellShares);
    if (isNaN(shares) || shares <= 0 || shares > maxShares + 0.00001) {
      toast({ title: "Invalid amount", description: `Enter between 0 and ${maxShares.toFixed(4)} shares`, variant: "destructive" });
      return;
    }
    setSellLoading(true);
    haptic("medium");
    try {
      const res = await fetch("/api/holdings/sell", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdingId: sellingHolding.id,
          fundId: activeFundId,
          shares: shares,
          ...(opts.confirmTaxExplainer ? { confirmTaxExplainer: true } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        haptic("success");
        setSellSuccess(true);
        toast({ title: "Moved to cash", description: `${formatCurrency(parseFloat(data.saleValue || "0"))} will settle inside the fund.` });
        invalidateActiveFundFreshness();
        setSellTaxExplainer(null);
        setTimeout(() => {
          setSellingHolding(null);
          setSellShares("");
          setSellMode("dollars");
          setSellSuccess(false);
        }, 1400);
      } else if (res.status === 409 && data.error === "first_sell_tax_explainer_required") {
        // First-sell tax explainer — surface the modal with the
        // server-computed gain + tax estimate. User can continue
        // (re-fires with confirmTaxExplainer:true) or back out.
        haptic("selection");
        setSellTaxExplainer({
          payload: data as FirstSellTaxExplainerPayload,
          sharesToSell: shares,
        });
      } else {
        toast({ title: "Could not move to cash", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not move to cash", description: "Please try again", variant: "destructive" });
    } finally {
      setSellLoading(false);
    }
  };

  const isPageLoading = fundsLoading;

  return (
    <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8">
      <AppHeader />

      <main className="kiddo-canvas px-4 py-6 space-y-6">
        {/* Approaching-18 prep banner. Renders when the kid's
            majority date is within the 90-day window but hasn't
            arrived yet. Calm card (sage register, not alarm) that
            routes to /age-18-plan where the full walkthrough lives.
            Without this banner, the kid reaches majority and the
            parent gets surprised by the auto-fired transition
            emails per age18TransitionWorker.ts. Locked spec'd
            this in FUND_STATES_SPEC.md under "Approaching 18"
            and "What's missing today" / item 2.
            Hidden when daysUntil18 <= 0 (already at/past majority;
            the kid's claim flow takes over) or > 90 (too early,
            would become wallpaper). */}
        {age18Transition && age18Transition.daysUntil18 > 0 && age18Transition.daysUntil18 <= 90 && (
          <button
            type="button"
            onClick={() => { haptic("selection"); setLocation("/age-18-plan"); }}
            className="w-full rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.20)] bg-[hsl(var(--kiddo-evergreen)/0.05)] p-4 text-left transition-colors hover:bg-[hsl(var(--kiddo-evergreen)/0.08)]"
            data-testid="dashboard-approaching-18-banner"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--kiddo-evergreen))]">
                  Handoff in {age18Transition.daysUntil18 === 1 ? "1 day" : `${age18Transition.daysUntil18} days`}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {recipientFirstNameDisplay || "Your child"} turns {age18Transition.majorityAge} on {formatAgeTransitionDate(age18Transition.eighteenthBirthday)}.
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Walk through what's about to change and what to prep.
                </p>
              </div>
              <ChevronRight size={18} className="shrink-0 mt-1 text-[hsl(var(--kiddo-evergreen))]" aria-hidden />
            </div>
          </button>
        )}
        {coverageReturnNotice && (
          <div
            className={`rounded-2xl border p-4 shadow-premium-sm ${
              coverageReturnNotice.type === "success"
                ? "border-green-200 bg-green-50"
                : "border-amber-200 bg-amber-50"
            }`}
            data-testid="card-coverage-return-notice"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-sm font-semibold ${coverageReturnNotice.type === "success" ? "text-green-800" : "text-amber-800"}`}>
                  {coverageReturnNotice.title}
                </p>
                <p className={`mt-1 text-sm ${coverageReturnNotice.type === "success" ? "text-green-700" : "text-amber-700"}`}>
                  {coverageReturnNotice.description}
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setCoverageReturnNotice(null)}
                data-testid="button-dismiss-coverage-return-notice"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* (Removed: the routine "Your gift is pending. This is normal."
            banner. Status pills on each pending gift row + the new
            `$X settling` summary line under "Total gifts" cover this
            job without the alert-pattern noise.) */}

        {/* Action items for the active fund. Dashboard is per-kid
            so we scope to the active fund — household-aggregate
            items belong on /funds. Mounted ABOVE SetupProgressNudge
            because individual blockers ("KYC failed", "SSN missing")
            are more time-sensitive than the broad "you're 60% set
            up" overview. Hidden when empty so no visual debt on
            the happy path. */}
        {(() => {
          const fundActionItems = activeFund
            ? actionItems.filter((i) => i.fundId === activeFund.id)
            : [];
          if (fundActionItems.length === 0) return null;
          return (
            <div className="mb-4">
              <ActionItemList items={fundActionItems} heading="Needs your attention" compact />
            </div>
          );
        })()}

        {/* SetupProgressNudge hidden for demo accounts — the Dunphy
            demo is showcase mode, not new-customer onboarding mode.
            Setup tasks (link bank / activate investing / complete
            profile) are seeded as already-done conceptually; the
            nudge would otherwise show "4 of 5 complete" against
            tasks that don't apply to a sandboxed account. Locked
            2026-05-21 with the demo polish pass. */}
        {!(user as any)?.isDemoAccount && !authLoading && !fundsLoading && !bankLoading && setup.percent < 100 && (
          <SetupProgressNudge
            title="Finish the few things behind the gift link"
            subtitle="This is the quiet setup that lets gifts move cleanly."
            percent={setup.percent}
            items={setup.steps.map((s) => ({ label: s.label, done: s.done }))}
            collapsible
            defaultExpanded={false}
            ctaLabel={
              setup.nextAction === "create_fund"
                ? "Create fund"
                : setup.nextAction === "activate_investing"
                  ? "Activate investing"
                : setup.nextAction === "link_bank"
                  ? "Set up withdrawals"
                  : setup.nextAction === "complete_profile"
                    ? "Add your name"
                    : "Review settings"
            }
            onCta={() => {
              if (setup.nextAction === "create_fund") {
                setAddFundOpen(true);
                return;
              }
              if (setup.nextAction === "activate_investing") {
                setLocation("/activate");
                return;
              }
              if (setup.nextAction === "complete_profile") {
                setLocation("/profile");
                return;
              }
              setLocation("/settings?from=dashboard");
            }}
            ctaTestId="button-setup-progress-cta"
          />
        )}

        {/* SSN nudge moved below the hero card — addresses the
            "compliance masquerading as a welcome" critique. The parent
            sees the warm balance + chart + share CTA first, then setup
            tasks (including SSN) below as one of several next-step cards. */}

        {/* At-18 welcome banner — extracted to
            @/components/dashboard/KidAt18WelcomeBanner. Renders only when
            the viewer is the kid and the claim is recent (server gates
            kidClaimedAt). One-time, dismissable, per-fund localStorage. */}
        <KidAt18WelcomeBanner
          kidClaimedAt={(dashboardSummary as any)?.kidClaimedAt as string | null | undefined}
          fundId={activeFundId}
          childFirstName={recipientFirstNameDisplay}
        />

        {/* Milestone celebration moment — wired 2026-05-20 (the component
            was built, imported, and the prev/current value-tracking
            useRef was set up months ago, but the actual render call was
            never added; per project_share_card_rasterization_pattern.md
            this was the deferred 'just needs wiring' item).
            Compares prevValueRef.current against rawTotalValue on every
            render via getMilestoneCrossed; returns null when no
            threshold was just crossed, so it occupies zero layout
            space outside the actual celebration window. When it fires,
            it renders the celebration card + the rasterizable
            MilestoneShareCard so the parent can one-tap share to
            Instagram Stories / iMessage / wherever. The 8-particle
            confetti restraint and the threshold-specific emotional
            anchor (community-college, state-school-year, etc.) honor
            the locked discipline against AI-slop celebrations. */}
        <MilestoneMoment
          currentValue={rawTotalValue}
          previousValue={prevValueRef.current}
          recipientName={recipientFirstNameDisplay}
        />

        {/* Closed-fund banner — calm, action-bearing. Renders when the
            active fund is in the 'closed' state. Mirror of the Settings
            banner so a parent on the dashboard sees the closed state
            without having to navigate to Settings to find out why the
            share link isn't working. Reopen routes to Settings →
            Membership (where the modal lives + the audit copy explains
            what stays/stops). */}
        {String((activeFund as any)?.status || "").toLowerCase() === "closed" && (
          <div
            className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex items-start justify-between gap-3"
            data-testid="dashboard-closed-fund-banner"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">
                {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "This"} fund is closed
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                The gift link is paused. Memory Book and history are preserved. Reopen any time from Settings.
              </p>
            </div>
            {/* Reopen-fund banner CTA. Updated 2026-05-14 to point at
                /settings?tab=child (the per-fund tab where the
                close/reopen action lives per the WHO/HOW IA — reopen
                is fund-scoped, not account-scoped). The reopen-banner
                renders at the top of the Settings page regardless of
                active tab, so the user lands at the right place to
                tap "Reopen fund". Previous target /settings?tab=
                membership would now bounce to Account and the parent
                would lose the reopen affordance. */}
            <Link href="/settings?tab=child">
              <button
                type="button"
                className="shrink-0 rounded-xl bg-[hsl(var(--kiddo-evergreen))] px-4 py-2 text-xs font-bold text-white hover:opacity-95"
                data-testid="dashboard-closed-fund-banner-cta"
              >
                Reopen fund
              </button>
            </Link>
          </div>
        )}



        {isPageLoading ? (
          <div className="space-y-4">
            <SkeletonBlock className="h-48 w-full" />
            <div className="flex gap-3">
              <SkeletonBlock className="h-10 flex-1" />
              <SkeletonBlock className="h-10 flex-1" />
              <SkeletonBlock className="h-10 flex-1" />
            </div>
          </div>
        ) : (
          <>
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div
                className="shadow-premium-lg"
                style={{
                  background: "linear-gradient(140deg, hsl(var(--kiddo-evergreen)) 0%, hsl(var(--kiddo-evergreen-deep)) 100%)",
                  borderRadius: "var(--radius-container)",
                  padding: "28px 28px 24px",
                  position: "relative",
                  overflow: "hidden",
                }}
                data-testid="hero-card"
              >
                {/* Decorative orbs removed 2026-05-12. The two fully-rounded
                    ambient-highlight circles (200px white-tint top-right +
                    240px gold-tint bottom-left) read as AI-generated landing
                    page decoration and violated the locked
                    Apple-Settings register + the Mario-star framing
                    ("if it shows up on every screen, nobody cares"). The
                    green evergreen→evergreen-deep gradient IS the visual
                    anchor; meaningful negative space carries more weight
                    than decorative fill. See feedback_no_ai_slop.md and
                    feedback_animation_primitives.md for the locked rules. */}
                <div style={{ position: "relative", zIndex: 1 }}>
                  {/* Fund identity row. Optional 32px child-avatar glyph
                      to the left of the name lockup — small enough to
                      stay in the iOS Contacts / Messages register
                      (identity mark, not hero image), large enough to
                      personalize the most-visited surface in the app.
                      Renders only when the parent has explicitly set a
                      child photo; falls back to the colored-initial
                      pattern (same primitive as "Who Loves Emma" + the
                      Memory Book gifter roster). Dark hero background
                      gets a subtle white ring to lift the avatar from
                      the gradient. The avatar is a glyph, not a tap
                      target — taps on this row still belong to the
                      fund-name dropdown / share affordance. */}
                  {/* Identity row — bottom margin bumped from 6 to 14 so the
                      32px child avatar doesn't crowd the 50px balance
                      directly below. Old gap read as cramped because the
                      avatar's bottom landed within ~6px of the balance's
                      cap-line. 14 gives the balance proper breathing room
                      without separating the two surfaces too far. */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                      {/* Mobile-only — desktop already carries fund
                          identity in the DesktopSidebar's nav and fund
                          switcher, so a glyph here would be redundant
                          chrome. md:hidden hides it at the >=768px
                          breakpoint where the sidebar takes over. */}
                      {(() => {
                        const childPhotoUrl = (activeFund as any)?.childPhotoUrl as string | null | undefined;
                        const childInitial = (recipientFirstNameDisplay || activeFund?.name || "").trim().slice(0, 1).toUpperCase() || "•";
                        if (childPhotoUrl) {
                          return (
                            <div
                              aria-hidden
                              className="md:hidden"
                              style={{
                                width: 32, height: 32, flexShrink: 0,
                                borderRadius: "50%",
                                overflow: "hidden",
                                boxShadow: "0 0 0 2px rgba(255,255,255,0.30), 0 1px 4px rgba(0,0,0,0.18)",
                                background: "rgba(255,255,255,0.10)",
                              }}
                            >
                              {/* Load hints added 2026-05-20 per user
                                  report ('the photo is taking a long
                                  time to load'). This is the focal-
                                  point image of the Dashboard hero,
                                  above the fold, on the most-visited
                                  surface. fetchPriority='high' tells
                                  the browser to prioritize this image
                                  over other resource fetches on the
                                  page. decoding='async' moves the
                                  decode off the main thread so it
                                  does not block other rendering.
                                  loading='eager' is explicit (default
                                  for above-the-fold, but clearer
                                  here). See feedback_image_load_hints
                                  _pattern.md for the canonical
                                  treatment of focal-point images. */}
                              <img
                                src={childPhotoUrl}
                                alt=""
                                loading="eager"
                                decoding="async"
                                fetchPriority="high"
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                              />
                            </div>
                          );
                        }
                        return (
                          <div
                            aria-hidden
                            className="md:hidden"
                            style={{
                              width: 32, height: 32, flexShrink: 0,
                              borderRadius: "50%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: "rgba(255,255,255,0.12)",
                              color: "rgba(255,255,255,0.92)",
                              fontSize: 13, fontWeight: 700,
                              boxShadow: "0 0 0 1.5px rgba(255,255,255,0.22)",
                            }}
                          >
                            {childInitial}
                          </div>
                        );
                      })()}
                      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" as const, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" as const }} data-testid="text-fund-hero-label">
                        {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s Fund` : activeFund?.name || "Your fund"}
                        {" · "}{activeFund?.accountType || "UTMA"}
                        {" · "}{activeFund?.status === "active" ? "Active" : "Draft"}
                      </div>
                    </div>
                    {(() => {
                      const validCount = gifts.filter(g => {
                        const s = String(g.status || "").toLowerCase();
                        return s !== "failed" && s !== "refunded";
                      }).length;
                      return validCount > 0 ? (
                        <span className="rounded-full" style={{
                          background: "hsl(var(--kiddo-gold) / 0.25)", color: "hsl(var(--kiddo-gold-light))",
                          padding: "2px 9px",
                          fontSize: 10, fontWeight: 700, letterSpacing: "0.02em", flexShrink: 0, marginLeft: 8,
                        }}>
                          {validCount} {validCount === 1 ? "gift" : "gifts"}
                          {contributorCount > 0 && (
                            <> · from {contributorCount} {contributorCount === 1 ? "person" : "people"}</>
                          )}
                        </span>
                      ) : null;
                    })()}
                  </div>

                  {/* Fund-switch skeleton: when dashboard-summary is loading AND
                      the funds-list balance says this fund has real data, render
                      a brief skeleton instead of flashing stale numbers from the
                      previous fund or a wrong "Ready for the first gift" empty
                      state. Brand-new funds (balance==0) skip this and
                      land directly on the empty hero — that's the correct state
                      for them and the optimistic create flow. */}
                  {dashboardSummaryLoading && !dashboardSummary && getFundTotalValue(activeFund) > 0 ? (
                    <>
                      <div style={{ marginBottom: 10 }} data-testid="hero-loading-skeleton">
                        <div className="animate-pulse rounded-lg" style={{ width: 180, height: 44, background: "rgba(255,255,255,0.10)", marginBottom: 10 }} />
                        <div className="animate-pulse rounded-full" style={{ width: 110, height: 18, background: "hsl(var(--kiddo-gold) / 0.18)", marginBottom: 18 }} />
                        <div className="animate-pulse rounded-2xl" style={{ width: "100%", height: 88, background: "rgba(255,255,255,0.05)" }} />
                      </div>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 4 }}>
                        Loading {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "your"} fund…
                      </p>
                    </>
                  ) : totalValue === 0 && gifts.length === 0 ? (
                    <>
                      <div className="font-heading" style={{ fontSize: 46, fontWeight: 700, color: "white", letterSpacing: "-1.5px", lineHeight: 1, marginBottom: 8 }} data-testid="text-total-balance">
                        $0.00
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>
                        Ready for the first gift.
                      </p>
                      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", lineHeight: 1.55, marginBottom: 22 }}>
                        Share {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "your child's"} gift link to get started.
                      </p>
                      {/* Acknowledge any scheduled recurring investment.
                          Without this, the empty state reads as "nothing
                          is happening" even when the parent has set up a
                          recurring that's about to fire. Calm honesty per
                          locked Kiddo register: the share CTA still
                          headlines (gifter loop is the moat), but the
                          parent's own setup work gets acknowledged. */}
                      {(() => {
                        // parentContributions is already scoped to activeFundId
                        // via the useQuery key, so no per-fund filter needed.
                        const fundRecurring = parentContributions.find((c) => c.status === "active");
                        if (!fundRecurring) return null;
                        const amt = parseFloat(String(fundRecurring.amount || "0"));
                        if (!Number.isFinite(amt) || amt <= 0) return null;
                        const freq = String(fundRecurring.frequency || "monthly").toLowerCase();
                        const freqLabel =
                          freq === "weekly" ? "week"
                            : freq === "yearly" || freq === "annual" || freq === "annually" ? "year"
                              : freq === "daily" ? "day"
                                : "month";
                        const nextDate = fundRecurring.nextRunDate ? new Date(fundRecurring.nextRunDate) : null;
                        const nextLabel = nextDate && !Number.isNaN(nextDate.getTime())
                          ? nextDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : null;
                        return (
                          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 16 }}>
                            Your ${amt.toFixed(0)}/{freqLabel} recurring fires{nextLabel ? ` next on ${nextLabel}` : " on schedule"}.
                          </p>
                        );
                      })()}
                      {age18Transition && (
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 14, marginBottom: 18 }}>
                          {recipientFirstNameDisplay || "Your child"} turns {age18Transition.majorityAge} on {formatAgeTransitionDate(age18Transition.eighteenthBirthday)} · {age18Transition.countdownLabel}
                        </p>
                      )}
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
                        {!isReadOnlyFund && (
                          <button
                            onClick={() => { haptic("medium"); handleShareLink(); }}
                            data-testid="button-empty-state-share-link"
                            className="rounded-full"
                            style={{
                              padding: "10px 20px", fontSize: 13, background: "hsl(var(--kiddo-gold))",
                              color: "white", border: "none",
                              fontWeight: 700, cursor: "pointer",
                              display: "inline-flex", alignItems: "center", gap: 6,
                            }}
                          >
                            <Share2 size={13} color="white" />
                            Share
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* "Today" kicker — creates timeframe symmetry with the
                          "$X at 65" projection button below. Without it, the
                          parent has to triangulate that the big white number
                          is the present-day balance vs the long-horizon
                          projection. Same micro-label register used by the
                          "Latest gift" / "Recent gift" labels in the gift
                          strip below — calm Settings-app uppercase, muted
                          on the green hero. Intentionally NOT labeled
                          "Emma's fund value" or "Kiddo value" — those clutter
                          the anchor number and read as Acorns/Mint chrome. */}
                      {/* Kicker swaps from "Today" to the scrubbed date
                          while the parent is dragging through the chart.
                          Same uppercase Settings-app register either way
                          — the visual continuity is what makes the swap
                          feel native instead of a separate tooltip
                          surface. transition smooths the cross-fade so
                          rapid scrubbing doesn't flicker. */}
                      <div
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: "rgba(255,255,255,0.42)",
                          textTransform: "uppercase" as const,
                          letterSpacing: "0.08em",
                          marginBottom: 6,
                          transition: "color 0.2s",
                        }}
                        data-testid="text-hero-balance-today-kicker"
                      >
                        {isScrubbing ? scrubbedTrendPoint!.label : "Today"}
                      </div>
                      {/* Shared-fund badge. Appears only when the active fund
                          is one the parent was invited to (not their own).
                          Sits between the kicker and the balance so it's
                          read as context BEFORE the number, not as a
                          decoration after. Viewer / co-admin distinction
                          is reserved for the Settings page; the hero just
                          says "this isn't your fund originally." */}
                      {isSharedFund && (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "3px 10px",
                            marginBottom: 8,
                            borderRadius: 9999,
                            background: "rgba(255,255,255,0.12)",
                            border: "1px solid rgba(255,255,255,0.18)",
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: "rgba(255,255,255,0.78)",
                            letterSpacing: "0.03em",
                          }}
                          data-testid="badge-shared-fund"
                        >
                          {isPreviousOwner
                            ? `📦 Transferred to ${recipientFirstNameDisplay || "them"} · view only`
                            : `🤝 Shared with you${isViewerOnly ? " · view-only" : ""}`}
                        </div>
                      )}
                      {/* Balance — uses brand serif via .font-heading instead of
                          a hardcoded Lora override. The flash color uses the
                          --kiddo-gold-light token for the freshening cue.
                          During chart scrub, the balance shows the scrubbed
                          historical value AND the freshening cue is
                          suppressed (the value change is the user's intent,
                          not a system event — animating it would be confusing
                          theatre). aria-live flips to "off" during scrub OR
                          during the count-up animation so screen readers
                          don't fire 60 announcements per second while
                          either kind of value-change is happening. When the
                          animation settles, aria-live returns to "polite"
                          and the final value is announced exactly once.
                          Pattern locked in `project_count_up_animation_consistency.md`. */}
                      {/* Stagger reveal added 2026-05-12 — the balance fades in
                          AFTER the parent hero card has settled + the kicker /
                          shared-badge above are already visible. Creates the
                          Apple-cinematic "everything settles, then the hero
                          number reveals last with count-up" moment per the
                          user's locked intuition. 220ms delay matches the
                          hero card's own fade-in finish; the count-up
                          (1200ms) then runs as the focal animation. Per
                          feedback_animation_primitives.md: staged reveals +
                          count-ups are approved primitives. Skipped on chart-
                          scrub (the value swap there is user-driven, not
                          system-driven, so the stagger would feel like lag). */}
                      <motion.div
                        className="font-heading"
                        initial={isScrubbing ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.32, delay: 0.22, ease: "easeOut" }}
                        style={{
                          fontSize: 50,
                          fontWeight: 700,
                          // Gold while EITHER the count-up is running OR a new gift
                          // just arrived. The newGiftFlash window holds the cue lit
                          // for ~3.8s after arrival so the gold-glow moment isn't
                          // blink-and-miss. Count-up duration bumped to 1200ms
                          // 2026-05-12 (was 900ms default) — hero balance is the
                          // focal element on the duration ladder.
                          color: !isScrubbing && ((balanceAnimating && showFresheningCue) || newGiftFlash) ? "hsl(var(--kiddo-gold-light))" : "white",
                          letterSpacing: "-1.5px",
                          lineHeight: 1,
                          marginBottom: 4,
                          filter: !isScrubbing && ((balanceAnimating && showFresheningCue) || newGiftFlash) ? "drop-shadow(0 0 18px hsl(var(--kiddo-gold) / 0.35))" : "none",
                          transition: "color 0.55s ease, filter 0.55s ease",
                        }}
                        data-testid="text-total-balance"
                        aria-live={isScrubbing || balanceAnimating ? "off" : "polite"}
                      >
                        {formatCurrency(isScrubbing ? scrubbedTrendPoint!.value : displayHeroBalance)}
                      </motion.div>

                      {/* Hero gain pill removed — the +$X all-time gain (and its
                          percent) was duplicating what the lifetime stats row's
                          "Growth" card already shows below. The hero stays as
                          the emotional anchor surface (balance · recent gift ·
                          share · projection); the metrics-shaped numbers live
                          in the metrics row and on the chart's range pill.
                          What stays here: the "$X invested" informational
                          fallback when the parent has invested but hasn't yet
                          accrued meaningful gain, and the empty-state warmth
                          ("Growing for {child}") for brand-new funds. */}
                      {/* "$X invested" fallback dropped — when balance == invested
                          (the common no-gain case) it was restating the balance
                          number directly above. When balance > invested or
                          balance < invested, the lifetime stats row's Growth
                          card already carries that delta. The hero stays as
                          the emotional anchor; metrics-shaped numbers live in
                          the metrics row. Only the truly-empty fund still
                          shows the "Growing for {child}" warmth, and the
                          settling-cash button still appears alongside when
                          there's cash in flight. */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                        {invested === 0 && rawTotalValue === 0 && (
                          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", fontWeight: 500 }}>
                            Growing for {recipientFirstNameDisplay || "them"}
                          </span>
                        )}
                        {cash > 0 && (
                          isReadOnlyFund ? (
                            // View-only collaborators AND previous owners
                            // (post-handoff parents) see the cash figure but
                            // not a clickable invest button — the action would
                            // 403 server-side anyway, and rendering a dead CTA
                            // is worse UX than rendering an informational stat.
                            <span
                              style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", fontWeight: 600, marginLeft: 4 }}
                              data-testid="text-hero-cash-stat-readonly"
                            >
                              {formatCurrency(cash)} cash
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setInvestCashInitialTicker(""); setInvestCashOpen(true); haptic("light"); }}
                              style={{ fontSize: 11.5, color: "hsl(var(--kiddo-gold-light) / 0.85)", fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", marginLeft: 4 }}
                              data-testid="button-hero-cash-stat"
                            >
                              {formatCurrency(cash)} cash
                            </button>
                          )
                        )}
                      </div>

                      {/* Settling row - shown whenever there's pending cash */}
                      {settling > 0 && (
                        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                          <div className="rounded-full" style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            background: "hsl(var(--kiddo-gold-light) / 0.12)", border: "1px solid hsl(var(--kiddo-gold-light) / 0.25)",
                            padding: "4px 12px",
                          }}>
                            <span style={{ fontSize: 10, lineHeight: 1 }}>🌱</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--kiddo-gold-light) / 0.9)" }}>
                              {formatCurrency(settling)} settling
                            </span>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>
                              · 1–2 business days
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Cycling gift strip */}
                      {recentGiftsFeed.length > 0 && (() => {
                        // Key the card by gift id (with index as fallback) so a
                        // brand-new gift arriving at index 0 while the user was
                        // already parked on index 0 still drives an
                        // enter/exit animation — keying by `heroGiftIdx` alone
                        // would silently swap the contents and the parent
                        // would miss the arrival. The card flashes gold only
                        // when newGiftFlash is true AND the user is looking
                        // at index 0 (the latest gift); if they manually
                        // dotted away to an older gift mid-flash, we don't
                        // mis-paint that older gift as "just arrived."
                        const cardKey = recentGiftsFeed[heroGiftIdx]?.id ?? `idx-${heroGiftIdx}`;
                        const cardIsFlashing = newGiftFlash && heroGiftIdx === 0;
                        return (
                        <div style={{ marginBottom: 20 }}>
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={cardKey}
                              // Slow-in entrance when arriving: a gentle scale +
                              // lift from 0.97 / +4px, eased with the standard
                              // out-expo curve. This is the approved
                              // "anticipation + follow-through" primitive — no
                              // bounce, no sparkle, no reveal-sweep.
                              initial={{ opacity: 0, scale: cardIsFlashing ? 0.97 : 1, y: cardIsFlashing ? 4 : 0 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: cardIsFlashing ? 0.55 : 0.35, ease: cardIsFlashing ? [0.16, 1, 0.3, 1] : "easeOut" }}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                const heroGift = recentGiftsFeed[heroGiftIdx];
                                if (!heroGift?.id || !activeFundId) return;
                                haptic("selection");
                                setLocation(`/memory/${activeFundId}?gift=${heroGift.id}`);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  const heroGift = recentGiftsFeed[heroGiftIdx];
                                  if (!heroGift?.id || !activeFundId) return;
                                  haptic("selection");
                                  setLocation(`/memory/${activeFundId}?gift=${heroGift.id}`);
                                }
                              }}
                              style={{
                                background: cardIsFlashing ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)",
                                borderRadius: 16,
                                padding: "11px 14px",
                                border: cardIsFlashing
                                  ? "1px solid hsl(var(--kiddo-gold-light) / 0.55)"
                                  : "1px solid rgba(255,255,255,0.1)",
                                boxShadow: cardIsFlashing
                                  ? "0 0 22px hsl(var(--kiddo-gold) / 0.30)"
                                  : "none",
                                cursor: "pointer",
                                transition: "background 0.55s ease, border-color 0.55s ease, box-shadow 0.55s ease",
                              }}
                              data-testid="card-hero-recent-gift"
                            >
                              {(() => {
                                const g = recentGiftsFeed[heroGiftIdx];
                                const ticker = (g as any)?.selectedTicker as string | null | undefined;
                                const holdingName = ticker
                                  ? friendlyHoldingName(ticker, holdings.find(h => h.ticker === ticker)?.name)
                                  : null;
                                const amt = parseFloat(String(g?.amount || "0"));
                                const netAmt = parseFloat(String(g?.netAmount || "0"));
                                const investedAmt = netAmt > 0 ? netAmt : amt;
                                const giftEventName = g?.eventId
                                  ? (events.find(e => e.id === g.eventId)?.name ?? null)
                                  : null;
                                // Destination derivation. Prior version only showed
                                // a destination when the gift had a single
                                // selectedTicker — gifts auto-allocated across the
                                // managed mix and cash-parked gifts both rendered
                                // an empty bottom-info row, which read as "this
                                // gift had less context" even though they were
                                // identical events. Now: every settled gift gets
                                // a destination line. Order:
                                //   1. selectedTicker → specific holding name
                                //   2. cash-park (explicit or fallback) → "Held as cash"
                                //   3. anything else settled → "{Child}'s mix"
                                //   4. still in flight → no line (status pill below
                                //      already carries that signal in non-hero
                                //      surfaces; hero stays calm)
                                const giftStatus = String((g as any)?.status || "").toLowerCase();
                                const giftExec = String((g as any)?.executionModel || "").toLowerCase();
                                const isSettled = ["invested", "settled", "completed"].includes(giftStatus);
                                const childPossessive = recipientFirstNameDisplay
                                  ? `${recipientFirstNameDisplay}'s`
                                  : "the";
                                const destinationName = holdingName
                                  ? holdingName
                                  : isSettled
                                  ? (giftExec === "cash" ? "cash" : `${childPossessive} mix`)
                                  : null;
                                const destinationPrefix = destinationName === "cash" ? "Held as " : "Went into ";
                                return (
                                  <>
                                    <p style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 3 }}>
                                      {heroGiftIdx === 0 ? "Latest gift" : "Recent gift"}
                                    </p>
                                    <p style={{ fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.88)", lineHeight: 1.35 }}>
                                      {displayGifterName(g?.senderName, (g as any)?.isAnonymous)} added {formatCurrency(amt)} to {recipientFirstNameDisplay || "the fund"}'s future.
                                    </p>
                                    {/* Status pills (✓ Thanked / ⏳ Awaiting thanks / ✨ From you /
                                        🌱 Settling / No thanks yet) intentionally dropped from the
                                        hero. The green section is the parent's emotional/celebratory
                                        anchor surface — those pills are a task/state register that
                                        belongs in the Activity feed, the Thank You manager, and the
                                        bell. Mixing them into the hero converted an emotional surface
                                        into a partial task list and created light guilt pressure
                                        ("you haven't thanked uncle yet") at exactly the moment the
                                        parent should feel good about the fund. Per the bell-vs-tab
                                        semantic split: hero = anchor, Activity = ledger, bell = needs
                                        glance. */}
                                    {/* Bottom info row — height-reserved so a gift with no
                                        holding / event / message doesn't shrink the card vs gifts
                                        that have all three. Same render priority as before. */}
                                    <div style={{ minHeight: 16, marginTop: 8 }}>
                                      {destinationName ? (
                                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.3 }}>
                                          {/* Dollar amount intentionally dropped here — the gift
                                              narrative line above (e.g. "Dovi added $100 to Emma's
                                              future") already shows the amount. Repeating it within
                                              30px is the duplication that makes this section read
                                              "crammed." This line carries the destination only. */}
                                          {destinationPrefix}{destinationName}
                                          {giftEventName ? ` · ${giftEventName}` : ""}
                                        </p>
                                      ) : giftEventName ? (
                                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.3 }}>
                                          {giftEventName}
                                        </p>
                                      ) : g?.message ? (
                                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                                          "{g.message}"
                                        </p>
                                      ) : null}
                                    </div>
                                  </>
                                );
                              })()}
                            </motion.div>
                          </AnimatePresence>
                          {recentGiftsFeed.length > 1 && (
                            <div style={{ display: "flex", gap: 5, marginTop: 8, justifyContent: "center" }}>
                              {recentGiftsFeed.slice(0, 5).map((_, dotIdx) => (
                                <button
                                  key={`dot-${dotIdx}`}
                                  type="button"
                                  onClick={() => setHeroGiftIdx(dotIdx)}
                                  style={{
                                    width: dotIdx === heroGiftIdx ? 18 : 6,
                                    height: 6,
                                    borderRadius: 3,
                                    background: dotIdx === heroGiftIdx ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.22)",
                                    border: "none",
                                    padding: 0,
                                    cursor: "pointer",
                                    transition: "all 0.3s ease",
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        );
                      })()}

                      {/* CTA row. Share button hidden for read-only roles
                          (viewers + previous owners post-handoff). For a
                          previous owner, the gift link is the kid's now;
                          a Share affordance pointing at their old fund
                          would invite gifts that go to a fund they no
                          longer control. Cleaner to hide entirely than
                          to leave a 403-bound dead CTA. */}
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
                        {!isReadOnlyFund && (
                          <button
                            onClick={() => { haptic("medium"); handleShareLink(); }}
                            data-testid="button-hero-share-link"
                            className="kiddo-press"
                            style={{
                              padding: "10px 20px", fontSize: 13,
                              background: "hsl(var(--kiddo-gold))", color: "white",
                              border: "none", borderRadius: 9999,
                              fontWeight: 700, cursor: "pointer",
                              display: "inline-flex", alignItems: "center", gap: 6,
                            }}
                          >
                            <Share2 size={13} color="white" />
                            Share
                          </button>
                        )}
                        {(() => {
                          // Hero CTA = the long-horizon emotional anchor. Math
                          // (two-phase contribution + compound, 7% yearly average,
                          // UTMA-aware: contributions stop at 18) lives in the
                          // `heroProjectedAt65` useMemo at the top of this
                          // component so the cached-first-number hook can drive
                          // the count-up animation. `displayHeroProjectedAt65`
                          // paints the LAST cached projection instantly on load
                          // and animates UP to the new value when fresher data
                          // lands. Acorns-style: never animates downward, never
                          // shows a skeleton, the parent always sees a number.
                          const formatted = new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 0,
                          }).format(displayHeroProjectedAt65);
                          return (
                            <button
                              onClick={() => {
                                haptic("selection");
                                if (activeFundId) setLocation(`/projection/${activeFundId}`);
                              }}
                              data-testid="button-hero-view-fund"
                              style={{
                                background: "rgba(255,255,255,0.14)",
                                border: "1px solid rgba(255,255,255,0.28)",
                                borderRadius: 9999,
                                padding: "10px 18px",
                                fontSize: 13,
                                fontWeight: 700,
                                color: "white",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                              title={`See ${recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "their"} full potential on the projection page`}
                            >
                              <span style={{ fontWeight: 800, letterSpacing: "0.01em" }}>{formatted}</span>
                              <span style={{ opacity: 0.78, fontSize: 11.5, fontWeight: 600 }}>at 65</span>
                              <span style={{ opacity: 0.85 }}>→</span>
                            </button>
                          );
                        })()}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.section>

            {/* SSN nudge — placed AFTER the hero card so the parent gets
                their warm balance + chart + share CTA first, then sees this
                as one of several setup tasks. Previously above the hero,
                which read as "compliance masquerading as a welcome." */}
            {/* ssnSnoozeTick is incremented on snooze so this condition
                re-evaluates after dismissal. We don't reference it inside
                the condition (it's a state-bump only) — React re-renders
                when state changes regardless of whether it's read. */}
            {ssnSnoozeTick >= 0 && activeFund &&
              !(user as any)?.isDemoAccount &&
              String((activeFund as any).accountType || "UTMA").toUpperCase() === "UTMA" &&
              !(activeFund as any).recipientSsnCollectedAt &&
              !readSsnLatched(String(activeFund.id)) &&
              !isSsnSnoozed(String(activeFund.id)) && (
              <div className="mt-4">
                <SsnCollectionNudge
                  key={activeFund.id}
                  fundId={String(activeFund.id)}
                  childFirst={recipientFirstNameDisplay || "your child"}
                  hasMultipleFunds={funds.length > 1}
                  onCollected={async (updatedFund: any) => {
                    if (!updatedFund || !updatedFund.id) return;
                    await queryClient.cancelQueries({ queryKey: ["/api/funds"] });
                    queryClient.setQueryData<any[]>(["/api/funds"], (prev) =>
                      Array.isArray(prev)
                        ? prev.map((f) => (f?.id === updatedFund.id ? { ...f, ...updatedFund } : f))
                        : prev,
                    );
                  }}
                />
              </div>
            )}

            {/* ============================================================================
                30-DAY SUMMARY CARD — Acorns-style scannable lines, Kiddo-warm copy.
                Lives directly under the hero so it's impossible to miss. Each row
                tappable, deep-links to the relevant detail surface. Rendered when ANY
                line has activity OR there's a scheduled run preview to show.

                Dynamic label and period: for funds <30 days old we show "Fund so far"
                with a period that starts at the fund's creation date — saying "Last 30
                days · Apr 4 → today" when the fund didn't exist until Apr 13 is a
                literal lie we shouldn't ship. Once the fund crosses 30 days the label
                rolls to "Last 30 days" with a true rolling 30-day window.
                ============================================================================ */}
            {(() => {
              const NOW_MS = Date.now();
              const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
              const thirtyDaysAgoMs = NOW_MS - THIRTY_DAYS_MS;
              const fundCreatedMs = activeFund?.createdAt
                ? new Date(String(activeFund.createdAt)).getTime()
                : null;
              const fundAgeDays = fundCreatedMs && Number.isFinite(fundCreatedMs)
                ? Math.max(0, (NOW_MS - fundCreatedMs) / (24 * 60 * 60 * 1000))
                : null;
              // LIFETIME mode permanently. Was: the section reframed to
              // "last 30 days" once the fund crossed 30 days old —
              // emotionally tiny for a kid's fund built over years and
              // at odds with the design lens (Emma at 18 looking back
              // wants the lifetime story, not a recent-month flow).
              // Activity tab does the 30-day flow story perfectly; this
              // section is now exclusively the lifetime "fund so far"
              // story. The 30-day variable name is preserved internally
              // to minimize churn — semantics now mean "since fund
              // creation" everywhere.
              const periodStartMs = fundCreatedMs ?? thirtyDaysAgoMs;
              const isYoungFund = fundAgeDays != null && fundAgeDays < 30;
              void isYoungFund; // kept for any downstream branching that may come back

              const ownerEmail = String(user?.email || "").trim().toLowerCase();
              const last30 = (gifts || []).filter((g) => {
                const d = g.createdAt ? new Date(String(g.createdAt)).getTime() : 0;
                if (!d || d < periodStartMs) return false;
                const status = String(g.status || "").toLowerCase();
                return status !== "failed" && status !== "refunded";
              });
              const last30FromOthers = last30.filter((g) =>
                String((g as any).senderEmail || "").trim().toLowerCase() !== ownerEmail || ownerEmail === "",
              );
              const last30Auto = last30.filter((g) => !!(g as any).parentContributionId);
              const last30OneTime = last30.filter((g) =>
                ownerEmail !== ""
                && String((g as any).senderEmail || "").trim().toLowerCase() === ownerEmail
                && !(g as any).parentContributionId,
              );
              // Exclude parent's own gifts from the "from others" total when we know who
              // the owner is — a gift you sent yourself isn't "from people who love her".
              const fromOthersIfKnown = ownerEmail
                ? last30.filter((g) => {
                    const e = String((g as any).senderEmail || "").trim().toLowerCase();
                    return e !== ownerEmail;
                  })
                : last30FromOthers;
              const sumAmt = (rows: typeof last30) => rows.reduce((s, g) => {
                const n = parseFloat(String((g as any).netAmount || g.amount || "0"));
                return s + (Number.isFinite(n) && n > 0 ? n : 0);
              }, 0);
              const giftsFromOthersTotal = sumAmt(fromOthersIfKnown);
              const yourAutoInvestTotal = sumAmt(last30Auto);
              const yourOneTimeTotal = sumAmt(last30OneTime);

              // 30-day market growth: walk fundHistory for the snapshot at or before 30
              // days ago, compute (today's value − then's value) − (today's basis − then's
              // basis). That isolates market movement from new contributions. Skipped when
              // there's no qualifying snapshot (fund younger than 30 days).
              const olderSnaps = fundHistory.filter((s) =>
                new Date(String(s.snapshotDate || 0)).getTime() <= periodStartMs,
              );
              const snap30 = olderSnaps[0];
              const valueThen = snap30 ? parseFloat(String(snap30.totalValue || "0")) : null;
              const basisThen = snap30 ? parseFloat(String(snap30.principalBasis || "0")) : null;
              // 30-day market growth — formerly used `currentFundBasis -
              // basisThen` to estimate "money in this period," which broke
              // when cost basis drifted from actual contributions (sales
              // re-feeding cash into new positions, test-data shenanigans
              // inflating basis). Now uses the SAME period-flow totals
              // we display above (giftsFromOthersTotal + yourAutoInvestTotal
              // + yourOneTimeTotal) as the "money in" denominator —
              // self-consistent with the rendered breakdown. As a result,
              // for young funds (no qualifying snapshot) this collapses
              // cleanly to `currentValue − contributions` → "Total so
              // far" naturally equals the actual fund value, matching
              // every other surface in the app.
              const periodContributionFlows = giftsFromOthersTotal + yourAutoInvestTotal + yourOneTimeTotal;
              const marketGrowth30 = (valueThen != null && Number.isFinite(valueThen))
                ? (totalValue - valueThen) - periodContributionFlows
                : (totalValue - periodContributionFlows);

              // Lifetime withdrawals — sums withdrawal transactions since
              // the period start. Only surfaced as a row when nonzero.
              const periodWithdrawals = (fundTransactions || []).reduce((sum, tx) => {
                if (String(tx?.type || "").toLowerCase() !== "withdrawal") return sum;
                const ts = tx?.createdAt ? new Date(String(tx.createdAt)).getTime() : 0;
                if (!ts || ts < periodStartMs) return sum;
                const n = parseFloat(String(tx?.amount || "0"));
                return sum + (Number.isFinite(n) && n > 0 ? n : 0);
              }, 0);
              // Cash sitting uninvested — uses the outer-scope `cash`
              // (cashBalance only, excluding settling). Surfaced as a
              // row only when nonzero; silent on the typical case.
              const periodCash = cash;

              const total30 = giftsFromOthersTotal + yourAutoInvestTotal + yourOneTimeTotal + marketGrowth30 - periodWithdrawals;

              // Next scheduled run — soonest active parent_contribution.
              const nextScheduled = (parentContributions || [])
                .filter((c: any) => c.status === "active" && c.nextRunDate)
                .map((c: any) => ({ ...c, nextTs: new Date(String(c.nextRunDate)).getTime() }))
                .filter((c: any) => Number.isFinite(c.nextTs) && c.nextTs > Date.now())
                .sort((a: any, b: any) => a.nextTs - b.nextTs)[0];

              // Render guard: don't show the card if there's literally nothing to say
              // AND no upcoming run. Empty hero is fine on a brand-new fund.
              const hasAnything =
                fromOthersIfKnown.length > 0
                || last30Auto.length > 0
                || last30OneTime.length > 0
                || (marketGrowth30 != null && Math.abs(marketGrowth30) >= 0.01)
                || !!nextScheduled;
              if (!hasAnything) return null;

              const childFirst = recipientFirstNameDisplay || "Your child";
              const childPossess = recipientFirstNameDisplay
                ? `${recipientFirstNameDisplay}'s`
                : "Their";
              const fmtRow = (n: number, signed = false) => {
                const sign = signed && n > 0 ? "+" : signed && n < 0 ? "−" : "";
                const v = Math.abs(n);
                return `${sign}${formatCurrency(v)}`;
              };
              const fmtNextDate = (ts: number) =>
                new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

              return (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  data-testid="section-last-30-summary"
                >
                  {/* Visual pairing with the green hero above: cream background instead of
                      white, evergreen-tinted border, matching shadow. Reads as the same
                      family as the hero — different section, same warmth. The hero is
                      evergreen on top; this card sits below as a softer, secondary cousin
                      in the same color story rather than a generic white tile. */}
                  <div
                    className="rounded-3xl p-5"
                    style={{
                      background: "hsl(var(--kiddo-cream))",
                      border: "1px solid hsl(var(--kiddo-evergreen) / 0.18)",
                      boxShadow: "0 1px 3px rgba(26,67,50,0.06), 0 4px 12px rgba(26,67,50,0.04)",
                    }}
                  >
                    <div className="flex items-baseline justify-between mb-4">
                      {/* Always "fund so far" — lifetime view permanently
                          (was "last 30 days" once fund crossed 30 days). */}
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        {childPossess} fund so far <span aria-hidden>🌱</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">
                        {new Date(periodStartMs).toLocaleDateString("en-US", { month: "short", day: "numeric", year: fundAgeDays != null && fundAgeDays > 365 ? "numeric" : undefined, timeZone: "UTC" })} → today
                      </p>
                    </div>

                    <div className="space-y-2">
                      {/* Gifts row navigates to Memory Book. Pronoun pulled
                          from getPronouns(activeFund.pronoun).object so the
                          line respects the fund's setting (was previously
                          checking if the child's NAME equaled the string
                          "they" — nonsensical fallback that defaulted to
                          "her" for everyone else, including they/them kids).
                          ChevronRight signals "navigates away" — consistent
                          with the other two navigate-away rows below
                          (Market growth, Withdrawals). Scroll-within-page
                          rows (Recurring, One-time, Cash) deliberately
                          have no chevron — their affordance is the gold
                          halo on the target Dashboard section. */}
                      <button
                        type="button"
                        onClick={() => { haptic("selection"); setLocation(`/memory/${activeFundId}`); }}
                        className="w-full flex items-baseline justify-between py-1.5 hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors text-left"
                        data-testid="last30-row-gifts"
                      >
                        <span className="text-sm text-muted-foreground">
                          {/* Name instead of pronoun. The fund's pronoun is
                              respected elsewhere (Kid View copy, smart-nudge,
                              age-18 walkthrough), but THIS line reads warmer
                              with the actual first name. The pronoun default
                              of 'them' when unset rendered awkwardly for
                              clearly-gendered names ('Gifts from people who
                              love them' for Emma's fund). Per the 2026-05-13
                              audit. Falls back to 'your child' when no first
                              name is present (e.g. brand-new fund). */}
                          Gifts from people who love {childFirst}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-foreground tabular-nums">
                            {fmtRow(giftsFromOthersTotal)}
                          </span>
                          <ChevronRight size={14} className="text-muted-foreground/50 flex-shrink-0" aria-hidden />
                        </span>
                      </button>
                      <button
                        type="button"
                        // Deep-link to the Dashboard's own "Recurring investments"
                        // section with gold halo, rather than routing to
                        // /activity?filter=auto (which mixed recurring + one-time
                        // together — the same destination both rows shared
                        // before this fix). The recurring-investments section
                        // lives on this page; intra-page scroll keeps the user
                        // in context and lands them right on the schedule list
                        // they manage. Locked pattern per
                        // project_deep_link_scroll_pattern.md.
                        onClick={() => summaryScrollTo("recurring")}
                        className="w-full flex items-baseline justify-between py-1.5 hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors text-left"
                        data-testid="last30-row-auto"
                      >
                        <span className="text-sm text-muted-foreground">
                          Your recurring investments
                          {/* When the 30-day total is zero AND there's a scheduled run
                              queued, append "starts {date}" so the bare $0 doesn't look
                              like a bug to a parent looking at 3 active schedules below.
                              The recurring worker hasn't fired the first run yet — this
                              line tells them when it will. */}
                          {yourAutoInvestTotal === 0 && nextScheduled && (
                            <span className="text-[11px] text-muted-foreground/70">
                              {" · starts "}{fmtNextDate(nextScheduled.nextTs)}
                            </span>
                          )}
                        </span>
                        {/* Invisible ChevronRight reserves the layout space the
                            navigate-away rows (Gifts / Market growth / Withdrawals)
                            spend on their visible chevron — so all dollar values
                            column-align across the card regardless of whether the
                            row navigates away or scrolls within the page. */}
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-foreground tabular-nums">
                            {fmtRow(yourAutoInvestTotal)}
                          </span>
                          <ChevronRight size={14} className="invisible flex-shrink-0" aria-hidden />
                        </span>
                      </button>
                      <button
                        type="button"
                        // Deep-link to the Dashboard's "One-time investment"
                        // card with gold halo. Pairs with the recurring row
                        // above; each row drills into the matching section on
                        // the same page rather than dumping both into the same
                        // Activity-filter URL (which was a real bug — both
                        // routed to /activity?filter=auto).
                        onClick={() => summaryScrollTo("onetime")}
                        className="w-full flex items-baseline justify-between py-1.5 hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors text-left"
                        data-testid="last30-row-onetime"
                      >
                        <span className="text-sm text-muted-foreground">Your one-time additions</span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-foreground tabular-nums">
                            {fmtRow(yourOneTimeTotal)}
                          </span>
                          <ChevronRight size={14} className="invisible flex-shrink-0" aria-hidden />
                        </span>
                      </button>
                      {marketGrowth30 != null && (
                        <button
                          type="button"
                          onClick={() => { haptic("selection"); if (activeFundId) setLocation(`/projection/${activeFundId}`); }}
                          className="w-full flex items-baseline justify-between py-1.5 hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors text-left"
                          data-testid="last30-row-growth"
                        >
                          <span className="text-sm text-muted-foreground">Market growth</span>
                          {/* Chevron signals "navigates to /projection" (the
                              forward-looking "what could this become" page,
                              not a holdings drill-down). Per the locked rule
                              that growth click destinations point FORWARD
                              (kid-at-18 projection), not BACKWARD (Robinhood
                              performance-attribution). See project_design_lens_kid_at_18.md
                              and feedback_chart_range_stat_behavior.md. */}
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`text-sm font-semibold tabular-nums ${marketGrowth30 >= 0 ? "text-[hsl(var(--kiddo-evergreen))]" : "text-red-500"}`}>
                              {fmtRow(marketGrowth30, true)}
                            </span>
                            <ChevronRight size={14} className="text-muted-foreground/50 flex-shrink-0" aria-hidden />
                          </span>
                        </button>
                      )}
                      {/* Cash row was previously rendered HERE (inline with
                          the input rows like Gifts / One-time / Market
                          growth). The math was correct but the placement
                          was misleading: a parent reasonably sums the
                          visible numbers and gets a total $X higher than
                          "Worth today" because cash is a SUBSET of the
                          input flows, not an additive input. Moved below
                          the Worth today divider as a sub-detail.
                          Per the 2026-05-13 audit. */}
                      {/* Withdrawals — only shown when nonzero. Negative
                          framing (red, prefixed minus) so it's visually
                          distinct from positive flows. */}
                      {periodWithdrawals > 0.005 && (
                        <button
                          type="button"
                          // Route to /activity unfiltered. The previous
                          // ?filter=growth was semantically wrong — "growth"
                          // is the auto+growth category aggregate, not
                          // withdrawals. No dedicated withdrawals filter
                          // exists in Activity.tsx today; unfiltered lands the
                          // user where they can scan recent activity and find
                          // withdrawal rows. If a dedicated withdrawals filter
                          // ships later, swap this URL.
                          onClick={() => { haptic("selection"); setLocation("/activity"); }}
                          className="w-full flex items-baseline justify-between py-1.5 hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors text-left"
                          data-testid="lifetime-row-withdrawals"
                        >
                          <span className="text-sm text-muted-foreground">Withdrawals</span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-sm font-semibold tabular-nums text-red-500">
                              −{fmtRow(periodWithdrawals)}
                            </span>
                            <ChevronRight size={14} className="text-muted-foreground/50 flex-shrink-0" aria-hidden />
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Worth today — separated by a divider so it reads
                        as the sum. Was "Total so far" / "Total this
                        month" — relabeled to make it unambiguous: this
                        is the fund's actual current worth, not a running
                        tally.

                        The "since {date}" sub-line was deleted 2026-05-13.
                        The panel header already shows "{date} → today"
                        with year for funds older than 365 days; repeating
                        the date below Worth today was redundant. The
                        original argument for the duplicate was emotional
                        anchor for old funds ("since June 14, 2019" reads
                        as 'we've been doing this since the day they were
                        born') — but the header already carries that date
                        for old funds. The Worth today section's other
                        sub-lines (cash status + next-scheduled preview)
                        carry NEW information; the date sub-line did not. */}
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-bold text-foreground">Worth today</span>
                        {/* Wrap matches the input-row pattern (inline-flex
                            + gap-1.5 + invisible ChevronRight 14px) so the
                            right edge of the Worth today number column-aligns
                            with the right edge of the rows above. */}
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-heading text-lg font-bold tabular-nums text-foreground">
                            {/* Unsigned — Worth today is a TOTAL VALUE, not a delta. */}
                            {fmtRow(total30)}
                          </span>
                          <ChevronRight size={14} className="invisible flex-shrink-0" aria-hidden />
                        </span>
                      </div>
                      {/* Cash-status sub-detail. Subordinate to Worth today
                          because it's a SUBSET of that total (the portion
                          not yet invested), not an additive input.
                          Tappable to scroll to the cash card where the
                          parent can choose to invest it. Silent when zero.

                          Wording uses "of that" to point back at Worth
                          today and make the subset relationship explicit.
                          Earlier versions led with a bullet "·" which
                          read as "and also" (additive) — a calm user
                          would math Worth today + $50 cash and conclude
                          the total was off. Per the 2026-05-13 audit.
                          The "of that" phrasing eliminates the ambiguity
                          without splitting into Invested + Cash sub-lines
                          (which would add a line for marginal info). */}
                      {periodCash > 0.005 && (
                        <button
                          type="button"
                          onClick={() => summaryScrollTo("cash")}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground/80 hover:text-foreground transition-colors"
                          data-testid="lifetime-row-cash"
                        >
                          {/* Settling-state copy enhancement 2026-05-14
                              per FUND_STATES_SPEC.md item 1. Original
                              copy stopped at "waiting to invest" which
                              left the parent without a time horizon.
                              Adding "Available in 1 to 2 business
                              days" matches the locked settling-window
                              vocabulary used on the gifter side
                              (GiftSuccess.tsx, mobile GifterFlow
                              handoff step) so both sides read as one
                              coherent story. */}
                          <span className="tabular-nums">{fmtRow(periodCash)}</span>
                          <span>of that is still in cash. Invests on the next cycle, usually 1 to 2 business days.</span>
                          <ChevronRight size={12} className="opacity-60" aria-hidden />
                        </button>
                      )}
                    </div>

                    {/* Next scheduled — preview at the bottom. Only when there's an
                        upcoming active run. Tappable: drops into Activity → Scheduled. */}
                    {nextScheduled && (() => {
                      const nextAmt = parseFloat(String(nextScheduled.amount || "0"));
                      const nextDate = fmtNextDate(nextScheduled.nextTs);
                      const nextTicker = nextScheduled.selectedTicker;
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            haptic("selection");
                            // Land on the Scheduled tab with this specific
                            // contribution highlighted + scrolled into view.
                            // Activity.tsx parses ?tab + ?highlight on mount.
                            const sid = String(nextScheduled?.id || "");
                            const target = sid
                              ? `/activity?tab=scheduled&highlight=${encodeURIComponent(sid)}`
                              : `/activity?tab=scheduled`;
                            setLocation(target);
                          }}
                          className="mt-3 w-full flex items-center justify-between gap-2 rounded-lg bg-[hsl(var(--kiddo-evergreen)/0.06)] border border-[hsl(var(--kiddo-evergreen)/0.18)] px-3 py-2 hover:bg-[hsl(var(--kiddo-evergreen)/0.10)] transition-colors text-left"
                          data-testid="last30-next-scheduled"
                        >
                          <span className="text-[12px] text-foreground">
                            <span className="font-semibold">Next:</span>{" "}
                            <span className="text-muted-foreground">
                              {Number.isFinite(nextAmt) ? formatCurrency(nextAmt) : ""} recurring investment
                              {nextTicker ? ` → ${nextTicker}` : ""} · {nextDate}
                            </span>
                          </span>
                          <span className="text-[11px] font-semibold text-[hsl(var(--kiddo-evergreen))]">
                            View →
                          </span>
                        </button>
                      );
                    })()}

                    {/* Last-30-days handoff to Activity. The section is
                        permanently lifetime-mode now; parents who want
                        the recent-flow story drop into Activity for it
                        (where the 30-day breakdown lives perfectly).
                        Quiet text link, only shown when there's actually
                        something in the period to look at. */}
                    {(giftsFromOthersTotal > 0 || yourAutoInvestTotal > 0 || yourOneTimeTotal > 0 || periodWithdrawals > 0) && (
                      <button
                        type="button"
                        onClick={() => { haptic("selection"); setLocation("/activity"); }}
                        className="mt-3 w-full text-center text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        data-testid="lifetime-link-recent"
                      >
                        Last 30 days ↗
                      </button>
                    )}
                  </div>
                </motion.section>
              );
            })()}

            {uninvestedCash > 0 && !isReadOnlyFund && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.010 }}
              >
                <button
                  type="button"
                  onClick={() => { setInvestCashInitialTicker(""); setInvestCashOpen(true); haptic("light"); }}
                  className="kiddo-card w-full p-4 text-left transition-all hover:border-[hsl(var(--kiddo-gold)/0.45)]"
                  style={getDeepLinkHighlightCardStyle(summaryHaloTarget === "cash")}
                  data-testid="button-invest-cash"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[hsl(var(--kiddo-gold)/0.25)] bg-[hsl(var(--kiddo-gold)/0.12)]">
                          {/* Banknote, not TrendingUp. Icons identify
                              the noun ("this card is about cash"),
                              not the verb ("...that could grow").
                              Also matches the InvestCashModal that
                              opens on tap — Banknote is used there
                              for the cash row, so the card→modal
                              transition reads as one surface. */}
                          <Banknote size={17} className="text-[hsl(var(--kiddo-evergreen))]" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                          {cashContext === "kyc_pending" ? "Verification complete" : cashContext === "held_as_cash" ? "Cash is waiting" : "Cash is waiting"}
                        </p>
                        <p className="text-xl font-bold text-foreground font-heading">{formatCurrency(uninvestedCash)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {cashContext === "kyc_pending" && "Choose how much to invest now, or leave it in cash."}
                          {cashContext === "held_as_cash" && "You can invest some, all, or none of it today."}
                          {cashContext === "gifts_settled" && `${recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "The"} cash is ready. You choose the amount.`}
                        </p>
                      </div>
                    </div>
                    {/* Evergreen primary-CTA pill, NOT gold. Gold's
                        Tier-A weight (solid pill, white text) is locked
                        to Share buttons exclusively — using it for the
                        cash-invest action dilutes Share's brand
                        signature. The card already uses gold as a
                        Tier-B accent (border + icon-background tint
                        above) which is fine. See feedback in
                        project_color_palette_60_30_10.md. */}
                    <div className="shrink-0 whitespace-nowrap rounded-full bg-[hsl(var(--kiddo-evergreen))] px-3 py-1.5 text-xs font-semibold text-white">
                      Review options
                    </div>
                  </div>
                </button>
              </motion.section>
            )}

            {/* Quick links — four canonical jobs, always.
                  1. Share          → loop trigger (the most important action)
                  2. Gifter page    → preview from the gifter's perspective
                  3. {Child}'s view → preview from the kid's perspective (mobile + KidView page)
                  4. Occasion       → DYNAMIC: most-relevant active occasion as a one-tap
                                      preview/share, falling back to "New occasion ✨"
                                      creator when no active occasion exists.
                Hard rule: this row is for PREVIEWS + SHARE shortcuts only. Inline actions
                that already have dedicated dashboard sections (Add investment, Memory Book)
                belong in those sections — duplicating them here is interaction debt, not
                generosity. See feedback_quick_links_principle.md.
                Mobile renders compact icon+micro-label pills; desktop bumps tile/label
                sizes via md: classes so the same component breathes on a wider canvas. */}
            {activeFund && (() => {
              const childFirst = (recipientFirstNameDisplay || "").trim() || "Kid";
              const fundSlug = (activeFund as any).slug;
              const activeOccasion = pickActiveOccasion(events);
              // Compute a tight "label" for the occasion button.
              //   ≤7 days: urgency phrasing — "in Xd" or "Tomorrow" or "Today"
              //   ≤30 days: same urgency phrasing (still feel-it-coming)
              //   else: short event name (truncated to ~10ch)
              //   no occasion: "New occasion"
              const occasionEmoji = activeOccasion ? eventEmoji(activeOccasion.eventType) : null;
              const occasionDays = activeOccasion?.eventDate
                ? Math.ceil((new Date(activeOccasion.eventDate).getTime() - Date.now()) / 86400000)
                : null;
              const occasionLabel = activeOccasion
                ? (occasionDays !== null && occasionDays <= 30
                    ? (occasionDays === 0 ? "Today" : occasionDays === 1 ? "Tomorrow" : `in ${occasionDays}d`)
                    : (() => {
                        const raw = String(activeOccasion.name || "Occasion").trim();
                        return raw.length > 10 ? `${raw.slice(0, 9)}…` : raw;
                      })())
                : "New occasion";
              const occasionIsImminent = activeOccasion && occasionDays !== null && occasionDays <= 30;
              const occasionSlug = activeOccasion?.slug;
              const handleOccasionTap = () => {
                haptic("selection");
                if (activeOccasion && fundSlug && occasionSlug) {
                  // Preview the occasion's public gifter page (e.g. /emma/birthday-2026)
                  window.open(`/${fundSlug}/${occasionSlug}`, "_blank");
                } else {
                  // Empty state → create one. Same affordance, contextual job.
                  setCreateEventSheetOpen(true);
                }
              };
              // Responsive tile + label classes. Mobile keeps the compact original
              // sizes; md+ scales up so desktop reads as a proper quick-links panel
              // instead of a tiny mobile row marooned in white space.
              const btn = "flex flex-1 min-w-0 flex-col items-center gap-[5px] md:gap-2 py-1 md:py-2 select-none cursor-pointer transition-all active:opacity-50 active:scale-95 bg-transparent border-0";
              const tile = "w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center bg-[hsl(var(--kiddo-cream))] text-[hsl(var(--kiddo-evergreen))]";
              const tileGold = "w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center bg-[hsl(var(--kiddo-gold)/0.14)] text-[hsl(var(--kiddo-ink))]";
              const lbl = "text-[9.5px] md:text-xs font-medium text-muted-foreground leading-tight text-center";
              const lblGold = "text-[9.5px] md:text-xs font-semibold text-[hsl(var(--kiddo-ink))] leading-tight text-center";
              return (
                <motion.section
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: 0.011 }}
                >
                  <div className="flex w-full">
                    {/* 1. Share — the loop trigger.
                        Hidden for read-only roles. A previous owner sharing
                        their handed-off fund's link would route incoming
                        gifts to a fund they no longer control; viewers
                        sharing isn't theirs to do. Preview pills (gifter
                        page, kid view) stay visible — those are READ
                        affordances, not WRITE actions. */}
                    {!isReadOnlyFund && (
                      <button type="button" onClick={() => { haptic("medium"); handleShareLink(); }} className={btn} data-testid="pill-share-link">
                        <span className={tile}><Share2 size={14} className="md:hidden" strokeWidth={2} /><Share2 size={18} className="hidden md:block" strokeWidth={2} /></span>
                        <span className={lbl}>Share link</span>
                      </button>
                    )}
                    {/* 2. Gifter page — preview from gifter perspective.
                        Wouter <Link> for proper SPA nav. Pass props directly on
                        Link (no inner <a>) so wouter renders one clean anchor
                        with its own click handler — no merging/race weirdness. */}
                    {fundSlug ? (
                      <Link
                        href={`/${fundSlug}`}
                        className={btn}
                        data-testid="pill-gifter-page"
                        onClick={() => haptic("selection")}
                      >
                        <span className={tile}><Eye size={14} className="md:hidden" strokeWidth={2} /><Eye size={18} className="hidden md:block" strokeWidth={2} /></span>
                        <span className={lbl}>Gifter page</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className={btn}
                        data-testid="pill-gifter-page"
                        style={{ pointerEvents: "none", opacity: 0.5 }}
                      >
                        <span className={tile}><Eye size={14} className="md:hidden" strokeWidth={2} /><Eye size={18} className="hidden md:block" strokeWidth={2} /></span>
                        <span className={lbl}>Gifter page</span>
                      </button>
                    )}
                    {/* 3. {Child}'s view — preview from kid perspective */}
                    <button type="button" onClick={() => { haptic("selection"); setKidViewConfigStep(kidViewSettings?.enabled ? "done" : "settings"); setKidViewConfigOpen(true); }} className={btn} data-testid="pill-kid-view">
                      <span className={tile}><Smile size={14} className="md:hidden" strokeWidth={2} /><Smile size={18} className="hidden md:block" strokeWidth={2} /></span>
                      <span className={`${lbl} w-full`}>{childFirst}'s view</span>
                    </button>
                    {/* 4. Occasion — DYNAMIC: wouter <Link> for active occasion
                        nav (handles SPA routing + cmd/ctrl-click new-tab),
                        <button> fallback for the empty-state "create new
                        occasion" sheet trigger. Props on Link directly — no
                        inner <a> — so wouter manages the single anchor cleanly. */}
                    {activeOccasion && fundSlug && occasionSlug ? (
                      <Link
                        href={`/${fundSlug}/${occasionSlug}`}
                        className={btn}
                        data-testid="pill-occasion-active"
                        aria-label={`Open ${activeOccasion.name || "occasion"} page`}
                        onClick={() => haptic("selection")}
                      >
                        <span className={occasionIsImminent ? tileGold : tile}>
                          <span className="text-[18px] md:text-[22px] leading-none" aria-hidden="true">{occasionEmoji}</span>
                        </span>
                        <span className={occasionIsImminent ? lblGold : lbl}>{occasionLabel}</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={handleOccasionTap}
                        className={btn}
                        data-testid="pill-occasion-new"
                        aria-label="Create new occasion"
                      >
                        <span className={tile}>
                          {/* CalendarClock replaces Sparkles 2026-05-12 — the
                              "create new occasion" CTA semantically maps to
                              the locked "Calendar (event with time)" icon
                              per feedback_iconography_consistency.md.
                              Sparkles was AI-slop iconography banned by
                              feedback_no_ai_slop.md. */}
                          <CalendarClock size={14} className="md:hidden" strokeWidth={2} />
                          <CalendarClock size={18} className="hidden md:block" strokeWidth={2} />
                        </span>
                        <span className={lbl}>{occasionLabel}</span>
                      </button>
                    )}
                  </div>
                </motion.section>
              );
            })()}

            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.012 }}
            >
              <div className="kiddo-card overflow-hidden p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--kiddo-border)/0.65)] px-4 pt-3">
                  <h3 className="text-sm font-bold text-muted-foreground">
                    {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s growth` : "Fund growth"}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1">
                    {(["1W", "1M", "YTD", "1Y", "5Y", "ALL"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setChartRange(r)}
                        className={`border-b-2 px-2.5 py-1.5 text-xs transition-colors ${chartRange === r ? "border-[hsl(var(--kiddo-evergreen))] font-bold text-[hsl(var(--kiddo-evergreen))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <Suspense fallback={<div className="h-[180px] w-full bg-[linear-gradient(180deg,hsl(var(--kiddo-evergreen)/0.06),transparent)]" aria-hidden="true" />}>
                  <div className="relative">
                    <DashboardTrendChart data={trendData} onScrub={setScrubbedTrendPoint} />
                    {totalValue > 0 && trendData.length > 0 && (() => {
                      // Live dot — sits on the rightmost end of the chart
                      // line (the most recent plotted value), pulsing to
                      // signal "this is where the fund is right now."
                      //
                      // Two bugs the previous version had:
                      //   (1) The Y-domain math diverged from the chart's
                      //       own domain. Chart used `dataMax + max(dataMax
                      //       * 0.12, 1)`. Dot used `dataMax * 1.12`.
                      //       Match in normal cases, drift apart when
                      //       dataMax is small (< 8.33), which slid the
                      //       dot above or below the actual line peak.
                      //   (2) The dot was positioned at `totalValue`, but
                      //       the chart's line ENDS at the rightmost
                      //       trendData point. If snapshots lag the live
                      //       value (just-landed contribution, market
                      //       price tick after last snapshot, etc.), the
                      //       dot floated off the line.
                      // Fix: anchor to the rightmost trendData point AND
                      // mirror the chart's exact YAxis domain function.
                      const lastValue = trendData[trendData.length - 1].value;
                      const dataMax = Math.max(...trendData.map((d) => d.value), 0.01);
                      // Mirrors DashboardTrendChart's YAxis domain function
                      // EXACTLY — copy/paste of the same math so the dot's
                      // coordinate space and the chart's coordinate space
                      // can never drift apart again.
                      const pad = Math.max(Math.abs(dataMax) * 0.12, 1);
                      const domainMax = dataMax + pad;
                      const CHART_H = 180, PLOT_TOP = 8, PLOT_H = 180 - 8 - 22;
                      const dotTopPct = ((PLOT_TOP + (1 - lastValue / domainMax) * PLOT_H) / CHART_H) * 100;
                      return (
                        <div className="pointer-events-none" style={{ position: "absolute", right: 6, top: `${dotTopPct}%`, transform: "translate(50%, -50%)", width: 9, height: 9, zIndex: 10 }}>
                          <span className="absolute inset-0 animate-ping rounded-full" style={{ background: "hsl(43, 85%, 50%)", opacity: 0.55 }} />
                          <span className="relative block rounded-full" style={{ width: 9, height: 9, background: "hsl(43, 85%, 50%)" }} />
                        </div>
                      );
                    })()}
                  </div>
                </Suspense>
                {(trendMode === "gifts" || trendMode === "single" || trendMode === "waiting") && (
                  <p className="px-4 pb-4 text-center text-xs text-muted-foreground">
                    {trendMode === "gifts" && "Estimated from gift activity while snapshots accumulate."}
                    {trendMode === "single" && `Line fills in as more gifts arrive.`}
                    {trendMode === "waiting" && `Share the gift link to get the first one in.`}
                  </p>
                )}
                {gifts.length > 0 && (
                  <div className="border-t border-[hsl(var(--kiddo-border)/0.65)] px-4 py-3">
                    {/* items-start aligns the eyebrow titles across columns —
                        was items-center which centered each column vertically,
                        making columns of different heights (Growth now has a
                        percent line beneath the dollar) drift the titles out
                        of alignment. Top-aligned: titles always sit on the
                        same baseline. */}
                    <div className="flex items-start gap-6">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Total gifts</p>
                      <p className="font-heading text-base font-bold text-foreground">
                        {formatCurrency(gifterRoster.reduce((s, g) => s + g.totalNetAmount, 0))}
                      </p>
                      {/* `$X settling` indicator — replaces the noisy
                          "Your gift is pending. This is normal." banner.
                          Tiny gold-tone secondary line, only renders when
                          something is actually in flight. Mirrors the
                          30-day summary's secondary-line pattern.
                          `settling` already aggregates pendingBalance +
                          processing-status gifts upstream — we don't need
                          to re-derive it here. */}
                      {settling > 0 && (
                        <p
                          style={{ fontSize: 10.5, fontWeight: 600, color: "hsl(43,55%,40%)", marginTop: 2 }}
                          data-testid="text-pending-summary"
                        >
                          {formatCurrency(settling)} settling
                        </p>
                      )}
                    </div>
                    {(() => {
                      // Growth row swaps to the scrubbed point's gain when
                      // the parent is dragging through the chart. Compute
                      // both gain and percent from the same scrubbed
                      // payload so the dollar and the percent always agree
                      // (no math drift between the two lines). When not
                      // scrubbing, fall back to the live lifetime numbers.
                      // Honors feedback_no_greenwashing_losses.md — color
                      // and sign track the actual computed delta at every
                      // scrub position; a historical dip below principal
                      // shows red, no exceptions.
                      const scrubGain = isScrubbing && scrubbedTrendPoint && typeof scrubbedTrendPoint.principal === "number"
                        ? scrubbedTrendPoint.value - scrubbedTrendPoint.principal
                        : null;
                      const scrubPct = scrubGain !== null && scrubbedTrendPoint && (scrubbedTrendPoint.principal ?? 0) > 0
                        ? (scrubGain / (scrubbedTrendPoint.principal as number)) * 100
                        : null;
                      // Growth is the ONE stat that follows the chart range
                      // (per the locked hybrid rule). When a non-ALL range
                      // is selected and we have a valid rangeGain, use it
                      // and suffix the label ("Growth · 1W"). Otherwise
                      // fall back to lifetime totalReturnVsContributions
                      // (no suffix on the label). Scrub still wins —
                      // mid-drag the figure tracks the cursor position.
                      // Total gifts + Have gifted are intentionally NOT
                      // range-aware: they're lifetime identity numbers
                      // (cumulative principal + village headcount) per
                      // the kid-at-18 lens. Shrinking them to "this week"
                      // would erode the lifetime story.
                      const usingRangeGain = scrubGain === null && chartRange !== "ALL" && rangeGain !== null;
                      const growthDollars = scrubGain !== null
                        ? scrubGain
                        : usingRangeGain
                          ? rangeGain!.delta
                          : totalReturnVsContributions;
                      const growthPercent = scrubPct !== null
                        ? scrubPct
                        : usingRangeGain
                          ? rangeGain!.pct
                          : totalReturnPctVsContributions;
                      // Label ALWAYS reflects the user's chart-range
                      // selection — independent of whether the underlying
                      // gain data is fresh. The suffix matches the chip
                      // text for terse ranges (1W / 1M / YTD / 1Y / 5Y)
                      // so tap→suffix is one-step. "ALL" gets humanized
                      // to "All-time" because the chip text reads as a
                      // code value in copy. Scrub stays unsuffixed
                      // (the scrub timestamp lives in the chart kicker).
                      //
                      // Previously this conflated "user clicked ALL" with
                      // "user clicked 1W but rangeGain returned null"
                      // (fund too young for the window, or no snapshot
                      // history yet) — both showed "All-time", which
                      // ignored the user's click in the second case and
                      // read as the stat label being broken. Now the
                      // label honors the click; the value falls back to
                      // lifetime when rangeGain is null (current
                      // behavior) but the LABEL respects what the parent
                      // tapped. Locked rule:
                      // feedback_chart_range_stat_behavior.md ("Growth
                      // label always suffixed `· {range}` (humanized
                      // 'All-time' for ALL)").
                      const rangeSuffix = scrubGain !== null
                        ? null
                        : chartRange === "ALL"
                          ? "All-time"
                          : chartRange;
                      // Dynamic label: "Growth" when ≥0, "Return" when <0. Per
                      // feedback_no_greenwashing_losses.md — the noun in the stat
                      // label shouldn't imply positive directionality while the
                      // value/color say otherwise. "Growth · 1W / -$50" was a
                      // contradiction. "Return · 1W / -$50" is honest neutral.
                      // "Return" not "Loss" — the calm Apple-Settings register
                      // refuses harsh framing. Symmetric to the existing dynamic
                      // green/red color treatment on line 5428. Memory pattern
                      // locked in feedback_chart_range_stat_behavior.md.
                      const growthNoun = growthDollars >= 0 ? "Growth" : "Return";
                      const growthLabel = rangeSuffix ? `${growthNoun} · ${rangeSuffix}` : growthNoun;
                      // Render the row whenever there's a meaningful number
                      // OR the parent is scrubbing — during scrub we want
                      // to show $0.00 / 0% honestly rather than collapsing
                      // the row mid-drag (which would jank the layout).
                      // The hide-check now reads the displayed value, not
                      // just lifetime — so a fund with $0 lifetime growth
                      // but a small 1W move still surfaces the row when
                      // the parent zooms in.
                      if (!isScrubbing && Math.abs(growthDollars) < 0.01) return null;
                      return (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{growthLabel}</p>
                        <p
                          className={`font-heading text-base font-bold ${growthDollars >= 0 ? "text-green-600" : "text-red-500"}`}
                          aria-live={isScrubbing ? "off" : "polite"}
                        >
                          {growthDollars >= 0 ? "+" : ""}{formatCurrency(growthDollars)}
                        </p>
                        {/* Percent rides as a quiet secondary line. Was previously
                            shown only on the hero gain pill (now removed); moved
                            here so the percent stays visible in its canonical
                            metrics home rather than living on the emotional
                            anchor surface. Same number, different surface. */}
                        {Math.abs(growthPercent) >= 0.01 && (
                          <p className={`text-[10.5px] font-semibold ${growthPercent >= 0 ? "text-green-600/70" : "text-red-500/70"}`}>
                            {growthPercent >= 0 ? "+" : ""}{growthPercent.toFixed(2)}%
                          </p>
                        )}
                      </div>
                      );
                    })()}
                    {contributorCount > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Have gifted</p>
                        <p className="font-heading text-base font-bold text-foreground">{contributorCount} {contributorCount === 1 ? "person" : "people"}</p>
                      </div>
                    )}
                    </div>
                  </div>
                )}
              </div>
            </motion.section>


            {/* Age-band strategy nudge. Fires once per band when the child's age crosses
                a threshold AND the current strategy doesn't match the recommended one for
                that age. Dismissible per fund (one shot — once dismissed, never re-shows
                for that band). Push/email surfaces are deliberately held; this is the
                in-app banner only for now. */}
            {(() => {
              const birthdateRaw = (activeFund as any)?.recipientBirthdate;
              if (!birthdateRaw || !activeFundId) return null;
              const bd = new Date(birthdateRaw);
              if (isNaN(bd.getTime())) return null;
              const ageMs = Date.now() - bd.getTime();
              const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
              if (ageYears < 0 || ageYears >= 18) return null;

              // Bands: 11–13 → Balanced, 14–15 → Conservative warning, 16–17 → Conservative final
              type BandDef = { key: string; minAge: number; maxAge: number; recommendKey: "balanced" | "conservative"; toneline: string };
              const bands: BandDef[] = [
                // Toneline copy locked 2026-05-21 — rewritten away from
                // the "as X gets closer, Y can lock in Z" AI rhythm
                // (slogan structure, vague "lock in more of what's
                // there" close). Now factual + direct: what the mix
                // does mechanically, no warmth-words.
                { key: "strategy_band_11_13", minAge: 11, maxAge: 14, recommendKey: "balanced",
                  toneline: "Balanced shifts about 40% from stocks into bonds. Less upside, less drawdown." },
                { key: "strategy_band_14_15", minAge: 14, maxAge: 16, recommendKey: "conservative",
                  toneline: "Conservative is 70% bonds. Built for the last five years before handoff." },
                { key: "strategy_band_16_17", minAge: 16, maxAge: 18, recommendKey: "conservative",
                  toneline: "Conservative protects what's already there. You can change it back any time." },
              ];
              const activeBand = bands.find(b => ageYears >= b.minAge && ageYears < b.maxAge);
              if (!activeBand) return null;

              const currentStrategyKey = String((activeFund as any)?.investmentStrategy || "growth").toLowerCase();
              if (currentStrategyKey === activeBand.recommendKey || currentStrategyKey === "custom") return null;

              const dismissed = Array.isArray((activeFund as any)?.dismissedNudges) ? (activeFund as any).dismissedNudges : [];
              if (dismissed.includes(activeBand.key)) return null;
              if (nudgeOptimisticallyDismissed.has(activeBand.key)) return null;

              const recommendedLabel = activeBand.recommendKey === "balanced" ? "Balanced Mix" : "Conservative Mix";
              const childFirst = recipientFirstNameDisplay || "Your child";
              const isSwitchingThis = nudgeSwitchLoading === activeBand.key;

              const handleDismiss = async () => {
                haptic("light");
                // Hide immediately. The server call is fire-and-forget for UX latency.
                setNudgeOptimisticallyDismissed(prev => {
                  const next = new Set(prev);
                  next.add(activeBand.key);
                  return next;
                });
                try {
                  await fetch(`/api/funds/${activeFundId}/dismiss-nudge`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nudgeKey: activeBand.key }),
                  });
                  void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
                  void queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "dashboard-summary"] });
                } catch {
                  // best-effort: optimistic dismissal already applied
                }
              };
              const handleSwitch = async () => {
                if (isSwitchingThis) return;
                haptic("medium");
                setNudgeSwitchLoading(activeBand.key);
                try {
                  // Run strategy switch + nudge dismissal in parallel — both server-side writes,
                  // no dependency between them, no need to wait sequentially.
                  const [strategyRes] = await Promise.all([
                    fetch(`/api/funds/${activeFundId}/strategy`, {
                      method: "PATCH",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ strategy: activeBand.recommendKey }),
                    }),
                    fetch(`/api/funds/${activeFundId}/dismiss-nudge`, {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ nudgeKey: activeBand.key }),
                    }),
                  ]);
                  if (!strategyRes.ok) throw new Error("strategy update failed");
                  // Optimistically hide the banner the moment we know the strategy update succeeded.
                  setNudgeOptimisticallyDismissed(prev => {
                    const next = new Set(prev);
                    next.add(activeBand.key);
                    return next;
                  });
                  haptic("success");
                  toast({ title: `${childFirst}'s mix updated`, description: `Switched to ${recommendedLabel}.` });
                  void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
                  void queryClient.invalidateQueries({ queryKey: ["/api/funds", activeFundId, "dashboard-summary"] });
                } catch (err) {
                  toast({ title: "Could not update strategy", description: "Please try again.", variant: "destructive" });
                } finally {
                  setNudgeSwitchLoading(null);
                }
              };
              return (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-2xl border border-[hsl(var(--kiddo-gold)/0.35)] bg-[hsl(var(--kiddo-gold)/0.10)] p-5"
                >
                  {/* Eyebrow + body retoned 2026-05-21 — was
                      "{kid} is growing up 🌱" + "around {age} years
                      old. Want to shift to the {mix}?" which read as
                      a parenting-app push notification rather than a
                      product-page strategy review. Now factual:
                      "Strategy review" eyebrow, age stated directly,
                      mix change framed as a recommendation not a
                      sales question. */}
                  <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--kiddo-gold-ink))] mb-1">
                    Strategy review
                  </p>
                  <p className="text-sm font-semibold text-foreground leading-snug">
                    {childFirst} is {Math.floor(ageYears)}. Most funds shift to the {recommendedLabel} around this age.
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    {activeBand.toneline}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      className="rounded-xl"
                      onClick={handleSwitch}
                      disabled={isSwitchingThis}
                      data-testid={`button-nudge-switch-${activeBand.key}`}
                    >
                      {isSwitchingThis ? (
                        <span className="flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin" />
                          Switching to {recommendedLabel}…
                        </span>
                      ) : (
                        <>Switch to {recommendedLabel} →</>
                      )}
                    </Button>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 disabled:opacity-50"
                      onClick={() => { haptic("selection"); setLocation("/settings?tab=money"); }}
                      disabled={isSwitchingThis}
                    >
                      See all options
                    </button>
                    <button
                      type="button"
                      className="ml-auto text-xs text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-50"
                      onClick={handleDismiss}
                      disabled={isSwitchingThis}
                      data-testid={`button-nudge-dismiss-${activeBand.key}`}
                    >
                      Not now
                    </button>
                  </div>
                </motion.section>
              );
            })()}

            <motion.section
              ref={holdingsSectionRef}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.018 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="kiddo-section-label" data-testid="text-holdings-title">
                  {recipientFirstNameDisplay ? `What ${recipientFirstNameDisplay} owns` : "What the fund owns"}
                </p>
              </div>
              {holdingsLoading ? (
                <div className="space-y-3">
                  <SkeletonBlock className="h-16 w-full" />
                  <SkeletonBlock className="h-16 w-full" />
                </div>
              ) : holdings.length === 0 ? (
                <div className="kiddo-card p-6 text-center">
                  <p className="text-sm font-bold text-foreground">{recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s investments will appear here after the first gift.` : "Investments will appear here after the first gift."}</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    Every gift gets invested automatically. 🌱
                  </p>
                </div>
              ) : (() => {
                // Split managed (auto-invest ETFs) vs chosen (gifter/parent stock picks)
                const chosenTickers = new Set(
                  gifts
                    .filter(g => String(g.executionModel || "").toLowerCase() === "pick" && g.selectedTicker)
                    .map(g => String(g.selectedTicker).toUpperCase())
                );

                // Managed-mix ticker set. Was: ONLY the current strategy's
                // tickers — which made the managed mix randomly disappear
                // when (a) custom allocations transiently emptied during
                // a refetch / mutation, or (b) the user switched strategies
                // and their pre-existing managed-ETF holdings (VTI/VXUS/etc.)
                // suddenly didn't match the new strategy and orphan-fell
                // into chosen. Both are real bugs that the parent saw as
                // "the list of stocks randomly disappears."
                //
                // Fix: build a STABLE UNION of all canonical managed-mix
                // tickers (every preset strategy's basket + any current
                // custom allocations). This way:
                //   - VTI/VXUS/BND/VGT are ALWAYS recognized as managed,
                //     regardless of which preset strategy is active or
                //     which strategy historically purchased them.
                //   - Custom allocation tickers are included when defined.
                //   - A transient empty `customAllocations === {}` no
                //     longer empties the entire managed set — the preset
                //     ETFs remain.
                //   - Strategy switches don't make existing managed
                //     holdings appear to "jump" sections.
                const managedStrategyName = investPrefs?.managedStrategy ?? "growth";
                const managedStrategyTickers = new Set<string>();
                // Union of every preset strategy's basket — these tickers
                // are canonically "managed mix" across the product.
                for (const presetKey of Object.keys(MANAGED_STRATEGY_ALLOCATIONS)) {
                  for (const a of MANAGED_STRATEGY_ALLOCATIONS[presetKey]) {
                    managedStrategyTickers.add(a.ticker.toUpperCase());
                  }
                }
                // Add custom allocation tickers when present (the user's
                // currently configured custom mix). Skipped silently when
                // customAllocations is null/empty — preset tickers above
                // already cover the common cases.
                if (managedStrategyName === "custom" && fundStrategy?.customAllocations) {
                  for (const t of Object.keys(fundStrategy.customAllocations)) {
                    managedStrategyTickers.add(t.toUpperCase());
                  }
                }
                const chosenAlsoManagedTickers = new Set(Array.from(chosenTickers).filter(t => managedStrategyTickers.has(t)));

                // Gifter cost basis per chosen ticker (for splitting overlap positions)
                const gifterCostByTicker = new Map<string, number>();
                for (const g of gifts) {
                  if (String(g.executionModel || "").toLowerCase() === "pick" && g.selectedTicker) {
                    const t = String(g.selectedTicker).toUpperCase();
                    gifterCostByTicker.set(t, (gifterCostByTicker.get(t) ?? 0) + parseFloat(String(g.netAmount || g.amount || "0")));
                  }
                }

                // For overlap tickers, show in BOTH sections with split proportional values
                type HoldingEntry = typeof holdings[0] & { _overlapSide?: "chosen" | "managed" };
                const chosenH: HoldingEntry[] = [];
                const managedH: HoldingEntry[] = [];
                const scaleField = (v: string | undefined | null, f: number) =>
                  (parseFloat(String(v || "0")) * f).toFixed(4);

                for (const h of holdings) {
                  const ticker = h.ticker.toUpperCase();
                  if (chosenAlsoManagedTickers.has(ticker)) {
                    const totalCost = parseFloat(String(h.costBasis || "0")) || 1;
                    const gifterCost = gifterCostByTicker.get(ticker) ?? 0;
                    const gF = Math.max(0, Math.min(gifterCost / totalCost, 1));
                    const mF = 1 - gF;
                    chosenH.push({
                      ...h,
                      shares: scaleField(h.shares, gF),
                      costBasis: scaleField(h.costBasis, gF),
                      currentValue: scaleField(h.currentValue, gF),
                      gain: scaleField(h.gain, gF),
                      _overlapSide: "chosen",
                    });
                    if (mF > 0.001) {
                      managedH.push({
                        ...h,
                        shares: scaleField(h.shares, mF),
                        costBasis: scaleField(h.costBasis, mF),
                        currentValue: scaleField(h.currentValue, mF),
                        gain: scaleField(h.gain, mF),
                        _overlapSide: "managed",
                      });
                    }
                  } else if (chosenTickers.has(ticker)) {
                    chosenH.push(h);
                  } else if (managedStrategyTickers.has(ticker)) {
                    managedH.push(h);
                  } else {
                    // Orphan holding (e.g., reallocated from a sold pick that's not in the active
                    // managed strategy). It's an individual stock, not a managed-mix ETF — surface
                    // it under "Chosen with Love" rather than wrongly grouping with the managed mix.
                    chosenH.push(h);
                  }
                }

                // First gifter who chose each ticker (for badge)
                const tickerGifter = new Map<string, string>();
                for (const g of gifts) {
                  if (String(g.executionModel || "").toLowerCase() === "pick" && g.selectedTicker) {
                    const t = String(g.selectedTicker).toUpperCase();
                    if (!tickerGifter.has(t)) tickerGifter.set(t, displayGifterName(g.senderName, (g as any).isAnonymous));
                  }
                }

                // Donut ring data
                const principal   = holdings.reduce((s, h) => s + parseFloat(h.costBasis    || "0"), 0);
                const growth      = holdings.reduce((s, h) => s + parseFloat(h.gain         || "0"), 0);
                const cash        = parseFloat(String((activeFund as any)?.cashBalance    || "0"))
                                  + parseFloat(String((activeFund as any)?.pendingBalance || "0"));
                const totalPool   = principal + Math.max(0, growth) + cash || 1;
                const managedVal  = managedH.reduce((s, h) => s + parseFloat(h.currentValue || "0"), 0);
                const chosenVal   = chosenH.reduce( (s, h) => s + parseFloat(h.currentValue || "0"), 0);
                const investedTotal = managedVal + chosenVal;
                const invPool     = investedTotal || 1;
                const validGifts  = gifts.filter(g => !["failed","refunded"].includes(String(g.status||"").toLowerCase()));
                const occasionVal = validGifts.filter(g => g.eventId).reduce((s, g) => s + parseFloat(String(g.netAmount || g.amount || "0")), 0);
                const directVal   = validGifts.filter(g => !g.eventId).reduce((s, g) => s + parseFloat(String(g.netAmount || g.amount || "0")), 0);
                const giftPool    = occasionVal + directVal || 1;

                // SVG arc path helper for proper clickable donut segments
                // Returns a filled annular sector path (cx,cy = center; R=outer r; r=inner r; a1/a2 in radians from 12 o'clock)
                const arcPath = (cx: number, cy: number, R: number, ri: number, a1: number, a2: number): string => {
                  const [ss, cc] = [Math.sin, Math.cos];
                  const x1=cx+R*ss(a1),  y1=cy-R*cc(a1);
                  const x2=cx+R*ss(a2),  y2=cy-R*cc(a2);
                  const x3=cx+ri*ss(a2), y3=cy-ri*cc(a2);
                  const x4=cx+ri*ss(a1), y4=cy-ri*cc(a1);
                  const lg = a2-a1 > Math.PI ? 1 : 0;
                  return `M${x1.toFixed(3)} ${y1.toFixed(3)}A${R} ${R} 0 ${lg} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}L${x3.toFixed(3)} ${y3.toFixed(3)}A${ri} ${ri} 0 ${lg} 0 ${x4.toFixed(3)} ${y4.toFixed(3)}Z`;
                };

                // Build colored arc segments for one ring, returns rendered paths
                type ArcSeg = { key: string; f: number; color: string };
                const renderRing = (segs: ArcSeg[], cx: number, cy: number, R: number, ri: number): React.ReactNode => {
                  const GAP = 0.028; // ~1.6° gap between segments for breathing room
                  let angle = -Math.PI / 2; // 12 o'clock
                  const total = segs.reduce((s, x) => s + x.f, 0) || 1;
                  return segs.map((seg) => {
                    const frac = seg.f / total;
                    const sweep = frac * 2 * Math.PI;
                    const startA = angle + (segs.length > 1 ? GAP / 2 : 0);
                    const endA   = angle + sweep - (segs.length > 1 ? GAP / 2 : 0);
                    angle += sweep;
                    if (frac < 0.005 || endA <= startA) return null;
                    const isActive = donutActiveSegment === seg.key;
                    return (
                      <path
                        key={seg.key}
                        d={arcPath(cx, cy, R, ri, startA, endA)}
                        fill={seg.color}
                        opacity={donutActiveSegment === null || isActive ? 1 : 0.3}
                        style={{ cursor:"pointer", transition:"opacity 0.2s ease" }}
                        onClick={() => { haptic("light"); setDonutActiveSegment(isActive ? null : seg.key); }}
                      />
                    );
                  });
                };

                // Tooltip messages per segment
                const childFirst = recipientFirstNameDisplay || "them";
                const segTooltip: Record<string, string> = {
                  principal: `${formatCurrency(principal)} gifted by people who love ${childFirst}.`,
                  growth: growth > 0.5 ? `${formatCurrency(growth)} in growth so far. Building quietly.` : `No growth yet. Every gift is a seed. 🌱`,
                  cash: cash > 0.5
                    ? `${formatCurrency(cash)} is sitting as cash, ready to invest.`
                    : settling > 0.5
                      ? `${formatCurrency(settling)} on its way to ${childFirst === "them" ? "the fund" : `${childFirst}'s fund`}. Settling now. Usually moments via card or Apple Pay, up to 1 to 2 business days for bank transfers.`
                      : `All of ${childFirst === "them" ? "the gifts are" : `${childFirst}'s gifts are`} invested. Nothing pending.`,
                  managed: `${formatCurrency(managedVal)} in a diversified managed mix.`,
                  chosen: `${formatCurrency(chosenVal)} chosen with love by people who care about ${childFirst === "them" ? "their" : childFirst + "'s"} future.`,
                };

                return (
                  <div>
                    {/* Holdings list — direct render. The two-page horizontal-
                        scroll-snap carousel + Holdings/Breakdown segmented
                        switcher + Page 2 donut breakdown were surgically
                        removed 2026-05-12 (wrong-shape design that ate many
                        sessions of layout grief — see
                        project_dashboard_holdings_carousel_hidden.md for the
                        full rationale). The Holdings LIST itself (Chosen
                        with love + Managed mix) stays because it's the
                        DriveWealth/SIPC trust signal made visible per
                        project_brokerage_as_trust_feature.md. */}
                      {(() => {
                          const childPoss = recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s fund` : "the fund";
                          const childFirst = recipientFirstNameDisplay || "them";
                          const hasBothSections = chosenH.length > 0 && managedH.length > 0;
                          const canCustomize = effectivePlan === "starter" || effectivePlan === "family";

                          // Renders one holding row. `isChosen` enables the contextual `+`
                          // button — only meaningful for picks (a parent can intentionally
                          // add more Apple), not for managed mix tickers (those are
                          // auto-allocated by the strategy, so a user-driven "add more BND"
                          // would just fight the rebalancer).
                          const renderHoldingRow = (h: HoldingEntry, isChosen = false) => {
                            const hValue   = parseFloat(h.currentValue || "0");
                            const hCost    = parseFloat(h.costBasis    || "0");
                            const hGain    = hValue - hCost;
                            const hGainPct = hCost > 0 ? (hGain / hCost) * 100 : 0;
                            const hShares  = parseFloat(h.shares || "0");
                            // Per-row % is computed against the actual sum of holdings
                            // shown in this card (investedTotal = chosenVal + managedVal),
                            // NOT against the fund's balance field. The two can diverge
                            // when the server-side balance hasn't reconciled with the
                            // current brokerage holding values, and using balance as
                            // the denominator made per-row %s sum to >100% (because
                            // the holdings sum exceeded balance). investedTotal is
                            // the same denominator the section summary lines use, so
                            // per-row %s now sum to exactly 100% across both sections.
                            const hPct     = investedTotal > 0 ? (hValue / investedTotal) * 100 : 0;
                            const dName    = friendlyHoldingName(h.ticker, h.name);
                            const sharesLbl = hShares > 0
                              ? (hShares >= 1 ? hShares.toFixed(2) : hShares.toFixed(4)) + " shares"
                              : null;
                            const pctLbl = hPct > 0 ? `${Math.round(hPct)}% of ${childPoss}` : null;
                            const overlapSide = h._overlapSide;
                            const ticker = h.ticker.toUpperCase();
                            const handleAddMore = () => {
                              haptic("medium");
                              setOneTimeAmount("50");
                              setOneTimeStep("amount");
                              setOneTimeExecutionModel("pick");
                              setOneTimeTicker(ticker);
                              setOneTimePaymentMethod("apple_pay");
                              setOneTimeMemoryNote("");
                              setOneTimeNoteSaved(false);
                              setOneTimeModalOpen(true);
                            };
                            return (
                              <div
                                key={`v2-${h.id}-${overlapSide ?? "solo"}`}
                                className="kiddo-card p-4 w-full transition-all hover:border-primary/30"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <button
                                    type="button"
                                    onClick={() => { haptic("selection"); setSelectedHolding(h); }}
                                    className="flex flex-1 min-w-0 items-center gap-3 text-left transition-transform active:scale-[0.99]"
                                    data-testid={`holding-row-${h.id}`}
                                  >
                                    <StockLogo ticker={h.ticker} size={36} />
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <p className="truncate text-sm font-bold text-foreground">{dName}</p>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {sharesLbl ?? `Part of ${childPoss}`}
                                        {pctLbl && sharesLbl && <span className="ml-1.5 text-muted-foreground/60">· {pctLbl}</span>}
                                        {pctLbl && !sharesLbl && <span>{pctLbl}</span>}
                                      </p>
                                      {overlapSide === "chosen" && (
                                        <p className="mt-0.5 text-[10px] font-medium text-muted-foreground/70">
                                          gifter-chosen · personal
                                        </p>
                                      )}
                                      {overlapSide === "managed" && (
                                        <p className="mt-0.5 text-[10px] font-medium text-muted-foreground/70">
                                          algorithm-allocated · automatic
                                        </p>
                                      )}
                                    </div>
                                  </button>
                                  <div className="shrink-0 flex items-center gap-2.5">
                                    <button
                                      type="button"
                                      onClick={() => { haptic("selection"); setSelectedHolding(h); }}
                                      className="text-right transition-transform active:scale-[0.99]"
                                      aria-label={`View ${dName} details`}
                                    >
                                      <p className="text-sm font-bold text-foreground">{formatCurrency(hValue)}</p>
                                      {hCost > 0 && Math.abs(hGain) > 0.01 && (
                                        <p className={`text-xs font-semibold tabular-nums ${hGain >= 0 ? "text-green-600" : "text-red-500"}`}>
                                          {hGain >= 0 ? "+" : ""}{formatCurrency(hGain)} ({hGain >= 0 ? "+" : ""}{hGainPct.toFixed(2)}%)
                                        </p>
                                      )}
                                    </button>
                                    {isChosen && !isReadOnlyFund && (
                                      <button
                                        type="button"
                                        onClick={handleAddMore}
                                        aria-label={`Add more ${dName}`}
                                        title={`Add more ${dName}`}
                                        data-testid={`button-add-more-${h.id}`}
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen)/0.18)] active:scale-95 transition-all"
                                      >
                                        <Plus size={14} strokeWidth={2.5} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          };

                          const handleCustomize = () => {
                            haptic("selection");
                            if (canCustomize) {
                              setLocation("/settings?tab=money");
                            } else {
                              setLocation("/upgrade");
                            }
                          };

                          // Stack always — chosen with love above managed mix.
                          // Tried desktop side-by-side (md:flex-row md:items-start)
                          // 2026-05-12; reverted because columns of unequal length
                          // (5 chosen picks vs 4 ETFs in Conservative) left visible
                          // empty space below the shorter column, inside the
                          // carousel container that's height-locked to the taller
                          // column. The gap reads as "broken layout" between Page 1
                          // content and the Holdings/Breakdown page switcher. Stack
                          // always = both sections end at their natural content
                          // height, no imbalance possible. Trade-off: desktop loses
                          // horizontal use of space, but holdings are typically
                          // fewer than 10 items total so vertical scroll is fine.
                          return (
                            <div className={hasBothSections ? "flex flex-col gap-4" : "space-y-2"}>
                              {/* Chosen with love */}
                              {chosenH.length > 0 && (
                                <div className="space-y-2">
                                  {hasBothSections && (
                                    <div className="flex items-center justify-between px-1 pb-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <p className="text-[12px] font-semibold text-muted-foreground/85">Chosen with love</p>
                                        <span className="text-[11px]">💚</span>
                                      </div>
                                      {!isReadOnlyFund && (
                                        <div className="relative flex items-center gap-1.5">
                                          <AnimatePresence>
                                            {investPickerOpen && (
                                              <motion.div
                                                key="invest-picker"
                                                initial={{ opacity: 0, scale: 0.92, x: 6 }}
                                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.92, x: 6 }}
                                                transition={{ duration: 0.14, ease: "easeOut" }}
                                                className="flex items-center gap-1.5"
                                              >
                                                <button
                                                  type="button"
                                                  onClick={() => { haptic("selection"); setInvestPickerOpen(false); setOneTimeAmount("50"); setOneTimeStep("amount"); setOneTimeExecutionModel("pick"); setOneTimeTicker(""); setOneTimePaymentMethod("apple_pay"); setOneTimeMemoryNote(""); setOneTimeNoteSaved(false); setOneTimeModalOpen(true); }}
                                                  className="rounded-full border border-[hsl(var(--kiddo-gold)/0.35)] bg-[hsl(var(--kiddo-gold)/0.10)] px-2.5 py-0.5 text-[10px] font-bold text-[hsl(var(--kiddo-gold-ink))] transition-colors hover:bg-[hsl(var(--kiddo-gold)/0.20)]"
                                                >
                                                  One time
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => { haptic("selection"); setInvestPickerOpen(false); setEditingContribId(null); setAutoInvestStep("amount"); setAutoInvestModalOpen(true); }}
                                                  className="rounded-full border border-[hsl(var(--kiddo-evergreen)/0.25)] bg-[hsl(var(--kiddo-evergreen)/0.08)] px-2.5 py-0.5 text-[10px] font-bold text-[hsl(var(--kiddo-evergreen))] transition-colors hover:bg-[hsl(var(--kiddo-evergreen)/0.15)]"
                                                >
                                                  Recurring
                                                </button>
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                          <button
                                            type="button"
                                            onClick={() => { haptic("light"); setInvestPickerOpen(v => !v); }}
                                            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-colors ${investPickerOpen ? "bg-[hsl(var(--kiddo-evergreen))] text-white" : "bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen)/0.18)]"}`}
                                            aria-label="Add investment"
                                          >
                                            Add an investment
                                            <Plus size={10} className={`transition-transform ${investPickerOpen ? "rotate-45" : ""}`} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {[...chosenH].sort((a, b) => parseFloat(b.currentValue || "0") - parseFloat(a.currentValue || "0")).map((h) => renderHoldingRow(h, true))}
                                  {/* Section summary — composition only.
                                      Deliberately no per-section performance %:
                                      side-by-side performance comparisons drive
                                      performance-chasing behavior and brush
                                      against the Robinhood "celebratory imagery
                                      tied to trading frequency" precedent.
                                      The split summary gives at-a-glance
                                      composition without the dangerous
                                      comparison. Fund-level performance lives
                                      in the hero metric where the long-horizon
                                      lens applies. See feedback_no_ai_slop.md
                                      and feedback_no_greenwashing_losses.md. */}
                                  {hasBothSections && investedTotal > 0 && (
                                    <p className="px-1 pt-1 text-[11px] font-medium text-muted-foreground/70 tabular-nums">
                                      Total: {formatCurrency(chosenVal)} · {Math.round((chosenVal / investedTotal) * 100)}% of invested
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Horizontal divider between Chosen-with-love and
                                  managed mix. Used to also have a vertical-on-desktop
                                  variant when the layout went side-by-side; dropped
                                  with the stack-always change above. */}
                              {hasBothSections && (
                                <div className="border-t border-[hsl(var(--kiddo-border)/0.6)]" />
                              )}

                              {/* Managed-bucket section. Header reads
                                  "Emma's mix (⚖️ Conservative)" — uses the
                                  canonical `mixIdentityFor` so the bucket
                                  name matches every other surface (the
                                  recurring schedule list, per-row chips,
                                  etc.), and the current preset rides as
                                  a parenthetical with the locked strategy
                                  emoji (⚖️ Conservative · 🌿 Balanced ·
                                  📈 Growth · 🎯 Custom). The structural
                                  cue (this bucket is platform-managed vs
                                  the gifter-picked "Chosen with love"
                                  pair) is carried by the strategy emoji
                                  itself, the section's visual contrast
                                  with the picks section, and the
                                  parenthetical preset name. Same warm
                                  naming axis as everywhere else in the
                                  app — kid-at-18 reads "her mix," not
                                  brokerage chrome. */}
                              {managedH.length > 0 && (() => {
                                const stratKey = String((activeFund as any)?.investmentStrategy || "growth").toLowerCase();
                                const stratEmoji = strategyEmoji(stratKey);
                                // Bare strategy name (no "Mix" suffix) for
                                // the inline parenthetical — "Managed mix
                                // (Conservative Mix)" would read as
                                // duplicated "mix." Trims "Steady &
                                // Balanced" → "Balanced" for the same
                                // brevity.
                                const bareStratName = ({
                                  growth: "Growth",
                                  balanced: "Balanced",
                                  conservative: "Conservative",
                                  custom: "Custom",
                                } as Record<string, string>)[stratKey] ?? "Growth";
                                return (
                                <div className="space-y-2">
                                  {/* Strategy header always renders. Was previously
                                      gated by `hasBothSections` (only shown when
                                      Custom picks coexisted with managed holdings),
                                      which meant new parents on the default Growth
                                      Mix with no custom picks saw zero strategy
                                      identity on the holdings card — violating the
                                      locked strategy emoji map rule. The header
                                      does double duty: it identifies the active
                                      mix in the canonical "Emma's mix (📈 Growth)"
                                      form AND surfaces the Customize entry for
                                      parents who want to switch strategies. Both
                                      jobs apply whether or not Custom picks exist. */}
                                  <div className="flex items-center justify-between px-1 pb-0.5">
                                    <p className="text-[12px] font-semibold text-muted-foreground/85">
                                      {(() => {
                                        // Sentence-case the warm form so
                                        // "Emma's mix" reads as a header
                                        // even when the kid name is missing.
                                        const raw = mixIdentityFor(recipientFirstNameDisplay);
                                        return raw.charAt(0).toUpperCase() + raw.slice(1);
                                      })()}
                                      <span className="ml-1.5 font-normal text-muted-foreground/70">
                                        ({stratEmoji} {bareStratName})
                                      </span>
                                    </p>
                                    <button
                                      type="button"
                                      onClick={handleCustomize}
                                      className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-colors bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen)/0.18)]`}
                                    >
                                      <Pencil size={9} />
                                      {canCustomize ? `Customize ${childFirst}'s mix` : "Customize"}
                                      {!canCustomize && <span className="rounded-full bg-[hsl(var(--kiddo-gold)/0.18)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[hsl(var(--kiddo-gold-ink))]">Plus</span>}
                                    </button>
                                  </div>
                                  {[...managedH].sort((a, b) => parseFloat(b.currentValue || "0") - parseFloat(a.currentValue || "0")).map((h) => renderHoldingRow(h, false))}
                                  {/* Section summary — composition only. See
                                      Chosen-with-love summary above for
                                      rationale on why per-section performance
                                      is intentionally absent. */}
                                  {hasBothSections && investedTotal > 0 && (
                                    <p className="px-1 pt-1 text-[11px] font-medium text-muted-foreground/70 tabular-nums">
                                      Total: {formatCurrency(managedVal)} · {Math.round((managedVal / investedTotal) * 100)}% of invested
                                    </p>
                                  )}
                                </div>
                                );
                              })()}

                              {/* Settling cash row */}
                              {settling > 0 && (
                                <div style={{
                                  display: "flex", alignItems: "center", gap: 12,
                                  padding: "12px 14px", borderRadius: 14,
                                  border: "1.5px dashed rgba(26,23,16,0.18)",
                                  background: "hsl(43,30%,97%)",
                                }}>
                                  <div style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>💛</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: "rgb(26,23,16)", margin: 0 }}>Cash settling</p>
                                    <p style={{ fontSize: 11, color: "rgba(26,23,16,0.45)", margin: "2px 0 0", lineHeight: 1.4 }}>Available in 1–2 business days</p>
                                  </div>
                                  <p style={{ fontSize: 14, fontWeight: 700, color: "rgb(26,23,16)", flexShrink: 0 }}>{formatCurrency(settling)}</p>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                  </div>
                );
              })()}
            </motion.section>

            {/* Who loves [name] */}
            {gifterRoster.length > 0 && (() => {
              const namedGifters = gifterRoster.filter(g => g.name !== "Anonymous");
              const anonEntry = gifterRoster.find(g => g.name === "Anonymous");
              const totalGifted = gifterRoster.reduce((s, g) => s + g.totalNetAmount, 0);
              const fmtWhole = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
              const childName = recipientFirstNameDisplay;
              return (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.0195 }}
                  className="space-y-3"
                >
                  <p className="kiddo-section-label">
                    {childName ? `Who loves ${childName}` : "People who love them"}
                  </p>
                  <div
                    style={{
                      background: "white",
                      borderRadius: 20,
                      border: "1px solid rgba(26,23,16,0.1)",
                      boxShadow: "0 1px 6px rgba(26,23,16,0.05)",
                      padding: "20px 20px 18px",
                    }}
                  >
                    {/* People circles. Several signals stacked on each avatar:
                        - Owner: evergreen ring (the parent themself)
                        - Recurring: gold ring OR small ↻ badge top-right when
                          combined with owner ring (so both signals coexist
                          instead of one masking the other)
                        - Thanked: small evergreen check, bottom-right
                        - First gifter ever (external only): small ⭐ badge,
                          top-left — celebrates the iconic "first gift"
                          moment at the avatar level (mirrors Activity feed)
                        - Recent gifter (gave within last 48h): subtle pulse
                          animation around the ring, draws gentle attention
                        - Overflow cap: only AVATAR_VISIBLE shown by default,
                          rest gated behind a "+N more" tile that toggles
                          to expand. Avoids cluttering popular funds. */}
                    {(() => {
                      const AVATAR_VISIBLE = 8;
                      // Gifter recurring is retired — recurringGifts table
                      // only carries legacy entries; new gifters can no
                      // longer set recurring schedules. The recurring
                      // signal now lives PARENT-side via parent_contributions.
                      // We still check recurringEmails for legacy data
                      // hygiene, but the live recurring signal is whether
                      // the OWNER has an active parent_contribution.
                      const recurringEmails = new Set(
                        recurringGifts
                          .filter(r => String(r.status || "").toLowerCase() === "active")
                          .map(r => String(r.senderEmail || "").trim().toLowerCase())
                          .filter(Boolean)
                      );
                      const ownerHasRecurring = parentContributions.some(c => c.status === "active");
                      const ownerEmailLower = String(user?.email || "").trim().toLowerCase();
                      // First-gifter ever (external only). Walks all named
                      // gifters' gift histories and finds the chronologically-
                      // earliest external gift. The avatar that produced it
                      // gets a small ⭐ "first ever" badge.
                      const firstGifterName = (() => {
                        let earliest: { name: string; ts: number } | null = null;
                        for (const g of namedGifters) {
                          const gIsOwner = !!ownerEmailLower && g.gifts.some(x =>
                            String(x.senderEmail || "").trim().toLowerCase() === ownerEmailLower,
                          );
                          if (gIsOwner) continue;
                          for (const x of g.gifts) {
                            const ts = x.createdAt ? new Date(String(x.createdAt)).getTime() : NaN;
                            if (!Number.isFinite(ts)) continue;
                            if (!earliest || ts < earliest.ts) earliest = { name: g.name, ts };
                          }
                        }
                        return earliest?.name ?? null;
                      })();
                      const totalNamed = namedGifters.length;
                      const visibleGifters = avatarsExpanded
                        ? namedGifters
                        : namedGifters.slice(0, AVATAR_VISIBLE);
                      const overflowCount = Math.max(0, totalNamed - AVATAR_VISIBLE);
                      const recentMs = Date.now() - 48 * 60 * 60 * 1000;
                      return (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                      {visibleGifters.map(gifter => {
                        const color = GIFTER_AVATAR_COLORS[gifter.colorIdx];
                        const firstName = gifter.name.split(" ")[0];
                        // Gifter-level "thanked" badge only fires when EVERY
                        // thankable gift from this gifter has actually been
                        // thanked. The previous `.some(...)` form lit up the
                        // checkmark as soon as ONE gift was thanked — which
                        // lies the moment a second gift arrives that's still
                        // awaiting. A thankable gift is one with a
                        // senderEmail; anonymous-bucket entries can't be
                        // thanked so they don't gate the badge. With zero
                        // thankable gifts, no badge — nothing to celebrate.
                        const thankableGifts = gifter.gifts.filter(g => !!g.id && !!String(g.senderEmail || "").trim());
                        const isThanked = thankableGifts.length > 0
                          && thankableGifts.every(g => dashboardThankYouByGiftId.get(String(g.id))?.status === "sent");
                        const isOwner = !!user?.email && gifter.gifts.some(g =>
                          String(g.senderEmail || "").trim().toLowerCase() === String(user.email).trim().toLowerCase()
                        );
                        // Recurring signal source depends on whose avatar
                        // this is. Owner: parent_contributions table.
                        // External (legacy): recurring_gifts. Gifter
                        // recurring is retired so external case is mostly
                        // dead-data territory now.
                        const isRecurring = isOwner
                          ? ownerHasRecurring
                          : gifter.gifts.some(g =>
                              g.senderEmail && recurringEmails.has(String(g.senderEmail).trim().toLowerCase()),
                            );
                        const isFirstGifter = gifter.name === firstGifterName;
                        const lastGiftTs = gifter.lastGiftDate ? new Date(gifter.lastGiftDate).getTime() : 0;
                        const isRecent = lastGiftTs >= recentMs;
                        // Build a rich tooltip for desktop hover (native title
                        // attribute is accessible + zero JS overhead). Shows
                        // last-gift summary so the parent doesn't need to
                        // open the dialog just to see "when did Grandma
                        // last give?"
                        const tooltipParts: string[] = [
                          isOwner ? `${firstName} (you)` : firstName,
                          gifter.lastGiftDate
                            ? `last gave ${new Date(gifter.lastGiftDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
                            : null,
                          gifter.giftCount > 0
                            ? `${gifter.giftCount} ${gifter.giftCount === 1 ? "gift" : "gifts"}`
                            : null,
                          gifter.totalNetAmount > 0
                            ? `${formatCurrency(gifter.totalNetAmount)} total`
                            : null,
                          isFirstGifter ? "the first to give" : null,
                          isRecurring ? "recurring giver" : null,
                        ].filter(Boolean) as string[];
                        const tooltipText = tooltipParts.join(" · ");
                        return (
                          <button
                            key={gifter.name}
                            type="button"
                            onClick={() => { haptic("selection"); setSelectedGifter(gifter); }}
                            title={tooltipText}
                            className="kiddo-gifter-avatar"
                            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                          >
                            <div style={{ position: "relative" }}>
                              <div
                                className={isRecent ? "kiddo-gifter-avatar-pulse" : undefined}
                                style={{
                                  width: 56, height: 56, borderRadius: 9999,
                                  background: color.bg,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  overflow: "hidden",
                                  boxShadow: isOwner
                                    ? "0 0 0 2.5px hsl(var(--kiddo-evergreen)), 0 3px 10px rgba(26,23,16,0.15)"
                                    : isRecurring
                                    ? "0 0 0 2.5px hsl(43, 85%, 50%), 0 3px 10px rgba(26,23,16,0.15)"
                                    : "0 3px 10px rgba(26,23,16,0.13)",
                                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                                }}
                              >
                                {isOwner && user?.profileImageUrl ? (
                                  // Parent's own profile photo when set — Acorns-style
                                  // personal touch beats generic initials for the
                                  // "this is me" tile in the gifter roster.
                                  <img
                                    src={user.profileImageUrl}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span style={{ color: color.text, fontSize: 17, fontWeight: 800, letterSpacing: "0.01em" }}>
                                    {gifter.initials}
                                  </span>
                                )}
                              </div>
                              {/* First-gifter star — chronologically-earliest
                                  external gifter on this fund. Top-left so
                                  it doesn't conflict with the thanked check
                                  (bottom-right) or the recurring badge
                                  (top-right). */}
                              {isFirstGifter && (
                                <div
                                  title="First to give"
                                  style={{
                                    position: "absolute", top: -2, left: -2,
                                    width: 18, height: 18, borderRadius: 9999,
                                    background: "hsl(43, 85%, 50%)", border: "2.5px solid white",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 10, lineHeight: 1,
                                  }}
                                >
                                  ⭐
                                </div>
                              )}
                              {/* Owner+recurring resolution — when the parent
                                  has their own recurring schedule, the gold
                                  ring is masked by the evergreen owner ring.
                                  Surface a small ↻ badge top-right so both
                                  signals coexist. */}
                              {isOwner && isRecurring && (
                                <div
                                  title="Recurring schedule"
                                  style={{
                                    position: "absolute", top: -2, right: -2,
                                    width: 18, height: 18, borderRadius: 9999,
                                    background: "hsl(43, 85%, 50%)", border: "2.5px solid white",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: "white", fontSize: 10, fontWeight: 900, lineHeight: 1,
                                  }}
                                >
                                  ↻
                                </div>
                              )}
                              {isThanked && (
                                <div style={{
                                  position: "absolute", bottom: -1, right: -1,
                                  width: 18, height: 18, borderRadius: 9999,
                                  background: "hsl(var(--kiddo-evergreen))", border: "2.5px solid white",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                                    <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </div>
                              )}
                            </div>
                            <span style={{
                              fontSize: 10.5, fontWeight: 600,
                              color: isOwner ? "hsl(var(--kiddo-evergreen))" : "rgb(60,54,50)",
                              maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              textAlign: "center",
                            }}>
                              {isOwner ? "You" : firstName}
                            </span>
                            {/* Recency + repeat-count secondary line.
                                Single-gift gifters: just date ("May 5").
                                Repeat gifters: date + count ("May 5 · 3").
                                Tells the "who's loving lately" story at a
                                glance without forcing the parent to open
                                the per-gifter dialog. Counts get a small
                                evergreen color to gently celebrate sustained
                                giving (memory rule: returning love is its
                                own moment). */}
                            {gifter.lastGiftDate && (() => {
                              const lastDate = new Date(gifter.lastGiftDate);
                              const now = new Date();
                              const sameYear = lastDate.getUTCFullYear() === now.getUTCFullYear();
                              const dateLabel = lastDate.toLocaleDateString("en-US",
                                sameYear
                                  ? { month: "short", day: "numeric", timeZone: "UTC" }
                                  : { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }
                              );
                              const isRepeat = gifter.giftCount >= 2;
                              return (
                                <span style={{
                                  fontSize: 9, fontWeight: 500,
                                  color: "rgb(150,138,128)",
                                  maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                  textAlign: "center", marginTop: -2,
                                }}>
                                  {dateLabel}
                                  {isRepeat && (
                                    <span style={{ color: "hsl(var(--kiddo-evergreen))", fontWeight: 700 }}>
                                      {" · "}{gifter.giftCount}
                                    </span>
                                  )}
                                </span>
                              );
                            })()}
                          </button>
                        );
                      })}
                      {/* +N more tile — only when overflow is collapsed.
                          Tap toggles the avatars-expanded state to reveal
                          all gifters. */}
                      {!avatarsExpanded && overflowCount > 0 && (
                        <button
                          type="button"
                          onClick={() => { haptic("selection"); setAvatarsExpanded(true); }}
                          title={`Show all ${totalNamed} gifters`}
                          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                        >
                          <div style={{
                            width: 56, height: 56, borderRadius: 9999,
                            background: "rgba(26,23,16,0.05)",
                            border: "1.5px dashed rgba(26,23,16,0.18)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "rgb(110,100,90)", fontSize: 14, fontWeight: 800,
                            transition: "background 0.15s",
                          }}>
                            +{overflowCount}
                          </div>
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: "rgb(110,100,90)", textAlign: "center" }}>
                            more
                          </span>
                        </button>
                      )}
                      {avatarsExpanded && totalNamed > AVATAR_VISIBLE && (
                        <button
                          type="button"
                          onClick={() => { haptic("selection"); setAvatarsExpanded(false); }}
                          title="Show fewer"
                          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                        >
                          <div style={{
                            width: 56, height: 56, borderRadius: 9999,
                            background: "rgba(26,23,16,0.05)",
                            border: "1.5px dashed rgba(26,23,16,0.18)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "rgb(110,100,90)", fontSize: 14, fontWeight: 800,
                          }}>
                            −
                          </div>
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: "rgb(110,100,90)", textAlign: "center" }}>
                            less
                          </span>
                        </button>
                      )}
                      {/* Anonymous bucket — was a single dashed circle, which
                          read as one anonymous person who gave N times. The
                          rule is each anonymous gift = a distinct human, so
                          we render a stacked cluster (2-3 overlapping faded
                          circles) to signal "multiple distinct people." The
                          count caption stays for clarity. */}
                      {anonEntry && (() => {
                        // Cluster layout: triangular arrangement that reads
                        // as "a small group of people" rather than a
                        // left-anchored stack. The front circle sits
                        // center-bottom with the person silhouette; two
                        // smaller back circles peek from upper-left and
                        // upper-right, faded. When there's only 1 anon
                        // gift, single circle is fine — no cluster
                        // needed. Aligned to ~56x52 so the named-gifter
                        // 56-circle row stays vertically balanced.
                        const showCluster = anonEntry.giftCount >= 2;
                        return (
                        <button
                          type="button"
                          onClick={() => { haptic("selection"); setSelectedGifter(anonEntry); }}
                          title={`${anonEntry.giftCount} anonymous ${anonEntry.giftCount === 1 ? "gift" : "people"}`}
                          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                        >
                          <div style={{ position: "relative", width: 56, height: 52 }}>
                            {showCluster && (
                              <>
                                {/* Back-left peek circle */}
                                <div
                                  aria-hidden
                                  style={{
                                    position: "absolute",
                                    left: 0, top: 2,
                                    width: 32, height: 32, borderRadius: 9999,
                                    background: "rgba(26,23,16,0.04)",
                                    border: "2px dashed rgba(26,23,16,0.10)",
                                    opacity: 0.65,
                                  }}
                                />
                                {/* Back-right peek circle */}
                                <div
                                  aria-hidden
                                  style={{
                                    position: "absolute",
                                    left: 24, top: 2,
                                    width: 32, height: 32, borderRadius: 9999,
                                    background: "rgba(26,23,16,0.04)",
                                    border: "2px dashed rgba(26,23,16,0.10)",
                                    opacity: 0.65,
                                  }}
                                />
                              </>
                            )}
                            {/* Front-center main circle — carries the
                                person silhouette and crisp dashed border.
                                Sits below + over the back two circles for
                                the triangular cluster shape. Solid bg so
                                the back circles' borders behind it visually
                                clip cleanly without stripe-through noise. */}
                            <div style={{
                              position: "absolute",
                              left: showCluster ? 12 : 6,
                              top: showCluster ? 16 : 4,
                              width: showCluster ? 38 : 44,
                              height: showCluster ? 38 : 44,
                              borderRadius: 9999,
                              background: "rgb(248,245,240)",
                              border: "2px dashed rgba(26,23,16,0.14)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              boxShadow: "0 2px 6px rgba(26,23,16,0.10)",
                            }}>
                              <svg width={showCluster ? 18 : 22} height={showCluster ? 18 : 22} viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="8" r="4" fill="rgba(26,23,16,0.22)" />
                                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="rgba(26,23,16,0.18)" />
                              </svg>
                            </div>
                          </div>
                          <span style={{
                            fontSize: 10.5, fontWeight: 600, color: "rgb(150,138,128)",
                            textAlign: "center",
                          }}>
                            {anonEntry.giftCount} anon.
                          </span>
                        </button>
                        );
                      })()}
                    </div>
                      );
                    })()}

                    <div style={{ height: 1, background: "rgba(26,23,16,0.06)", margin: "16px 0" }} />

                    {/* Stats + invite. Anonymous-as-distinct-human rule:
                        each anonymous gift counts as a separate person
                        (matches Memory Book's "Anonymous as distinct human"
                        memory rule). Previously displayed "7 anonymous
                        GIFTS" alongside "3 named PEOPLE" — inconsistent
                        units and the breakdown didn't sum to a meaningful
                        total. Now fronts the celebration number ("10 people
                        love Emma") with the named/anonymous split as
                        context, so the breakdown adds up to the headline. */}
                    <div>
                      {(() => {
                        const namedCount = namedGifters.length;
                        const anonCount = anonEntry?.giftCount ?? 0;
                        const peopleCount = namedCount + anonCount;
                        if (peopleCount === 0) return null;
                        const peopleLabel = peopleCount === 1
                          ? `1 person loves ${childName || "them"}`
                          : `${peopleCount} people love ${childName || "them"}`;
                        const breakdown = (() => {
                          if (namedCount > 0 && anonCount > 0) {
                            return `${namedCount} named, ${anonCount} anonymous`;
                          }
                          if (namedCount > 0) return null;
                          // anon-only edge case: don't double-state the count
                          return `all anonymous`;
                        })();
                        return (
                          <p style={{ fontSize: 13.5, fontWeight: 600, color: "rgb(26,23,16)", lineHeight: 1.5 }}>
                            {peopleLabel}
                            {breakdown && (
                              <span style={{ color: "rgb(140,130,122)", fontWeight: 500 }}>
                                {" · "}{breakdown}
                              </span>
                            )}
                          </p>
                        );
                      })()}
                      <p style={{ fontSize: 13.5, color: "rgb(100,92,86)", marginTop: 8, lineHeight: 1.5 }}>
                        {fmtWhole(totalGifted)} gifted to {childName ? `${childName}'s` : "the"} fund.{" "}
                        {/* Inline share-loop close. The community signal
                            here ("X people love Emma") is the moment to
                            invite more — but the surface used to end at
                            the dollar total with no inline action. The
                            standalone Share card below still exists for
                            users who want a dedicated CTA; this link
                            tightens the loop for users who want to act
                            from inside this section. Same global share
                            modal the rest of the app uses.
                            Hidden for read-only roles — a previous owner
                            inviting more gifts would route them to a fund
                            they no longer control. */}
                        {!isReadOnlyFund && (
                          <button
                            type="button"
                            onClick={() => {
                              // Was dispatching `kiddo:open-share-modal` —
                              // but Dashboard ALSO listens for that event,
                              // and GlobalShareModal listens at App level
                              // unconditionally. Both modals fired in
                              // parallel, stacking. We're already inside
                              // Dashboard scope here, so calling
                              // handleShareLink() directly avoids the event
                              // bus entirely and only opens the canonical
                              // in-page modal.
                              haptic("selection");
                              handleShareLink();
                            }}
                            style={{
                              background: "none", border: "none", padding: 0,
                              color: "hsl(var(--kiddo-evergreen))", fontWeight: 700,
                              cursor: "pointer", fontFamily: "inherit", fontSize: "inherit",
                            }}
                            data-testid="who-loves-share-link"
                          >
                            Share with one more →
                          </button>
                        )}
                      </p>
                    </div>
                  </div>
                </motion.section>
              );
            })()}

            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.030 }}
              className="space-y-3"
            >
              {/* "Your part of [Child]'s story" — frames the parent's contributions
                  as a chapter in the larger story rather than a sidecar money flow.
                  Maintains the Emma-centric voice every other header uses, while
                  keeping "your" as the subject so the parent knows this section
                  belongs to them. "Story" is intentional: these contributions get
                  stamped into the Memory Book as love letters, not just transactions. */}
              <p className="kiddo-section-label" data-testid="text-your-part-title">
                {recipientFirstNameDisplay
                  ? `Your part of ${recipientFirstNameDisplay}${recipientFirstNameDisplay.endsWith("s") ? "'" : "'s"} story`
                  : "Your part of their story"}
              </p>

              {/* Layout mirrors "What Emma owns" → Chosen with love / Managed mix:
                  outside uppercase subheaders sit ABOVE each column (not inside
                  the cards), columns stack on mobile and sit side-by-side on
                  desktop, separated by a 1px warm divider — horizontal on mobile,
                  vertical on desktop. Same pattern as lines 3989-4049 so the two
                  twin sections of the parent dashboard read as one visual family. */}
              <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
              {/* ── Recurring subsection ── */}
              {/* Outer column carries layout only — no floating section
                  header anymore. The header lives INSIDE the kiddo-card
                  below as the first row, paired with the status line.
                  Apple Settings group pattern: one card per section,
                  internal hierarchy via small uppercase eyebrows + hairline
                  dividers. Matches the locked parent-surface design lens
                  ("Apple-Settings-discoverable") and rhymes with the
                  one-time card next to it.
                  Note: removed the decorative 🌱 that previously rode
                  alongside this label — brand-reserved sprout per
                  project_strategy_emoji_map. The structural cue is
                  carried by the section eyebrow + the strategy chips on
                  individual rows. */}
              <div ref={recurringSectionRef} className="md:flex-1 flex flex-col scroll-mt-20">

              {/* ── Gentle nudge: duplicate recurring schedules into same ticker ──
                  First instance of the "observation + opportunity, never warning"
                  pattern. Surfaces only when the duplicate is plausibly mergeable:
                  same execution model, both active (paused schedules wouldn't
                  combine cleanly with a running one). Per-ticker dismissal is
                  sticky via localStorage — once dismissed, the parent won't see
                  it again for that ticker until they create a third schedule
                  (which generates a fresh nudgeKey signature). */}
              {(() => {
                // Same retired-ticker filter as the deck below: Z (Zillow)
                // schedules don't trigger gentle nudges either, since the
                // user can't add another Apple-shaped duplicate to a ticker
                // that no longer exists in the picker.
                const activePicks = parentContributions.filter(c => {
                  if (c.status !== "active" || c.executionModel !== "pick" || !c.selectedTicker) return false;
                  const t = String(c.selectedTicker || "").toUpperCase();
                  if (t && LEGACY_PICK_META[t]) return false;
                  return true;
                });
                const byTicker = new Map<string, typeof activePicks>();
                for (const c of activePicks) {
                  const t = String(c.selectedTicker || "").toUpperCase();
                  if (!t) continue;
                  const arr = byTicker.get(t) || [];
                  arr.push(c);
                  byTicker.set(t, arr);
                }
                const duplicates = Array.from(byTicker.entries()).filter(([_, arr]) => arr.length >= 2);
                if (duplicates.length === 0) return null;
                return (
                  <>
                    {duplicates.map(([ticker, schedules]) => {
                      const nudgeKey = `duplicate-recurring:${ticker}:${schedules.length}`;
                      if (dismissedNudges.has(nudgeKey)) return null;
                      const totalAnnualized = schedules.reduce((sum, c) => {
                        const amt = parseFloat(String(c.amount || "0"));
                        const periods = c.frequency === "daily" ? 365 : c.frequency === "weekly" ? 52 : c.frequency === "yearly" ? 1 : 12;
                        return sum + amt * periods;
                      }, 0);
                      const monthly = totalAnnualized / 12;
                      const meta = lookupPickMeta(ticker, quotedAutoInvestStocks);
                      const tickerName = meta?.name || ticker;
                      const tickerEmoji = meta?.emoji || "";
                      return (
                        <div
                          key={nudgeKey}
                          className="rounded-xl bg-[hsl(var(--kiddo-cream)/0.6)] border border-[hsl(var(--kiddo-border)/0.4)] p-3 flex items-start gap-2.5"
                          data-testid={`gentle-nudge-${nudgeKey}`}
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[13px]" aria-hidden="true">
                            💡
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-xs text-foreground/85 leading-snug">
                              {/* Inline emoji dropped — ticker emoji read as decoration in
                                  a prose context (a 💡 nudge icon is already the visual
                                  anchor of the row), and an inline StockLogo would break
                                  the line-height of the sentence. The ticker NAME alone
                                  ("Starbucks") carries identification fine in flowing
                                  prose; brand-mark logos belong on UI elements with
                                  their own footprint (cards, pills, sheet headers),
                                  not embedded in sentences. */}
                              You're sending <span className="font-semibold tabular-nums">{formatMoneyFriendly(monthly)}/month</span> into {tickerName} across {schedules.length} schedules.
                            </p>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => { haptic("selection"); highlightDuplicateSchedules(ticker); }}
                                className="text-[11px] font-semibold text-[hsl(var(--kiddo-evergreen))] hover:underline"
                                data-testid={`gentle-nudge-action-${nudgeKey}`}
                              >
                                See both schedules →
                              </button>
                              <button
                                type="button"
                                onClick={() => { haptic("light"); dismissNudge(nudgeKey); }}
                                className="text-[11px] text-muted-foreground/70 hover:text-foreground"
                                data-testid={`gentle-nudge-dismiss-${nudgeKey}`}
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}

              {/* ── Auto-invest deck (v2) ──
                  Hidden for read-only roles (previous owner, viewer).
                  This is a parent-control surface — setting up recurring
                  investments, pausing schedules, and editing tickers all
                  require write access on the fund's owner relationship.
                  A previous owner sees their old schedules listed in the
                  per-fund history rows (Activity / DetailHistoryModal),
                  which is the correct READ surface for what they put in
                  before handoff. The deck itself is a WRITE/SET-UP surface
                  and has no read-only mode to fall back to. */}
              {!isReadOnlyFund && (() => {
                // Filter out cancelled schedules AND any schedule whose ticker
                // has been retired from the picker (LEGACY_PICK_META members
                // like Z/Zillow). The schedule rows still exist server-side so
                // we can preserve audit history. We KEEP showing them — even
                // legacy-ticker schedules — because hiding silently is the
                // worst outcome: the parent gets charged $X/mo on a dead
                // ticker and can't see/cancel it. The dead-ticker rows are
                // visible and tagged with a "Legacy" badge so the parent
                // knows to cancel them. (Original implementation hid them
                // entirely; that caused a real incident where two active
                // schedules summed to $50/mo combined but only one showed
                // in the UI, making the projection look like a bug.)
                const allContribs = parentContributions.filter(c => c.status !== "cancelled");
                const isLegacyTicker = (ticker: string | null | undefined): boolean => {
                  const t = String(ticker || "").toUpperCase();
                  return !!(t && LEGACY_PICK_META[t]);
                };
                const total = allContribs.length;
                // (Removed: safeIndex / peekDepth / goTo — carousel internals
                // for the deleted swipeable card deck. List view is the only
                // view now; no carousel state needed.)

                function freqLabel(f: string) {
                  if (f === "daily") return "day";
                  if (f === "weekly") return "week";
                  if (f === "yearly") return "year";
                  return "month";
                }

                // Empty state.
                //
                // Two cases: (a) parent has Plus access (hasAutoInvestAccess) and
                // just hasn't set a recurring investment yet, or (b) parent is on
                // free and the feature is gated. Same card, different framing for
                // each. The free-tier framing was previously a wall ("Upgrade to
                // Kiddo+" CTA, no specific projection, no calculator link) —
                // a textbook violation of the "never gate aha" principle from
                // project_setup_aha_habit_per_surface and the "tool-benefit not
                // fear/loss" framing from project_plus_conversion_framing. The
                // replacement: warm explainer + honest two-phase projection
                // (contributions stop at majority per the projection math fix
                // earlier this session arc) + calculator cross-link so the parent
                // can explore "what would $X/month do for [child]" without
                // hitting the Plus paywall. The calculator is a satellite app
                // intentionally pre-signup-distribution (project_satellite_apps);
                // surfacing it here gives free users the aha tool while keeping
                // the actual recurring-investment automation behind Plus.
                if (total === 0) {
                  // Two-phase projection math: lump grows for years-to-majority,
                  // monthly contributions accumulate during that window only,
                  // then pure compound takes over post-majority. Mirrors the
                  // Projection.tsx and dashboard-hero projectAt logic with the
                  // 0.10% AUM fee netted out so the headline is honest. We do
                  // NOT extrapolate $25/month past age 18 — the parent loses
                  // contribution control at majority transfer on a UTMA.
                  const yearsLeft = (age18Transition?.daysUntil18 ?? 0) / 365.25;
                  const r_m = (0.07 - KIDDO_AUM_FEE_RATE) / 12;
                  const n = Math.max(0, yearsLeft * 12);
                  const gf = Math.pow(1 + r_m, n);
                  const monthlyExample = 25;
                  const annuityPart = r_m > 0 && n > 0 ? monthlyExample * (gf - 1) / r_m : 0;
                  const projectedAddedValue = Math.max(0, annuityPart);
                  // Possessive form — "Emma's" when name exists, otherwise the
                  // fund's pronoun setting (her / his / their). Was hardcoded
                  // "their"; now respects getPronouns.
                  const childPossessive = recipientFirstNameDisplay
                    ? `${recipientFirstNameDisplay}'s`
                    : childPronouns.possAdj;
                  const yearsRoundedDown = Math.floor(yearsLeft);
                  const showProjection = yearsLeft > 0.5 && projectedAddedValue >= 1 && yearsRoundedDown >= 1;
                  return (
                    <div className="kiddo-card p-5 flex flex-col" data-testid="card-auto-invest-setup-v2">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--kiddo-evergreen)/0.10)]">
                          <Repeat size={17} className="text-[hsl(var(--kiddo-evergreen))]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          {!hasAutoInvestAccess && (
                            <span className="inline-block mb-1 rounded-full bg-[hsl(var(--kiddo-gold)/0.15)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--kiddo-gold-ink))]">Kiddo+</span>
                          )}
                          <p className="text-sm text-foreground">
                            {hasAutoInvestAccess
                              ? `Set a monthly amount and ${recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s fund` : "the fund"} grows on autopilot.`
                              : `Set $25/month and ${recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s fund` : "the fund"} grows every month. No gifter needed.`}
                          </p>
                          {/* Honest projection — only for free users (the
                              upgrade-pitch path). Shows the tool benefit
                              ("$25/month would add ~$X by majority") rather
                              than the fear/loss frame ("you're missing out
                              on $X"). Per project_plus_conversion_framing,
                              tool-benefit framing is the locked Plus
                              conversion lever. Per the projection math
                              fixed earlier this session, contributions
                              stop at age-of-majority on a UTMA — the math
                              here respects that and never extrapolates
                              past 18. */}
                          {!hasAutoInvestAccess && showProjection && (
                            <p className="mt-2 text-xs text-muted-foreground/85 leading-relaxed">
                              At $25/month for {yearsRoundedDown} {yearsRoundedDown === 1 ? "year" : "years"} until {childPossessive} {majorityOrdinal} birthday, that adds roughly <span className="font-semibold text-foreground tabular-nums">{formatMoneyFriendly(projectedAddedValue)}</span> on top of gifts. Hypothetical, 7% annual.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-border/40 flex flex-wrap items-center gap-3">
                        <Button
                          // Was conditionally gold for the upgrade case. Brand
                          // gold is reserved for the Share CTA — both branches
                          // here are parent-action CTAs, not share. Solid
                          // evergreen primary works for both; the plan-card
                          // context already signals "this is the upgrade path."
                          className="rounded-xl"
                          size="sm"
                          onClick={() => { haptic("selection"); if (hasAutoInvestAccess) { setEditingContribId(null); setAutoInvestStep("amount"); setAutoInvestModalOpen(true); } else { setAutoInvestUpgradeOpen(true); } }}
                          data-testid={hasAutoInvestAccess ? "button-setup-auto-invest-v2" : "button-auto-invest-upgrade-v2"}
                        >
                          {hasAutoInvestAccess ? "Set up recurring investment" : "See how Plus works"}
                        </Button>
                        {/* Calculator cross-link for free users. The at-18
                            calculator is a pre-signup satellite app per
                            project_satellite_apps, and surfacing it here
                            lets the parent explore "what would $X/month
                            do" with full interactivity, no Plus required.
                            The aha (the projection number) lives free; the
                            tool (recurring investment automation) lives
                            in Plus. Same aha-free / habit-Plus split per
                            project_plus_is_feature_gated_not_investing_gated. */}
                        {!hasAutoInvestAccess && (
                          <Link
                            href="/tools/at-18-calculator"
                            className="text-xs font-medium text-[hsl(var(--kiddo-evergreen))] hover:underline"
                            onClick={() => haptic("light")}
                            data-testid="link-at18-calculator-from-recurring-empty"
                          >
                            Try the calculator →
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="kiddo-card overflow-hidden" style={getDeepLinkHighlightCardStyle(summaryHaloTarget === "recurring")} data-testid="recurring-list-view">
                    {/* Section header + status — INSIDE the card as the
                        first block. Apple Settings group pattern: small
                        uppercase eyebrow, supporting summary line right
                        below it, then the schedule rows separated by
                        hairline divider. Was previously two floating
                        elements above the card, which broke visual rhythm
                        with the one-time card next door. */}
                    {(() => {
                      const statuses = allContribs.map(c => optimisticContribStatus[String(c.id)] ?? c.status);
                      const activeCount = statuses.filter(s => s === "active").length;
                      const pausedCount = statuses.filter(s => s === "paused").length;
                      const allPaused = activeCount === 0 && pausedCount === total;
                      const activeMonthly = allContribs.reduce((sum, c) => {
                        const status = optimisticContribStatus[String(c.id)] ?? c.status;
                        if (status !== "active") return sum;
                        return sum + toMonthlyEquivalent(parseFloat(String(c.amount || "0")), c.frequency);
                      }, 0);
                      const monthlyLabel = activeMonthly > 0
                        ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(activeMonthly))
                        : null;
                      const summaryText = allPaused
                        ? `${pausedCount} paused`
                        : pausedCount === 0
                          ? monthlyLabel
                            ? `${activeCount} active · ${monthlyLabel}/month`
                            : `${activeCount} active`
                          : monthlyLabel
                            ? `${activeCount} active · ${monthlyLabel}/month · ${pausedCount} paused`
                            : `${activeCount} active · ${pausedCount} paused`;
                      return (
                        <div className="px-4 pt-3.5 pb-3 border-b border-border/40">
                          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/65 mb-1">
                            Recurring investments
                          </p>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <p style={{ fontSize: 12, color: "rgba(26,23,16,0.55)", fontWeight: 500, flex: 1, minWidth: 0 }}>{summaryText}</p>
                            {allPaused && (
                              <button
                                type="button"
                                style={{ fontSize: 11.5, fontWeight: 700, color: "hsl(var(--kiddo-evergreen))", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                                onClick={() => allContribs.forEach(c => handleUpdateAutoInvestStatus(String(c.id), "active"))}
                              >
                                Resume all →
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── LIST VIEW — thin scannable rows. Single view, scales 1 → many.
                        For total === 1, rows get hero-ish styling (larger logo + amount,
                        more padding) so a parent with one schedule still feels weight. ── */}
                        <ul className="divide-y divide-border/40">
                          {allContribs.map((contrib) => {
                            const effectiveStatus = optimisticContribStatus[String(contrib.id)] ?? contrib.status;
                            const isPausedRow = effectiveStatus === "paused";
                            const bank = contrib.bankAccountId
                              ? bankAccounts.find((b: any) => b.id === contrib.bankAccountId)
                              : null;
                            const pickMeta = contrib.executionModel === "pick" && contrib.selectedTicker
                              ? lookupPickMeta(contrib.selectedTicker, quotedAutoInvestStocks)
                              : null;
                            // When we'll render a real logo on the left, drop the emoji from
                            // the label — the logo carries the visual identification, so
                            // "into Apple 🍎" alongside an Apple logo is redundant.
                            // For managed/auto contributions (no specific ticker), show the
                            // canonical bucket identity ("Emma's mix") instead of the
                            // preset-baked "Emma's Conservative Mix" — the strategy
                            // icon already shows the preset visually, baking it into
                            // the title duplicated information AND made the name lie
                            // when the parent switched presets. The bucket identity
                            // stays stable across preset changes; the icon + the chip
                            // below carry the current preset state separately.
                            // Pick → bare brand name ("Apple") since the brand owns its
                            // own identity.
                            const targetLabel = pickMeta
                              ? pickMeta.name
                              : capFirst(mixIdentityFor(recipientFirstNameDisplay));
                            // 4-second glow ring when this row matches the
                            // ticker that the duplicate-recurring nudge just
                            // pointed at. Gives the parent immediate visual
                            // confirmation of which schedules are the dupes —
                            // critical because the list shows ALL schedules,
                            // not just the duplicates. Ring fades out via the
                            // setTimeout in highlightDuplicateSchedules().
                            const isHighlighted = highlightedRecurringTicker
                              && String(contrib.selectedTicker || "").toUpperCase() === highlightedRecurringTicker;
                            // Hero treatment when there's exactly one schedule —
                            // larger logo, larger title, more padding so the
                            // single row still feels like a deliberate primary
                            // surface (not a thin line item lost in a list of
                            // one). Multi-schedule lists keep the compact
                            // scannable shape — they earn density.
                            const isSoloHero = total === 1;
                            return (
                              <li key={contrib.id} className={`relative ${isHighlighted ? "ring-2 ring-[hsl(var(--kiddo-evergreen))] ring-offset-2 rounded-xl bg-[hsl(var(--kiddo-evergreen)/0.04)] transition-all duration-500" : "transition-all duration-500"}`}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    haptic("selection");
                                    setListActionConfirmCancel(false);
                                    setListActionContribId(String(contrib.id));
                                  }}
                                  data-testid={`recurring-list-row-${contrib.id}`}
                                  className={`w-full flex items-center gap-3 px-4 ${isSoloHero ? "py-4" : "py-2.5"} pr-20 text-left hover:bg-muted/30 transition-colors ${isPausedRow ? "opacity-60" : ""}`}
                                >
                                  {/* Two icon types share the same slot:
                                      - Pick → real brand logo (Apple stays Apple
                                        even when paused; identity > state).
                                      - Managed → strategy icon (canonical
                                        emoji in a tinted tile, per-strategy
                                        color). Replaces the old generic Repeat
                                        icon — that icon told you "recurring,"
                                        which the cadence line already says, but
                                        not WHICH mix. The strategy icon now
                                        carries that signal at a glance.
                                      Row's 60% opacity still carries paused
                                      state quietly. */}
                                  {pickMeta && contrib.selectedTicker ? (
                                    <div className="shrink-0">
                                      <StockLogo ticker={contrib.selectedTicker} size={isSoloHero ? 40 : 32} />
                                    </div>
                                  ) : (
                                    <StrategyIcon
                                      strategyKey={(activeFund as any)?.investmentStrategy}
                                      size={isSoloHero ? 40 : 32}
                                      paused={isPausedRow}
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    {/* Hierarchy flipped: target (Apple, Conservative Mix) is
                                        the primary line — the emotional anchor. Amount + cadence
                                        ride underneath as functional metadata. The strategy
                                        emoji used to live inline at the end of the title; it
                                        moved into the StrategyIcon container above to avoid
                                        stacking the same brand mark twice. */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className={`${isSoloHero ? "text-base" : "text-sm"} font-semibold truncate ${isPausedRow ? "text-muted-foreground" : "text-foreground"}`}>
                                        {targetLabel}
                                      </p>
                                      {/* Legacy badge — surfaces when the schedule's
                                          ticker has been retired from the picker. The
                                          schedule still runs (the parent is still being
                                          charged) but they can't add new ones to it.
                                          Soft amber, NOT alarming red — fits the "fund
                                          is safe" tone. Tooltip explains; tap-through
                                          to the action sheet (existing onClick) lets
                                          them cancel from the menu. */}
                                      {isLegacyTicker(contrib.selectedTicker) && (
                                        <span
                                          title="This stock is no longer available to pick. Existing schedules still run. Cancel here to clean up."
                                          className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-amber-700 border border-amber-200"
                                        >
                                          Legacy
                                        </span>
                                      )}
                                    </div>
                                    <p className={`${isSoloHero ? "text-xs mt-0.5" : "text-[11px]"} text-muted-foreground truncate tabular-nums`}>
                                      <span className={isSoloHero ? "font-semibold text-foreground/85" : ""}>
                                        {formatMoneyFriendly(parseFloat(contrib.amount))}/{freqLabel(contrib.frequency)}
                                      </span>
                                      {bank ? ` · ${bank.bankName || "Bank"} ····${bank.last4 || ""}` : ""}
                                      {contrib.nextRunDate && !isPausedRow
                                        ? ` · Next ${new Date(String(contrib.nextRunDate)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
                                        : ""}
                                    </p>
                                  </div>
                                  <span
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                      isPausedRow ? "bg-amber-100 text-amber-800" : "bg-[hsl(var(--kiddo-evergreen)/0.15)] text-[hsl(var(--kiddo-evergreen))]"
                                    }`}
                                  >
                                    {isPausedRow ? "Paused" : "Active"}
                                  </span>
                                </button>
                                {/* Right-side action cluster — History opens
                                    the per-schedule detail modal (read view),
                                    MoreVertical opens the action sheet
                                    (Edit / Pause / Cancel). Two distinct
                                    affordances, one for reading, one for
                                    editing. Pattern matches the Activity
                                    Scheduled tab so the parent learns it
                                    once and uses it everywhere. */}
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    aria-label="View this schedule's history"
                                    title="View this schedule's history"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDetailScope({ kind: "schedule", scheduleId: String(contrib.id) });
                                    }}
                                    data-testid={`recurring-list-detail-${contrib.id}`}
                                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                                  >
                                    <History size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label="Recurring investment actions"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      haptic("selection");
                                      setListActionConfirmCancel(false);
                                      setListActionContribId(String(contrib.id));
                                    }}
                                    data-testid={`recurring-list-actions-${contrib.id}`}
                                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                                  >
                                    <MoreVertical size={16} />
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>

                    {/* "+ Add another" — last row of the card. Hairline
                        top-border replaces the schedule-list ul's
                        bottom-border so it reads as the final divider in
                        the same Apple-Settings group, not as a separate
                        floating button. The dashed border on the button
                        itself signals "empty slot waiting to be filled"
                        (the affordance the design lens calls out). */}
                    <div className="border-t border-border/40 px-4 py-3">
                      <button
                        type="button"
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[hsl(var(--kiddo-evergreen)/0.35)] bg-[hsl(var(--kiddo-evergreen)/0.04)] py-2.5 text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen)/0.08)] transition-colors"
                        onClick={() => { haptic("selection"); setEditingContribId(null); setAutoInvestStep("amount"); setAutoInvestModalOpen(true); }}
                      >
                        + Add another
                      </button>
                    </div>
                  </div>
                );
              })()}

              </div>

              {/* Warm divider — horizontal on mobile (between stacked columns),
                  vertical on desktop (between side-by-side columns). Same exact
                  treatment as the Chosen/Managed split. */}
              <div className="border-t border-[hsl(var(--kiddo-border)/0.6)] md:hidden" />
              <div className="hidden md:block w-px self-stretch bg-[hsl(var(--kiddo-border)/0.6)]" />

              {/* ── One-time subsection ──
                  Apple Settings group pattern: section eyebrow lives
                  INSIDE the card (top, before the existing "Last
                  contribution" inner block), not floating outside.
                  Mirrors the recurring side now that both sections
                  read as one visual family. The decorative 💚 that
                  used to ride alongside the floating label is gone —
                  same restraint pass as the recurring header. */}
              <div className="md:flex-1 flex flex-col">
              {/* ── One-time investment card ── */}
              <div className="kiddo-card p-5 flex flex-col flex-1" style={getDeepLinkHighlightCardStyle(summaryHaloTarget === "onetime")} data-testid="card-one-time-contribution-v2">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/65 mb-3">
                  One-time investment
                </p>
                <div className="min-w-0">
                  {lastOwnGift ? (() => {
                      // The "feel it working" moment: parent's last contribution wrapped
                      // as a mini Memory Book entry. Brand emoji is the hero (warm anchor),
                      // amount + date sit underneath as functional metadata, "Now worth"
                      // delta sits on its own line as the emotional payoff. We compute
                      // current value from shares × live price when available, skip the
                      // delta line entirely if no quote (never show a stale "+$0.00").
                      // Emoji/name resolved via lookupPickMeta so legacy tickers (Z) and
                      // server payloads missing tickerEmoji/tickerName still render warm.
                      const pickMeta = lookupPickMeta(lastOwnGift.ticker, quotedAutoInvestStocks);
                      const tickerEmoji = lastOwnGift.tickerEmoji || pickMeta?.emoji || "";
                      const tickerName = lastOwnGift.tickerName || pickMeta?.name || lastOwnGift.ticker || "";
                      const meta = lastOwnGift.ticker
                        ? quotedAutoInvestStocks.find((s) => s.symbol === lastOwnGift.ticker)
                        : null;
                      const livePrice = meta?.price && Number.isFinite(meta.price) ? meta.price : null;
                      const currentValue = livePrice && lastOwnGift.shares != null && lastOwnGift.shares > 0
                        ? lastOwnGift.shares * livePrice
                        : null;
                      const delta = currentValue != null ? currentValue - lastOwnGift.amount : null;
                      const dateLabel = lastOwnGift.createdAt
                        ? new Date(lastOwnGift.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
                        : null;
                      return (
                        <div className="rounded-xl bg-[hsl(var(--kiddo-cream)/0.7)] border border-[hsl(var(--kiddo-border)/0.4)] p-3 space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
                            Last investment
                          </p>
                          {/* Real brand logo for picks (Robinhood / Apple Stocks
                              register — real money, real position, real logo).
                              Falls back to the ticker emoji for unrecognized
                              symbols, and to nothing for managed-mix where
                              "Fund default" stands alone. StockLogo handles
                              its own letter-circle fallback when Parqet
                              doesn't have the asset. */}
                          <div className="flex items-center gap-1.5">
                            {lastOwnGift.ticker ? (
                              <StockLogo ticker={lastOwnGift.ticker} size={18} className="shrink-0" />
                            ) : tickerEmoji ? (
                              <span className="text-[15px] leading-none" aria-hidden="true">{tickerEmoji}</span>
                            ) : null}
                            <p className="text-sm font-semibold text-foreground leading-snug">
                              {tickerName || "Fund default"}
                              <span className="ml-1 font-normal text-muted-foreground">· {formatMoneyFriendly(lastOwnGift.amount)}{dateLabel ? ` · ${dateLabel}` : ""}</span>
                            </p>
                          </div>
                          {currentValue != null && delta != null && Math.abs(delta) >= 0.01 && (
                            <p className="text-[12px] tabular-nums leading-snug">
                              <span className="text-muted-foreground">Now worth </span>
                              <span className="font-semibold text-foreground">{formatCurrency(currentValue)}</span>
                              <span className={`ml-1 font-semibold ${delta >= 0 ? "text-[hsl(var(--kiddo-evergreen))]" : "text-amber-700"}`}>
                                ({delta >= 0 ? "+" : "−"}{formatCurrency(Math.abs(delta))}){delta >= 0 ? " 🌱" : ""}
                              </span>
                            </p>
                          )}
                        </div>
                      );
                    })() : (
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--kiddo-evergreen)/0.10)]">
                          <Plus size={17} className="text-[hsl(var(--kiddo-evergreen))]" />
                        </div>
                        <p className="text-xs text-muted-foreground pt-1">
                          {activeAutoInvest
                            ? "Add outside your regular schedule anytime."
                            : `A birthday. A milestone. Just because. 🌱`}
                        </p>
                      </div>
                    )}
                </div>
                <div className="mt-auto pt-4">
                  {isReadOnlyFund ? (
                    // Read-only role (previous owner, viewer): show the
                    // last-investment chrome above unchanged, but the
                    // action stack (Invest more, Repeat last gift, Add
                    // custom amount, Contribute now from schedule, View
                    // all investments) is all write or write-adjacent.
                    // View-all still routes via `openDetailScope` which
                    // is a per-fund read endpoint — keep that as the
                    // single read affordance so a previous owner can
                    // browse their own historical contributions on the
                    // handed-off fund. Everything else is hidden.
                    <button
                      type="button"
                      className="w-full text-center text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors py-1"
                      onClick={() => { openDetailScope({ kind: "contributions" }); }}
                      data-testid="button-one-time-view-all-readonly"
                    >
                      View past investments →
                    </button>
                  ) : lastOwnGift ? (
                    <div className="space-y-2">
                      {/* Hierarchy: solid evergreen primary = invest in the fund (managed
                          mix, age-appropriate), outlined evergreen secondary = repeat the
                          same stock as last time, text tertiary = custom. Brand gold is
                          reserved for the Share CTA per locked rule — using it here was a
                          drift; this card's primary now uses the canonical evergreen so
                          the parent-investment action reads distinct from share-the-link.
                          The default routes through auto-allocator so contributions diversify
                          per the active strategy instead of concentrating a chosen-with-love
                          position. */}
                      <Button
                        className="w-full rounded-xl"
                        size="sm"
                        onClick={() => {
                          haptic("medium");
                          setOneTimeAmount(String(lastOwnGift.amount.toFixed(0)));
                          setOneTimeStep("amount");
                          setOneTimeExecutionModel("auto");
                          setOneTimeTicker("");
                          setOneTimePaymentMethod("apple_pay");
                          setOneTimeMemoryNote("");
                          setOneTimeNoteSaved(false);
                          setOneTimeModalOpen(true);
                        }}
                        data-testid="button-one-time-add-to-mix-v2"
                      >
                        Invest {formatMoneyFriendly(lastOwnGift.amount)} in {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "this"} fund →
                      </Button>
                      {lastOwnGift.ticker && (() => {
                        // Mirror the same fallback chain used in the metadata line above
                        // so the "again" button always carries the warm name
                        // when the server payload doesn't pre-populate it.
                        const repeatMeta = lookupPickMeta(lastOwnGift.ticker, quotedAutoInvestStocks);
                        const repeatName = lastOwnGift.tickerName || repeatMeta?.name || lastOwnGift.ticker;
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full rounded-xl border-[hsl(var(--kiddo-evergreen)/0.35)] bg-[hsl(var(--kiddo-evergreen)/0.06)] text-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen)/0.12)]"
                            onClick={() => {
                              haptic("light");
                              setOneTimeAmount(String(lastOwnGift.amount.toFixed(0)));
                              setOneTimeStep("amount");
                              setOneTimeExecutionModel("pick");
                              setOneTimeTicker(lastOwnGift.ticker || "");
                              setOneTimePaymentMethod("apple_pay");
                              setOneTimeMemoryNote("");
                              setOneTimeNoteSaved(false);
                              setOneTimeModalOpen(true);
                            }}
                            data-testid="button-one-time-repeat-v2"
                          >
                            Add {formatMoneyFriendly(lastOwnGift.amount)} to {repeatName} again
                          </Button>
                        );
                      })()}
                      <button
                        type="button"
                        className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                        onClick={() => { haptic("light"); setOneTimeAmount("50"); setOneTimeStep("amount"); setOneTimeExecutionModel("auto"); setOneTimeTicker(""); setOneTimePaymentMethod("apple_pay"); setOneTimeMemoryNote(""); setOneTimeNoteSaved(false); setOneTimeModalOpen(true); }}
                        data-testid="button-one-time-custom-amount-v2"
                      >
                        Different amount or stock →
                      </button>
                      {/* "View all contributions" — opens the same modal
                          Activity uses, scoped to all the parent's
                          contributions (recurring + one-time). Replaces
                          the previous "View all in Activity →" link
                          which forced a navigation away from Dashboard.
                          Stays here on Dashboard with the rich detail view
                          inline — Acorns-style. */}
                      <button
                        type="button"
                        className="w-full text-center text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors py-1"
                        onClick={() => { openDetailScope({ kind: "contributions" }); }}
                        data-testid="button-one-time-view-all-v2"
                      >
                        View all your investments →
                      </button>
                    </div>
                  ) : activeAutoInvest ? (
                    <div className="space-y-2">
                      <Button
                        className="w-full rounded-xl"
                        size="sm"
                        disabled={contributingNow}
                        onClick={() => {
                          haptic("light");
                          setAddFromScheduleNote("");
                          setAddFromScheduleSheet({ planId: activeAutoInvest.id, amount: String(activeAutoInvest.amount) });
                        }}
                        data-testid="button-contribute-now-card-v2"
                      >
                        {contributingNow ? (
                          <span className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Opening checkout...
                          </span>
                        ) : `Add ${formatMoneyFriendly(parseFloat(activeAutoInvest.amount))}`}
                      </Button>
                      <button
                        type="button"
                        className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                        onClick={() => { haptic("light"); setOneTimeAmount("50"); setOneTimeStep("amount"); setOneTimeExecutionModel("auto"); setOneTimeTicker(""); setOneTimePaymentMethod("apple_pay"); setOneTimeMemoryNote(""); setOneTimeNoteSaved(false); setOneTimeModalOpen(true); }}
                        data-testid="button-one-time-custom-amount-v2"
                      >
                        Different amount
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full rounded-xl"
                      size="sm"
                      onClick={() => { haptic("light"); setOneTimeAmount("50"); setOneTimeStep("amount"); setOneTimeExecutionModel("auto"); setOneTimeTicker(""); setOneTimePaymentMethod("apple_pay"); setOneTimeMemoryNote(""); setOneTimeNoteSaved(false); setOneTimeModalOpen(true); }}
                      data-testid="button-one-time-contribution-v2"
                    >
                      Add a gift
                    </Button>
                  )}
                </div>
              </div>
              </div>
              </div>
            </motion.section>

            {/* ===== Occasions and Goals ===== */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.035 }}
            >
              {/* ── Section header ── */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:2 }}>
                <span className="kiddo-section-label">
                  {recipientFirstNameDisplay
                    ? `${recipientFirstNameDisplay}'s Occasions and Goals`
                    : "Occasions and Goals"}
                </span>
                {!isReadOnlyFund && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); haptic("selection"); if (isFamily || isStarter) setCreateEventSheetOpen(true); else setEventGateOpen(true); }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen)/0.18)] transition-colors"
                    aria-label="New occasion or goal"
                  >
                    <Plus size={13} />
                  </button>
                )}
              </div>

              {/* ── Horizontal tile row ── */}
              {(() => {
                const fmtC = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
                const fundSlug = (activeFund as any)?.slug as string | undefined;
                // Use the canonical EVENT_TYPE_EMOJI map (defined near top of
                // file) instead of a local subset. The local map missed types
                // like "first_car", "religious_holiday", "wedding", etc., which
                // fell through to the bare fallback. Single source of truth
                // means new event types added centrally pick up the correct
                // emoji on the dashboard tile without a parallel update here.
                // See feedback_quick_links_principle.md / EVENT_TYPE_EMOJI.

                // ── Smart suggestions ──
                const childBirthdateRaw = (activeFund as any)?.recipientBirthdate;
                const childBirthdate = childBirthdateRaw ? new Date(childBirthdateRaw) : null;
                const nowMs = Date.now();
                const childAgeNow = childBirthdate ? Math.floor((nowMs - childBirthdate.getTime()) / (365.25 * 86400000)) : null;
                const childFirstSug = (recipientFirstNameDisplay || "").trim() || "your child";
                const ord = (n: number) => n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";

                // SugTile gains a sortMs field so we can rank by date proximity at
                // the end. Most imminent dated event leads. Goal events (no date)
                // use sortMs = Infinity so they fall to the end of the visible 5
                // but still appear if there's room. Previously the order was
                // category-based (birthday → cultural → 13+ → holiday) which made
                // newborn Jane see "1st Birthday May 2027 (11 months away)" ABOVE
                // "Hanukkah Dec 2026 (6 months away)". Proximity-sort fixes that.
                type SugTile = { key: string; emoji: string; name: string; sub: string; countdown: string; sortMs: number; prefill: { name: string; eventType?: string; eventDate?: string; goalAmount?: string; eventCategory?: string } };
                const suggestions: SugTile[] = [];

                // Birthday — three branches now, not one:
                //   (1) Unborn / future-birthdate kid: suggest "Welcome [Name]"
                //       with the birth date. The old code produced
                //       "Jane's 0th Birthday" which is broken English and
                //       not what the parent wants. The welcome event is the
                //       moment that actually matters pre-birth.
                //   (2) Newborn (under 1 year old): suggest "First Year" as
                //       a savings goal AND the 1st birthday as the dated
                //       event. The 1st birthday alone is too far away to
                //       be the primary suggestion for a 2-week-old.
                //   (3) Standard: next birthday with proper ordinal.
                // Also fixed the today-is-the-birthday roll-forward by
                // comparing against end-of-day on the candidate birthday
                // rather than midnight. Without that fix, the suggestion
                // on a kid's actual birthday said "next year" instead of
                // showing "today."
                if (childBirthdate) {
                  const bd = new Date(childBirthdate);
                  const isUnborn = bd.getTime() > nowMs;
                  const isNewborn = !isUnborn && childAgeNow !== null && childAgeNow < 1;
                  const hasWelcomeOrBirthEvent = activeEvents.some(e =>
                    String(e.name || "").toLowerCase().includes("welcome") ||
                    String(e.name || "").toLowerCase().includes("arrival") ||
                    e.eventType === "baby_shower",
                  );

                  if (isUnborn && !hasWelcomeOrBirthEvent) {
                    // Pre-birth: the imminent moment is the welcome itself.
                    const daysUntilBirth = Math.ceil((bd.getTime() - nowMs) / 86400000);
                    const countdownStr = daysUntilBirth <= 60
                      ? `${daysUntilBirth}d away`
                      : daysUntilBirth <= 365
                      ? `${Math.round(daysUntilBirth / 30)}mo away`
                      : `${Math.ceil(daysUntilBirth / 365)}yr away`;
                    suggestions.push({
                      key: "sug-welcome", emoji: "👶",
                      name: `Welcome ${childFirstSug}`,
                      sub: bd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                      countdown: countdownStr,
                      sortMs: bd.getTime(),
                      prefill: { name: `Welcome ${childFirstSug}`, eventType: "baby_shower", eventDate: bd.toISOString().slice(0, 10), eventCategory: "gifting_occasion" },
                    });
                  } else if (!activeEvents.some(e => e.eventType === "birthday")) {
                    // Standard next-birthday math, with the today-is-birthday fix.
                    const nextBday = new Date(bd.getFullYear(), bd.getMonth(), bd.getDate());
                    nextBday.setFullYear(new Date().getFullYear());
                    // End-of-day so today's birthday does not roll forward.
                    // Previously: nextBday at midnight, nowMs somewhere later
                    // in the day → "next year" instead of "today."
                    nextBday.setHours(23, 59, 59, 999);
                    if (nextBday.getTime() < nowMs) {
                      nextBday.setFullYear(nextBday.getFullYear() + 1);
                    }
                    const nextAge = nextBday.getFullYear() - bd.getFullYear();
                    // Guard against any residual 0/negative ordinal that could
                    // slip through (e.g., kid born today, weird DST math). If
                    // it does, skip the birthday tile rather than render
                    // "0th Birthday." Welcome branch above is the right
                    // fallback for the unborn case; for born-today we just
                    // don't add a 1st-birthday tile a year away.
                    if (nextAge > 0) {
                      const daysUntil = Math.ceil((nextBday.getTime() - nowMs) / 86400000);
                      const countdownStr = daysUntil <= 0
                        ? "Today"
                        : daysUntil <= 60
                        ? `${daysUntil}d away`
                        : daysUntil <= 365
                        ? `${Math.round(daysUntil / 30)}mo away`
                        : `${Math.ceil(daysUntil / 365)}yr away`;
                      suggestions.push({
                        key: "sug-birthday", emoji: "🎂",
                        name: `${childFirstSug}'s ${nextAge}${ord(nextAge)} Birthday`,
                        sub: nextBday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                        countdown: countdownStr,
                        sortMs: nextBday.getTime(),
                        prefill: { name: `${childFirstSug}'s ${nextAge}${ord(nextAge)} Birthday`, eventType: "birthday", eventDate: nextBday.toISOString().slice(0, 10), eventCategory: "gifting_occasion" },
                      });
                    }
                  }

                  // First Year goal for newborns. Pairs with the 1st-birthday
                  // tile above (which is 11+ months away for a freshly-born
                  // kid). Captures the more concrete "let's build the fund
                  // through year one" framing that parents of newborns
                  // actually have in mind. No date — it's a goal.
                  if (isNewborn && !activeEvents.some(e =>
                    String(e.name || "").toLowerCase().includes("first year") ||
                    String(e.name || "").toLowerCase().includes("year one"))) {
                    suggestions.push({
                      key: "sug-first-year", emoji: "🌱",
                      name: `${childFirstSug}'s First Year`,
                      sub: "Savings goal", countdown: "no date needed",
                      sortMs: Number.POSITIVE_INFINITY,
                      prefill: { name: `${childFirstSug}'s First Year`, eventType: "just_because", goalAmount: "2500", eventCategory: "savings_goal" },
                    });
                  }
                }

                // Cultural traditions - read early so we can interleave
                const culturalBg = (activeFund as any)?.culturalBackground as CulturalBackground | null | undefined;
                const traditions = culturalBg?.traditions ?? [];

                // Cultural suggestions feed in. Each cultural suggestion gets a
                // sortMs derived from its event date (or +Infinity for goals).
                if (traditions.length > 0) {
                  const culturalSugs = getCulturalSuggestions({
                    traditions,
                    childFirstName: childFirstSug,
                    childBirthdate: childBirthdate,
                    childAgeNow,
                    activeEventNames: activeEvents.map(e => e.name),
                    nowMs,
                  });
                  for (const cs of culturalSugs) {
                    if (!suggestions.some(s => s.key === cs.key)) {
                      const csDateStr = cs.prefill?.eventDate;
                      const csMs = csDateStr ? new Date(csDateStr).getTime() : Number.POSITIVE_INFINITY;
                      suggestions.push({ ...(cs as SugTile), sortMs: Number.isFinite(csMs) ? csMs : Number.POSITIVE_INFINITY });
                    }
                  }
                }

                // Driver's License (universal, age 14 to 16). Massive gifting
                // moment for many families; previously absent. The 13+ block
                // had First Car / Graduation / College but not the milestone
                // the car money is FOR. Targets the kid's 16th birthday as
                // the date so the goal has a concrete end-point.
                if (childAgeNow !== null && childAgeNow >= 14 && childAgeNow <= 16 &&
                    !activeEvents.some(e => String((e as any).name || "").toLowerCase().includes("license") || String((e as any).name || "").toLowerCase().includes("driver"))) {
                  const sixteenthYear = childBirthdate ? childBirthdate.getFullYear() + 16 : new Date().getFullYear() + 1;
                  const sixteenthDate = childBirthdate
                    ? new Date(sixteenthYear, childBirthdate.getMonth(), childBirthdate.getDate())
                    : new Date(sixteenthYear, 5, 1);
                  const daysUntilSixteen = Math.ceil((sixteenthDate.getTime() - nowMs) / 86400000);
                  const countdownStr = daysUntilSixteen <= 0
                    ? "Already here"
                    : daysUntilSixteen <= 60
                    ? `${daysUntilSixteen}d away`
                    : daysUntilSixteen <= 365
                    ? `${Math.round(daysUntilSixteen / 30)}mo away`
                    : `${Math.ceil(daysUntilSixteen / 365)}yr away`;
                  suggestions.push({
                    key: "sug-license", emoji: "🪪",
                    name: `${childFirstSug}'s Driver's License`,
                    sub: sixteenthDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                    countdown: countdownStr,
                    sortMs: sixteenthDate.getTime(),
                    prefill: { name: `${childFirstSug}'s Driver's License`, eventType: "just_because", eventDate: sixteenthDate.toISOString().slice(0, 10), eventCategory: "gifting_occasion" },
                  });
                }

                // Age-gated (13+) - graduation, first car, college fund
                if (childAgeNow !== null && childAgeNow >= 13) {
                  if (!activeEvents.some(e => e.eventType === "graduation")) {
                    const gradYear = childBirthdate ? childBirthdate.getFullYear() + 18 : new Date().getFullYear() + 4;
                    const yearsUntil = gradYear - new Date().getFullYear();
                    const gradDateMs = new Date(gradYear, 5, 1).getTime();
                    suggestions.push({
                      key: "sug-grad", emoji: "🎓",
                      name: `${childFirstSug}'s Graduation`,
                      sub: `Class of ${gradYear}`,
                      countdown: yearsUntil <= 0 ? "This year" : `${yearsUntil} yr${yearsUntil !== 1 ? "s" : ""} away`,
                      sortMs: gradDateMs,
                      prefill: { name: `${childFirstSug}'s Graduation`, eventType: "graduation", eventDate: `${gradYear}-06-01`, eventCategory: "gifting_occasion" },
                    });
                  }
                  if (!activeEvents.some(e => String((e as any).name || "").toLowerCase().includes("car"))) {
                    suggestions.push({
                      key: "sug-car", emoji: "🚗",
                      name: `${childFirstSug}'s First Car`,
                      sub: "Savings goal", countdown: "no date needed",
                      sortMs: Number.POSITIVE_INFINITY,
                      prefill: { name: `${childFirstSug}'s First Car`, eventType: "just_because", goalAmount: "5000", eventCategory: "savings_goal" },
                    });
                  }
                  if (!activeEvents.some(e => String((e as any).name || "").toLowerCase().includes("college"))) {
                    suggestions.push({
                      key: "sug-college", emoji: "📚",
                      name: `${childFirstSug}'s College Fund`,
                      sub: "Savings goal", countdown: "no date needed",
                      sortMs: Number.POSITIVE_INFINITY,
                      prefill: { name: `${childFirstSug}'s College Fund`, eventType: "just_because", goalAmount: "50000", eventCategory: "savings_goal" },
                    });
                  }
                }

                // Holiday - Oct through Dec (only when no cultural traditions set)
                if (new Date().getMonth() >= 9 && traditions.length === 0 && !activeEvents.some(e => e.eventType === "holiday")) {
                  const yr = new Date().getFullYear();
                  const xmas = new Date(yr, 11, 25);
                  const xmasDays = Math.ceil((xmas.getTime() - nowMs) / 86400000);
                  suggestions.push({
                    key: "sug-holiday", emoji: "🎄",
                    name: "Holiday Gift Fund",
                    sub: `Dec 25, ${yr}`,
                    countdown: xmasDays > 0 ? `${xmasDays}d away` : "This season",
                    sortMs: xmas.getTime(),
                    prefill: { name: `${childFirstSug}'s Holiday Fund`, eventType: "holiday", eventDate: `${yr}-12-25`, eventCategory: "gifting_occasion" },
                  });
                }

                // Sort by date proximity. Dated events (finite sortMs) lead,
                // most imminent first. Undated goal events (sortMs Infinity)
                // fall to the end of the list but stay visible if the cap of
                // 5 has room. This is the brilliance fix the user asked for:
                // a parent of newborn Jane previously saw "1st Birthday May
                // 2027 (11 months away)" ABOVE "Hanukkah Dec 2026 (6 months
                // away)" because category order beat proximity. Proximity-
                // sort makes the closer-and-more-meaningful event lead.
                suggestions.sort((a, b) => a.sortMs - b.sortMs);

                const visibleSuggestions = suggestions.slice(0, 5);

                // Type-aware empty-state copy. Tiles are 140px wide, so each line stays terse;
                // the warm aspiration ("share the link and watch it grow") shows up via the
                // emoji + verb pair rather than a paragraph the tile can't fit.
                const emptyStateByType: Record<string, string> = {
                  car: "🚗 Vroom from $0",
                  graduation: "🎓 Cap & gown fund",
                  birthday: "🎂 Cake fund",
                  holiday: "🎄 Holiday glow",
                  baby_shower: "🍼 Welcome fund",
                  religious_holiday: "✡️ Tradition fund",
                  just_because: "💛 Start the story",
                };
                const emptyStateByName = (eventName: string): string | null => {
                  const n = eventName.toLowerCase();
                  if (n.includes("car")) return "🚗 Vroom from $0";
                  if (n.includes("college") || n.includes("school")) return "📚 College fund";
                  if (n.includes("graduation")) return "🎓 Cap & gown fund";
                  if (n.includes("hanukkah")) return "🕎 Festival fund";
                  if (n.includes("christmas") || n.includes("holiday")) return "🎄 Holiday glow";
                  if (n.includes("birthday")) return "🎂 Cake fund";
                  if (n.includes("trip") || n.includes("travel")) return "🌍 Adventure fund";
                  return null;
                };

                const renderTile = (event: typeof activeEvents[0], isArchived: boolean) => {
                  const key = `tile-${event.id}`;
                  const imgUrl = (event as any).imageUrl as string | null | undefined;
                  // Honor the parent's saved focal point so the tile crops
                  // correctly at this surface's aspect (~3:2). Defaults to
                  // center when focal point isn't set (legacy events).
                  const imgFocalX = (event as any).imageFocalX != null ? Number((event as any).imageFocalX) : 0.5;
                  const imgFocalY = (event as any).imageFocalY != null ? Number((event as any).imageFocalY) : 0.5;
                  const imgFxPct = Number.isFinite(imgFocalX) ? Math.max(0, Math.min(100, imgFocalX * 100)) : 50;
                  const imgFyPct = Number.isFinite(imgFocalY) ? Math.max(0, Math.min(100, imgFocalY * 100)) : 50;
                  const imgPosition = `${imgFxPct}% ${imgFyPct}%`;
                  const giftVol = parseFloat(String(event.giftVolume || "0"));
                  const goal = parseFloat(String(event.goalAmount || "0"));
                  // Goal-based progress uses WHOLE FUND VALUE as the
                  // numerator — every dollar in the fund moves toward
                  // every goal. Honors the locked product principle
                  // ("All occasions and goals go into the same fund 🌱"):
                  // money is fungible, not earmarked. The per-event
                  // giftVolume still drives the non-goal "raised"
                  // display below since that one IS legitimately
                  // event-attribution (gifts that came through THIS
                  // event's share link). Two metrics, two jobs:
                  //   - Goal events: show the whole fund's path toward
                  //     the goal — every dollar counts.
                  //   - Open events: show what came through THIS share
                  //     link specifically — celebrates the social moment.
                  const fundTowardGoal = goal > 0 ? totalValue : 0;
                  const pct = goal > 0 ? Math.min(100, (fundTowardGoal / goal) * 100) : 0;
                  const goalReached = goal > 0 && fundTowardGoal >= goal;
                  const daysLeft = event.eventDate
                    ? Math.ceil((new Date(event.eventDate).getTime() - Date.now()) / 86400000)
                    : null;
                  const isSoon = !isArchived && daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
                  // Prefer the savings goal type when the event is a savings goal
                  // (so "First Car" → 🚗 not 🎁). Falls through to the canonical
                  // event-type emoji map otherwise. eventEmoji() returns 🎉 if
                  // nothing matches — never 🐶 or other off-brand fallbacks.
                  const emoji = (() => {
                    const name = String(event.name || "").toLowerCase();
                    if (name.includes("car")) return "🚗";
                    if (name.includes("college") || name.includes("school")) return "🎓";
                    if (name.includes("home") || name.includes("house")) return "🏡";
                    if (name.includes("trip") || name.includes("travel") || name.includes("gap year")) return "✈️";
                    if (name.includes("business")) return "💼";
                    if (name.includes("emergency")) return "🛡️";
                    if (name.includes("wedding")) return "💍";
                    return eventEmoji(event.eventType);
                  })();
                  // Tile-friendly date label. Year is omitted when the event is in
                  // the current calendar year (saves precious tile pixels).
                  const tileDateLabel = event.eventDate
                    ? (() => {
                        const d = new Date(event.eventDate as any);
                        const sameYear = d.getUTCFullYear() === new Date().getFullYear();
                        return d.toLocaleDateString("en-US", sameYear
                          ? { month: "short", day: "numeric", timeZone: "UTC" }
                          : { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
                      })()
                    : null;
                  const isExpanded = expandedTileIdV2 === String(event.id);
                  const warmEmpty =
                    emptyStateByName(String(event.name || ""))
                    ?? emptyStateByType[event.eventType || ""]
                    ?? "Just starting 🌱";

                  const borderColor = isArchived
                    ? "rgba(26,23,16,0.07)"
                    : goalReached ? "hsl(143,47%,40%)"
                    : isSoon ? "hsl(43,65%,60%)"
                    : isExpanded ? "hsl(143,47%,34%)"
                    : "rgba(26,23,16,0.10)";

                  // Themed cover background when there's no uploaded photo.
                  // Same getEventCoverTheme used for the suggestion tiles —
                  // active event tiles now match (custom-created events get
                  // a designed look instead of a flat amber tint). When the
                  // event is a savings goal, the eventType IS the goal type
                  // ("car", "college", etc.), so it lookup-keys correctly.
                  // Photo upload still wins; this is only the default.
                  const tileTheme = getEventCoverTheme({
                    eventType: event.eventType,
                    savingsGoalType: (event as any).eventCategory === "savings_goal" ? event.eventType : undefined,
                  });

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { haptic("light"); setExpandedTileIdV2(isExpanded ? null : String(event.id)); }}
                      style={{
                        width: 140, minWidth: 140, height: 148, flexShrink: 0,
                        borderRadius: 18, border: `1.5px solid ${borderColor}`,
                        overflow: "hidden", cursor: "pointer", background: "white",
                        display: "flex", flexDirection: "column",
                        boxShadow: isExpanded
                          ? "0 4px 18px rgba(26,23,16,0.13)"
                          : "0 1px 3px rgba(26,23,16,0.06)",
                        opacity: isArchived ? 0.72 : 1,
                        transition: "box-shadow 0.18s, opacity 0.18s, border-color 0.18s",
                        textAlign: "left",
                        filter: isArchived ? "saturate(0.55)" : "none",
                      }}
                    >
                      {/* ── Visual top: photo or themed cover ── */}
                      <div style={{ flex: 1, position: "relative", overflow: "hidden",
                        background: imgUrl ? undefined : tileTheme.background,
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {imgUrl ? (
                          <>
                            <img src={imgUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: imgPosition, display: "block" }} />
                            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 35%, white 100%)" }} />
                          </>
                        ) : (
                          <span style={{ fontSize: 38, lineHeight: 1, userSelect: "none", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.08))" }}>{emoji}</span>
                        )}
                        {/* "Soon" gold shimmer badge */}
                        {isSoon && (
                          <div style={{ position: "absolute", top: 7, right: 7,
                            background: "hsl(43,80%,52%)", borderRadius: 8,
                            padding: "2px 6px", fontSize: 9, fontWeight: 700, color: "white", lineHeight: 1.4 }}>
                            {daysLeft === 0 ? "Today" : `${daysLeft}d`}
                          </div>
                        )}
                        {goalReached && (
                          <div style={{ position: "absolute", top: 7, right: 7,
                            background: "hsl(143,47%,32%)", borderRadius: 8,
                            padding: "2px 6px", fontSize: 9, fontWeight: 700, color: "white", lineHeight: 1.4 }}>
                            🌟
                          </div>
                        )}
                      </div>

                      {/* ── Bottom info ── */}
                      <div style={{ padding: "8px 10px 9px", background: "white", flexShrink: 0 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "rgb(26,23,16)", lineHeight: 1.25,
                          display: "-webkit-box", WebkitLineClamp: tileDateLabel ? 1 : 2, WebkitBoxOrient: "vertical" as const,
                          overflow: "hidden", marginBottom: 2 }}>
                          {event.name}
                        </p>
                        {tileDateLabel && (
                          <p style={{ fontSize: 9, color: "rgba(26,23,16,0.42)", lineHeight: 1.2, marginBottom: 4, fontWeight: 500 }}>
                            {tileDateLabel}
                          </p>
                        )}
                        {goal > 0 ? (
                          <>
                            {/* Goal progress: whole-fund value vs goal.
                                Every dollar in the fund counts toward
                                every goal (one fund, fungible money).
                                fmtC strips trailing zeros to keep the
                                tile's narrow text readable. */}
                            <p style={{ fontSize: 9.5, color: fundTowardGoal > 0 ? "rgba(26,23,16,0.45)" : "hsl(143,40%,30%)", marginBottom: 4, lineHeight: 1, fontWeight: fundTowardGoal > 0 ? 400 : 600 }}>
                              {fundTowardGoal > 0
                                ? <>{fmtC(fundTowardGoal)} <span style={{ color: "rgba(26,23,16,0.28)" }}>of {fmtC(goal)}</span></>
                                : <>{warmEmpty}</>}
                            </p>
                            <div style={{ height: 3, background: "rgba(26,23,16,0.08)", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, borderRadius: 2,
                                background: goalReached ? "hsl(143,47%,38%)" : "hsl(143,47%,38%)",
                                transition: "width 0.5s ease" }} />
                            </div>
                          </>
                        ) : (
                          <p style={{ fontSize: 9.5, color: giftVol > 0 ? "rgba(26,23,16,0.38)" : "hsl(143,40%,30%)", lineHeight: 1, fontWeight: giftVol > 0 ? 400 : 600 }}>
                            {isArchived ? "Archived" : giftVol > 0 ? fmtC(giftVol) + " raised" : warmEmpty}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                };

                const visibleArchived = showArchivedTilesV2 ? archivedEvents : [];
                const childFirst = recipientFirstNameDisplay || "your child";
                const openCreate = () => { haptic("selection"); if (isFamily || isStarter) setCreateEventSheetOpen(true); else setEventGateOpen(true); };

                if (activeEvents.length === 0 && archivedEvents.length === 0) {
                  return (
                    <div>
                      {/* Warm copy */}
                      <div style={{ marginBottom: 14 }}>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "rgb(26,23,16)", margin: "0 0 4px", lineHeight: 1.35 }}>Every milestone deserves a moment.</p>
                        <p style={{ fontSize: 13, color: "rgba(26,23,16,0.45)", lineHeight: 1.55, margin: 0 }}>
                          {capFirst(childFirst)}'s birthday coming up? Saving for their first car?
                        </p>
                      </div>
                      {/* Suggestion tiles (same as normal view) + create tile */}
                      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
                        {visibleSuggestions.map(sug => {
                          const isSavingsGoal = sug.prefill.eventCategory === "savings_goal";
                          // Per-event-type cover treatment instead of the
                          // generic flat tint. Lookup priority is suggestion
                          // key first (so "hanukkah" beats generic "holiday"),
                          // then savings goal, then event type. Matches the
                          // user's "should auto ones have cover photos pre-set
                          // — sample or just kinda relevant?" — without
                          // licensing real photos.
                          const theme = getEventCoverTheme({
                            suggestionKey: sug.key,
                            eventType: sug.prefill.eventType,
                            savingsGoalType: isSavingsGoal ? sug.prefill.eventType : undefined,
                          });
                          return (
                            <button
                              key={sug.key}
                              type="button"
                              onClick={() => { haptic("selection"); setEditEventTarget({ name: sug.prefill.name, eventType: sug.prefill.eventType ?? undefined, eventDate: sug.prefill.eventDate ?? undefined, goalAmount: sug.prefill.goalAmount ?? undefined, eventCategory: sug.prefill.eventCategory ?? undefined }); setCreateEventSheetOpen(true); }}
                              style={{ width: 140, minWidth: 140, height: 148, flexShrink: 0, borderRadius: 18, border: `1px solid ${theme.accent}33`, overflow: "hidden", cursor: "pointer", background: "white", display: "flex", flexDirection: "column", textAlign: "left" }}
                            >
                              <div style={{ flex: 1, background: theme.background, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                                <span style={{ fontSize: 38, lineHeight: 1, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.08))" }}>{sug.emoji || theme.emoji}</span>
                              </div>
                              <div style={{ padding: "7px 10px 8px", background: "white", flexShrink: 0 }}>
                                <p style={{ fontSize: 10.5, fontWeight: 700, color: "rgb(26,23,16)", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden", marginBottom: 3 }}>{sug.name}</p>
                                <p style={{ fontSize: 9, color: "rgba(26,23,16,0.38)", lineHeight: 1.3, marginBottom: 2 }}>{sug.sub}</p>
                                <p style={{ fontSize: 9, color: theme.inkColor, fontWeight: 600 }}>Tap to create</p>
                              </div>
                            </button>
                          );
                        })}
                        {childFirstSug && (
                          <button type="button" onClick={() => { haptic("light"); setCulturalBgSelections(traditions); setCulturalBgPickerOpen(true); }} style={{ width: 140, minWidth: 140, height: 148, flexShrink: 0, borderRadius: 18, border: traditions.length > 0 ? "1.5px solid rgba(26,61,43,0.25)" : "1.5px dashed rgba(26,61,43,0.25)", overflow: "hidden", cursor: "pointer", background: "white", display: "flex", flexDirection: "column", textAlign: "left" }}>
                            <div style={{ flex: 1, background: "hsl(143,28%,97%)", display: "flex", alignItems: "center", justifyContent: "center", gap: 2, flexWrap: "wrap", padding: "6px 8px" }}>
                              {traditions.length > 0
                                ? traditions.slice(0, 4).map(t => <span key={t} style={{ fontSize: 22, lineHeight: 1 }}>{TRADITION_ICONS[t]}</span>)
                                : <span style={{ fontSize: 30 }}>🌍</span>
                              }
                            </div>
                            <div style={{ padding: "7px 10px 8px", background: "white", flexShrink: 0 }}>
                              <p style={{ fontSize: 10.5, fontWeight: 700, color: "rgb(26,23,16)", lineHeight: 1.25, marginBottom: 3 }}>{traditions.length > 0 ? "Your traditions" : "Add your traditions"}</p>
                              <p style={{ fontSize: 9, color: "rgba(26,23,16,0.38)", lineHeight: 1.3, marginBottom: 2 }}>{traditions.length > 0 ? `${traditions.length} selected` : "Unlock milestone suggestions"}</p>
                              <p style={{ fontSize: 9, color: "rgba(26,61,43,0.6)", fontWeight: 600 }}>{traditions.length > 0 ? "Edit →" : "Personalize →"}</p>
                            </div>
                          </button>
                        )}
                        <button type="button" onClick={openCreate} style={{ width: 72, minWidth: 72, height: 148, flexShrink: 0, borderRadius: 18, border: "1.5px dashed rgba(26,23,16,0.15)", background: "rgba(26,23,16,0.025)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "rgba(26,23,16,0.4)" }}>
                          <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
                          <span style={{ fontSize: 9.5, fontWeight: 600, lineHeight: 1.3, textAlign: "center" }}>New</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <>
                    {/* Tile scroll row */}
                    <div style={{
                      display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4,
                      scrollbarWidth: "none", msOverflowStyle: "none",
                      WebkitOverflowScrolling: "touch",
                    }}
                      className="kv2c"
                    >
                      {/* Active tiles */}
                      {activeEvents.map(e => renderTile(e, false))}

                      {/* Archived tiles */}
                      {visibleArchived.map(e => renderTile(e, true))}

                      {/* Suggested tiles. Hidden for read-only roles —
                          tapping a suggestion opens the create-event sheet,
                          which is a parent-control surface. Active and
                          archived tiles above still render so the previous
                          owner can browse the kid's occasion history. */}
                      {!isReadOnlyFund && visibleSuggestions.map(sug => {
                        const isSavingsGoal = sug.prefill.eventCategory === "savings_goal";
                        const theme = getEventCoverTheme({
                          suggestionKey: sug.key,
                          eventType: sug.prefill.eventType,
                          savingsGoalType: isSavingsGoal ? sug.prefill.eventType : undefined,
                        });
                        return (
                          <button
                            key={sug.key}
                            type="button"
                            onClick={() => {
                              haptic("selection");
                              setEditEventTarget({ name: sug.prefill.name, eventType: sug.prefill.eventType ?? undefined, eventDate: sug.prefill.eventDate ?? undefined, goalAmount: sug.prefill.goalAmount ?? undefined, eventCategory: sug.prefill.eventCategory ?? undefined });
                              setCreateEventSheetOpen(true);
                            }}
                            style={{
                              width: 140, minWidth: 140, height: 148, flexShrink: 0,
                              borderRadius: 18,
                              border: `1px solid ${theme.accent}33`,
                              overflow: "hidden", cursor: "pointer", background: "white",
                              display: "flex", flexDirection: "column",
                              boxShadow: "none",
                              textAlign: "left",
                            }}
                          >
                            {/* Themed cover. Per-event-type gradient (Hanukkah
                                navy+gold, Christmas green+red, College Fund
                                blue, etc.) gives each suggestion a designed
                                feel without licensing real photos. */}
                            <div style={{ flex: 1, position: "relative", background: theme.background, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: 38, lineHeight: 1, userSelect: "none", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.08))" }}>{sug.emoji || theme.emoji}</span>
                            </div>
                            {/* Bottom info */}
                            <div style={{ padding: "7px 10px 8px", background: "white", flexShrink: 0 }}>
                              <p style={{ fontSize: 10.5, fontWeight: 700, color: "rgb(26,23,16)", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden", marginBottom: 3 }}>
                                {sug.name}
                              </p>
                              <p style={{ fontSize: 9, color: "rgba(26,23,16,0.38)", lineHeight: 1.3, marginBottom: 2 }}>
                                {sug.prefill.goalAmount
                                  ? `Goal: ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(parseFloat(sug.prefill.goalAmount))}`
                                  : sug.sub}
                              </p>
                              <p style={{ fontSize: 9, color: theme.inkColor, fontWeight: 600, lineHeight: 1 }}>
                                Tap to create
                              </p>
                            </div>
                          </button>
                        );
                      })}

                      {/* Traditions tile - always visible; shows selected icons when set */}
                      {childFirstSug && (
                        <button
                          type="button"
                          onClick={() => {
                            haptic("light");
                            setCulturalBgSelections(traditions);
                            setCulturalBgPickerOpen(true);
                          }}
                          style={{
                            width: 140, minWidth: 140, height: 148, flexShrink: 0,
                            borderRadius: 18,
                            border: traditions.length > 0 ? "1.5px solid rgba(26,61,43,0.25)" : "1.5px dashed rgba(26,61,43,0.25)",
                            overflow: "hidden", cursor: "pointer", background: "white",
                            display: "flex", flexDirection: "column",
                            textAlign: "left",
                          }}
                        >
                          <div style={{ flex: 1, background: "hsl(143,28%,97%)", display: "flex", alignItems: "center", justifyContent: "center", gap: 2, flexWrap: "wrap", padding: "6px 8px" }}>
                            {traditions.length > 0
                              ? traditions.slice(0, 4).map(t => <span key={t} style={{ fontSize: 22, lineHeight: 1 }}>{TRADITION_ICONS[t]}</span>)
                              : <span style={{ fontSize: 30, lineHeight: 1 }}>🌍</span>
                            }
                          </div>
                          <div style={{ padding: "7px 10px 8px", background: "white", flexShrink: 0 }}>
                            <p style={{ fontSize: 10.5, fontWeight: 700, color: "rgb(26,23,16)", lineHeight: 1.25, marginBottom: 3 }}>
                              {traditions.length > 0 ? "Your traditions" : "Add your traditions"}
                            </p>
                            <p style={{ fontSize: 9, color: "rgba(26,23,16,0.38)", lineHeight: 1.3, marginBottom: 2 }}>
                              {traditions.length > 0 ? `${traditions.length} selected` : "Unlock milestone suggestions"}
                            </p>
                            <p style={{ fontSize: 9, color: "rgba(26,61,43,0.6)", fontWeight: 600, lineHeight: 1 }}>
                              {traditions.length > 0 ? "Edit →" : "Personalize →"}
                            </p>
                          </div>
                        </button>
                      )}

                      {/* Show/hide archived toggle tile */}
                      {archivedEvents.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { haptic("light"); setShowArchivedTilesV2(v => !v); }}
                          style={{
                            width: 72, minWidth: 72, height: 148, flexShrink: 0,
                            borderRadius: 18, border: "1.5px dashed rgba(26,23,16,0.15)",
                            background: "rgba(26,23,16,0.025)", cursor: "pointer",
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            gap: 6, color: "rgba(26,23,16,0.4)",
                          }}
                        >
                          <span style={{ fontSize: 18 }}>{showArchivedTilesV2 ? "↑" : "↓"}</span>
                          <span style={{ fontSize: 9.5, fontWeight: 600, lineHeight: 1.3, textAlign: "center" }}>
                            {showArchivedTilesV2 ? "Hide" : `${archivedEvents.length} archived`}
                          </span>
                        </button>
                      )}

                      {/* Create tile - always last. Hidden for read-only
                          roles (previous owner, viewer) — they can't create
                          new occasions on a fund they don't control. */}
                      {!isReadOnlyFund && (
                        <button
                          type="button"
                          onClick={() => { haptic("selection"); if (isFamily || isStarter) setCreateEventSheetOpen(true); else setEventGateOpen(true); }}
                          style={{
                            width: 72, minWidth: 72, height: 148, flexShrink: 0,
                            borderRadius: 18, border: "1.5px dashed rgba(26,23,16,0.15)",
                            background: "rgba(26,23,16,0.025)", cursor: "pointer",
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            gap: 6, color: "rgba(26,23,16,0.4)",
                          }}
                        >
                          <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
                          <span style={{ fontSize: 9.5, fontWeight: 600, lineHeight: 1.3, textAlign: "center" }}>New</span>
                        </button>
                      )}
                    </div>

                    {/* ── "All in the same fund" clarity note ── */}
                    {activeEvents.length > 0 && (
                      <p style={{ fontSize: 11, color: "rgba(26,23,16,0.38)", marginTop: 8, lineHeight: 1.5, letterSpacing: "0.01em" }}>
                        All occasions and goals go into the same fund. 🌱
                      </p>
                    )}

                    {/* ── Expanded detail panel - slides in below the row ── */}
                    <AnimatePresence initial={false}>
                      {expandedTileIdV2 !== null && (() => {
                        const allEvts = [...activeEvents, ...archivedEvents];
                        const ev = allEvts.find(e => String(e.id) === expandedTileIdV2);
                        if (!ev) return null;
                        const isArch = ev.status === "archived" || ev.status === "closed";
                        const imgUrl = (ev as any).imageUrl as string | null | undefined;
                        const desc = (ev as any).description as string | null | undefined;
                        const giftVol = parseFloat(String(ev.giftVolume || "0"));
                        const goal = parseFloat(String(ev.goalAmount || "0"));
                        // Goal progress reads off the whole fund value, not the
                        // event-specific gift volume. The fund is fungible — every
                        // dollar in it counts toward every goal. Showing "$0 of
                        // $4,996" toward Emma's First Car when there's $1,550
                        // sitting in the fund is the bug pattern. The tile uses
                        // fundTowardGoal already; the detail panel was contradicting
                        // it with event-only giftVol. Same source on both surfaces.
                        const fundTowardGoal = goal > 0 ? totalValue : 0;
                        const pct = goal > 0 ? Math.min(100, (fundTowardGoal / goal) * 100) : 0;
                        const goalReached = goal > 0 && fundTowardGoal >= goal;
                        const evUrl = fundSlug
                          ? ev.isPermanent
                            ? `${window.location.origin}/${fundSlug}`
                            : `${window.location.origin}/${fundSlug}/${ev.slug}`
                          : null;
                        const daysLeft = ev.eventDate
                          ? Math.ceil((new Date(ev.eventDate).getTime() - Date.now()) / 86400000)
                          : null;
                        // eventDate is stored at UTC midnight (date-only, picked
                        // via <input type="date">). Render in UTC so Apr 9 stays
                        // Apr 9, not Apr 8 in US timezones.
                        const dateStr = ev.eventDate
                          ? new Date(ev.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
                          : null;
                        const evGifts = gifts
                          .filter(g => g.eventId === ev.id && g.status !== "failed" && g.status !== "refunded")
                          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                        const emoji = eventEmoji(ev.eventType);

                        return (
                          <motion.div
                            key={`detail-${ev.id}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                            style={{ overflow: "hidden" }}
                          >
                            <div style={{
                              background: "white", borderRadius: 18,
                              border: "1px solid rgba(26,23,16,0.09)",
                              boxShadow: "0 2px 16px rgba(26,23,16,0.08)",
                              overflow: "hidden",
                            }}>
                              {/* Header: photo or icon strip.
                                  Photo redesign — let the photo BE the photo.
                                  Earlier attempts overlaid title + dark wash
                                  on it ("movie poster" register), which works
                                  for curated stock imagery but fights real
                                  user-uploaded photos of varying quality.
                                  Apple Photos / Notion / Airbnb pattern: photo
                                  at top, NO overlay, title moves to the white
                                  panel below. Close button moves with it.
                                  - aspectRatio 16/9 with min 200 / max 280px
                                    gives a real photo area without dominating
                                    the panel
                                  - cover fit + center position is the safest
                                    crop default for portrait OR landscape
                                    source images
                                  - subtle bottom-edge fade blends into the
                                    white panel so the photo doesn't end on a
                                    hard horizontal line */}
                              {imgUrl ? (
                                <>
                                  <div
                                    style={{
                                      position: "relative",
                                      width: "100%",
                                      aspectRatio: "16 / 9",
                                      minHeight: 200,
                                      maxHeight: 280,
                                      overflow: "hidden",
                                      background: "hsl(43,28%,92%)",
                                    }}
                                  >
                                    {(() => {
                                      // Apply saved focal point in the
                                      // expanded-tile detail panel too —
                                      // same source-of-truth as the
                                      // collapsed tile, just at a wider
                                      // aspect ratio.
                                      const evFx = (ev as any).imageFocalX != null ? Number((ev as any).imageFocalX) : 0.5;
                                      const evFy = (ev as any).imageFocalY != null ? Number((ev as any).imageFocalY) : 0.5;
                                      const evFxPct = Number.isFinite(evFx) ? Math.max(0, Math.min(100, evFx * 100)) : 50;
                                      const evFyPct = Number.isFinite(evFy) ? Math.max(0, Math.min(100, evFy * 100)) : 50;
                                      return (
                                        <img
                                          src={imgUrl}
                                          alt={ev.name}
                                          style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            objectPosition: `${evFxPct}% ${evFyPct}%`,
                                            display: "block",
                                          }}
                                        />
                                      );
                                    })()}
                                    {/* Soft 1-2px fade at the very bottom so
                                        the photo doesn't terminate on a hard
                                        horizontal line against the white
                                        panel below. Way more subtle than the
                                        old dark overlay. */}
                                    <div
                                      style={{
                                        position: "absolute",
                                        left: 0, right: 0, bottom: 0, height: 24,
                                        background: "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.45) 100%)",
                                        pointerEvents: "none",
                                      }}
                                    />
                                  </div>
                                  {/* Title row — sits in white space below the
                                      photo, parallel to the no-image branch's
                                      header. Close button rides here too so
                                      the photo stays unobstructed. */}
                                  <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <p style={{ fontSize: 16, fontWeight: 800, color: "rgb(26,23,16)", lineHeight: 1.2, margin: 0 }}>{ev.name}</p>
                                      {(dateStr || isArch) && (
                                        <p style={{ fontSize: 11.5, color: "rgba(26,23,16,0.5)", marginTop: 3, margin: "3px 0 0" }}>
                                          {[dateStr, daysLeft !== null && daysLeft > 0 ? `${daysLeft} days away` : daysLeft === 0 ? "Today" : null, isArch ? "Archived" : null].filter(Boolean).join(" · ")}
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => setExpandedTileIdV2(null)}
                                      aria-label="Close occasion details"
                                      style={{ background: "rgba(26,23,16,0.06)", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgb(80,72,64)", fontSize: 13, flexShrink: 0 }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: 28 }}>{emoji}</span>
                                    <div>
                                      <p style={{ fontSize: 15, fontWeight: 800, color: "rgb(26,23,16)", lineHeight: 1.2 }}>{ev.name}</p>
                                      {(dateStr || isArch) && (
                                        <p style={{ fontSize: 11, color: "rgba(26,23,16,0.45)", marginTop: 2 }}>
                                          {[dateStr, daysLeft !== null && daysLeft > 0 ? `${daysLeft} days away` : daysLeft === 0 ? "Today" : null, isArch ? "Archived" : null].filter(Boolean).join(" · ")}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <button onClick={() => setExpandedTileIdV2(null)} style={{ background: "rgba(26,23,16,0.06)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgb(100,90,80)", fontSize: 13, flexShrink: 0 }}>✕</button>
                                </div>
                              )}

                              <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

                                {/* Description */}
                                {desc && stripHtml(desc) && (
                                  <p style={{ fontSize: 12, color: "rgba(26,23,16,0.55)", lineHeight: 1.55, margin: 0 }}>{stripHtml(desc)}</p>
                                )}

                                {/* Goal progress — fund-total vs goal. The
                                    label MUST say "fund" explicitly. Without
                                    that word the reader treats the modal as
                                    self-contained ("First Car: $1,917 of
                                    $5,000" → "$1,917 was gifted to First Car")
                                    even though gifts are fungible into the
                                    fund and the goal is just a milestone the
                                    fund as a whole is tracking. The label
                                    "{child}'s fund toward this goal" is the
                                    smallest copy fix that closes the
                                    contradiction at a glance. */}
                                {goal > 0 && (
                                  <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                      <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(26,23,16,0.5)" }}>
                                        {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s fund` : "Fund"} toward this goal
                                      </span>
                                      <span style={{ fontSize: 11, fontWeight: 700, color: goalReached ? "hsl(143,47%,32%)" : "rgb(26,23,16)" }}>
                                        {fmtC(fundTowardGoal)} <span style={{ fontWeight: 400, color: "rgba(26,23,16,0.4)" }}>of {fmtC(goal)}</span>
                                        {goalReached && " 🌟"}
                                      </span>
                                    </div>
                                    <div style={{ height: 5, background: "rgba(26,23,16,0.07)", borderRadius: 3, overflow: "hidden" }}>
                                      <div style={{ height: "100%", width: `${pct}%`, background: "hsl(143,47%,38%)", borderRadius: 3, transition: "width 0.5s ease" }} />
                                    </div>
                                  </div>
                                )}

                                {/* Time-to-goal projection. Honest framing: this is a fund-level
                                    projection — at the family's current pace of recurring contributions
                                    and 7%/yr growth, when does the fund as a whole hit this goal amount?
                                    Goal progress (above) ALSO uses the whole fund value (since the
                                    fund is fungible) so the two read consistently: where we are now,
                                    when we'll cross the line, both off the same number.
                                    Hidden on archived events: the event is closed, so projecting "fund
                                    hits this number in N months" alongside it reads as a live forecast
                                    for a thing that no longer collects. */}
                                {goal > 0 && !goalReached && !isArch && (() => {
                                  const T = totalValue;
                                  const G = goal;
                                  if (T >= G) return null;

                                  // Recurring gifts only count when they have a real Stripe
                                  // subscription. Rows that hit "active" status but never had a
                                  // subscription created (e.g., setup-flow drop-off where
                                  // payment_setup_status flipped to "ready" but the subscription
                                  // create failed silently) are phantoms — they'll never charge,
                                  // so trusting them inflates "today's pace" projections by money
                                  // that never arrives. Parent contributions don't have this
                                  // problem since they fire via the off-session worker.
                                  const M = sumMonthlyEquivalent([
                                    ...parentContributions.filter((c) => String(c.status || "").toLowerCase() === "active"),
                                    ...recurringGifts.filter((rg) => String(rg.status || "").toLowerCase() === "active" && !!rg.stripeSubscriptionId),
                                  ]);

                                  const r_m = 0.07 / 12;
                                  let monthsToGoal: number | null = null;
                                  if (M > 0.01) {
                                    // FV = T*(1+r)^n + M*((1+r)^n - 1)/r → solve for n
                                    const x = (G + M / r_m) / (T + M / r_m);
                                    if (x > 1) monthsToGoal = Math.log(x) / Math.log(1 + r_m);
                                  } else if (T > 0.01) {
                                    // Pure compounding: T*(1+r)^n = G
                                    monthsToGoal = Math.log(G / T) / Math.log(1 + r_m);
                                  }

                                  // No path forward — encourage setting up a recurring contribution.
                                  if (monthsToGoal === null || !Number.isFinite(monthsToGoal) || monthsToGoal <= 0) {
                                    return (
                                      <div style={{ borderRadius: 10, background: "rgba(26,67,50,0.05)", border: "1px solid rgba(26,67,50,0.12)", padding: "10px 12px" }}>
                                        <p style={{ fontSize: 11.5, color: "rgb(26,67,50)", lineHeight: 1.5 }}>
                                          Set up a recurring investment to put this goal on a clock. Every month adds up.
                                        </p>
                                      </div>
                                    );
                                  }

                                  // Clamp to reasonable horizons
                                  if (monthsToGoal > 12 * 60) {
                                    return (
                                      <div style={{ borderRadius: 10, background: "rgba(26,23,16,0.04)", border: "1px solid rgba(26,23,16,0.08)", padding: "10px 12px" }}>
                                        <p style={{ fontSize: 11.5, color: "rgba(26,23,16,0.55)", lineHeight: 1.5 }}>
                                          At today's pace this goal is more than 60 years out. Consider raising the recurring amount.
                                        </p>
                                      </div>
                                    );
                                  }

                                  const goalDate = new Date();
                                  goalDate.setMonth(goalDate.getMonth() + Math.ceil(monthsToGoal));
                                  // Use Math.ceil instead of Math.round so we never tell parents
                                  // the goal hits SOONER than the math actually supports — e.g.
                                  // a 1.4-month projection should read "~2 months", not "~1 months".
                                  // Pluralize correctly so the singular case never says "1 months".
                                  const yearsToGoal = monthsToGoal / 12;
                                  const horizonText = (() => {
                                    if (yearsToGoal >= 2) {
                                      const yrs = Math.ceil(yearsToGoal);
                                      return `~${yrs} ${yrs === 1 ? "year" : "years"}`;
                                    }
                                    const months = Math.max(1, Math.ceil(monthsToGoal));
                                    return `~${months} ${months === 1 ? "month" : "months"}`;
                                  })();
                                  const arrivalLabel = goalDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                                  const childFirst = recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "the";
                                  const monthlyDisplay = M > 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(M)) : null;
                                  return (
                                    <div style={{ borderRadius: 10, background: "rgba(26,67,50,0.05)", border: "1px solid rgba(26,67,50,0.15)", padding: "10px 12px" }}>
                                      <p style={{ fontSize: 11.5, fontWeight: 600, color: "rgb(26,67,50)", lineHeight: 1.5 }}>
                                        {/* Tightened 2026-05-13 — was "At today's pace,
                                            Emma's fund hits $5,000 in ~4 years (around Feb 2030).
                                            $50/mo of recurring · 7%/yr assumed · projection only."
                                            "hits" replaced with "is on pace for" (warmer, lets the
                                            fund accumulate rather than punch a number); "today's pace"
                                            dropped as filler; "around" before the date dropped because
                                            the relative duration already implies approximation; "of"
                                            removed from "$50/mo of recurring" (form-jargon filler);
                                            "projection only" removed as defensive disclosure since
                                            "growth assumed" already does that work. */}
                                        {childFirst} fund is on pace for {fmtC(G)} in {horizonText} ({arrivalLabel}).
                                      </p>
                                      <p style={{ fontSize: 10.5, color: "rgba(26,67,50,0.7)", lineHeight: 1.5, marginTop: 3 }}>
                                        {monthlyDisplay ? `${monthlyDisplay}/mo recurring · ` : ""}7% growth assumed.
                                      </p>
                                    </div>
                                  );
                                })()}

                                {/* Gifts — STRICTLY event-tagged gifts only
                                    (g.eventId === ev.id). Hidden entirely
                                    when empty: an empty "Gifts" section next
                                    to a "$1,917 of $5,000" progress bar reads
                                    as a contradiction no matter how the
                                    label is phrased, because the user can't
                                    not see two numbers and try to reconcile
                                    them. The "Goal" row above tells the
                                    whole story when no event-specific gifts
                                    exist. When event-tagged gifts DO exist,
                                    showing them with the disclosed label
                                    "via this event page" is honest and
                                    non-contradictory. */}
                                {evGifts.length > 0 && (
                                  <div>
                                    <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: "rgba(26,23,16,0.35)", textTransform: "uppercase", marginBottom: 8 }}>Gifts via this occasion page</p>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                                      {evGifts.slice(0, 5).map((g, gi) => {
                                        const gName = displayGifterName(g.senderName, (g as any).isAnonymous);
                                        const gAmt = parseFloat(String(g.netAmount || g.amount || "0"));
                                        const gDate = g.createdAt ? new Date(g.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : null;
                                        const isLast = gi === Math.min(evGifts.length, 5) - 1;
                                        // Same thank-you state rules as elsewhere: owner self / anonymous / sent / draft / missing.
                                        const evGiftEmail = String((g as any)?.senderEmail || "").trim().toLowerCase();
                                        const evOwnerEmail = String(user?.email || "").trim().toLowerCase();
                                        const evIsOwner = !!evOwnerEmail && evGiftEmail === evOwnerEmail;
                                        const evIsAnon = gName === "Anonymous";
                                        const evTy = g.id ? dashboardThankYouByGiftId.get(String(g.id)) : null;
                                        const evTyState: "sent" | "draft" | "missing" | "self" | "anonymous" =
                                          evIsOwner ? "self"
                                          : evIsAnon || !evGiftEmail ? "anonymous"
                                          : evTy?.status === "sent" ? "sent"
                                          : evTy ? "draft"
                                          : "missing";
                                        return (
                                          <div key={g.id ?? gi} style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 8, paddingBottom: 8, borderBottom: isLast ? "none" : "1px solid rgba(26,23,16,0.06)" }}>
                                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "hsl(143,47%,94%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                              <span style={{ fontSize: 10, fontWeight: 800, color: "hsl(143,47%,28%)" }}>{gName.charAt(0).toUpperCase()}</span>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                                <p style={{ fontSize: 12.5, fontWeight: 600, color: "rgb(26,23,16)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{gName}</p>
                                                {/* "✨ From you" pill removed — gifter name is already
                                                    in the row above, so the pill was duplicating info
                                                    the parent could read directly. Same removal applied
                                                    on Dashboard hero, gifter detail modal, and Memory
                                                    Book list. */}
                                                {evTyState === "sent" && <span className="rounded-full" style={{ fontSize: 9, fontWeight: 700, background: "hsl(var(--kiddo-evergreen) / 0.09)", color: "hsl(var(--kiddo-evergreen))", padding: "1px 5px" }}>✓ Thanked</span>}
                                                {evTyState === "draft" && <span style={{ fontSize: 9, fontWeight: 700, background: "hsl(43,75%,92%)", color: "hsl(43,55%,28%)", padding: "1px 5px", borderRadius: 999 }}>⏳ Awaiting</span>}
                                                {evTyState === "missing" && <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(26,23,16,0.06)", color: "rgba(26,23,16,0.55)", padding: "1px 5px", borderRadius: 999 }}>No thanks yet</span>}
                                              </div>
                                              {gDate && <p style={{ fontSize: 10.5, color: "rgba(26,23,16,0.4)", margin: 0, marginTop: 1 }}>{gDate}</p>}
                                              {g.message && <p style={{ fontSize: 10.5, color: "rgba(26,23,16,0.5)", fontStyle: "italic", margin: 0, marginTop: 2 }}>"{g.message}"</p>}
                                            </div>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: "rgb(26,23,16)", flexShrink: 0 }}>{fmtC(gAmt)}</span>
                                          </div>
                                        );
                                      })}
                                      {evGifts.length > 5 && (
                                        <p style={{ fontSize: 11, color: "rgba(26,23,16,0.4)", textAlign: "center", paddingTop: 6 }}>+{evGifts.length - 5} more</p>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Occasion code - active occasions only.
                                    Hidden for read-only roles — the code
                                    is a gift-routing affordance (anyone
                                    with the code can route a gift to the
                                    occasion), so it's a Share-equivalent.
                                    Previous owners post-handoff shouldn't
                                    be circulating this. */}
                                {!isArch && !isReadOnlyFund && dashboardSummary?.eventGiftCodes?.[ev.id] && (() => {
                                  const evCode = dashboardSummary.eventGiftCodes![ev.id].code;
                                  return (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await navigator.clipboard.writeText(evCode);
                                          haptic("success");
                                          toast({ title: "Occasion code copied", variant: "saved", duration: 1200 });
                                        } catch {
                                          window.prompt("Occasion code:", evCode);
                                        }
                                      }}
                                      style={{
                                        width: "100%", padding: "10px 14px",
                                        borderRadius: 12, border: "1.5px dashed rgba(26,61,43,0.3)",
                                        background: "rgba(26,61,43,0.04)", cursor: "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                                      }}
                                    >
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <Hash size={12} color="hsl(143,47%,32%)" />
                                        <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(26,23,16,0.5)", letterSpacing: "0.04em" }}>Occasion code</span>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 14, fontWeight: 800, color: "hsl(143,47%,28%)", letterSpacing: "0.12em" }}>{evCode}</span>
                                        <Copy size={11} color="rgba(26,61,43,0.4)" />
                                      </div>
                                    </button>
                                  );
                                })()}

                                {/* Share button - active only. Hidden for
                                    read-only roles per the same logic as
                                    the fund-level share buttons. */}
                                {!isArch && !isReadOnlyFund && evUrl && (
                                  <button
                                    type="button"
                                    onClick={() => { haptic("medium"); const thisPage: SharePage = sharePages.find(p => p.url === evUrl) ?? { label: ev.name, url: evUrl }; const rest = sharePages.filter(p => p.url !== evUrl); setEventShareTarget([thisPage, ...rest]); }}
                                    style={{
                                      width: "100%", padding: "11px 0", borderRadius: 14,
                                      border: "1.5px solid hsl(143,47%,38%)",
                                      background: "hsl(143,47%,97%)", color: "hsl(143,47%,28%)",
                                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                                    }}
                                  >
                                    <Share2 size={13} />
                                    Share
                                  </button>
                                )}

                                {/* Archived: "Create from this" CTA.
                                    Read-only roles can't create new
                                    occasions; hide. */}
                                {isArch && !isReadOnlyFund && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      haptic("selection");
                                      setEditEventTarget({ id: ev.id, name: ev.name, slug: (ev as any).slug, eventType: ev.eventType, eventDate: ev.eventDate, goalAmount: ev.goalAmount, description: (ev as any).description, imageUrl: (ev as any).imageUrl, imageFocalX: (ev as any).imageFocalX, imageFocalY: (ev as any).imageFocalY, isArchived: true });
                                      setCreateEventSheetOpen(true);
                                    }}
                                    style={{
                                      width: "100%", padding: "11px 0", borderRadius: 14,
                                      border: "1.5px solid hsl(143,47%,38%)",
                                      background: "hsl(143,47%,97%)", color: "hsl(143,47%,28%)",
                                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                                    }}
                                  >
                                    Create from this occasion
                                  </button>
                                )}

                                {/* Edit + Preview row.
                                    Edit hidden for read-only roles — the
                                    underlying create-event sheet does a
                                    PATCH, which the server rejects for
                                    previous owners. Preview link is a
                                    pure read affordance, stays. */}
                                <div style={{ display: "flex", gap: 8 }}>
                                  {!isReadOnlyFund && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        haptic("selection");
                                        setEditEventTarget({ id: ev.id, name: ev.name, slug: (ev as any).slug, eventType: ev.eventType, eventDate: ev.eventDate, goalAmount: ev.goalAmount, description: (ev as any).description, imageUrl: (ev as any).imageUrl, imageFocalX: (ev as any).imageFocalX, imageFocalY: (ev as any).imageFocalY });
                                        setCreateEventSheetOpen(true);
                                      }}
                                      style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "1px solid rgba(26,23,16,0.12)", background: "transparent", fontSize: 12, fontWeight: 600, color: "rgba(26,23,16,0.55)", cursor: "pointer" }}
                                    >
                                      Edit
                                    </button>
                                  )}
                                  {evUrl && !isArch && (
                                    <a
                                      href={evUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={() => haptic("selection")}
                                      style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "1px solid rgba(26,23,16,0.12)", background: "transparent", fontSize: 12, fontWeight: 600, color: "rgba(26,23,16,0.55)", cursor: "pointer", textDecoration: "none", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}
                                    >
                                      Preview
                                    </a>
                                  )}
                                  {isArch && !isReadOnlyFund && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        haptic("medium");
                                        const eventsKey = ["/api/funds", activeFundId, "events"];
                                        const summaryKey = ["/api/funds", activeFundId, "dashboard-summary"];
                                        const globalEventsKey = ["/api/events"];
                                        // Cancel any in-flight refetches so a racing poll or
                                        // window-focus refetch can't overwrite our optimistic write
                                        // with stale "still archived" data.
                                        await Promise.all([
                                          queryClient.cancelQueries({ queryKey: eventsKey }),
                                          queryClient.cancelQueries({ queryKey: summaryKey }),
                                          queryClient.cancelQueries({ queryKey: globalEventsKey }),
                                        ]);
                                        const prevEvents = queryClient.getQueryData<any[]>(eventsKey);
                                        const prevSummary = queryClient.getQueryData<any>(summaryKey);
                                        const prevGlobalEvents = queryClient.getQueryData<any[]>(globalEventsKey);
                                        // Optimistically flip the event back to active across all
                                        // three caches that show occasions: per-fund events (tile),
                                        // dashboard-summary (its events sub-array), and the global
                                        // events list (DesktopSidebar Quick Links).
                                        queryClient.setQueryData<any[]>(eventsKey, (prev) =>
                                          Array.isArray(prev)
                                            ? prev.map((e) => (e?.id === ev.id ? { ...e, status: "active" } : e))
                                            : prev,
                                        );
                                        queryClient.setQueryData<any>(summaryKey, (prev: any) =>
                                          prev && Array.isArray(prev.events)
                                            ? { ...prev, events: prev.events.map((e: any) => (e?.id === ev.id ? { ...e, status: "active" } : e)) }
                                            : prev,
                                        );
                                        queryClient.setQueryData<any[]>(globalEventsKey, (prev) =>
                                          Array.isArray(prev)
                                            ? prev.map((e) => (e?.id === ev.id ? { ...e, status: "active" } : e))
                                            : prev,
                                        );
                                        setExpandedTileIdV2(null);
                                        toast({ title: "Reactivated", description: "It's back in your active occasions." });
                                        try {
                                          await updateEventMutation.mutateAsync({ id: ev.id, data: { status: "active" } });
                                        } catch {
                                          if (prevEvents !== undefined) queryClient.setQueryData(eventsKey, prevEvents);
                                          if (prevSummary !== undefined) queryClient.setQueryData(summaryKey, prevSummary);
                                          if (prevGlobalEvents !== undefined) queryClient.setQueryData(globalEventsKey, prevGlobalEvents);
                                          toast({ title: "Couldn't reactivate", description: "We moved it back. Try again in a moment.", variant: "destructive" });
                                        }
                                      }}
                                      style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "1px solid rgba(26,23,16,0.12)", background: "transparent", fontSize: 12, fontWeight: 600, color: "hsl(143,47%,30%)", cursor: "pointer" }}
                                    >
                                      Reactivate
                                    </button>
                                  )}
                                </div>

                                {/* Archive - active only. Write action;
                                    hidden for read-only roles. */}
                                {!isArch && !isReadOnlyFund && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      haptic("light");
                                      const eventsKey = ["/api/funds", activeFundId, "events"];
                                      const summaryKey = ["/api/funds", activeFundId, "dashboard-summary"];
                                      const globalEventsKey = ["/api/events"];
                                      // Cancel any in-flight refetches first. Without this, the
                                      // 60s polling tick or a window-focus refetch can land AFTER
                                      // our optimistic write and overwrite it with stale "still
                                      // active" data — the symptom: archived event "comes back".
                                      await Promise.all([
                                        queryClient.cancelQueries({ queryKey: eventsKey }),
                                        queryClient.cancelQueries({ queryKey: summaryKey }),
                                        queryClient.cancelQueries({ queryKey: globalEventsKey }),
                                      ]);
                                      const prevEvents = queryClient.getQueryData<any[]>(eventsKey);
                                      const prevSummary = queryClient.getQueryData<any>(summaryKey);
                                      const prevGlobalEvents = queryClient.getQueryData<any[]>(globalEventsKey);
                                      // Optimistically flip the event's status so the active tile
                                      // disappears immediately. We update three caches: per-fund
                                      // events (Dashboard tile), per-fund dashboard-summary (its
                                      // events sub-array), and the global events list (DesktopSidebar
                                      // Quick Links). All three feed UI that shows the occasion.
                                      queryClient.setQueryData<any[]>(eventsKey, (prev) =>
                                        Array.isArray(prev)
                                          ? prev.map((e) => (e?.id === ev.id ? { ...e, status: "archived" } : e))
                                          : prev,
                                      );
                                      queryClient.setQueryData<any>(summaryKey, (prev: any) =>
                                        prev && Array.isArray(prev.events)
                                          ? { ...prev, events: prev.events.map((e: any) => (e?.id === ev.id ? { ...e, status: "archived" } : e)) }
                                          : prev,
                                      );
                                      queryClient.setQueryData<any[]>(globalEventsKey, (prev) =>
                                        Array.isArray(prev)
                                          ? prev.map((e) => (e?.id === ev.id ? { ...e, status: "archived" } : e))
                                          : prev,
                                      );
                                      setExpandedTileIdV2(null);
                                      toast({ title: "Archived", description: "You can reactivate it anytime." });
                                      try {
                                        await updateEventMutation.mutateAsync({ id: ev.id, data: { status: "archived" } });
                                      } catch {
                                        // Revert the optimistic write so the tile reappears.
                                        if (prevEvents !== undefined) queryClient.setQueryData(eventsKey, prevEvents);
                                        if (prevSummary !== undefined) queryClient.setQueryData(summaryKey, prevSummary);
                                        if (prevGlobalEvents !== undefined) queryClient.setQueryData(globalEventsKey, prevGlobalEvents);
                                        toast({ title: "Couldn't archive", description: "We brought it back. Try again in a moment.", variant: "destructive" });
                                      }
                                    }}
                                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: "rgba(26,23,16,0.3)", textAlign: "center", width: "100%", padding: "2px 0" }}
                                  >
                                    Archive this occasion
                                  </button>
                                )}

                              </div>
                            </div>
                          </motion.div>
                        );
                      })()}
                    </AnimatePresence>
                  </>
                );
              })()}

            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.040 }}
              className="space-y-3"
            >
              <p className="kiddo-section-label" style={{ textTransform: "none", fontSize: "0.82rem", letterSpacing: "0.01em" }}>
                {recipientFirstNameDisplay
                  ? `The day it all becomes ${recipientFirstNameDisplay}'s.`
                  : "The day it all becomes theirs."}
              </p>
              <div style={{
                background: "white",
                borderRadius: 20,
                border: "1px solid rgba(26,23,16,0.1)",
                boxShadow: "0 1px 6px rgba(26,23,16,0.05)",
                overflow: "hidden",
              }}>
                {/* Date + countdown header */}
                <div style={{
                  background: "linear-gradient(135deg, hsl(143,47%,14%) 0%, hsl(143,40%,22%) 100%)",
                  padding: "20px 20px 18px",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: 4 }}>
                        {recipientFirstNameDisplay || "Your child"} turns {majorityAge}
                      </p>
                      <p style={{ fontSize: 22, fontWeight: 800, color: "white", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                        {age18Transition ? formatAgeTransitionDate(age18Transition.eighteenthBirthday) : "Add a birthdate"}
                      </p>
                      {age18Transition && totalValue === 0 && (
                        <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
                          🌱 {age18Transition.countdownLabel} until {recipientFirstNameDisplay || capFirst(childPronouns.subject)} turn{recipientFirstNameDisplay || childPronouns.singular ? "s" : ""} {age18Transition.majorityAge}.
                        </p>
                      )}
                      {totalValue > 0 && age18Transition && (() => {
                        const fmtUSD0 = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
                        const yearsToMajority = age18Transition.daysUntil18 / 365.25;
                        // Sum every active recurring schedule (parent contributions + gifter
                        // recurring) normalized to monthly via the shared helper, so this
                        // hero number always matches the recurring summary, the Projection
                        // page, and the server-side lifecycle worker.
                        // Phantom-row guard: recurring gifts without a Stripe
                        // subscription don't actually charge. See the
                        // event-card projection above for the long version.
                        const activeMonthlyContribution = sumMonthlyEquivalent([
                          ...parentContributions.filter((c: any) => String(c?.status || "").toLowerCase() === "active"),
                          ...recurringGifts.filter((rg: any) => String(rg?.status || "").toLowerCase() === "active" && !!rg?.stripeSubscriptionId),
                        ]);
                        // Two-phase projection. Phase 1: contributions accumulate
                        // until contribStopYears (monthly compounding + monthly
                        // annuity). Phase 2: balance compounds with NO new
                        // contributions until totalYears.
                        //
                        // Why two phases: for UTMA accounts, the parent loses
                        // contribution control at age-of-majority. The previous
                        // single-phase formula treated activeMonthlyContribution
                        // as continuing for the entire horizon, which inflated
                        // the long-horizon (age-30) number by assuming the kid
                        // would keep receiving the parent's recurring deposits
                        // for 12+ years past majority. Realistic post-majority
                        // is pure compound on the at-majority balance — the kid
                        // owns the account and decides if/when to add more.
                        //
                        // For at-majority itself, contribStopYears == years so
                        // phase 2 is a no-op and the math reduces to the
                        // original FV formula.
                        const projectAt = (years: number, contribStopYears: number = years): number => {
                          const r_m = 0.07 / 12;
                          const stopYears = Math.max(0, Math.min(contribStopYears, years));
                          const n_contrib = stopYears * 12;
                          const n_postStop = Math.max(0, (years - stopYears) * 12);
                          const gf_contrib = Math.pow(1 + r_m, n_contrib);
                          const gf_postStop = Math.pow(1 + r_m, n_postStop);
                          const compoundedBalance = totalValue * gf_contrib;
                          const annuityPart = activeMonthlyContribution > 0
                            ? activeMonthlyContribution * (gf_contrib - 1) / r_m
                            : 0;
                          const balanceAtStop = compoundedBalance + annuityPart;
                          return balanceAtStop * gf_postStop;
                        };
                        const projectedAtMajority = projectAt(yearsToMajority);
                        // Long-horizon view (an extra 12 years past majority) only shown when
                        // it adds contrast — skip when at-majority is already enormous or when
                        // the kid is past majority. Contributions stop at majority for UTMA
                        // (the kid owns the account at that point), so the post-majority
                        // years are pure compound.
                        const projectedLongHorizon = projectAt(yearsToMajority + 12, yearsToMajority);
                        const showLongHorizon = age18Transition.daysUntil18 > 0 && projectedLongHorizon > projectedAtMajority * 1.5;
                        // Subject for the "turns N" / "lets it keep growing" lines.
                        // Names always take singular verb agreement regardless of
                        // pronoun (Em turns 18, not Em turn 18). Pronoun fallback
                        // uses childPronouns.singular for proper verb form
                        // (she/he = singular, they = plural).
                        const childSubject = recipientFirstNameDisplay || childPronouns.subject;
                        const childIsSingular = !!recipientFirstNameDisplay || childPronouns.singular;
                        const beyondAge = age18Transition.majorityAge + 12;
                        return (
                          <>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                              <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", fontStyle: "italic" }}>
                                On track for {fmtUSD0(Math.round(projectedAtMajority))} when {childSubject} turn{childIsSingular ? "s" : ""} {age18Transition.majorityAge} 🌱
                              </p>
                              <button
                                type="button"
                                onClick={() => { haptic("light"); setDisclosureOpen("projection"); }}
                                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "rgba(255,255,255,0.28)", lineHeight: 1, display: "flex", alignItems: "center", flexShrink: 0 }}
                                aria-label="How we calculate projections"
                              >
                                <Info size={11} />
                              </button>
                            </div>
                            {showLongHorizon && (
                              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.42)", marginTop: 4, fontStyle: "italic" }}>
                                If {childSubject} let{childIsSingular ? "s" : ""} it keep growing to {beyondAge} → ~{fmtUSD0(Math.round(projectedLongHorizon))}.
                              </p>
                            )}
                          </>
                        );
                      })()}
                      {!age18Transition && (
                        <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
                          Add a birthdate to see the countdown.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Letter - inline */}
                <AnimatePresence initial={false}>
                  {letterInlineOpen ? (
                    <motion.div
                      key="letter-composer"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      style={{ overflow: "hidden", borderBottom: "1px solid rgba(26,23,16,0.07)" }}
                    >
                      <div style={{ padding: "18px 20px 20px" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "rgb(26,23,16)", marginBottom: 2 }}>
                          Write something for {recipientFirstNameDisplay || childPronouns.object}
                        </p>
                        <p style={{ fontSize: 11.5, color: "rgba(26,23,16,0.45)", marginBottom: 12, lineHeight: 1.5 }}>
                          {/* Pronoun-aware: "She reads" / "He reads" / "They read"
                              on her/his/their 18th birthday. */}
                          {capFirst(childPronouns.subject)} read{childPronouns.singular ? "s" : ""} it on {childPronouns.possAdj} {majorityOrdinal} birthday.
                        </p>
                        <textarea
                          autoFocus
                          value={letterDraft}
                          onChange={e => { setLetterDraft(e.target.value); setLetterDiscardConfirm(false); setLetterDeleteConfirm(false); }}
                          placeholder={`Start anywhere. Why you opened this, what you hope for ${childPronouns.object}, what ${childPronouns.subject} mean${childPronouns.singular ? "s" : ""} to you.`}
                          style={{
                            width: "100%", minHeight: 130, padding: "13px 15px",
                            borderRadius: 14, border: "1.5px solid rgba(26,23,16,0.12)",
                            background: "rgb(249,248,246)", fontSize: 14, lineHeight: 1.65,
                            color: "rgb(26,23,16)", resize: "none", fontFamily: "inherit",
                            outline: "none", boxSizing: "border-box", display: "block",
                          }}
                          onFocus={e => { e.target.style.borderColor = "rgba(26,23,16,0.28)"; }}
                          onBlur={e => { e.target.style.borderColor = "rgba(26,23,16,0.12)"; }}
                        />
                        {letterDraft.trim() && (
                          <p style={{ fontSize: 11, color: "rgba(26,23,16,0.35)", marginTop: 6 }}>
                            {letterDraft.trim().split(/\s+/).filter(Boolean).length} words
                          </p>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                          <button
                            type="button"
                            disabled={!letterDraft.trim() || letterSaving}
                            onClick={handleSaveLetter}
                            style={{
                              flex: 1, height: 40, borderRadius: 12, border: "none", cursor: "pointer",
                              background: letterDraft.trim() ? "hsl(var(--kiddo-gold))" : "rgba(26,23,16,0.08)",
                              color: letterDraft.trim() ? "white" : "rgba(26,23,16,0.3)",
                              fontSize: 13, fontWeight: 700, transition: "background 0.15s",
                            }}
                          >
                            {letterSaving ? "Saving…" : "Save letter"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const savedContent = (parentLetter?.content || "").trim();
                              const hasUnsaved = letterDraft.trim() !== savedContent && letterDraft.trim().length > 0;
                              if (hasUnsaved && !letterDiscardConfirm) {
                                setLetterDiscardConfirm(true);
                                return;
                              }
                              setLetterInlineOpen(false);
                              setLetterDraft("");
                              setLetterDiscardConfirm(false);
                              setLetterDeleteConfirm(false);
                            }}
                            style={{
                              height: 40, padding: "0 16px", borderRadius: 12,
                              border: letterDiscardConfirm ? "1.5px solid rgba(200,40,40,0.3)" : "1.5px solid rgba(26,23,16,0.12)",
                              background: "transparent",
                              color: letterDiscardConfirm ? "rgb(180,30,30)" : "rgba(26,23,16,0.5)",
                              fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "color 0.15s, border-color 0.15s",
                            }}
                          >
                            {letterDiscardConfirm ? "Discard changes?" : "Cancel"}
                          </button>
                        </div>
                        {parentLetter?.id && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(26,23,16,0.06)" }}>
                            <button
                              type="button"
                              disabled={letterSaving}
                              onClick={() => {
                                if (!letterDeleteConfirm) {
                                  setLetterDeleteConfirm(true);
                                  return;
                                }
                                void handleDeleteLetter();
                              }}
                              style={{
                                width: "100%", height: 36, padding: "0 12px", borderRadius: 10,
                                border: letterDeleteConfirm ? "1.5px solid rgba(200,40,40,0.4)" : "none",
                                background: letterDeleteConfirm ? "rgba(200,40,40,0.05)" : "transparent",
                                color: letterDeleteConfirm ? "rgb(180,30,30)" : "rgba(26,23,16,0.45)",
                                fontSize: 12, fontWeight: 600, cursor: letterSaving ? "default" : "pointer",
                                transition: "color 0.15s, border-color 0.15s, background 0.15s",
                              }}
                              data-testid="button-delete-parent-letter"
                            >
                              {letterSaving
                                ? "Clearing…"
                                : letterDeleteConfirm
                                  ? `Yes, clear ${recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "this"} letter`
                                  : "Clear this letter"}
                            </button>
                            {letterDeleteConfirm && (
                              <button
                                type="button"
                                onClick={() => setLetterDeleteConfirm(false)}
                                style={{
                                  width: "100%", marginTop: 4, padding: "4px 0",
                                  background: "transparent", border: "none",
                                  color: "rgba(26,23,16,0.4)", fontSize: 11, cursor: "pointer",
                                }}
                              >
                                Never mind
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="letter-cta"
                      type="button"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => { haptic("medium"); setLetterDraft(parentLetter?.content || ""); setLetterInlineOpen(true); }}
                      style={{
                        width: "100%", padding: "16px 20px",
                        display: "flex", alignItems: "center", gap: 14,
                        background: "transparent", border: "none", cursor: "pointer",
                        textAlign: "left", borderBottom: "1px solid rgba(26,23,16,0.07)",
                      }}
                    >
                      <div style={{
                        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                        background: parentLetter ? "rgba(26,61,43,0.1)" : "hsl(43,85%,95%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                          <rect x="2" y="4" width="16" height="12" rx="2" stroke={parentLetter ? "hsl(143,47%,28%)" : "hsl(43,72%,40%)"} strokeWidth="1.5"/>
                          <path d="M2 7l8 5 8-5" stroke={parentLetter ? "hsl(143,47%,28%)" : "hsl(43,72%,40%)"} strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {parentLetter ? (() => {
                          const wordCount = parentLetter.content.trim().split(/\s+/).filter(Boolean).length;
                          return (
                            <>
                              <p style={{ fontSize: 13.5, fontWeight: 700, color: "rgb(26,23,16)", marginBottom: 2 }}>
                                {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "The"} letter is ready
                              </p>
                              <p style={{ fontSize: 12, color: "rgba(26,23,16,0.45)" }}>
                                {wordCount} {wordCount === 1 ? "word" : "words"} &middot; tap to edit
                              </p>
                            </>
                          );
                        })() : (
                          <>
                            <p style={{ fontSize: 13.5, fontWeight: 700, color: "rgb(26,23,16)", marginBottom: 3 }}>
                              Write something for {recipientFirstNameDisplay || childPronouns.object}
                            </p>
                            <p style={{ fontSize: 12, color: "rgba(26,23,16,0.45)", lineHeight: 1.5 }}>
                              {/* Pronoun-aware reads-it line; name takes singular verb;
                                  pronoun form uses childPronouns.singular for agreement. */}
                              {recipientFirstNameDisplay
                                ? `${recipientFirstNameDisplay} reads it`
                                : `${capFirst(childPronouns.subject)} read${childPronouns.singular ? "s" : ""} it`} on {childPronouns.possAdj} {majorityOrdinal} birthday.
                            </p>
                          </>
                        )}
                      </div>
                      <div style={{
                        fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
                        color: parentLetter ? "hsl(143,47%,28%)" : "hsl(43,72%,38%)",
                        background: parentLetter ? "rgba(26,61,43,0.08)" : "hsl(43,85%,94%)",
                        padding: "5px 11px", borderRadius: 20,
                      }}>
                        {parentLetter ? "Edit" : "Start writing"}
                      </div>
                    </motion.button>
                  )}
                </AnimatePresence>

                {/* What happens at 18 */}
                <button
                  type="button"
                  onClick={() => { haptic("selection"); setLocation("/age-18-plan"); }}
                  style={{
                    width: "100%", padding: "14px 20px",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div>
                    {/* Pronoun-aware "{name|pronoun} turn(s) 18" + "{name|pronoun}
                        see(s) first" — names take singular verb regardless,
                        pronouns use childPronouns.singular. */}
                    <p style={{ fontSize: 13, fontWeight: 600, color: "rgb(26,23,16)" }}>What happens when {recipientFirstNameDisplay ? `${recipientFirstNameDisplay} turns` : `${childPronouns.subject} turn${childPronouns.singular ? "s" : ""}`} 18?</p>
                    <p style={{ fontSize: 11.5, color: "rgba(26,23,16,0.45)", marginTop: 1 }}>How the fund transfers, what {recipientFirstNameDisplay || childPronouns.subject} see{recipientFirstNameDisplay || childPronouns.singular ? "s" : ""} first.</p>
                  </div>
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M7 4l6 6-6 6" stroke="rgba(26,23,16,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </motion.section>

            {/* Per-fund settings entry point REMOVED 2026-05-15. The
                "{Kid}'s settings" button card (and its slide-up
                FundSettingsSheet) was redundant: the canonical home
                for per-fund settings is /settings?tab=child, which
                lives in the primary nav. The sheet variant also had
                a split-brain UX — every WRITE action (Edit fund,
                Invite co-parent, Close fund) routed back to the
                /settings page anyway, so the sheet only ever showed
                READ state in-card before bouncing the user out. Per
                the WHO/HOW IA inversion (Account = user, Settings =
                per-fund + HOW preferences), the right path is the
                Settings nav entry. Removing this card finishes that
                IA work rather than regressing it. */}
            <TrustMicroStrip />
          </>
        )}
      </main>

      {/* Contextual disclosure modals */}
      <Dialog open={disclosureOpen !== null} onOpenChange={(o) => { if (!o) setDisclosureOpen(null); }}>
        <DialogContent className="max-w-sm w-[92vw] rounded-2xl p-0 overflow-hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">
            {disclosureOpen === "growth" ? "How we calculate growth" : "How we calculate projections"}
          </DialogTitle>
          {disclosureOpen === "growth" ? (
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[hsl(var(--kiddo-evergreen))]">How we calculate growth ⓘ</p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "The fund's"} growth shows the change in invested value since the first gift.
                </p>
              </div>
              <div className="rounded-xl bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.06em]">Does not include</p>
                <ul className="space-y-1">
                  {["Kiddo subscription fees", "Stripe processing fees", "Cash not yet invested"].map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-0.5 shrink-0 text-muted-foreground/50">·</span>{item}
                    </li>
                  ))}
                </ul>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.06em] pt-2">Does include</p>
                <ul className="space-y-1">
                  {/* TODO: re-add "Dividends reinvested" once dividends are
                      actually tracked. Today the codebase has zero dividend
                      handling — no webhook, no sync job, no activity rows
                      written when a position pays. Restoring DRIP requires:
                        1. Confirm DriveWealth DRIP enrollment.
                        2. Add a daily "sync share counts" job that pulls
                           share counts from the custodian.
                        3. Detect share-count increases and write
                           `dividend_reinvested` activity rows (need a new
                           activity type + getTypeConfig styling).
                        4. Surface a "Dividends" line in the "fund so far"
                           card with real numbers.
                      Until 1-3 are real, this disclosure must NOT claim
                      dividends are reinvested — that would be promising
                      something the code doesn't deliver. Honesty over
                      marketing per the Emma-at-18 design lens. */}
                  {["Market gains and losses"].map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]">·</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                Past performance does not guarantee future results. Not investment advice.
              </p>
              <button
                type="button"
                className="w-full text-center text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] hover:opacity-70 transition-opacity"
                onClick={() => setDisclosureOpen(null)}
              >
                Got it
              </button>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[hsl(var(--kiddo-evergreen))]">How we calculate projections ⓘ</p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "The"} projected value at {age18Transition?.majorityAge ?? 18} is based on:
                </p>
              </div>
              <div className="rounded-xl bg-muted/30 p-4 space-y-1.5">
                {(() => {
                  // Sum every active recurring schedule into a monthly total via the
                  // shared helper — same number every other surface uses.
                  // Same phantom-row guard as the projection blends above.
                  const activeMonthly = sumMonthlyEquivalent([
                    ...parentContributions.filter((c: any) => String(c?.status || "").toLowerCase() === "active"),
                    ...recurringGifts.filter((rg: any) => String(rg?.status || "").toLowerCase() === "active" && !!rg?.stripeSubscriptionId),
                  ]);
                  const monthlyLabel = activeMonthly > 0
                    ? `$${Math.round(activeMonthly).toLocaleString()}/month from active recurring schedules`
                    : null;
                  const childFirst = recipientFirstNameDisplay;
                  const majorityAge = age18Transition?.majorityAge ?? 18;
                  // The eighteenthBirthday field on age18Transition is actually the
                  // majority date — most states it equals the 18th birthday, but PA/MS
                  // funds have majority at 21. Phrase as "majority date" to stay
                  // honest when they're not the same.
                  const majorityDateLabel = age18Transition
                    ? majorityAge === 18
                      ? `${childFirst ? `${childFirst}'s` : `${capFirst(childPronouns.possAdj)}`} ${majorityOrdinal} birthday: ${formatAgeTransitionDate(age18Transition.eighteenthBirthday)}`
                      : `${childFirst ? `${childFirst}'s` : "Their"} ${majorityAge}st birthday (your state's UTMA majority date): ${formatAgeTransitionDate(age18Transition.eighteenthBirthday)}`
                    : null;
                  const items = [
                    "Current invested balance",
                    ...(monthlyLabel ? [monthlyLabel] : []),
                    "7% historical average annual return, compounded monthly",
                    ...(majorityDateLabel ? [majorityDateLabel] : []),
                  ];
                  return items.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]">·</span>{item}
                    </div>
                  ));
                })()}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This is hypothetical. Not guaranteed. Markets go up and down. But gifts that last? Those are guaranteed. 🌱
              </p>
              <button
                type="button"
                className="w-full text-center text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] hover:opacity-70 transition-opacity"
                onClick={() => setDisclosureOpen(null)}
              >
                Got it
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AddFundSheet
        open={addFundOpen}
        onClose={() => setAddFundOpen(false)}
        onSuccess={(newFundId) => {
          if (newFundId) selectFund(newFundId);
        }}
      />

      {/* Second-fund wall — intercepts Add Fund taps for free/Plus
          users at the single-fund limit. AddFundSheet has its own
          upgrade-family in-flow step as a defensive fallback, but
          this modal stops the parent before they enter a multi-step
          flow they can't complete. dismissedFeatureWalls tracks the
          encounter so a repeat shows softer copy. */}
      <FeatureWallModal
        open={secondFundWallOpen}
        onClose={() => setSecondFundWallOpen(false)}
        featureId="second_fund"
        requiredTier="family"
        title="Kiddo Family covers every child."
        body={
          effectivePlan === "starter"
            ? "Kiddo+ covers one child's fund. Kiddo Family unlocks unlimited child funds — one price for every kid in your household, one dashboard across all of them, recurring investments and co-parent access on every fund."
            : "Add unlimited child funds with Kiddo Family. One price for every kid, one dashboard across all of them, recurring investments and co-parent access on every fund. Cancel anytime."
        }
        upgradePath="/account?tab=plan&upgrade=family"
      />

      {sharePages.length > 0 && (
        <ShareModal
          open={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          pages={sharePages}
          recipientName={recipientFirstNameDisplay || activeFund?.name || "your child"}
          giftCode={giftCodeData ?? undefined}
          snapshotHref={activeFund?.id ? `/fund/${activeFund.id}/snapshot` : undefined}
        />
      )}

      {eventShareTarget && (
        <ShareModal
          open={!!eventShareTarget}
          onClose={() => setEventShareTarget(null)}
          pages={eventShareTarget}
          recipientName={recipientFirstNameDisplay || activeFund?.name || "your child"}
          giftCode={giftCodeData ?? undefined}
        />
      )}

      {/* One-time contribution modal */}
      <Dialog open={oneTimeModalOpen} onOpenChange={(v) => { if (!v) { setOneTimeModalOpen(false); setOneTimeStep("amount"); setOneTimePaymentMethod("apple_pay"); setOneTimeMemoryNote(""); setOneTimeNoteSaved(false); setOneTimeMedia(EMPTY_MEMORY_MEDIA); } }}>
        <DialogContent className="max-w-sm w-[95vw] rounded-2xl p-0 overflow-hidden flex flex-col max-h-[88vh]" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Add a one-time investment</DialogTitle>

          {/* Progress bar */}
          <div className="h-1 bg-[hsl(var(--kiddo-evergreen)/0.12)] shrink-0">
            <div
              className="h-full bg-[hsl(var(--kiddo-evergreen))] transition-all duration-300"
              style={{ width: oneTimeStep === "amount" ? "33%" : oneTimeStep === "target" ? "66%" : "100%" }}
            />
          </div>

          <div className="px-6 pt-5 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--kiddo-gold)/0.12)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--kiddo-gold-ink))]">
              <span className="text-[10px]">💛</span> Add a gift
            </span>
          </div>

          <div className="p-6 pt-3 space-y-5 overflow-y-auto flex-1 min-h-0">
            {/* STEP 1: Amount */}
            {oneTimeStep === "amount" && (
              <>
                <div>
                  <h2 className="font-heading text-xl font-semibold text-foreground">
                    How much?
                  </h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Goes straight into {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "the"} fund and invests immediately.
                  </p>
                </div>

                {uninvestedCash > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                    <p className="text-xs font-semibold text-amber-800">
                      {formatCurrency(uninvestedCash)} already in the fund
                    </p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      There's uninvested cash in {recipientFirstNameDisplay || "the fund"}. This gift is in addition to that.
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Amount</label>
                    <div className="relative mt-2">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                      <input
                        type="number"
                        min="5"
                        step="1"
                        value={oneTimeAmount}
                        onChange={(e) => setOneTimeAmount(e.target.value)}
                        placeholder="50"
                        className="h-12 w-full rounded-2xl border border-border bg-background pl-8 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                      />
                    </div>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {[25, 50, 100, 250].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setOneTimeAmount(String(amt))}
                          className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                            oneTimeAmount === String(amt)
                              ? "border-primary text-primary bg-primary/10"
                              : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">$5 minimum. Estimated processing updates live once you choose a payment method.</p>
                  </div>
                </div>

                {/* Live diff arrow — only when the parent opened this modal via the
                    "+" on a stock they already own. They came in with intent ("more
                    Apple"), so the moment they type an amount the Apple position
                    should visibly grow. Mutation clarity for the parent surface:
                    show what is, what's changing, what will be. Live updates as
                    the amount changes. Skipped silently if any data is missing
                    (no live price, no held position, etc.) — degrades gracefully
                    rather than rendering a broken row. */}
                {oneTimeExecutionModel === "pick" && oneTimeTicker && oneTimeAmount && parseFloat(oneTimeAmount) >= 5 && (() => {
                  const heldPosition = holdings.find(h => (h.ticker || "").toUpperCase() === oneTimeTicker.toUpperCase());
                  if (!heldPosition) return null;
                  const tickerMeta = quotedAutoInvestStocks.find(s => s.symbol === oneTimeTicker.toUpperCase());
                  const livePrice = tickerMeta?.price && Number.isFinite(tickerMeta.price) ? tickerMeta.price : null;
                  if (!livePrice) return null;
                  const beforeShares = parseFloat(heldPosition.shares || "0");
                  const beforeValue = parseFloat(heldPosition.currentValue || "0");
                  if (!(beforeShares > 0) || !(beforeValue > 0) || !(investedCurrentValue > 0)) return null;
                  const addAmt = parseFloat(oneTimeAmount);
                  const addShares = addAmt / livePrice;
                  const afterShares = beforeShares + addShares;
                  const afterValue = beforeValue + addAmt;
                  // Denominator is the actual sum of holdings (investedCurrentValue),
                  // not the fund's balance field. Balance can lag the brokerage
                  // values when the price job hasn't reconciled, which made
                  // "X% of fund" before/after numbers misleading. Using the
                  // holdings sum keeps this consistent with the per-row %
                  // labels in the holdings card and the section summary lines.
                  const beforePct = (beforeValue / investedCurrentValue) * 100;
                  const afterPct = (afterValue / (investedCurrentValue + addAmt)) * 100;
                  const pctDelta = afterPct - beforePct;
                  const fmtShares = (n: number) => n >= 1 ? n.toFixed(2) : n.toFixed(4);
                  const companyName = tickerMeta?.name || oneTimeTicker.toUpperCase();
                  const companyEmoji = tickerMeta?.emoji || "";
                  return (
                    <div className="rounded-xl bg-[hsl(var(--kiddo-evergreen)/0.06)] border border-[hsl(var(--kiddo-evergreen)/0.20)] p-3.5 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <StockLogo ticker={oneTimeTicker} size={20} />
                        <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--kiddo-evergreen))]">
                          {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "The"} {companyName} position
                        </p>
                      </div>
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-0.5">Before</p>
                          <p className="text-sm font-semibold text-foreground/70 tabular-nums">{formatCurrency(beforeValue)}</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">{fmtShares(beforeShares)} sh · {beforePct.toFixed(1)}%</p>
                        </div>
                        <span className="text-[hsl(var(--kiddo-evergreen))] text-base font-bold" aria-hidden="true">→</span>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--kiddo-evergreen))] font-bold mb-0.5">After 🌱</p>
                          <p className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(afterValue)}</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            {fmtShares(afterShares)} sh · {afterPct.toFixed(1)}%
                            {Math.abs(pctDelta) >= 0.1 && (
                              <span className={`ml-1 font-medium ${pctDelta >= 0 ? "text-[hsl(var(--kiddo-evergreen))]" : "text-amber-700"}`}>
                                ({pctDelta >= 0 ? "+" : ""}{pctDelta.toFixed(1)})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <Button
                  className="w-full rounded-full"
                  disabled={!oneTimeAmount || parseFloat(oneTimeAmount) < 5}
                  onClick={() => setOneTimeStep("target")}
                >
                  Continue
                </Button>
              </>
            )}

            {/* STEP 2: Investment target */}
            {oneTimeStep === "target" && (
              <>
                <div>
                  <h2 className="font-heading text-xl font-semibold text-foreground">
                    Where should it go?
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {oneTimeExecutionModel === "cash"
                      ? `${formatCurrency(parseFloat(oneTimeAmount))} will sit as cash in the fund until you invest it from the dashboard.`
                      : `${formatCurrency(parseFloat(oneTimeAmount))} will be invested as soon as it clears.`}
                  </p>
                </div>

                <div className="space-y-2">
                  {/* Auto / fund default */}
                  <button
                    type="button"
                    onClick={() => { setOneTimeExecutionModel("auto"); setOneTimeTicker(""); }}
                    className={`w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                      oneTimeExecutionModel === "auto"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2l1.8 5.4H17l-4.2 3.1 1.6 5-4.4-3.2L5.6 15.5l1.6-5L3 7.4h5.2z" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinejoin="round" fill="hsl(var(--primary)/0.15)"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Fund default</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {investPrefs?.defaultMode === "stock" && investPrefs?.defaultTicker
                          ? `Buys ${investPrefs.defaultTicker} shares`
                          : investPrefs?.defaultMode === "cash"
                            ? "Held as cash"
                            : investPrefs?.managedStrategy === "balanced"
                              ? "Balanced stock and bond mix"
                              : investPrefs?.managedStrategy === "conservative"
                                ? "Capital preservation mix"
                                : "Diversified growth portfolio"}
                      </p>
                    </div>
                    {oneTimeExecutionModel === "auto" && (
                      <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </button>

                  {/* Fund default peek - visible when "auto" is selected */}
                  {oneTimeExecutionModel === "auto" && (() => {
                    const mode = investPrefs?.defaultMode ?? "managed";
                    const defaultTicker = investPrefs?.defaultTicker;
                    const amt = parseFloat(oneTimeAmount || "0");

                    if (mode === "stock" && defaultTicker) {
                      const stockMeta = quotedAutoInvestStocks.find(s => s.symbol === defaultTicker);
                      return (
                        <div className="rounded-xl border border-[hsl(var(--kiddo-evergreen)/0.3)] bg-[hsl(var(--kiddo-evergreen)/0.05)] p-3 flex items-center gap-3">
                          <StockLogo ticker={defaultTicker} size={28} className="shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{stockMeta?.name ?? defaultTicker}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{stockMeta?.tagline ?? "Your chosen default stock"}</p>
                            {amt > 0 && <p className="text-[11px] font-semibold text-[hsl(var(--kiddo-evergreen))] mt-1">{formatCurrency(amt)} invested</p>}
                          </div>
                        </div>
                      );
                    }

                    if (mode === "cash") {
                      return (
                        <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-3">
                          <div className="text-2xl shrink-0">💵</div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">Held as cash</p>
                            <p className="text-[11px] text-muted-foreground">Sits in the fund until you manually invest it</p>
                          </div>
                        </div>
                      );
                    }

                    const strategy = investPrefs?.managedStrategy ?? "growth";
                    const isBalanced = strategy === "balanced";
                    const isCustom = strategy === "custom";
                    const isConservative = strategy === "conservative";
                    const presetAllocations = MANAGED_STRATEGY_ALLOCATIONS[strategy] ?? MANAGED_STRATEGY_ALLOCATIONS.growth;
                    const customAllocations: Array<{ ticker: string; name: string; weight: number }> = isCustom && fundStrategy?.customAllocations
                      ? Object.entries(fundStrategy.customAllocations)
                          .map(([ticker, w]) => {
                            const opt = (["VTI","VXUS","BND","VGT","DIS","AAPL","NKE","TSLA","NFLX","RBLX","SBUX","AMZN"] as const);
                            const names: Record<string, string> = { VTI:"US Total Market",VXUS:"International",BND:"Bonds",VGT:"Tech",DIS:"Disney",AAPL:"Apple",NKE:"Nike",TSLA:"Tesla",NFLX:"Netflix",RBLX:"Roblox",SBUX:"Starbucks",AMZN:"Amazon" };
                            return { ticker, name: names[ticker] ?? ticker, weight: Math.round(Number(w) * 100) };
                          })
                          .filter(a => a.weight > 0)
                          .sort((a, b) => b.weight - a.weight)
                      : [];
                    const allocations = isCustom ? customAllocations : presetAllocations;
                    return (
                      <div className="rounded-xl border border-[hsl(var(--kiddo-evergreen)/0.2)] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-3 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{STRATEGY_META[strategy]?.emoji ?? STRATEGY_META.growth.emoji}</span>
                          <p className="text-sm font-semibold text-foreground">
                            {isCustom ? "Custom mix" : isBalanced ? "Steady & Balanced" : isConservative ? "Conservative Mix" : "Growth Mix"}
                          </p>
                        </div>
                        {allocations.length > 0 ? (
                          <div className="grid grid-cols-2 gap-1.5">
                            {allocations.map((a) => (
                              <div key={a.ticker} className="flex items-center gap-2 rounded-lg bg-background/70 border border-border/50 px-2.5 py-1.5">
                                <StockLogo ticker={a.ticker} size={20} />
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold text-foreground">{a.ticker} <span className="text-[hsl(var(--kiddo-evergreen))]">{a.weight}%</span></p>
                                  <p className="text-[9px] text-muted-foreground leading-tight truncate">{a.name}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : isCustom ? (
                          <p className="text-[11px] text-muted-foreground">Loading your custom mix...</p>
                        ) : null}
                      </div>
                    );
                  })()}

                  {/* Pick a stock */}
                  <button
                    type="button"
                    onClick={() => setOneTimeExecutionModel("pick")}
                    className={`w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                      oneTimeExecutionModel === "pick"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="hsl(var(--primary))" strokeWidth="1.5"/><circle cx="10" cy="10" r="4" stroke="hsl(var(--primary))" strokeWidth="1.5"/><circle cx="10" cy="10" r="1.5" fill="hsl(var(--primary))"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Pick a stock</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Choose exactly what to buy</p>
                    </div>
                    {oneTimeExecutionModel === "pick" && (
                      <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </button>

                  {/* Hold as cash — third option for the parent who wants to
                      add money now but pick the investment later. Backend
                      already supports this via the cash-park branch in
                      webhookHandlers.settleInvestedGift (executionModel ===
                      'cash' bypasses the buy attempts, money lands in
                      cashBalance). Honest copy: "doesn't earn market
                      returns" — same energy as `feedback_no_greenwashing
                      _losses`, telling the parent the trade-off plainly so
                      they don't park money long-term thinking it's safer. */}
                  <button
                    type="button"
                    onClick={() => { setOneTimeExecutionModel("cash"); setOneTimeTicker(""); }}
                    className={`w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                      oneTimeExecutionModel === "cash"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                    data-testid="button-one-time-execution-cash"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-lg" aria-hidden="true">💵</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Hold as cash</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Add now, invest from the dashboard later</p>
                    </div>
                    {oneTimeExecutionModel === "cash" && (
                      <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </button>

                  {/* Honest disclosure for cash mode — sits below the button
                      group, only renders when cash is selected. Doesn't
                      shame the choice (legitimate use cases exist), but
                      tells the parent what the trade-off is so they don't
                      park money long-term thinking it's safer. Per the
                      no-greenwashing rule, omitting this would be the
                      Acorns-style "money sitting uninvested" failure. */}
                  {oneTimeExecutionModel === "cash" && (
                    <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
                      Cash sits in the fund earning nothing until you invest it. Use this when you want to time the buy yourself, or accumulate before a single bigger investment.
                    </p>
                  )}
                </div>

                {/* Stock picker grid */}
                {oneTimeExecutionModel === "pick" && (
                  <div className="grid grid-cols-2 gap-2">
                    {quotedAutoInvestStocks.map((stock) => {
                      const amt = parseFloat(oneTimeAmount || "0");
                      const isSelected = oneTimeTicker === stock.symbol;
                      return (
                        <button
                          key={stock.symbol}
                          type="button"
                          onClick={() => setOneTimeTicker(stock.symbol)}
                          className={`rounded-xl border p-3 text-left transition-colors ${
                            isSelected
                              ? "border-[hsl(var(--kiddo-evergreen))] bg-[hsl(var(--kiddo-evergreen)/0.06)]"
                              : "border-border hover:border-[hsl(var(--kiddo-evergreen)/0.4)]"
                          }`}
                        >
                          <StockLogo ticker={stock.symbol} size={32} className="mb-1.5" />
                          <p className="text-sm font-semibold text-foreground leading-tight">{stock.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{stock.tagline}</p>
                          {amt > 0 && (
                            <p className="text-[11px] font-semibold text-[hsl(var(--kiddo-evergreen))] mt-1.5">
                              {formatCurrency(amt)} invested
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setOneTimeStep("amount")}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1 rounded-full"
                    disabled={oneTimeExecutionModel === "pick" && !oneTimeTicker}
                    onClick={() => setOneTimeStep("confirm")}
                  >
                    Continue
                  </Button>
                </div>
              </>
            )}

            {/* STEP 3: Confirm + memory note */}
            {oneTimeStep === "confirm" && (
              <>
                <div>
                  <h2 className="font-heading text-xl font-semibold text-foreground">
                    Almost there.
                  </h2>
                </div>

                {/* Position diff arrow on confirm — same logic as the amount step,
                    repeated here so the parent re-confirms at the moment of pay
                    that this is what they're doing. The diff is the trust artifact;
                    showing it twice (once live as they choose, once at confirm)
                    is intentional, not redundant. */}
                {oneTimeExecutionModel === "pick" && oneTimeTicker && oneTimeAmount && parseFloat(oneTimeAmount) >= 5 && (() => {
                  const heldPosition = holdings.find(h => (h.ticker || "").toUpperCase() === oneTimeTicker.toUpperCase());
                  if (!heldPosition) return null;
                  const tickerMeta = quotedAutoInvestStocks.find(s => s.symbol === oneTimeTicker.toUpperCase());
                  const livePrice = tickerMeta?.price && Number.isFinite(tickerMeta.price) ? tickerMeta.price : null;
                  if (!livePrice) return null;
                  const beforeShares = parseFloat(heldPosition.shares || "0");
                  const beforeValue = parseFloat(heldPosition.currentValue || "0");
                  if (!(beforeShares > 0) || !(beforeValue > 0) || !(investedCurrentValue > 0)) return null;
                  const addAmt = parseFloat(oneTimeAmount);
                  const addShares = addAmt / livePrice;
                  const afterShares = beforeShares + addShares;
                  const afterValue = beforeValue + addAmt;
                  // Denominator is the actual sum of holdings (investedCurrentValue),
                  // not the fund's balance field. Balance can lag the brokerage
                  // values when the price job hasn't reconciled, which made
                  // "X% of fund" before/after numbers misleading. Using the
                  // holdings sum keeps this consistent with the per-row %
                  // labels in the holdings card and the section summary lines.
                  const beforePct = (beforeValue / investedCurrentValue) * 100;
                  const afterPct = (afterValue / (investedCurrentValue + addAmt)) * 100;
                  const fmtShares = (n: number) => n >= 1 ? n.toFixed(2) : n.toFixed(4);
                  const companyName = tickerMeta?.name || oneTimeTicker.toUpperCase();
                  const companyEmoji = tickerMeta?.emoji || "";
                  return (
                    <div className="rounded-xl bg-[hsl(var(--kiddo-evergreen)/0.06)] border border-[hsl(var(--kiddo-evergreen)/0.20)] p-3.5 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <StockLogo ticker={oneTimeTicker} size={20} />
                        <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--kiddo-evergreen))]">
                          {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "The"} {companyName} position
                        </p>
                      </div>
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-0.5">Before</p>
                          <p className="text-sm font-semibold text-foreground/70 tabular-nums">{formatCurrency(beforeValue)}</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">{fmtShares(beforeShares)} sh · {beforePct.toFixed(1)}%</p>
                        </div>
                        <span className="text-[hsl(var(--kiddo-evergreen))] text-base font-bold" aria-hidden="true">→</span>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--kiddo-evergreen))] font-bold mb-0.5">After 🌱</p>
                          <p className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(afterValue)}</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">{fmtShares(afterShares)} sh · {afterPct.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Summary card */}
                <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Amount</span>
                    <span className="text-sm font-semibold text-foreground">{formatCurrency(parseFloat(oneTimeAmount || "0"))}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Goes into</span>
                    <span className="text-sm font-semibold text-foreground">
                      {oneTimeExecutionModel === "pick" && oneTimeTicker
                        ? `${quotedAutoInvestStocks.find(s => s.symbol === oneTimeTicker)?.name ?? oneTimeTicker} (${oneTimeTicker})`
                        : oneTimeExecutionModel === "cash"
                          ? "Cash (invest later)"
                          : capFirst(mixIdentityFor(recipientFirstNameDisplay))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Funding source</span>
                    <span className="text-sm font-semibold text-foreground">
                      {oneTimePaymentMethod === "bank"
                        ? "Bank transfer"
                        : oneTimePaymentMethod === "cashapp"
                          ? "Cash App"
                          : oneTimePaymentMethod === "paypal"
                            ? "PayPal"
                            : oneTimePaymentMethod === "card"
                              ? "Card"
                              : "Apple Pay / Google Pay"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Estimated processing fee
                    </span>
                    <span className="text-sm font-semibold text-foreground" data-testid="text-one-time-processing-fee">
                      {formatCurrency(oneTimeSelectedEstimate.processingFee)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estimated total charged</span>
                    <span className="text-sm font-semibold text-foreground" data-testid="text-one-time-total-charge">
                      {formatCurrency(oneTimeSelectedEstimate.totalCharge)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">How do you want to fund it?</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      New money can come from Apple Pay, Cash App, PayPal, card, or bank transfer. Fees are estimated live before checkout.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {([
                      ["apple_pay", "Apple Pay / Google Pay", "Fastest on supported devices", "~2.9% + $0.30"],
                      ["card", "Credit or debit card", "Visa, Mastercard, Amex, Discover", "~2.9% + $0.30"],
                      ["cashapp", "Cash App", "Pay with Cash App balance", "~2.9% + $0.30"],
                      ["paypal", "PayPal", "Pay with your PayPal account", "~3.49% + $0.49"],
                      ["bank", "Bank transfer (ACH)", bankAccounts.length > 0 ? "Lowest fee. You can use a connected bank." : "Lowest fee. Connect or verify a bank at checkout.", "0.8% max $5"],
                    ] as const).map(([method, title, description, fee]) => {
                      const estimate = oneTimeEstimatedRailOptions[method];
                      const savings =
                        method === "bank"
                          ? Math.max(0, oneTimeCardLikeFee - estimate.processingFee)
                          : 0;
                      return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => {
                          setOneTimePaymentMethod(method);
                          haptic("selection");
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${
                          oneTimePaymentMethod === method
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        }`}
                        data-testid={`button-one-time-payment-${method}`}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">{title}</span>
                          <span className="block text-xs text-muted-foreground">{description}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className={`block text-[11px] font-semibold ${method === "bank" ? "text-green-700" : "text-muted-foreground"}`}>
                            {fee}
                          </span>
                          <span className="block text-[10px] text-foreground/80" data-testid={`text-one-time-total-${method}`}>
                            {formatCurrency(estimate.totalCharge)} total
                          </span>
                          {savings > 0 && (
                            <span className="block text-[10px] text-green-700">
                              Save about {formatCurrency(savings)}
                            </span>
                          )}
                        </span>
                      </button>
                    )})}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Estimated charge = gift amount plus payment processing. The full gift amount goes into the fund.
                  </p>
                  {oneTimeAchSavings > 0 && (
                    <p className="text-[11px] text-green-700">
                      Bank transfer saves about {formatCurrency(oneTimeAchSavings)} compared with card pricing.
                    </p>
                  )}
                </div>

                {/* Memory note */}
                <div className="rounded-2xl border border-amber-200/60 bg-amber-50/40 p-4 space-y-2">
                  <p className="text-sm font-semibold text-foreground">
                    Leave a note for the Memory Book
                  </p>
                  <p className="text-xs text-muted-foreground -mt-1">
                    {/* Pronoun-aware reads-on-18 helper. */}
                    {recipientFirstNameDisplay
                      ? `${recipientFirstNameDisplay} reads it on ${childPronouns.possAdj} ${majorityOrdinal} birthday.`
                      : `${capFirst(childPronouns.subject)}'ll read it when ${childPronouns.subject} ${childPronouns.singular ? "is" : "are"} 18.`} Optional, but it matters.
                  </p>
                  {oneTimeNoteSaved ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 font-medium">
                      Saved to the memory book
                    </div>
                  ) : (
                    <>
                      <textarea
                        value={oneTimeMemoryNote}
                        onChange={(e) => setOneTimeMemoryNote(e.target.value.slice(0, 240))}
                        placeholder={noteFlowPlaceholder("one-time")}
                        rows={3}
                        className="w-full rounded-xl border border-amber-200/40 bg-white/80 px-3 py-2.5 text-sm resize-none placeholder:text-amber-700/40 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <p className="text-[10px] text-muted-foreground text-right">{oneTimeMemoryNote.length}/240</p>
                      {/* Media trio (photo / video / voice). Voice is the moat
                          — Emma at 18 hearing the parent's voice from when she
                          was 3. Collapsible by default so the speed of the
                          one-time flow is preserved for parents who just want
                          to deposit. */}
                      {activeFundId && (
                        <MemoryMediaPicker
                          fundId={activeFundId}
                          value={oneTimeMedia}
                          onChange={setOneTimeMedia}
                          childName={recipientFirstNameDisplay}
                          pronoun={(activeFund as any)?.pronoun}
                          majorityAge={(activeFund as any)?.majorityAge}
                          requiresPlus={!hasAutoInvestAccess}
                          className="mt-2"
                        />
                      )}
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setOneTimeStep("target")}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1 rounded-full"
                    disabled={startingOneTime}
                    onClick={handleStartOneTimeContribution}
                  >
                    {startingOneTime ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Invest {formatCurrency(parseFloat(oneTimeAmount || "0"))}{recipientFirstNameDisplay ? ` in ${recipientFirstNameDisplay}` : ""}</>
                    )}
                  </Button>
                </div>
                <p className="text-center text-xs text-muted-foreground -mt-2">
                  Secure checkout via Stripe. Final totals can move slightly if the payment rail changes on the hosted checkout page.
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Gifter detail sheet — slide-up from bottom, mirrors the
          HoldingDetailSheet pattern. Drilling into a specific entity
          (a person who gave) is the same UX job as drilling into a
          stock holding, so the affordance should match. Previously
          rendered as a centered Dialog modal, which broke the
          "slide-up for entity drill-ins, modal for system actions"
          pattern locked in feedback_slide_up_vs_modal.md. */}
      <Sheet open={!!selectedGifter} onOpenChange={(v) => { if (!v) setSelectedGifter(null); }}>
        <SheetContent side="bottom" className="overflow-y-auto px-0 pb-0" aria-describedby={undefined}>
          <SheetTitle className="sr-only">
            {selectedGifter?.name === "Anonymous" ? "Anonymous people" : selectedGifter ? (
              user?.email && selectedGifter.gifts.some(g => String(g.senderEmail || "").trim().toLowerCase() === String(user.email).trim().toLowerCase())
                ? "Your gifts" : `${selectedGifter.name}'s gifts`
            ) : "Person"}
          </SheetTitle>
          {selectedGifter && (selectedGifter.name === "Anonymous" ? (() => {
            // Anonymous bucket — was a 4-line dead-end (avatar + count +
            // tagline). Now renders the same per-gift detail rows the
            // named-gifter dialog gets, just with an "Anonymous" badge
            // per row instead of a name. Anonymity doesn't preclude
            // detail: dates, amounts, tickers, messages, and "now worth"
            // deltas all still tell the story without identifying the
            // giver. Per the design lens (Emma at 18 looking back),
            // these gifts ARE part of her story — flattening them to a
            // count is the opposite of what we should do.
            const anonSorted = [...selectedGifter.gifts].sort(
              (a, b) => new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime(),
            );
            const anonAggregate = (() => {
              let totalNow = 0;
              let totalPaid = 0;
              let anyLive = false;
              for (const g of selectedGifter.gifts) {
                const status = String(g.status || "").toLowerCase();
                if (status === "failed" || status === "refunded") continue;
                const netAmt = parseFloat(String(g.netAmount || g.amount || "0"));
                const paid = Number.isFinite(netAmt) && netAmt > 0 ? netAmt : 0;
                totalPaid += paid;
                // Same allocation-aware resolver the named-gifter
                // dialog uses — sums across the gift's CURRENT
                // allocations (post-rebalance) so a $50 SBUX gift
                // that was sold and reallocated to VTI gets attributed
                // properly instead of going silent.
                const resolved = computeGiftCurrentValue(g);
                if (resolved.todayValue != null && Number.isFinite(resolved.todayValue)) {
                  totalNow += resolved.todayValue;
                  anyLive = true;
                } else {
                  totalNow += paid;
                }
              }
              return { totalNow, totalPaid, delta: totalNow - totalPaid, anyLive };
            })();
            return (
              <>
                {/* Header — triangular cluster (matches the avatar
                    cluster on the section). Two back peek-circles + one
                    front-bottom main circle with the person silhouette.
                    Reads as "small group of people" rather than a flat
                    left-anchored stack. */}
                <div className="px-6 pt-6 pb-4">
                  <div className="flex items-start gap-4">
                    <div style={{ position: "relative", width: 64, height: 60, flexShrink: 0 }}>
                      {/* Back-left peek */}
                      <div
                        aria-hidden
                        style={{
                          position: "absolute",
                          left: 0, top: 2,
                          width: 36, height: 36, borderRadius: 9999,
                          background: "rgba(26,23,16,0.04)",
                          border: "2px dashed rgba(26,23,16,0.10)",
                          opacity: 0.65,
                        }}
                      />
                      {/* Back-right peek */}
                      <div
                        aria-hidden
                        style={{
                          position: "absolute",
                          left: 28, top: 2,
                          width: 36, height: 36, borderRadius: 9999,
                          background: "rgba(26,23,16,0.04)",
                          border: "2px dashed rgba(26,23,16,0.10)",
                          opacity: 0.65,
                        }}
                      />
                      {/* Front-center main circle */}
                      <div style={{
                        position: "absolute",
                        left: 14, top: 20,
                        width: 44, height: 44, borderRadius: 9999,
                        background: "rgb(248,245,240)",
                        border: "2px dashed rgba(26,23,16,0.14)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 2px 6px rgba(26,23,16,0.10)",
                      }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="8" r="4" fill="rgba(26,23,16,0.22)" />
                          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="rgba(26,23,16,0.18)" />
                        </svg>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading text-lg font-bold text-foreground">Anonymous people</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {selectedGifter.giftCount} {selectedGifter.giftCount === 1 ? "gift" : "gifts"} · {formatCurrency(selectedGifter.totalNetAmount)} total
                      </p>
                      {anonAggregate.anyLive && Math.abs(anonAggregate.delta) >= 0.01 && anonAggregate.totalPaid > 0 && (() => {
                        const pct = (anonAggregate.delta / anonAggregate.totalPaid) * 100;
                        const up = anonAggregate.delta >= 0;
                        return (
                          <p className="text-xs mt-1 tabular-nums">
                            <span style={{ color: "rgb(100,92,86)" }}>{formatCurrency(anonAggregate.totalNow)} today</span>
                            <span style={{ color: up ? "rgb(22,128,67)" : "rgb(190,30,30)", fontWeight: 700 }}>
                              {" · "}{up ? "+" : ""}{formatCurrency(anonAggregate.delta)} ({up ? "+" : ""}{pct.toFixed(1)}%) {up ? "🌱" : ""}
                            </span>
                          </p>
                        );
                      })()}
                      <p className="text-xs text-muted-foreground italic mt-2 leading-relaxed">
                        They chose not to be known. Their love counts just as much. 🌱
                      </p>
                    </div>
                  </div>
                </div>
                <div style={{ height: 1, background: "rgba(26,23,16,0.07)" }} />
                {/* Per-gift list — same structure as the named-gifter
                    branch but with an "Anonymous" pill instead of a name.
                    No thank-you actions (no email to reach), no Memory
                    Book deep-link by gifter (no name to filter on). The
                    individual gift IS still tappable to its specific
                    Memory Book entry — the moment lives there. */}
                <div className="overflow-y-auto max-h-[40vh]">
                  {anonSorted.map((g, i) => {
                    const netAmt = parseFloat(String(g.netAmount || g.amount || "0"));
                    const statusStr = String(g.status || "").toLowerCase();
                    const isPending = statusStr === "pending" || statusStr === "processing";
                    const isInvested = statusStr === "invested" || statusStr === "settled";
                    const gTicker = (g as any).selectedTicker as string | null | undefined;
                    const gHoldingName = gTicker
                      ? friendlyHoldingName(gTicker, holdings.find(h => h.ticker === gTicker)?.name)
                      : null;
                    const childMixLabel = recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s mix` : "Recurring mix";
                    const investLabel = gTicker ? gTicker.toUpperCase() : childMixLabel;
                    const sharesAcquired = (g as any).sharesAcquired ? parseFloat(String((g as any).sharesAcquired)) : null;
                    const giftDate = new Date(String(g.createdAt || Date.now()));
                    const fullDate = giftDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
                    const isLast = i === anonSorted.length - 1;
                    const navigateToThisGift = () => {
                      if (!g.id || !activeFundId) return;
                      haptic("selection");
                      setSelectedGifter(null);
                      setLocation(`/memory/${activeFundId}?gift=${g.id}`);
                    };
                    return (
                      <div
                        key={g.id || i}
                        role="button"
                        tabIndex={0}
                        onClick={navigateToThisGift}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigateToThisGift(); } }}
                        data-testid={`anon-gift-row-${g.id || i}`}
                        style={{
                          padding: "16px 24px",
                          borderBottom: isLast ? "none" : "1px solid rgba(26,23,16,0.06)",
                          cursor: g.id ? "pointer" : "default",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => { if (g.id) e.currentTarget.style.background = "rgba(26,23,16,0.025)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
                            <span style={{
                              fontSize: 10.5, fontWeight: 700,
                              color: "rgb(120,110,100)",
                              background: "rgba(26,23,16,0.06)",
                              border: "1px dashed rgba(26,23,16,0.18)",
                              borderRadius: 999, padding: "1.5px 7px",
                            }}>
                              Anonymous
                            </span>
                            {/* Same brand-mark treatment as the named-gifter
                                rows above — anonymous senders still bought
                                a real ticker and Emma at 18 should see
                                which company her anonymous gift bought.
                                See feedback_no_ai_slop / brokerage trust
                                principles. */}
                            {gTicker && (
                              <StockLogo ticker={gTicker} size={18} className="shrink-0" />
                            )}
                            <span style={{
                              fontSize: 10.5, fontWeight: 700,
                              color: gTicker ? "rgb(26,67,50)" : "rgb(120,110,100)",
                              background: gTicker ? "rgba(26,67,50,0.09)" : "rgba(26,23,16,0.06)",
                              borderRadius: 999, padding: "2px 8px",
                            }}>
                              {/* "✓" prefix removed — every entry in this list is
                                  by definition either invested OR shows a "🌱 Settling"
                                  pill alongside, so the checkmark was telling the parent
                                  what the absence-of-Settling already tells them. */}
                              {investLabel}
                            </span>
                            {gHoldingName && (
                              <span style={{ fontSize: 12, color: "rgb(80,72,64)", fontWeight: 500 }}>
                                {gHoldingName}
                              </span>
                            )}
                            {isPending && (
                              <span style={{ fontSize: 9.5, fontWeight: 700, background: "hsl(143,28%,94%)", color: "hsl(143,40%,30%)", padding: "1px 6px", borderRadius: 999 }}>
                                🌱 Settling
                              </span>
                            )}
                          </div>
                          <p className="font-heading" style={{ fontSize: 16, fontWeight: 700, color: "rgb(26,23,16)", flexShrink: 0 }}>
                            {formatCurrency(Number.isFinite(netAmt) ? netAmt : 0)}
                          </p>
                        </div>
                        <div style={{ marginTop: 7, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "3px 10px" }}>
                          <span style={{ fontSize: 11.5, color: "rgb(120,110,100)", fontWeight: 500 }}>
                            Received {fullDate}
                          </span>
                        </div>
                        {(() => {
                          // Same allocation-aware resolver as the
                          // named-gifter dialog. Anonymous gift's
                          // original ticker may have been sold and
                          // reallocated; "Now worth" reflects where the
                          // money actually IS today, not the original
                          // ticker's stale price.
                          const resolved = computeGiftCurrentValue(g);
                          if (resolved.todayValue == null) return null;
                          const todayValue = resolved.todayValue;
                          const paid = Number.isFinite(netAmt) ? netAmt : 0;
                          const delta = todayValue - paid;
                          const showDelta = Math.abs(delta) >= 0.01 && paid > 0;
                          return (
                            <>
                              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "3px 8px" }}>
                                <span style={{ fontSize: 11.5, color: "rgb(100,90,82)", fontWeight: 600 }}>
                                  Now worth {formatCurrency(todayValue)}
                                </span>
                                {showDelta && (
                                  <span style={{
                                    fontSize: 11, fontWeight: 700,
                                    color: delta >= 0 ? "rgb(22,128,67)" : "rgb(190,30,30)",
                                  }}>
                                    {delta >= 0 ? "+" : "−"}{formatCurrency(Math.abs(delta))} 🌱
                                  </span>
                                )}
                              </div>
                              {resolved.isReallocated && resolved.nowInLabel && (
                                <p style={{ marginTop: 3, fontSize: 10.5, color: "rgb(140,130,122)", lineHeight: 1.4 }}>
                                  Now in: {resolved.nowInLabel}
                                </p>
                              )}
                            </>
                          );
                        })()}
                        {isPending && (
                          <p style={{ marginTop: 6, fontSize: 11.5, color: "rgba(26,23,16,0.4)", lineHeight: 1.5 }}>
                            On its way to {recipientFirstNameDisplay || "the fund"}. Settles in 1–2 business days.
                          </p>
                        )}
                        {g.message && (
                          <p style={{ marginTop: 7, fontSize: 12.5, fontStyle: "italic", color: "rgba(26,23,16,0.52)", lineHeight: 1.5 }}>
                            "{g.message}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ height: 1, background: "rgba(26,23,16,0.07)" }} />
                {!isReadOnlyFund && (
                  <div className="px-5 py-4">
                    <Button
                      className="w-full kiddo-gold-button rounded-full"
                      onClick={() => { setSelectedGifter(null); handleShareLink(); }}
                      data-testid="button-anon-modal-share-gift-link"
                    >
                      <Share2 size={14} className="mr-2" />
                      Share {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "the"} gift link
                    </Button>
                  </div>
                )}
              </>
            );
          })() : (() => {
            const color = GIFTER_AVATAR_COLORS[selectedGifter.colorIdx];
            // Gifter-level "Thanked" pill — same all-or-nothing rule as
            // the avatar grid's badge above. Lies if it lights up when
            // only one of grandpa's three gifts has been thanked, so
            // it requires every thankable gift to be sent. Per-gift
            // pills further down the dialog still surface the precise
            // status for each individual gift.
            const thankableGifts = selectedGifter.gifts.filter(g => !!g.id && !!String(g.senderEmail || "").trim());
            const isThanked = thankableGifts.length > 0
              && thankableGifts.every(g => dashboardThankYouByGiftId.get(String(g.id))?.status === "sent");
            const isOwnerPopup = !!user?.email && selectedGifter.gifts.some(g =>
              String(g.senderEmail || "").trim().toLowerCase() === String(user.email).trim().toLowerCase()
            );
            const sortedGifts = [...selectedGifter.gifts].sort(
              (a, b) => new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime()
            );
            // Identify the chronologically EARLIEST gift in this gifter's
            // history. Same celebration pattern as the Activity History
            // tab's first-gift banner — except here it marks the
            // chronologically-earliest row inside this person's gift
            // list. Skipped for the parent (no need to celebrate parent's
            // own first contribution from inside the gifter dialog) and
            // for anonymous (no identity to celebrate "first" against).
            const firstGiftIdInDialog = (() => {
              if (isOwnerPopup) return null;
              if (selectedGifter.name === "Anonymous") return null;
              if (sortedGifts.length === 0) return null;
              // sortedGifts is descending — earliest is the LAST entry.
              const earliest = sortedGifts[sortedGifts.length - 1];
              return earliest?.id ? String(earliest.id) : null;
            })();
            // Bulk thank-you trigger — when a gifter has 3+ unthanked
            // gifts, render a top-of-list shortcut. Tapping routes to
            // their Memory Book filter where the parent can compose
            // thanks at scale (the existing per-gift composer is the
            // single source of truth for outgoing thanks). Skipped for
            // owner / anonymous / contactless senders. Threshold is 3
            // because 1-2 are easily handled inline; 3+ is when the
            // friction of tapping each one starts to bite.
            const unthankedCount = (() => {
              if (isOwnerPopup) return 0;
              if (selectedGifter.name === "Anonymous") return 0;
              return sortedGifts.filter(g => {
                const giftEmail = String((g as any).senderEmail || "").trim();
                if (!giftEmail) return false; // contactless senders
                const ty = g.id ? dashboardThankYouByGiftId.get(String(g.id)) : null;
                return !ty || ty.status !== "sent";
              }).length;
            })();
            const showBulkThanks = unthankedCount >= 3;
            // "Now worth" aggregate — uses the per-gift current-value
            // resolver that traces through giftAllocations, so a gift
            // whose original ticker was sold and rebalanced into VTI
            // is correctly attributed to its current location instead
            // of disappearing or showing stale numbers.
            const aggregateNowWorth = (() => {
              let totalNow = 0;
              let totalPaid = 0;
              let anyLive = false;
              for (const g of selectedGifter.gifts) {
                const status = String(g.status || "").toLowerCase();
                if (status === "failed" || status === "refunded") continue;
                const netAmt = parseFloat(String(g.netAmount || g.amount || "0"));
                const paid = Number.isFinite(netAmt) && netAmt > 0 ? netAmt : 0;
                totalPaid += paid;
                const resolved = computeGiftCurrentValue(g);
                if (resolved.todayValue != null && Number.isFinite(resolved.todayValue)) {
                  totalNow += resolved.todayValue;
                  anyLive = true;
                } else {
                  totalNow += paid;
                }
              }
              return { totalNow, totalPaid, delta: totalNow - totalPaid, anyLive };
            })();
            // Per-gift recurring signal lives on each gift row below
            // (line ~9599 — `↻ Recurring` chip when g.parentContributionId
            // is set). Showing a header-level pill that fires on
            // "ANY active schedule exists" was conflating the parent's
            // identity with the gift's lifecycle: a parent with one
            // active schedule + five one-time additions saw "↻ Recurring"
            // at the top of the dialog, even though only one of the six
            // gifts in the list was actually recurring.
            // Same all-or-nothing truthfulness pattern as the Thanked
            // badge fix: gifter-level summaries lie when only SOME
            // gifts have the property. Remove the gifter-level pill;
            // let the per-gift chips carry the signal where it's
            // honest and unambiguous.
            const showRecurringPill = false;
            return (
              <>
                <div className="px-6 pb-4 pt-6">
                  <div className="flex items-center gap-4">
                    <div style={{ position: "relative" }}>
                      <div
                        style={{
                          width: 52, height: 52, borderRadius: 9999, flexShrink: 0,
                          background: color.bg,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          overflow: "hidden",
                          boxShadow: isOwnerPopup
                            ? "0 0 0 2.5px hsl(var(--kiddo-evergreen)), 0 2px 8px rgba(26,23,16,0.12)"
                            : "0 2px 8px rgba(26,23,16,0.12)",
                        }}
                      >
                        {isOwnerPopup && user?.profileImageUrl ? (
                          // Parent's own profile photo in the gifter detail
                          // modal hero — same swap as the small roster avatar
                          // so the parent reads "this is me" consistently.
                          <img
                            src={user.profileImageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span style={{ color: color.text, fontSize: 18, fontWeight: 800 }}>
                            {selectedGifter.initials}
                          </span>
                        )}
                      </div>
                      {isThanked && (
                        <div style={{
                          position: "absolute", bottom: -1, right: -1,
                          width: 18, height: 18, borderRadius: 9999,
                          background: "hsl(var(--kiddo-evergreen))", border: "2px solid white",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-heading text-lg font-bold text-foreground">
                          {isOwnerPopup ? "Your gifts" : selectedGifter.name}
                        </h3>
                        {isOwnerPopup && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--kiddo-evergreen))", background: "hsl(var(--kiddo-evergreen)/0.1)", borderRadius: 999, padding: "2px 7px", flexShrink: 0 }}>
                            Parent
                          </span>
                        )}
                        {/* Recurring pill — owner-only since gifter
                            recurring is retired. Mirrors the avatar's
                            ↻ badge so the signal doesn't vanish on tap. */}
                        {showRecurringPill && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "hsl(43, 55%, 30%)", background: "hsl(43, 75%, 55%, 0.16)", borderRadius: 999, padding: "2px 7px", flexShrink: 0 }}>
                            ↻ Recurring
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <p className="text-sm text-muted-foreground">
                          {selectedGifter.giftCount} {selectedGifter.giftCount === 1 ? "gift" : "gifts"} · {formatCurrency(selectedGifter.totalNetAmount)} gifted
                        </p>
                        {isThanked && (
                          <span className="rounded-full" style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--kiddo-evergreen))", background: "hsl(var(--kiddo-evergreen) / 0.09)", padding: "2px 7px" }}>
                            ✓ Thanked
                          </span>
                        )}
                      </div>
                      {/* "Now worth" aggregate — answers the kid-at-18
                          question without forcing the parent to scroll
                          and mentally add up per-gift deltas. Only shows
                          when we have at least one live quote AND the
                          delta is >= 1 cent (otherwise it would just say
                          "$X today, +$0" which is noise). */}
                      {aggregateNowWorth.anyLive && Math.abs(aggregateNowWorth.delta) >= 0.01 && aggregateNowWorth.totalPaid > 0 && (() => {
                        const pct = (aggregateNowWorth.delta / aggregateNowWorth.totalPaid) * 100;
                        const up = aggregateNowWorth.delta >= 0;
                        return (
                          <p className="text-xs mt-1 tabular-nums" data-testid="gifter-modal-aggregate-now-worth">
                            <span style={{ color: "rgb(100,92,86)" }}>
                              {formatCurrency(aggregateNowWorth.totalNow)} today
                            </span>
                            <span style={{ color: up ? "rgb(22,128,67)" : "rgb(190,30,30)", fontWeight: 700 }}>
                              {" · "}{up ? "+" : ""}{formatCurrency(aggregateNowWorth.delta)} ({up ? "+" : ""}{pct.toFixed(1)}%) {up ? "🌱" : ""}
                            </span>
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <div style={{ height: 1, background: "rgba(26,23,16,0.07)" }} />

                {/* Featured single-gift spotlight removed: when a gifter only
                    has one gift, the spotlight repeated the SAME info that the
                    per-gift row already shows (sender, amount, message, date).
                    The per-gift row is now the single source of truth — same
                    rule we follow inside HoldingDetailSheet, where there's no
                    separate spotlight either. Multi-gift gifters always saw
                    only the rows; single-gift gifters now do too. */}

                {/* Bulk-thanks shortcut — only when 3+ unthanked gifts.
                    Routes to this gifter's Memory Book filter where the
                    parent can run through thanks at speed. Sits between
                    the header and the list so it's visible without
                    scrolling. */}
                {showBulkThanks && activeFundId && (
                  <div className="px-5 pt-3 pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        haptic("selection");
                        setSelectedGifter(null);
                        setLocation(`/memory/${activeFundId}?gifter=${encodeURIComponent(selectedGifter.name)}`);
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-full border border-[hsl(43,75%,55%/0.35)] bg-[hsl(43,75%,55%/0.10)] py-2 text-[12.5px] font-semibold text-[hsl(43,55%,30%)] hover:bg-[hsl(43,75%,55%/0.18)] transition-colors"
                      data-testid="button-bulk-thanks"
                    >
                      💌 Thank all {unthankedCount} unthanked →
                    </button>
                  </div>
                )}

                <div className="overflow-y-auto max-h-[40vh]">
                  {sortedGifts.map((g, i) => {
                    // Month/year subheader — when a gifter has many gifts,
                    // group them by month for scanability. Same pattern as
                    // Activity feed's day-level grouping. Compares this
                    // row's month to the previous row's month; renders a
                    // subheader on transitions. Skipped when only 5 or
                    // fewer gifts (no value-add for short lists).
                    const showMonthGroups = sortedGifts.length > 5;
                    const giftDateForGroup = g.createdAt ? new Date(String(g.createdAt)) : null;
                    const prevGiftForGroup = i > 0 ? sortedGifts[i - 1] : null;
                    const prevDateForGroup = prevGiftForGroup?.createdAt
                      ? new Date(String(prevGiftForGroup.createdAt))
                      : null;
                    const monthChanged = showMonthGroups && giftDateForGroup && (
                      !prevDateForGroup ||
                      giftDateForGroup.getUTCFullYear() !== prevDateForGroup.getUTCFullYear() ||
                      giftDateForGroup.getUTCMonth() !== prevDateForGroup.getUTCMonth()
                    );
                    const monthLabel = monthChanged && giftDateForGroup
                      ? giftDateForGroup.toLocaleDateString("en-US", {
                          month: "long",
                          year: giftDateForGroup.getUTCFullYear() !== new Date().getUTCFullYear() ? "numeric" : undefined,
                          timeZone: "UTC",
                        })
                      : null;
                    const netAmt = parseFloat(String(g.netAmount || g.amount || "0"));
                    const statusStr = String(g.status || "").toLowerCase();
                    const isSettled = statusStr === "settled";
                    const isPending = statusStr === "pending" || statusStr === "processing";
                    const isInvested = statusStr === "invested" || isSettled;
                    const gTicker = (g as any).selectedTicker as string | null | undefined;
                    const gExecModel = (g as any).executionModel as string | null | undefined;
                    const gHoldingName = gTicker
                      ? friendlyHoldingName(gTicker, holdings.find(h => h.ticker === gTicker)?.name)
                      : null;
                    // "Family mix" was internal language. Show the child's mix instead so
                    // the row reads warmly ("Emma's mix"). Falls back to "Recurring mix"
                    // when there's no name on file (avoids the locked "auto-invest" word).
                    const childMixLabel = recipientFirstNameDisplay
                      ? `${recipientFirstNameDisplay}'s mix`
                      : "Recurring mix";
                    const investLabel = gTicker
                      ? gTicker.toUpperCase()
                      : (gExecModel && String(gExecModel).toLowerCase().includes("family") ? childMixLabel : childMixLabel);
                    const eventName = g.eventId
                      ? (events.find(e => e.id === g.eventId)?.name ?? null)
                      : null;
                    const sharesAcquired = (g as any).sharesAcquired ? parseFloat(String((g as any).sharesAcquired)) : null;
                    const priceAtPurchase = (g as any).priceAtPurchase ? parseFloat(String((g as any).priceAtPurchase)) : null;
                    const investedAt = (g as any).investedAt ? new Date(String((g as any).investedAt)) : null;
                    const giftDate = new Date(String(g.createdAt || Date.now()));
                    const fullDate = giftDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
                    const investDate = investedAt?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
                    // Thank-you state for THIS specific gift. Three suppression cases:
                    //   - owner viewing their own gift (you don't thank yourself)
                    //   - anonymous senders (no identity to reach)
                    //   - any sender without an email (no way to deliver)
                    // Otherwise: sent / draft (awaiting) / missing record.
                    const giftThankYou = g.id ? dashboardThankYouByGiftId.get(String(g.id)) : null;
                    const giftIsAnonymous = displayGifterName(g.senderName, (g as any).isAnonymous) === "Anonymous";
                    const giftHasContactableSender = !giftIsAnonymous && !!String((g as any).senderEmail || "").trim();
                    const giftThankYouState: "sent" | "draft" | "missing" | "self" | "anonymous" =
                      isOwnerPopup
                        ? "self"
                        : giftIsAnonymous || !giftHasContactableSender
                          ? "anonymous"
                          : giftThankYou?.status === "sent"
                            ? "sent"
                            : giftThankYou
                              ? "draft"
                              : "missing";
                    const isLast = i === sortedGifts.length - 1;
                    // Whole row navigates to this specific gift — same
                    // scroll-and-highlight as the auto-invest "View →" path.
                    // Row stays a div (not a button) because it contains the
                    // thank-you pill buttons; we attach onClick here and the
                    // pills already stopPropagation.
                    //
                    // Destination follows the Three Surfaces principle —
                    // Memory Book is kid-domain (warm), Activity is parent-
                    // domain (ledger). Routing rule:
                    //   - Other gifters → Memory Book (?gift=) — every gift
                    //     from someone who loves the kid is a kid-domain
                    //     moment, even when the note is empty.
                    //   - Parent's own gift WITH a note → Memory Book — the
                    //     parent's note IS kid-domain content; sending them
                    //     to Activity would drop that warm context.
                    //   - Parent's own gift WITHOUT a note → Activity — pure
                    //     financial deposit, no moment to honor; Activity
                    //     gives them fees / settlement / payment id.
                    const navigateToThisGift = () => {
                      if (!g.id || !activeFundId) return;
                      haptic("selection");
                      setSelectedGifter(null);
                      const parentWroteNote = isOwnerPopup && !!String(g.message || "").trim();
                      const target = isOwnerPopup && !parentWroteNote
                        ? `/activity?filter=auto&highlight=${encodeURIComponent(String(g.id))}`
                        : `/memory/${activeFundId}?gift=${g.id}`;
                      setLocation(target);
                    };
                    const isFirstGiftRow = firstGiftIdInDialog && g.id && String(g.id) === firstGiftIdInDialog;
                    return (
                      <Fragment key={g.id || i}>
                        {monthLabel && (
                          <p
                            style={{
                              fontSize: 10.5,
                              fontWeight: 800,
                              letterSpacing: "0.07em",
                              textTransform: "uppercase",
                              color: "rgb(140,130,122)",
                              padding: i === 0 ? "12px 24px 4px" : "14px 24px 4px",
                              margin: 0,
                              borderTop: i === 0 ? "none" : "1px solid rgba(26,23,16,0.04)",
                              background: "rgba(26,23,16,0.015)",
                            }}
                            data-testid={`gifter-modal-month-${monthLabel.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            {monthLabel}
                          </p>
                        )}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={navigateToThisGift}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigateToThisGift(); } }}
                        data-testid={`gifter-modal-gift-row-${g.id || i}`}
                        style={{
                          padding: "16px 24px",
                          borderBottom: isLast ? "none" : "1px solid rgba(26,23,16,0.06)",
                          cursor: g.id ? "pointer" : "default",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => { if (g.id) e.currentTarget.style.background = "rgba(26,23,16,0.025)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        {/* First-gift ribbon — celebrates the
                            chronologically-earliest gift this gifter ever
                            sent. Tiny but iconic; renders only above the
                            row that earned it. Honors the design lens
                            (Emma at 18 looking back at "the first time
                            grandpa gave"). Mirrors the Activity History
                            tab's first-gift banner pattern. */}
                        {isFirstGiftRow && (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              fontSize: 9.5,
                              fontWeight: 800,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase" as const,
                              color: "rgb(146,108,46)",
                              background: "rgba(184,121,26,0.10)",
                              padding: "2px 7px",
                              borderRadius: 999,
                              marginBottom: 8,
                            }}
                            data-testid={`gifter-modal-first-gift-ribbon-${g.id}`}
                          >
                            <span style={{ fontSize: 11, lineHeight: 1 }}>🎁</span>
                            First gift
                          </div>
                        )}
                        {/* Amount + status row */}
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
                            {/* Real brand mark when this gift bought a specific
                                ticker. Same StockLogo + emoji-fallback chain
                                used in the holdings card and the contribution
                                modal — keeps the parent surface consistent
                                with brokerage convention (Robinhood / Apple
                                Stocks / Public all show the brand). Skipped
                                for managed-mix gifts where the "ticker" is
                                Emma's mix, not a single company. */}
                            {gTicker && (
                              <StockLogo ticker={gTicker} size={18} className="shrink-0" />
                            )}
                            <span style={{
                              fontSize: 10.5, fontWeight: 700,
                              color: gTicker ? "rgb(26,67,50)" : "rgb(120,110,100)",
                              background: gTicker ? "rgba(26,67,50,0.09)" : "rgba(26,23,16,0.06)",
                              borderRadius: 999, padding: "2px 8px",
                            }}>
                              {/* "✓" prefix removed — every entry in this list is
                                  by definition either invested OR shows a "🌱 Settling"
                                  pill alongside, so the checkmark was telling the parent
                                  what the absence-of-Settling already tells them. */}
                              {investLabel}
                            </span>
                            {gHoldingName && (
                              <span style={{ fontSize: 12, color: "rgb(80,72,64)", fontWeight: 500 }}>
                                {gHoldingName}
                              </span>
                            )}
                            {isPending && (
                              <span style={{ fontSize: 9.5, fontWeight: 700, background: "hsl(143,28%,94%)", color: "hsl(143,40%,30%)", padding: "1px 6px", borderRadius: 999 }}>
                                🌱 Settling
                              </span>
                            )}
                            {/* Per-gift recurring tag. Two signals trigger
                                it: (1) the gift carries `parentContributionId`
                                (the canonical signal — gift came from a
                                schedule fired by the recurring worker), or
                                (2) the gift's message is the legacy
                                "Auto-invest contribution to {fund}"
                                boilerplate. Reason for #2: gifts created
                                before the parentContributionId column was
                                wired into the gift-creation path don't
                                carry the canonical signal but DO carry the
                                boilerplate message — that string is the
                                only evidence those legacy rows came from a
                                schedule. Treating the boilerplate as a
                                fallback signal here means legacy recurring
                                gifts also light up correctly, AND it pairs
                                with the message-suppression below (the
                                badge replaces the boilerplate text — same
                                signal, cleaner shape). */}
                            {(() => {
                              const giftMessage = String(g.message || "").trim();
                              const isBoilerplateRecurring = /^auto-invest contribution to /i.test(giftMessage);
                              const isRecurringGift = !!(g as any).parentContributionId || isBoilerplateRecurring;
                              if (!isRecurringGift) return null;
                              return (
                                <span style={{ fontSize: 9.5, fontWeight: 700, background: "hsl(var(--kiddo-evergreen)/0.1)", color: "hsl(var(--kiddo-evergreen))", padding: "1px 6px", borderRadius: 999 }}>
                                  ↻ Recurring
                                </span>
                              );
                            })()}
                            {/* Per-gift thank-you status. Skipped for anonymous and contactless senders. */}
                            {giftThankYouState === "sent" && (
                              <span className="rounded-full" style={{ fontSize: 9.5, fontWeight: 700, background: "hsl(var(--kiddo-evergreen) / 0.09)", color: "hsl(var(--kiddo-evergreen))", padding: "1px 6px" }}>
                                ✓ Thanked
                              </span>
                            )}
                            {/* Thank-you pill is now tappable when actionable. Routes to
                                this gift's Memory Book entry where the composer already
                                lives — no separate inline composer to maintain. Skipped
                                for owner / anonymous / already-sent (handled above). */}
                            {giftThankYouState === "draft" && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!g.id || !activeFundId) return;
                                  haptic("selection");
                                  setSelectedGifter(null);
                                  setLocation(`/memory/${activeFundId}?gift=${g.id}`);
                                }}
                                data-testid={`button-thanks-draft-${g.id}`}
                                style={{
                                  fontSize: 9.5, fontWeight: 700,
                                  background: "hsl(43,75%,92%)", color: "hsl(43,55%,28%)",
                                  padding: "2px 7px", borderRadius: 999, border: "none",
                                  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3,
                                }}
                                title="Finish your draft thank-you in the Memory Book"
                              >
                                ⏳ Finish thank-you →
                              </button>
                            )}
                            {giftThankYouState === "missing" && isInvested && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!g.id || !activeFundId) return;
                                  haptic("selection");
                                  setSelectedGifter(null);
                                  setLocation(`/memory/${activeFundId}?gift=${g.id}`);
                                }}
                                data-testid={`button-thanks-missing-${g.id}`}
                                style={{
                                  fontSize: 9.5, fontWeight: 700,
                                  background: "hsl(var(--kiddo-evergreen) / 0.10)",
                                  color: "hsl(var(--kiddo-evergreen))",
                                  padding: "2px 7px", borderRadius: 999, border: "none",
                                  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3,
                                }}
                                title={`Send a thank-you to ${displayGifterName(g.senderName, (g as any).isAnonymous)}`}
                              >
                                💌 Send thank-you →
                              </button>
                            )}
                            {/* "✨ From you" pill removed — in this per-gifter detail modal
                                the user is viewing their own gift list (header reads "Parent
                                · N gifts · $X gifted"), so a "From you" pill on every row
                                is pure redundancy. The screen's own context already says it. */}
                          </div>
                          <p className="font-heading" style={{ fontSize: 16, fontWeight: 700, color: "rgb(26,23,16)", flexShrink: 0 }}>
                            {formatCurrency(Number.isFinite(netAmt) ? netAmt : 0)}
                          </p>
                        </div>

                        {/* Date + shares + price row */}
                        <div style={{ marginTop: 7, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "3px 10px" }}>
                          <span style={{ fontSize: 11.5, color: "rgb(120,110,100)", fontWeight: 500 }}>
                            Received {fullDate}
                          </span>
                          {investDate && investDate !== fullDate && (
                            <span style={{ fontSize: 11.5, color: "rgb(120,110,100)" }}>· Invested {investDate}</span>
                          )}
                          {eventName && (
                            <span style={{ fontSize: 11.5, color: "rgb(140,130,122)" }}>· {eventName}</span>
                          )}
                        </div>

                        {/* Today's value of THIS specific gift's slice.
                            Uses the giftAllocations-aware resolver so a
                            gift whose original ticker was sold and
                            rebalanced (e.g., SBUX → VTI) shows the value
                            of where the money actually IS today, not
                            stale original-ticker math. Reallocation hint
                            ("now in: VTI · VXUS") surfaces when the
                            money has moved tickers. */}
                        {(() => {
                          const resolved = computeGiftCurrentValue(g);
                          if (resolved.todayValue == null) return null;
                          const todayValue = resolved.todayValue;
                          const paid = Number.isFinite(netAmt) ? netAmt : 0;
                          const delta = todayValue - paid;
                          const showDelta = Math.abs(delta) >= 0.01 && paid > 0;
                          return (
                            <>
                              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "3px 8px" }}>
                                <span style={{ fontSize: 11.5, color: "rgb(100,90,82)", fontWeight: 600 }}>
                                  Now worth {formatCurrency(todayValue)}
                                </span>
                                {showDelta && (
                                  <span style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: delta >= 0 ? "rgb(22,128,67)" : "rgb(190,30,30)",
                                  }}>
                                    {delta >= 0 ? "+" : "−"}{formatCurrency(Math.abs(delta))} 🌱
                                  </span>
                                )}
                              </div>
                              {resolved.isReallocated && resolved.nowInLabel && (
                                <p style={{ marginTop: 3, fontSize: 10.5, color: "rgb(140,130,122)", lineHeight: 1.4 }}>
                                  Now in: {resolved.nowInLabel}
                                </p>
                              )}
                            </>
                          );
                        })()}

                        {isPending && (
                          <p style={{ marginTop: 6, fontSize: 11.5, color: "rgba(26,23,16,0.4)", lineHeight: 1.5 }}>
                            On its way to {recipientFirstNameDisplay || "the fund"}. Settles in 1–2 business days.
                          </p>
                        )}
                        {/* Suppress the legacy "Auto-invest contribution
                            to {fund}" boilerplate — that's a system-
                            generated string, not a parent's love letter,
                            and the ↻ Recurring chip above already carries
                            the signal that this gift came from a schedule.
                            Same allowlist used by the Memory Book +
                            Activity render filters; single rule across
                            all surfaces. Test-pattern messages get the
                            same treatment. Real notes still render. */}
                        {(() => {
                          const giftMessage = String(g.message || "").trim();
                          if (!giftMessage) return null;
                          if (/^auto-invest contribution to /i.test(giftMessage)) return null;
                          if (/^(test|testing|tstgin|tstng|qqqqq|tester)\b/i.test(giftMessage)) return null;
                          return (
                            <p style={{ marginTop: 7, fontSize: 12.5, fontStyle: "italic", color: "rgba(26,23,16,0.52)", lineHeight: 1.5 }}>
                              &ldquo;{giftMessage}&rdquo;
                            </p>
                          );
                        })()}
                      </div>
                      </Fragment>
                    );
                  })}
                </div>
                <div style={{ height: 1, background: "rgba(26,23,16,0.07)" }} />
                <div className="px-5 py-4 space-y-2.5">
                  {/* Footer CTA differentiates parent vs gifter contexts:
                      - Parent's own gifts: route to Activity (where parent contributions
                        actually live as a ledger) — "Memory Book story" implies a rich
                        gifter narrative that doesn't apply to self-gifts.
                      - Other gifters: keep the Memory Book route — that's where their
                        notes, photos, and gift moments live.
                      "Share again" was ambiguous; replaced with a specific child-named
                      gift-link CTA so the action is unmistakable. */}
                  {isOwnerPopup ? (
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-2 rounded-full border border-[hsl(var(--kiddo-evergreen)/0.3)] bg-[hsl(var(--kiddo-evergreen)/0.06)] py-2.5 text-[13px] font-semibold text-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen)/0.12)] transition-colors"
                      onClick={() => {
                        haptic("selection");
                        setSelectedGifter(null);
                        // Parent's own contributions live under the "auto"
                        // category in Activity (auto_invest + parent_contribution).
                        // Land on that filter AND highlight the most recent
                        // contribution so the user has a "you are here" anchor
                        // when arriving — same scroll/highlight pattern as
                        // every other deep-link in the app.
                        const mostRecentGiftId = sortedGifts[0]?.id;
                        const target = mostRecentGiftId
                          ? `/activity?filter=auto&highlight=${encodeURIComponent(String(mostRecentGiftId))}`
                          : "/activity?filter=auto";
                        setLocation(target);
                      }}
                      data-testid="button-gifter-modal-view-activity"
                    >
                      View all your contributions in Activity →
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-2 rounded-full border border-[hsl(var(--kiddo-evergreen)/0.3)] bg-[hsl(var(--kiddo-evergreen)/0.06)] py-2.5 text-[13px] font-semibold text-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen)/0.12)] transition-colors"
                      onClick={() => {
                        haptic("selection");
                        setSelectedGifter(null);
                        setLocation(`/memory/${activeFundId}?gifter=${encodeURIComponent(selectedGifter.name)}`);
                      }}
                      data-testid="button-gifter-modal-memory-book"
                    >
                      See {selectedGifter.name.split(" ")[0]}'s story in Memory Book →
                    </button>
                  )}
                  {!isReadOnlyFund && (
                    <Button
                      className="w-full kiddo-gold-button rounded-full"
                      onClick={() => { setSelectedGifter(null); handleShareLink(); }}
                      data-testid="button-gifter-modal-share-gift-link"
                    >
                      <Share2 size={14} className="mr-2" />
                      Share {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "the"} gift link
                    </Button>
                  )}
                </div>
              </>
            );
          })())}
        </SheetContent>
      </Sheet>

      {/* "Add $X" from a recurring schedule card → optional Memory Book note → Stripe.
          Mirrors the one-time modal's note pattern, just lighter (one screen) since
          the amount/method are already locked by the parent's existing schedule. */}
      <Dialog
        open={!!addFromScheduleSheet}
        onOpenChange={(v) => { if (!v && !contributingNow) setAddFromScheduleSheet(null); }}
      >
        <DialogContent className="max-w-md w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Add to fund</DialogTitle>
          <div className="p-6 space-y-5">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Adding to {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s fund` : "the fund"}
              </p>
              <h2 className="font-heading text-2xl font-semibold text-foreground">
                {formatCurrency(parseFloat(addFromScheduleSheet?.amount || "0"))}
              </h2>
            </div>

            <div className="rounded-2xl border border-amber-200/60 bg-amber-50/40 p-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">
                Leave a note for the Memory Book
              </p>
              <p className="text-xs text-muted-foreground -mt-1">
                {/* Pronoun-aware reads-on-18 helper. Mirrors the same line
                    in the one-time-amount sheet — same copy, same pattern. */}
                {recipientFirstNameDisplay
                  ? `${recipientFirstNameDisplay} reads it on ${childPronouns.possAdj} ${majorityOrdinal} birthday.`
                  : `${capFirst(childPronouns.subject)}'ll read it when ${childPronouns.subject} ${childPronouns.singular ? "is" : "are"} 18.`}{" "}
                Optional, but it matters.
              </p>
              <textarea
                value={addFromScheduleNote}
                onChange={(e) => setAddFromScheduleNote(e.target.value.slice(0, 240))}
                placeholder={noteFlowPlaceholder("add-now")}
                rows={3}
                className="w-full rounded-xl border border-amber-200/40 bg-white/80 px-3 py-2.5 text-sm resize-none placeholder:text-amber-700/40 focus:outline-none focus:ring-1 focus:ring-primary"
                data-testid="textarea-add-from-schedule-note"
              />
              <p className="text-[10px] text-muted-foreground text-right">{addFromScheduleNote.length}/240</p>
              {/* Photo / video / voice trio for the contribute-now flow.
                  Same composer as the one-time and recurring flows so the
                  parent learns the pattern once. */}
              {activeFundId && (
                <MemoryMediaPicker
                  fundId={activeFundId}
                  value={addFromScheduleMedia}
                  onChange={setAddFromScheduleMedia}
                  childName={recipientFirstNameDisplay}
                  pronoun={(activeFund as any)?.pronoun}
                  majorityAge={(activeFund as any)?.majorityAge}
                  requiresPlus={!hasAutoInvestAccess}
                  className="mt-1"
                />
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setAddFromScheduleSheet(null)}
                disabled={contributingNow}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-full"
                disabled={contributingNow}
                onClick={() => {
                  if (!addFromScheduleSheet) return;
                  const planId = addFromScheduleSheet.planId;
                  const note = addFromScheduleNote;
                  const media = addFromScheduleMedia;
                  setAddFromScheduleSheet(null);
                  setAddFromScheduleNote("");
                  setAddFromScheduleMedia(EMPTY_MEMORY_MEDIA);
                  void handleContributeNow(planId, note, media);
                }}
                data-testid="button-add-from-schedule-confirm"
              >
                {contributingNow ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Add {formatCurrency(parseFloat(addFromScheduleSheet?.amount || "0"))}{recipientFirstNameDisplay ? ` to ${recipientFirstNameDisplay}` : ""}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Suspense fallback={null}>
        <HoldingDetailSheet
          holding={selectedHolding}
          onClose={() => setSelectedHolding(null)}
          recipientName={recipientFirstNameDisplay || undefined}
          totalPortfolioValue={totalValue}
          gifts={gifts}
          giftAllocations={giftAllocations}
          thankYousByGiftId={dashboardThankYouByGiftId}
          ownerEmail={user?.email || null}
          isReadOnly={isReadOnlyFund}
          isManagedMix={selectedHolding ? managedStrategyTickerSet.has(String(selectedHolding.ticker || "").toUpperCase()) : false}
          strategyLabel={strategyLabelFor((activeFund as any)?.investmentStrategy, recipientFirstNameDisplay)}
          onAddToStrategy={() => {
            // Managed-mix add: spread across all strategy ETFs per ratio.
            // executionModel "auto" tells the contribute pipeline to honor
            // the strategy weights instead of locking funds to one ticker.
            setOneTimeAmount("50");
            setOneTimeStep("amount");
            setOneTimeExecutionModel("auto");
            setOneTimeTicker("");
            setOneTimePaymentMethod("apple_pay");
            setOneTimeMemoryNote("");
            setOneTimeNoteSaved(false);
            setOneTimeModalOpen(true);
          }}
          onAdjustStrategy={() => {
            setLocation("/settings?tab=money#investment-strategy");
          }}
          onAddMore={(ticker) => {
            if (uninvestedCash > 0) {
              setInvestCashInitialTicker(ticker);
              setInvestCashOpen(true);
              return;
            }
            setOneTimeAmount("50");
            setOneTimeStep("amount");
            setOneTimeExecutionModel("pick");
            setOneTimeTicker(ticker);
            setOneTimePaymentMethod("apple_pay");
            setOneTimeMemoryNote("");
            setOneTimeNoteSaved(false);
            setOneTimeModalOpen(true);
          }}
          onSell={(holding) => {
            // Defensive: with the managed-mix branch removing the per-ETF
            // sell button, this path should only fire for picks. Keep the
            // managed-mix warning as a net in case a deep-link or other
            // entry point ever reaches here with a strategy ticker.
            const ticker = String(holding.ticker || "").toUpperCase();
            if (managedStrategyTickerSet.has(ticker)) {
              setSelectedHolding(null);
              setManagedSellWarning(holding);
            } else {
              setSellingHolding(holding);
              setSellShares("");
            }
          }}
          onNavigateToGift={(giftId: string) => {
            setSelectedHolding(null);
            setLocation(`/memory/${activeFundId}?gift=${giftId}`);
          }}
          onNavigateToGifter={(name: string) => {
            setSelectedHolding(null);
            // Empty name = "open unfiltered" path used by the Anonymous-multi-gift fallback
            // in HoldingDetailSheet. Drop the query param so MemoryBook lands on the full view.
            const trimmed = name.trim();
            setLocation(
              trimmed
                ? `/memory/${activeFundId}?gifter=${encodeURIComponent(trimmed)}`
                : `/memory/${activeFundId}`,
            );
          }}
        />
      </Suspense>

      <EventGateModal
        open={eventGateOpen}
        onClose={() => setEventGateOpen(false)}
      />


      {/* (Removed 2026-05-15: an "Invite more people sheet" used to
          live here, conditionally rendered on inviteSheetOpen. The
          sheet had complete UI — share button, copy-link button,
          per-occasion buttons — but `setInviteSheetOpen(true)` had
          ZERO call sites anywhere in the codebase. Found during the
          transferred-fund write-CTA gating sweep on the same day.
          The canonical Share surface is the global ShareModal opened
          via handleShareLink(); this sheet was a parallel design
          that never got wired up. Deletion preserves no behavior
          change — nothing could open it. ~105 lines removed.) */}

      <CreateEventSheet
        open={createEventSheetOpen}
        onClose={() => { setCreateEventSheetOpen(false); setEditEventTarget(null); }}
        fundId={activeFundId}
        fundName={recipientFirstNameDisplay || activeFund?.name}
        fundSlug={(activeFund as any)?.slug}
        childPhotoUrl={(activeFund as any)?.childPhotoUrl || undefined}
        investPrefs={dashboardSummary?.investmentPreferences || undefined}
        editEvent={editEventTarget}
      />


      {activeFund && (
        <CollaboratorInviteModal
          isOpen={collabModalOpen}
          onClose={() => setCollabModalOpen(false)}
          fundName={activeFund.name || "your fund"}
          onSendInvite={async (email, role) => {
            try {
              const res = await fetch(`/api/funds/${activeFundId}/collaborators`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, role }),
              });
              if (res.ok) {
                haptic("success");
                toast({ title: "Invite sent!", description: `${email} has been invited as ${role}` });
              } else {
                const data = await res.json();
                toast({ title: "Could not send invite", description: data.error || "Please try again", variant: "destructive" });
              }
            } catch {
              toast({ title: "Could not send invite", description: "Please try again", variant: "destructive" });
            }
          }}
        />
      )}

      {activeFund && (() => {
        const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const history30DaysAgo = [...fundHistory]
          .filter(h => new Date(h.snapshotDate).getTime() <= thirtyDaysAgoMs)
          .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime())[0];
        const fundMonthReturnPct = history30DaysAgo && totalValue > 0
          ? ((totalValue - parseFloat(history30DaysAgo.totalValue || "0")) / Math.max(0.01, parseFloat(history30DaysAgo.totalValue || "0"))) * 100
          : undefined;
        const fundAgeYears = activeFund.createdAt
          ? (Date.now() - new Date(activeFund.createdAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
          : undefined;
        return (
          <InvestCashModal
            open={investCashOpen}
            onClose={() => setInvestCashOpen(false)}
            onSuccess={invalidateActiveFundFreshness}
            cashAmount={uninvestedCash}
            childName={recipientFirstNameDisplay || activeFund.name || "your child"}
            fundId={String(activeFundId)}
            cashContext={cashContext}
            initialTicker={investCashInitialTicker || undefined}
            fundAllTimeReturnPct={displayGainPct || undefined}
            fundMonthReturnPct={fundMonthReturnPct}
            fundAgeYears={fundAgeYears}
          />
        );
      })()}

      {/* Parent one-time contribution success — twin of the recurring "done"
          step. Both flows now land on the same locked confirmation pattern
          (sprout + "[Child]'s fund is growing." + tagline). This dialog opens
          when the parent returns from Stripe with ?parentContrib=1 — see the
          effect at the top of the component. Kept compact (max-w-sm vs the
          configure modal's max-w-md) so it reads as a confirmation, not a
          re-engagement surface. */}
      <Dialog open={parentContribDoneOpen} onOpenChange={(v) => { if (!v) setParentContribDoneOpen(false); }}>
        <DialogContent className="max-w-sm w-[95vw] rounded-2xl p-6" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Investment sent</DialogTitle>
          <div className="text-center space-y-4 py-2">
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.05 }}
              className="w-16 h-16 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.12)] flex items-center justify-center mx-auto text-3xl"
              aria-hidden="true"
            >
              🌱
            </motion.div>
            <div>
              <h2 className="font-heading text-xl font-semibold text-foreground">
                {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s fund is growing.` : "Your gift is on its way."}
              </h2>
              {/* Was: "Lands as soon as your bank clears it." That copy
                  was ACH-specific — flat-out wrong for the card / Apple
                  Pay / Google Pay / Cash App paths Stripe actually uses
                  for these contributions, all of which settle in seconds.
                  Universal payment-method-agnostic phrasing keeps it
                  honest regardless of how the user paid. */}
              <p className="text-sm text-muted-foreground mt-2">
                {recipientFirstNameDisplay
                  ? `It'll show up in ${recipientFirstNameDisplay}'s fund any moment now.`
                  : "It'll show up in the fund any moment now."}
              </p>
              <p className="text-[11px] text-[hsl(var(--kiddo-evergreen))]/75 mt-3 font-medium">
                Powered by Kiddo · gifts that actually last 🌱
              </p>
            </div>
            <Button
              className="w-full rounded-full bg-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen))]/90 text-white"
              onClick={() => setParentContribDoneOpen(false)}
              data-testid="button-parent-contrib-done"
            >
              Done
            </Button>
            {/* Secondary text link mirrors the recurring done's "Add a gift
                now" pattern — same Done + text-link two-tier shape so the
                two confirmation moments feel like siblings.
                Memory Book is the destination because the parent's gift IS
                kid-domain content (the gift, the optional note, the brand
                logo, "now worth $X" delta later when the position settles).
                Even if the just-created gift isn't in the cache yet at tap
                time, MemoryBook's own deep-link effect polls for up to 6s,
                AND the page renders newest-first so the parent's gift is at
                the top regardless. No risk of "lands on nothing." */}
            {activeFundId && (
              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  setParentContribDoneOpen(false);
                  setLocation(`/memory/${activeFundId}`);
                }}
                data-testid="button-parent-contrib-view-memory"
              >
                View in Memory Book →
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Auto-invest upgrade modal — Plus paywall with personalized projection.
          Replaces a blind redirect to /pricing. The modal grounds the upgrade
          in THIS kid's actual time horizon ($X today + $25/mo for N years at
          7% = $Y at 18) so the parent sees what Plus actually unlocks for
          their fund, not generic feature copy. */}
      <Dialog open={autoInvestUpgradeOpen} onOpenChange={(open) => { if (!open) setAutoInvestUpgradeOpen(false); }}>
        <DialogContent className="max-w-md w-[95vw] rounded-2xl p-0 overflow-hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Upgrade to Kiddo+</DialogTitle>
          {(() => {
            const child = recipientFirstNameDisplay || "your child";
            const monthly = 25;
            const yearsLeft = age18Transition?.daysUntil18 ? age18Transition.daysUntil18 / 365.25 : null;
            // Same 7% real-return assumption used everywhere (Age18Plan,
            // recurring projection, cancel-flow loss-aversion). One number,
            // one disclaimer line, no greenwashing.
            const projectAtMajority = (start: number, years: number, monthlyContrib: number): number => {
              if (years <= 0) return start;
              const r = 0.07;
              const grown = start * Math.pow(1 + r, years);
              const months = years * 12;
              const monthRate = r / 12;
              const contribFV = monthlyContrib > 0 ? monthlyContrib * ((Math.pow(1 + monthRate, months) - 1) / monthRate) : 0;
              return Math.round(grown + contribFV);
            };
            const futureWith = yearsLeft && yearsLeft > 0 ? projectAtMajority(totalValue, yearsLeft, monthly) : null;
            const futureWithout = yearsLeft && yearsLeft > 0 ? projectAtMajority(totalValue, yearsLeft, 0) : null;
            const delta = futureWith !== null && futureWithout !== null ? futureWith - futureWithout : null;
            const fmt = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
            const yearsLabel = yearsLeft && yearsLeft >= 1 ? `${Math.round(yearsLeft)} year${Math.round(yearsLeft) === 1 ? "" : "s"}` : null;

            return (
              <div className="p-6 space-y-5">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[hsl(var(--kiddo-evergreen))]">
                    Recurring investments are a Plus feature
                  </p>
                  <h2 className="font-heading text-2xl font-semibold text-foreground leading-snug">
                    Set $25 a month. Watch what {yearsLabel || "the time"} can do.
                  </h2>
                </div>

                {delta !== null && futureWith !== null && yearsLabel ? (
                  <div className="rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.15)] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-4 space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-xs font-semibold text-foreground">{child}'s fund at {majorityAge}</p>
                      <p className="font-heading text-2xl font-bold text-[hsl(var(--kiddo-evergreen))] tabular-nums">
                        {fmt(futureWith)}
                      </p>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                      <span>+ added by $25/mo recurring</span>
                      <span className="font-semibold text-foreground tabular-nums">+{fmt(delta)}</span>
                    </div>
                    <p className="pt-1 text-[10px] leading-snug text-muted-foreground/70">
                      Starting from {fmt(totalValue)}, {yearsLabel} of compounding at 7% yearly average. Markets vary. Time is what compounds.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.15)] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-4">
                    <p className="text-sm text-foreground leading-relaxed">
                      Set a monthly amount and {child}'s fund grows on autopilot. Cancel any time.
                    </p>
                  </div>
                )}

                <div className="space-y-2 text-xs text-muted-foreground">
                  <p className="text-foreground font-semibold">Plus also includes:</p>
                  <ul className="space-y-1 pl-1">
                    <li>· Add your own photos, videos, and voice to Memory Book entries</li>
                    <li>· Custom fund mix (pick your own stocks and weights)</li>
                    <li>· Co-parent access for a partner or guardian</li>
                    <li>· 3 active occasions at a time, priority support</li>
                  </ul>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Kiddo+</p>
                    <p className="text-[11px] text-muted-foreground">$4.99/month or $39/year. Cancel any time.</p>
                  </div>
                </div>

                {/* Primary + secondary CTA shape per
                    IN_APP_UPGRADE_FEATURE_WALL_SPEC.md. Primary
                    routes to the Settings membership tab with the
                    auto-trigger query params so the Stripe upgrade
                    fires for THIS fund the moment Settings mounts.
                    Previous behavior routed to /pricing which is a
                    full tier-comparison matrix, asking the parent to
                    re-evaluate the entire decision when they were
                    trying to do one specific thing. The contextual
                    upgrade flow converts at the locked 3-8x rate of
                    generic 'see pricing' links per the spec. */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => { haptic("selection"); setAutoInvestUpgradeOpen(false); }}
                  >
                    Not now
                  </Button>
                  <Button
                    className="flex-1 rounded-full bg-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen))]/90 text-white"
                    onClick={() => {
                      haptic("medium");
                      setAutoInvestUpgradeOpen(false);
                      const fundId = activeFund?.id || "";
                      // Routes to Account "Plan & billing" tab per the
                      // 2026-05-14 WHO/HOW IA principle Phase 1b: Account
                      // is the primary home of plan management. Auto-
                      // trigger handler on Account fires Stripe checkout
                      // when ?upgrade=starter&fundId=X is present.
                      setLocation(fundId
                        ? `/account?tab=plan&upgrade=starter&fundId=${encodeURIComponent(fundId)}`
                        : "/account?tab=plan");
                    }}
                    data-testid="button-auto-invest-upgrade-confirm"
                  >
                    Upgrade to Plus
                  </Button>
                </div>
                <div className="-mt-2 text-center">
                  <button
                    type="button"
                    onClick={() => { haptic("light"); setAutoInvestUpgradeOpen(false); setLocation("/pricing"); }}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
                    data-testid="button-auto-invest-upgrade-see-all"
                  >
                    See all Plus features
                  </button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Auto-invest modal */}
      <Dialog open={autoInvestModalOpen} onOpenChange={(open) => { if (!open) { setAutoInvestModalOpen(false); setAutoInvestStep("amount"); setLastSavedContribId(null); setAutoInvestMedia(EMPTY_MEMORY_MEDIA); } }}>
        <DialogContent className="max-w-md w-[95vw] rounded-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Recurring investment settings</DialogTitle>

          {/* Step progress dots */}
          {autoInvestStep !== "done" && autoInvestStep !== "note" && (
            <div className="flex items-center justify-center gap-2 pt-5 pb-0 shrink-0">
              {(["amount", "target", "bank", "legal"] as const).map((s) => (
                <div
                  key={s}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    s === autoInvestStep
                      ? "w-7 bg-[hsl(var(--kiddo-evergreen))]"
                      : "w-2 bg-[hsl(var(--kiddo-evergreen)/0.18)]"
                  }`}
                />
              ))}
            </div>
          )}

          <div className="px-6 pt-4 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.09)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--kiddo-evergreen))]">
              <span className="text-[10px]">🔁</span> Recurring investment
            </span>
          </div>

          <div className="p-6 pt-3 space-y-5 overflow-y-auto flex-1 min-h-0">

            {/* STEP 1: Amount & frequency */}
            {autoInvestStep === "amount" && (() => {
              // Edit mode anchor: when the parent is editing an existing schedule
              // (rather than creating a new one), they need to see what they're
              // changing FROM, not just what they're setting it TO. Otherwise the
              // form looks identical to a fresh setup and the parent has to do
              // mental math against memory.
              const editingContrib = editingContribId
                ? parentContributions.find(c => c.id === editingContribId)
                : null;
              const isEditing = !!editingContrib;
              const prevAmount = editingContrib ? parseFloat(String(editingContrib.amount || "0")) : 0;
              const prevFreq = editingContrib ? String(editingContrib.frequency || "monthly") : "monthly";
              const prevPeriodsPerYear = prevFreq === "daily" ? 365 : prevFreq === "weekly" ? 52 : prevFreq === "yearly" ? 1 : 12;
              const prevAnnualized = prevAmount * prevPeriodsPerYear;
              const freqWord = (f: string) => f === "daily" ? "day" : f === "weekly" ? "week" : f === "yearly" ? "year" : "month";
              return (
              <>
                <div>
                  <h2 className="font-heading text-xl font-semibold text-foreground">
                    {isEditing
                      ? "Edit your recurring investment"
                      : recipientFirstNameDisplay ? `Grow ${recipientFirstNameDisplay}'s fund automatically` : "Grow automatically"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {isEditing
                      ? `Currently ${formatCurrency(prevAmount)}/${freqWord(prevFreq)} (${formatCurrency(prevAnnualized)}/yr). Adjust below. Change or cancel anytime.`
                      : "Set it once. Add to the fund on a schedule you control. Change or cancel anytime."}
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-foreground">Amount per gift</label>
                    <div className="relative mt-2">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={autoInvestAmount}
                        onChange={(e) => setAutoInvestAmount(e.target.value)}
                        placeholder="25"
                        className="h-12 w-full rounded-2xl border border-border bg-background pl-8 pr-4 text-sm"
                        data-testid="input-auto-invest-amount"
                      />
                    </div>
                    <div className="mt-2 flex gap-2">
                      {[10, 25, 50, 100].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setAutoInvestAmount(String(amt))}
                          className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                            autoInvestAmount === String(amt)
                              ? "border-primary text-primary bg-primary/10"
                              : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Frequency</label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(["daily", "weekly", "monthly", "yearly"] as const).map((freq) => (
                        <button
                          key={freq}
                          type="button"
                          onClick={() => setAutoInvestFrequency(freq)}
                          className={`h-11 rounded-xl border text-sm font-medium transition-colors ${
                            autoInvestFrequency === freq
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                          data-testid={`button-frequency-${freq}`}
                        >
                          {freq === "daily" ? "Daily" : freq === "weekly" ? "Weekly" : freq === "monthly" ? "Monthly" : "Yearly"}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">$5 minimum per gift</p>
                  </div>
                </div>

                {autoInvestAmount && parseFloat(autoInvestAmount) >= 5 && (() => {
                  const amt = parseFloat(autoInvestAmount);
                  const periodsPerYear = autoInvestFrequency === "daily" ? 365 : autoInvestFrequency === "weekly" ? 52 : autoInvestFrequency === "yearly" ? 1 : 12;
                  const monthly = amt * (periodsPerYear / 12);
                  // Future value of an annuity at 7% annual return, compounded monthly,
                  // running until the child turns 18. The 7% assumption is intentionally
                  // conservative (long-run S&P avg is ~10% nominal / ~7% real) and the
                  // disclaimer is non-negotiable: parents who later reconcile the projection
                  // against reality should never feel oversold. Honest losses, honest gains.
                  const monthsTo18 = age18Transition?.daysUntil18 ? Math.max(0, age18Transition.daysUntil18 / 30.4375) : null;
                  const r = 0.07 / 12;
                  const fvOf = (m: number) => monthsTo18 && monthsTo18 > 0
                    ? m * ((Math.pow(1 + r, monthsTo18) - 1) / r)
                    : null;
                  const fv = fvOf(monthly);
                  const fmt0 = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n));
                  const childPossessive = recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "their";
                  const childFirst = recipientFirstNameDisplay || "them";
                  const showProjection = fv !== null && fv > amt * 1.5; // skip if barely above the principal — no story to tell

                  // Edit-mode delta: when amount or frequency differs from the existing
                  // schedule, show before → after as a true diff arrow — monthly, yearly,
                  // and the 18-year FV. The FV diff is the behavioral lever: "+$10,800
                  // more for Emma at 18" is the number that makes a $25→$50 bump feel like
                  // a no-brainer instead of a $25/mo expense.
                  const valuesChanged = isEditing && (amt !== prevAmount || autoInvestFrequency !== prevFreq);
                  const annualDelta = (amt * periodsPerYear) - prevAnnualized;
                  const prevMonthly = prevAmount * (prevPeriodsPerYear / 12);
                  const prevFv = fvOf(prevMonthly);
                  const fvDelta = (fv !== null && prevFv !== null) ? fv - prevFv : null;
                  return (
                    <div className="rounded-xl bg-green-500/8 border border-green-200/40 p-3 space-y-2">
                      {valuesChanged ? (
                        <>
                          <div className="grid grid-cols-[auto_auto_1fr] gap-x-2 gap-y-1 text-[12px] items-baseline">
                            <span className="text-green-800/55">Was</span>
                            <span className="text-green-800/75 tabular-nums">{formatCurrency(prevAmount)}/{freqWord(prevFreq)}</span>
                            <span className="text-green-800/55 text-[11px]">· {formatCurrency(prevAnnualized)}/yr</span>
                            <span className="text-green-800/55">Now</span>
                            <span className="text-green-800 font-semibold tabular-nums">{formatCurrency(amt)}/{freqWord(autoInvestFrequency)}</span>
                            <span className="text-green-800/70 text-[11px]">
                              · {formatCurrency(amt * periodsPerYear)}/yr
                              {annualDelta !== 0 && (
                                <span className={`ml-1 font-medium ${annualDelta > 0 ? "text-green-700" : "text-amber-700"}`}>
                                  ({annualDelta > 0 ? "+" : ""}{formatCurrency(annualDelta)})
                                </span>
                              )}
                            </span>
                          </div>
                          {showProjection && prevFv !== null && fv !== null && Math.abs((fvDelta ?? 0)) >= 50 && (
                            <div className="pt-1.5 border-t border-green-200/40 space-y-1">
                              <p className="text-[12px] text-green-800/85 leading-relaxed">
                                By {childPossessive} 18th: <span className="line-through text-green-800/45">{fmt0(prevFv)}</span>
                                {" → "}
                                <span className="font-semibold">{fmt0(fv)}</span>
                              </p>
                              <p className={`text-[12px] font-semibold leading-relaxed ${(fvDelta ?? 0) >= 0 ? "text-green-700" : "text-amber-700"}`}>
                                {(fvDelta ?? 0) >= 0 ? "+" : ""}{fmt0(Math.abs(fvDelta ?? 0))} {(fvDelta ?? 0) >= 0 ? `more for ${childFirst} at ${majorityAge}` : `less for ${childFirst} at ${majorityAge}`}<span className="text-green-800/55 font-normal">*</span>
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-green-800">
                            {formatCurrency(amt)}/{freqWord(autoInvestFrequency)} ·{" "}
                            {formatCurrency(amt * periodsPerYear)}/yr
                            {recipientFirstNameDisplay ? ` into ${recipientFirstNameDisplay}'s fund` : ""}
                          </p>
                          {showProjection && (
                            <p className="text-xs text-green-800/85 leading-relaxed">
                              → roughly {fmt0(fv)} by {childPossessive} {majorityOrdinal} birthday<span className="text-green-800/55">*</span>
                            </p>
                          )}
                        </>
                      )}
                      {showProjection && (
                        <p className="text-[10px] text-green-800/45 leading-snug pt-0.5">
                          *Assuming a 7% yearly average. Markets vary. Time is what compounds.
                        </p>
                      )}
                    </div>
                  );
                })()}

                <Button
                  className="w-full rounded-full"
                  disabled={!autoInvestAmount || parseFloat(autoInvestAmount) < 5}
                  onClick={() => setAutoInvestStep("target")}
                  data-testid="button-auto-invest-next-target"
                >
                  {isEditing ? "Review changes" : "Continue"}
                </Button>
              </>
              );
            })()}

            {/* STEP 2: Investment target */}
            {autoInvestStep === "target" && (
              <>
                <div>
                  <h2 className="font-heading text-xl font-semibold text-foreground">
                    Where should it go?
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Each gift goes into what you choose. You can change this anytime.
                  </p>
                </div>

                <div className="space-y-2">
                  {/* Auto option */}
                  <button
                    type="button"
                    onClick={() => { setAutoInvestExecutionModel("auto"); setAutoInvestTicker(""); }}
                    className={`w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                      autoInvestExecutionModel === "auto"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2l1.8 5.4H17l-4.2 3.1 1.6 5-4.4-3.2L5.6 15.5l1.6-5L3 7.4h5.2z" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinejoin="round" fill="hsl(var(--primary)/0.15)"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Fund default</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {investPrefs?.defaultMode === "stock" && investPrefs?.defaultTicker
                          ? `Buys ${investPrefs.defaultTicker} shares automatically`
                          : investPrefs?.defaultMode === "cash"
                            ? "Contributions held as cash"
                            : investPrefs?.managedStrategy === "balanced"
                              ? "Balanced stock and bond mix"
                              : investPrefs?.managedStrategy === "conservative"
                                ? "Capital preservation mix"
                                : "Diversified growth portfolio"}
                      </p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
                      autoInvestExecutionModel === "auto" ? "border-primary bg-primary" : "border-border"
                    }`} />
                  </button>

                  {/* Fund default peek - visible when "auto" is selected */}
                  {autoInvestExecutionModel === "auto" && (() => {
                    const mode = investPrefs?.defaultMode ?? "managed";
                    const defaultTicker = investPrefs?.defaultTicker;

                    if (mode === "stock" && defaultTicker) {
                      const stockMeta = quotedAutoInvestStocks.find(s => s.symbol === defaultTicker);
                      return (
                        <div className="rounded-xl border border-[hsl(var(--kiddo-evergreen)/0.3)] bg-[hsl(var(--kiddo-evergreen)/0.05)] p-3 flex items-center gap-3">
                          <StockLogo ticker={defaultTicker} size={28} className="shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{stockMeta?.name ?? defaultTicker}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{stockMeta?.tagline ?? "Your chosen default stock"}</p>
                          </div>
                        </div>
                      );
                    }

                    if (mode === "cash") {
                      return (
                        <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-3">
                          <div className="text-2xl shrink-0">💵</div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">Held as cash</p>
                            <p className="text-[11px] text-muted-foreground">Money sits as cash until you manually invest it</p>
                          </div>
                        </div>
                      );
                    }

                    const strategy = investPrefs?.managedStrategy ?? "growth";
                    const isBalanced = strategy === "balanced";
                    const isCustom = strategy === "custom";
                    const isConservative = strategy === "conservative";
                    const presetAllocations = MANAGED_STRATEGY_ALLOCATIONS[strategy] ?? MANAGED_STRATEGY_ALLOCATIONS.growth;
                    const customAllocations: Array<{ ticker: string; name: string; weight: number }> = isCustom && fundStrategy?.customAllocations
                      ? Object.entries(fundStrategy.customAllocations)
                          .map(([ticker, w]) => {
                            const opt = (["VTI","VXUS","BND","VGT","DIS","AAPL","NKE","TSLA","NFLX","RBLX","SBUX","AMZN"] as const);
                            const names: Record<string, string> = { VTI:"US Total Market",VXUS:"International",BND:"Bonds",VGT:"Tech",DIS:"Disney",AAPL:"Apple",NKE:"Nike",TSLA:"Tesla",NFLX:"Netflix",RBLX:"Roblox",SBUX:"Starbucks",AMZN:"Amazon" };
                            return { ticker, name: names[ticker] ?? ticker, weight: Math.round(Number(w) * 100) };
                          })
                          .filter(a => a.weight > 0)
                          .sort((a, b) => b.weight - a.weight)
                      : [];
                    const allocations = isCustom ? customAllocations : presetAllocations;
                    return (
                      <div className="rounded-xl border border-[hsl(var(--kiddo-evergreen)/0.2)] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-3 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{STRATEGY_META[strategy]?.emoji ?? STRATEGY_META.growth.emoji}</span>
                          <p className="text-sm font-semibold text-foreground">
                            {isCustom ? "Custom mix" : isBalanced ? "Steady & Balanced" : isConservative ? "Conservative Mix" : "Growth Mix"}
                          </p>
                        </div>
                        {allocations.length > 0 ? (
                          <div className="grid grid-cols-2 gap-1.5">
                            {allocations.map((a) => (
                              <div key={a.ticker} className="flex items-center gap-2 rounded-lg bg-background/70 border border-border/50 px-2.5 py-1.5">
                                <StockLogo ticker={a.ticker} size={20} />
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold text-foreground">{a.ticker} <span className="text-[hsl(var(--kiddo-evergreen))]">{a.weight}%</span></p>
                                  <p className="text-[9px] text-muted-foreground leading-tight truncate">{a.name}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : isCustom ? (
                          <p className="text-[11px] text-muted-foreground">Loading your custom mix...</p>
                        ) : null}
                      </div>
                    );
                  })()}

                  {/* Pick a stock */}
                  <button
                    type="button"
                    onClick={() => {
                      setAutoInvestExecutionModel("pick");
                      if (!autoInvestTicker) setAutoInvestTicker("AAPL");
                    }}
                    className={`w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                      autoInvestExecutionModel === "pick"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="hsl(var(--primary))" strokeWidth="1.5"/><circle cx="10" cy="10" r="4" stroke="hsl(var(--primary))" strokeWidth="1.5"/><circle cx="10" cy="10" r="1.5" fill="hsl(var(--primary))"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Pick a stock</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Every gift buys shares in one company
                      </p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
                      autoInvestExecutionModel === "pick" ? "border-primary bg-primary" : "border-border"
                    }`} />
                  </button>
                </div>

                {/* Stock picker - visible when "pick" is selected */}
                {autoInvestExecutionModel === "pick" && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Choose a company</p>
                    <div className="grid grid-cols-2 gap-2">
                      {quotedAutoInvestStocks.map((stock) => {
                        const amt = parseFloat(autoInvestAmount || "0");
                        const isSelected = autoInvestTicker === stock.symbol;
                        return (
                          <button
                            key={stock.symbol}
                            type="button"
                            onClick={() => setAutoInvestTicker(stock.symbol)}
                            className={`rounded-xl border p-3 text-left transition-colors ${
                              isSelected
                                ? "border-[hsl(var(--kiddo-evergreen))] bg-[hsl(var(--kiddo-evergreen)/0.06)]"
                                : "border-border hover:border-[hsl(var(--kiddo-evergreen)/0.4)]"
                            }`}
                          >
                            <StockLogo ticker={stock.symbol} size={32} className="mb-1.5" />
                            <p className="text-sm font-semibold text-foreground leading-tight">{stock.name}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{stock.tagline}</p>
                            {amt > 0 && (
                              <p className="text-[11px] font-semibold text-[hsl(var(--kiddo-evergreen))] mt-1.5">
                                {formatCurrency(amt)} invested
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-full" onClick={() => setAutoInvestStep("amount")}>
                    Back
                  </Button>
                  <Button
                    className="flex-1 rounded-full"
                    disabled={autoInvestExecutionModel === "pick" && !autoInvestTicker}
                    onClick={() => setAutoInvestStep("bank")}
                    data-testid="button-auto-invest-next-bank"
                  >
                    Continue
                  </Button>
                </div>
              </>
            )}

            {/* STEP 3: Bank account */}
            {autoInvestStep === "bank" && (
              <>
                <div>
                  <h2 className="font-heading text-xl font-semibold text-foreground">
                    Where should we pull from?
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Recurring investments run from your connected bank account. Lower fees. More reliable. Better for {recipientFirstNameDisplay || "them"}.
                  </p>
                </div>

                {bankAccounts.length > 0 ? (
                  <div className="space-y-2">
                    {bankAccounts.map((bank: any) => (
                      <button
                        key={bank.id}
                        type="button"
                        onClick={() => setAutoInvestSelectedBankId(bank.id)}
                        disabled={(bank.connectionStatus || "active") !== "active" || bank.status !== "active"}
                        className={`w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                          (autoInvestSelectedBankId === bank.id) || (bankAccounts.length === 1 && !autoInvestSelectedBankId)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        } disabled:opacity-60 disabled:hover:border-border`}
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">{(bank.bankName || "B")[0].toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{bank.bankName || "Bank account"}</p>
                          <p className="text-xs text-muted-foreground">
                            Account ending in {bank.accountLast4}
                            {bank.isDefault ? " | default" : ""}
                            {(bank.connectionStatus || "active") !== "active" ? " | needs refresh" : ""}
                          </p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 transition-colors ${
                          (autoInvestSelectedBankId === bank.id) || (bankAccounts.length === 1 && !autoInvestSelectedBankId)
                            ? "border-primary bg-primary"
                            : "border-border"
                        }`} />
                      </button>
                    ))}
                    {/* Deep-link to canonical add-bank flow. Bank linking is
                        a Settings-level action (KYC/Stripe-verification side
                        effects) and shouldn't be a buried sub-action under
                        per-fund recurring-setup. This link routes the parent
                        to Settings > Bank & withdrawals if they want to add
                        another bank, remove one, or change the default —
                        without abandoning their recurring setup mid-flow.
                        Single-bank case still sees this (in case they want
                        to add a second); multi-bank case uses it to manage.
                        See project_money_in_architecture.md "Bank linking
                        is user-scoped, not per-fund". */}
                    <button
                      type="button"
                      onClick={() => { setAutoInvestModalOpen(false); haptic("selection"); setLocation("/settings?from=dashboard&tab=money"); }}
                      className="mt-1 flex w-full items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-[hsl(var(--kiddo-cream))] hover:text-foreground focus-visible:bg-[hsl(var(--kiddo-cream))] focus-visible:text-foreground focus-visible:outline-none"
                      data-testid="recurring-bank-manage-link"
                    >
                      Manage bank accounts in Settings →
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center space-y-3">
                    <p className="text-sm font-medium text-amber-900">No bank account connected yet.</p>
                    <p className="text-xs text-amber-700">Connect a bank account in Settings. Plaid is the fastest path when configured.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full border-amber-300 text-amber-800"
                      onClick={() => { setAutoInvestModalOpen(false); setAutoInvestStep("amount"); setLocation("/settings?from=dashboard"); }}
                    >
                      Go to Settings
                    </Button>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-full" onClick={() => setAutoInvestStep("target")}>
                    Back
                  </Button>
                  <Button
                    className="flex-1 rounded-full"
                    disabled={bankAccounts.length === 0}
                    onClick={() => setAutoInvestStep("legal")}
                    data-testid="button-auto-invest-next-legal"
                  >
                    Continue
                  </Button>
                </div>
              </>
            )}

            {/* STEP 4: Legal authorization */}
            {autoInvestStep === "legal" && (
              <>
                <div>
                  <h2 className="font-heading text-xl font-semibold text-foreground">
                    One last thing.
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Once invested, this money belongs to {recipientFirstNameDisplay || "them"}. That's the whole point.
                  </p>
                </div>

                <div className="rounded-xl border border-[hsl(var(--kiddo-evergreen)/0.15)] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-4 space-y-3 text-sm text-muted-foreground">
                  <p>
                    By tapping below, you authorize Kiddo to pull{" "}
                    <strong className="text-foreground">
                      {formatCurrency(parseFloat(autoInvestAmount || "0"))} {autoInvestFrequency === "daily" ? "daily" : autoInvestFrequency === "weekly" ? "weekly" : autoInvestFrequency === "yearly" ? "yearly" : "monthly"}
                    </strong>
                    {(() => {
                      const bank = bankAccounts.find((b: any) => b.id === autoInvestSelectedBankId) || bankAccounts[0];
                      return bank ? ` from ${bank.bankName} ···· ${bank.accountLast4}` : "";
                    })()}
                    {recipientFirstNameDisplay ? ` into ${recipientFirstNameDisplay}'s fund` : ""}
                    {autoInvestExecutionModel === "pick" && autoInvestTicker
                      ? `, going into ${quotedAutoInvestStocks.find(s => s.symbol === autoInvestTicker)?.name ?? autoInvestTicker}`
                      : ""}. Cancel or change anytime from your dashboard.
                  </p>
                  <p className="text-xs">
                    Investments can go up or down. Past performance is not a guarantee of future results. This is a custodial account. Money invested belongs to the child.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-full" onClick={() => setAutoInvestStep("bank")}>
                    Back
                  </Button>
                  <Button
                    className="flex-1 rounded-full bg-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen))]/90 text-white"
                    disabled={savingAutoInvest}
                    onClick={handleSaveAutoInvest}
                    data-testid="button-save-auto-invest"
                  >
                    {savingAutoInvest ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Repeat size={15} className="mr-1.5" />
                    )}
                    {savingAutoInvest ? "Setting up..." : recipientFirstNameDisplay ? `Start growing ${recipientFirstNameDisplay}'s fund` : "Start investing"}
                  </Button>
                </div>

              </>
            )}

            {/* NOTE step - full-screen memory book prompt.
                The note serves two purposes: it's stamped to the Memory Book
                immediately as a kickoff entry, AND saved on the schedule so
                every future auto-fire carries it forward (gift.message + new
                memory entry on each successful cycle). One note, recurring
                love letter. */}
            {autoInvestStep === "note" && (
              <div className="space-y-5 py-1">
                <div>
                  <h2 className="font-heading text-xl font-semibold text-foreground leading-snug">
                    Write something for {recipientFirstNameDisplay || "them"}.
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {recipientFirstNameDisplay ? `${recipientFirstNameDisplay} reads it` : `${capFirst(childPronouns.subject)} read${childPronouns.singular ? "s" : ""} it`} on {childPronouns.possAdj} {majorityOrdinal} birthday.
                  </p>
                  <p className="mt-2 text-xs text-[hsl(var(--kiddo-evergreen))] leading-relaxed">
                    We'll stamp this note onto every cycle. Each ${parseFloat(autoInvestAmount || "0").toFixed(0)} you add carries this love forward.
                  </p>
                </div>
                <textarea
                  autoFocus
                  value={autoInvestMemoryNote}
                  onChange={(e) => setAutoInvestMemoryNote(e.target.value.slice(0, 400))}
                  placeholder={noteFlowPlaceholder("recurring-kickoff")}
                  rows={6}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-sm leading-relaxed resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:border-[hsl(var(--kiddo-evergreen)/0.4)] focus:ring-1 focus:ring-[hsl(var(--kiddo-evergreen)/0.2)]"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{autoInvestMemoryNote.length}/400</span>
                </div>
                {/* Photo / video / voice trio. Note: per the "recurring stamps
                    once" rule, only the kickoff entry carries media. Future
                    cycles stamp the text note alone — Memory Book doesn't get
                    the same photo 216 times over 18 years. */}
                {activeFundId && (
                  <MemoryMediaPicker
                    fundId={activeFundId}
                    value={autoInvestMedia}
                    onChange={setAutoInvestMedia}
                    childName={recipientFirstNameDisplay}
                    pronoun={(activeFund as any)?.pronoun}
                    majorityAge={(activeFund as any)?.majorityAge}
                    requiresPlus={!hasAutoInvestAccess}
                  />
                )}
                <Button
                  className="w-full rounded-full bg-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen))]/90 text-white"
                  disabled={!autoInvestMemoryNote.trim() || savingMemoryNote}
                  onClick={async () => {
                    const saved = await handleSaveAutoInvestMemoryNote();
                    if (saved) setAutoInvestStep("done");
                  }}
                >
                  {savingMemoryNote ? "Saving..." : "Save to memory book"}
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setAutoInvestStep("done")}
                >
                  Skip for now
                </button>
              </div>
            )}

            {/* DONE state — every confirmation lands here with the sprout (the
                category mark) and the tagline (the loop). The sprout replaces a
                generic trend icon because Kiddo's whole story is "the gift that
                grows", and the tagline is the unmistakable line that should
                appear on every confirmation surface across the product. */}
            {autoInvestStep === "done" && (
              <div className="text-center space-y-4 py-2">
                <motion.div
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.05 }}
                  className="w-16 h-16 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.12)] flex items-center justify-center mx-auto text-3xl"
                  aria-hidden="true"
                >
                  🌱
                </motion.div>
                <div>
                  <h2 className="font-heading text-xl font-semibold text-foreground">
                    {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s fund is growing.` : "It's running."}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    {formatCurrency(parseFloat(autoInvestAmount))}/{autoInvestFrequency === "daily" ? "day" : autoInvestFrequency === "weekly" ? "week" : autoInvestFrequency === "yearly" ? "year" : "month"} is scheduled
                    {autoInvestExecutionModel === "pick" && autoInvestTicker
                      ? ` into ${quotedAutoInvestStocks.find(s => s.symbol === autoInvestTicker)?.name ?? autoInvestTicker}`
                      : ""}. Change or cancel anytime.
                  </p>
                  <p className="text-[11px] text-[hsl(var(--kiddo-evergreen))]/75 mt-3 font-medium">
                    Powered by Kiddo · gifts that actually last 🌱
                  </p>
                </div>
                <Button
                  className="w-full rounded-full bg-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen))]/90 text-white"
                  onClick={() => { setAutoInvestModalOpen(false); setAutoInvestStep("amount"); }}
                >
                  Done
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => { setAutoInvestModalOpen(false); handleContributeNow(activeAutoInvest?.id || ""); }}
                >
                  Add a gift now
                </button>
              </div>
            )}

          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={kidViewConfigOpen} onOpenChange={(o) => { if (!o) { setKidViewConfigOpen(false); setKidViewConfigStep("settings"); } }}>
        <DialogContent className="max-w-md w-[95vw] rounded-2xl p-0 overflow-hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Kid View settings</DialogTitle>

          {kidViewConfigStep === "settings" ? (
            <div className="p-6 space-y-5">
              <div>
                <p className="text-sm font-medium text-primary">Kid View</p>
                <h2 className="mt-1 font-heading text-xl font-semibold text-foreground">
                  Share {recipientFirstNameDisplay || "your child"}&apos;s fund safely
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  This creates a private link plus a parent-set PIN. Child mode is simpler. Teen mode adds holdings and stock suggestions automatically.
                </p>
              </div>

              <label className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-foreground">Turn on Kid View</p>
                  <p className="text-xs text-muted-foreground mt-1">Required before a share link can be copied.</p>
                </div>
                <input type="checkbox" checked={kidViewEnabled} onChange={(e) => setKidViewEnabled(e.target.checked)} />
              </label>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground">PIN</label>
                  <input
                    type="password"
                    value={kidViewPin}
                    onChange={(e) => setKidViewPin(e.target.value)}
                    placeholder={kidViewSettings?.hasPin ? "Leave blank to keep existing PIN" : "Set a 4-6 digit PIN"}
                    className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">PIN hint (optional)</label>
                  <input
                    value={kidViewPinHint}
                    onChange={(e) => setKidViewPinHint(e.target.value)}
                    placeholder="Something only your child would know"
                    className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  />
                </div>
              </div>

              {Array.isArray(kidViewSettings?.suggestions) && kidViewSettings.suggestions.length > 0 && (() => {
                // Apply optimistic state on top of server data so the badge
                // flips instantly when the parent clicks Approve/Decline.
                const enriched = kidViewSettings.suggestions.map((s: any) => ({
                  ...s,
                  // suggestionPending overrides server status until refetch lands
                  effectiveStatus: suggestionPending[s.id] ?? s.reviewedStatus ?? "pending",
                  isPending: Boolean(suggestionPending[s.id]),
                }));
                const pendingCount = enriched.filter((s: any) => s.effectiveStatus === "pending").length;
                const approvedCount = enriched.filter((s: any) => s.effectiveStatus === "approved").length;
                const declinedCount = enriched.filter((s: any) => s.effectiveStatus === "declined").length;
                return (
                  <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">Teen stock suggestions</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {pendingCount > 0 && (
                          <span className="inline-flex items-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.12)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--kiddo-evergreen))]">
                            {pendingCount} pending
                          </span>
                        )}
                        {approvedCount > 0 && (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                            {approvedCount} approved
                          </span>
                        )}
                        {declinedCount > 0 && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            {declinedCount} declined
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Show ALL suggestions, not just the first 3 — a teen
                        flooding her parent with picks deserves visibility,
                        not silent truncation. Long lists scroll naturally
                        inside the modal. */}
                    {enriched.map((suggestion: any) => {
                      const status = suggestion.effectiveStatus;
                      const statusPill = status === "approved"
                        ? "bg-green-100 text-green-700"
                        : status === "declined"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-[hsl(var(--kiddo-evergreen)/0.12)] text-[hsl(var(--kiddo-evergreen))]";
                      const statusLabel = status === "approved" ? "Approved" : status === "declined" ? "Declined" : "Pending";
                      return (
                        <div key={suggestion.id} className={`rounded-2xl bg-background p-3 transition-opacity ${suggestion.isPending ? "opacity-70" : ""}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground">{suggestion.ticker}</p>
                              {suggestion.reason && <p className="mt-1 text-sm text-muted-foreground">{suggestion.reason}</p>}
                              {suggestion.submittedAt && (
                                <p className="mt-1 text-[10px] text-muted-foreground/60">Submitted {new Date(suggestion.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                              )}
                            </div>
                            <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${statusPill}`}>
                              {suggestion.isPending ? "Saving…" : statusLabel}
                            </span>
                          </div>
                          {status === "pending" && !suggestion.isPending && (
                            <div className="mt-3 flex gap-2">
                              <Button size="sm" variant="outline" className="rounded-full border-[hsl(var(--kiddo-evergreen)/0.35)] text-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen)/0.08)]" onClick={() => handleReviewKidSuggestion(suggestion.id, "approved")}>
                                Approve
                              </Button>
                              <Button size="sm" variant="outline" className="rounded-full border-amber-300 text-amber-800 hover:bg-amber-50" onClick={() => handleReviewKidSuggestion(suggestion.id, "declined")}>
                                Decline
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <div className="flex gap-3">
                <Button className="flex-1" onClick={handleSaveKidView} disabled={savingKidView}>
                  {savingKidView ? "Saving..." : "Save settings"}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => { setKidViewConfigOpen(false); setKidViewConfigStep("settings"); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5 text-center">
              <div className="w-14 h-14 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] flex items-center justify-center mx-auto">
                <Smile size={26} className="text-[hsl(var(--kiddo-evergreen))]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-[hsl(var(--kiddo-evergreen))]">Kid View is live</p>
                <h2 className="font-heading text-xl font-semibold text-foreground">
                  {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s view is ready.` : "Your child's view is ready."}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Share the link and tell {recipientFirstNameDisplay || "them"} the PIN. They can see their fund grow in a child-friendly way.
                </p>
              </div>
              <div className="space-y-2.5">
                {kidViewSettings?.shareLink && (
                  <Button
                    className="w-full h-12 rounded-xl font-semibold bg-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen)/0.88)] text-white"
                    onClick={() => { haptic("medium"); window.open(kidViewSettings.shareLink, "_blank", "noopener"); }}
                  >
                    <Smile size={15} className="mr-2" />
                    Open {recipientFirstNameDisplay ? `${recipientFirstNameDisplay}'s` : "the"} View
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl font-semibold"
                  onClick={async () => {
                    if (!kidViewSettings?.shareLink) return;
                    await navigator.clipboard.writeText(kidViewSettings.shareLink);
                    haptic("success");
                    toast({ title: "Link copied!", description: "Share this link plus the PIN with your child." });
                  }}
                >
                  <Share2 size={14} className="mr-2" />
                  Copy link
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
                  onClick={() => setKidViewConfigStep("settings")}
                >
                  Edit settings
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={culturalBgPickerOpen} onOpenChange={open => { if (!open) setCulturalBgPickerOpen(false); }}>
        <DialogContent className="max-w-md w-[95vw] rounded-2xl p-0 overflow-hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Your family's traditions</DialogTitle>
          <div className="p-6 space-y-5">
            <div>
              <p className="text-sm font-medium text-primary">Occasions and Goals</p>
              <h2 className="mt-1 font-heading text-xl font-semibold text-foreground">What does your family celebrate?</h2>
              <p className="mt-2 text-sm text-muted-foreground">We'll suggest the right milestones at the right time. Pick as many as apply.</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TRADITION_LABELS) as CulturalTradition[]).map(t => {
                const selected = culturalBgSelections.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      haptic("selection");
                      setCulturalBgSelections(prev =>
                        prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                      );
                    }}
                    className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                      selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground/40"
                    }`}
                  >
                    <span className="text-xl leading-none">{TRADITION_ICONS[t]}</span>
                    <span className="text-sm font-medium text-foreground leading-tight">{TRADITION_LABELS[t]}</span>
                    {selected && (
                      <div className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <Plus size={10} className="text-primary-foreground rotate-45" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setCulturalBgPickerOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleSaveCulturalBg} disabled={savingCulturalBg}>
                {savingCulturalBg ? "Saving..." : "Save traditions"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Managed-mix sell warning. Shown before the regular sell sheet when the
          holding is part of the active managed strategy. Nudges toward "Customize mix". */}
      {managedSellWarning && (() => {
        const ticker = String(managedSellWarning.ticker || "").toUpperCase();
        const childName = recipientFirstNameDisplay || "your child";
        return (
          <div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40"
            onClick={() => setManagedSellWarning(null)}
          >
            <div
              className="w-full sm:max-w-sm bg-background rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--kiddo-evergreen)/0.10)] mb-4">
                <span className="text-2xl">🌱</span>
              </div>
              <h3 className="font-heading text-lg font-bold text-foreground mb-2">
                Sell {ticker} from {childName}'s managed mix?
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                {ticker} is part of {childName}'s diversified foundation. Selling changes {childName}'s allocation,
                and the managed mix will rebalance on the next contribution.
                <br /><br />
                Want to remove it from the mix permanently instead?
              </p>
              <div className="space-y-2">
                <Button
                  className="w-full rounded-xl"
                  onClick={() => {
                    haptic("selection");
                    setManagedSellWarning(null);
                    setLocation("/settings?tab=money");
                  }}
                  data-testid="button-managed-sell-customize"
                >
                  Customize mix instead →
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-xl text-muted-foreground"
                  onClick={() => {
                    haptic("light");
                    const h = managedSellWarning;
                    setManagedSellWarning(null);
                    setSellingHolding(h);
                    setSellShares("");
                  }}
                  data-testid="button-managed-sell-anyway"
                >
                  Sell {ticker} anyway
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-xs text-muted-foreground/70 hover:text-foreground transition-colors py-2"
                  onClick={() => setManagedSellWarning(null)}
                  data-testid="button-managed-sell-cancel"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {sellingHolding && (() => {
        const maxShares = parseFloat(sellingHolding.shares || "0");
        const maxValue = parseFloat(sellingHolding.currentValue || "0");
        const pricePerShare = maxShares > 0 ? maxValue / maxShares : 0;
        const sellDollarQuickOptions = buildSellDollarQuickAmountOptions(maxValue);
        const enteredShares = parseFloat(sellShares || "0");
        // Derived values from whichever mode is active
        const sharesNum = sellMode === "shares"
          ? enteredShares
          : (pricePerShare > 0 ? enteredShares / pricePerShare : 0);
        const dollarsNum = sellMode === "dollars"
          ? enteredShares
          : enteredShares * pricePerShare;
        const isAll = maxShares > 0 && Math.abs(sharesNum - maxShares) < 0.00001;
        const isValid = sharesNum > 0 && sharesNum <= maxShares + 0.00001;

        return (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => { if (sellLoading || sellSuccess) return; setSellingHolding(null); setSellShares(""); setSellMode("dollars"); }}
            />
            {/* Sheet layout: header (fixed) + scrollable body + footer
                (sticky). Was a single `overflow-hidden` block with no
                height constraint — content beyond viewport got clipped
                AND wasn't scrollable, so on shorter viewports / when the
                mobile keyboard opened, the Cancel and confirm buttons
                were invisible/unreachable. Header & footer stay pinned
                so the primary action is always tappable; the form middle
                scrolls when there's more than fits. */}
            <div className="relative bg-card rounded-t-3xl sm:rounded-2xl border border-border/50 shadow-premium-lg w-full sm:max-w-md max-h-[92vh] flex flex-col z-10 overflow-hidden">
              {/* Success overlay */}
              {sellSuccess && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-card rounded-t-3xl sm:rounded-2xl">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                    <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M5 13.5L10.5 19L21 8" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <p className="text-sm font-semibold text-foreground">Moved to cash</p>
                  <p className="text-xs text-muted-foreground">Settles inside the fund shortly.</p>
                </div>
              )}
              {/* Header — pinned, always visible */}
              <div className="px-6 pt-6 pb-3 shrink-0">
                <h3 className="font-heading text-lg font-semibold mb-1">Move {sellingHolding.ticker} to cash</h3>
                <p className="text-sm text-muted-foreground">
                  The cash stays inside {recipientFirstNameDisplay || "your child"}'s fund after settlement.
                </p>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2">

              {/* Summary row */}
              <div className="flex gap-3 mb-4">
                <div className="flex-1 rounded-xl bg-muted/40 border border-border/30 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Current value</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{formatCurrency(maxValue)}</p>
                </div>
                <div className="flex-1 rounded-xl bg-muted/40 border border-border/30 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total shares</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{maxShares.toFixed(4)}</p>
                </div>
                {pricePerShare > 0 && (
                  <div className="flex-1 rounded-xl bg-muted/40 border border-border/30 px-3 py-2.5 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Per share</p>
                    <p className="text-sm font-bold text-foreground mt-0.5">{formatCurrency(pricePerShare)}</p>
                  </div>
                )}
              </div>

              {/* Mode toggle */}
              <div className="flex rounded-xl border border-border/50 overflow-hidden mb-3">
                <button
                  type="button"
                  onClick={() => { setSellMode("dollars"); setSellShares(""); }}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors ${sellMode === "dollars" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  By dollar amount
                </button>
                <button
                  type="button"
                  onClick={() => { setSellMode("shares"); setSellShares(""); }}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors ${sellMode === "shares" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  By shares
                </button>
              </div>

              {/* Input */}
              <div className="mb-2">
                <div className="relative">
                  {sellMode === "dollars" && (
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">$</span>
                  )}
                  <input
                    type="number"
                    step={sellMode === "dollars" ? "0.01" : "0.0001"}
                    min="0"
                    max={sellMode === "dollars" ? maxValue : maxShares}
                    value={sellShares}
                    onChange={(e) => setSellShares(e.target.value)}
                    placeholder={sellMode === "dollars" ? "0.00" : "0.0000"}
                    className={`w-full rounded-xl border border-border/50 bg-background py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${sellMode === "dollars" ? "pl-8 pr-4" : "px-4"}`}
                    data-testid="input-sell-shares"
                    autoFocus
                  />
                </div>

                {/* Live conversion */}
                {enteredShares > 0 && pricePerShare > 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground px-0.5">
                    {sellMode === "dollars"
                      ? `≈ ${sharesNum.toFixed(4)} shares${isAll ? " (all)" : ""}`
                      : `≈ ${formatCurrency(dollarsNum)}${isAll ? " (all)" : ""}`}
                  </p>
                )}
              </div>

              {/* Quick presets */}
              <div className="flex gap-2 mb-4">
                {sellMode === "dollars"
                  ? sellDollarQuickOptions.map((option) => (
                      <button
                        key={`${option.label}-${option.amount}`}
                        type="button"
                        onClick={() => setSellShares(option.amount.toFixed(2))}
                        className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                          sellShares === option.amount.toFixed(2)
                            ? "border-primary text-primary bg-primary/10"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))
                  : (
                      <button
                        type="button"
                        onClick={() => setSellShares(maxShares.toFixed(4))}
                        className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                          sellShares === maxShares.toFixed(4)
                            ? "border-primary text-primary bg-primary/10"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        All shares
                      </button>
                    )
                }
              </div>

              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 mb-4">
                Moving an investment to cash can create tax reporting. For a child's fund, money still belongs to the child.
              </p>

              </div>
              {/* Footer — pinned, always visible. Border separates the
                  scroll area from the action zone so the parent always
                  sees Cancel / Confirm even when the form's mid-scroll. */}
              <div className="px-6 py-4 border-t border-border/30 shrink-0 bg-card">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-full"
                    disabled={sellLoading}
                    onClick={() => { setSellingHolding(null); setSellShares(""); setSellMode("dollars"); }}
                    data-testid="button-cancel-sell"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 rounded-full"
                    disabled={sellLoading || !isValid}
                    onClick={() => handleSellHolding(sharesNum)}
                    data-testid="button-confirm-sell"
                  >
                    {sellLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Moving to cash...
                      </span>
                    ) : `Move ${isValid && dollarsNum > 0 ? formatCurrency(dollarsNum) : ""} to cash`}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <AnimatePresence>
        {showCoverageUpgradeModal && activeFund && (
          <Dialog open={showCoverageUpgradeModal} onOpenChange={setShowCoverageUpgradeModal}>
            <DialogContent className="max-w-md w-[95vw] rounded-2xl p-0 overflow-hidden" aria-describedby={undefined}>
              <DialogTitle className="sr-only">Upgrade {activeFund.name}</DialogTitle>
              <div className="p-6 space-y-5">
                <div className="space-y-1">
                  <p className="text-sm text-[hsl(var(--kiddo-gold-ink))] font-medium">Kiddo+</p>
                  <h2 className="font-heading text-xl font-semibold text-foreground">Unlock recurring investments for {recipientFirstNameDisplay || activeFund.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    Add recurring investments, photo and video Memory Book entries, custom fund mix, and co-parent access for this fund.
                  </p>
                </div>

                {recentGiftForToast && (
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Latest gift</span>
                      <span className="font-medium text-foreground">{formatCurrency(parseFloat(recentGiftForToast.amount || "0"))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gift amount to fund</span>
                      <span className="font-medium text-foreground">{formatCurrency(parseFloat(recentGiftForToast.amount || "0"))}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Kiddo+ keeps the fund growing after every gift with recurring investments and richer Memory Book moments.
                    </p>
                  </div>
                )}

                <div className="rounded-xl border border-[hsl(var(--kiddo-gold))]/25 bg-[hsl(var(--kiddo-gold))]/8 p-4">
                  <p className="text-sm font-medium text-foreground">${KORA_STARTER_MONTHLY}/month</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Recurring investments, photo and video Memory Book entries, custom fund mix, and co-parent access for one child.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    // Evergreen primary-CTA, not Tier-A gold. The
                    // upgrade-card already uses gold as a Tier-B
                    // accent (border + tinted background of the
                    // price-block above) which signals "premium" at
                    // the surface level. The button itself shouldn't
                    // also be gold — that's Share's exclusive Tier-A
                    // weight. See project_color_palette_60_30_10.md.
                    className="flex-1 rounded-xl px-4 py-3 bg-[hsl(var(--kiddo-evergreen))] text-white font-medium hover:bg-[hsl(var(--kiddo-evergreen)/0.92)] transition-colors disabled:opacity-60"
                    onClick={() => void handleCoverActiveFund(MONETIZATION_TRIGGER_IDS.contributionLanding)}
                    disabled={startingCoverageCheckout}
                    data-testid="button-confirm-cover-fund"
                  >
                    {startingCoverageCheckout ? "Opening checkout..." : "Start Kiddo+"}
                  </button>
                  <button
                    type="button"
                    className="px-3 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => {
                      setShowCoverageUpgradeModal(false);
                      void trackMonetizationTrigger(MONETIZATION_TRIGGER_IDS.contributionLanding, "dismissed");
                    }}
                    data-testid="button-dismiss-cover-fund"
                  >
                    Skip for now
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {recentGiftForToast && !giftToastDismissed && (
          <GiftReceivedToast
            giverName={recentGiftForToast.senderName}
            amount={parseFloat(recentGiftForToast.amount)}
            recipientName={recipientFirstNameDisplay || activeFund?.name || "your child"}
            onViewActivity={() => {
              const id = String(recentGiftForToast.id || "");
              markGiftToastDismissed(id);
              setGiftToastDismissed(true);
              setRecentGiftForToast(null);
              // Toast is for an incoming gift — land on the gifts filter
              // AND highlight the specific row that just arrived. Activity
              // accepts ?highlight= as either an activity id or a gift id
              // (resolves both transparently), so passing the gift id is
              // the natural URL contract.
              const target = id
                ? `/activity?filter=gifts&highlight=${encodeURIComponent(id)}`
                : "/activity?filter=gifts";
              setLocation(target);
            }}
            onDismiss={() => {
              const id = String(recentGiftForToast.id || "");
              markGiftToastDismissed(id);
              setGiftToastDismissed(true);
              setRecentGiftForToast(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Smart nudge modal */}
      <Dialog open={smartNudge !== null} onOpenChange={(open) => { if (!open) setSmartNudge(null); }}>
        <DialogContent className="max-w-sm w-[92vw] rounded-2xl p-0 overflow-hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Smart nudge</DialogTitle>
          {smartNudge && (() => {
            const child = recipientFirstNameDisplay || "The fund";
            // `her` pronoun + `delta` / `monthIncrease` were used by the
            // previous comparison-table-shaped variants. Removed 2026-05-13
            // with the rewrite — the new prose variants don't reference
            // them. If pronouns become relevant again, grab them from
            // `childPronouns` inline at the use site.
            const fmt = (n?: number) => n != null ? `~$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "";
            const fmtAmt = (n?: number) => n != null ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "";
            // Per-scenario hero anchor. Without this the modal was a
            // wall of text with no visual signal of WHICH moment the
            // nudge celebrates. Eyebrow + headline alone made the
            // surface read like a conversion-funnel popup instead of
            // a contextual milestone. Locked palette: evergreen tile
            // (Apple-Settings-warm rather than gold celebration).
            // Trophy for milestone, TrendingUp for outperforming,
            // Heart for consistent-streak (the "showing up" anchor).
            const HeroIcon = smartNudge.scenario === "milestone"
              ? Trophy
              : smartNudge.scenario === "outperforming"
                ? TrendingUp
                : Heart;
            // Current balance line — a reinforcement number the
            // parent can anchor to. The milestone modal previously
            // said "Emma just crossed $100" with no other number on
            // screen; now we also show the actual balance so the
            // moment connects to reality. Computed at render time
            // from the live totalValue (not the stale fundHistory
            // value used to detect the crossing).
            const balanceLine = totalValue > 0
              ? `Now at ${fmtAmt(totalValue)}.`
              : null;
            return (
              <div className="p-6 space-y-5">
                {/* Hero icon anchor. Small evergreen-tinted tile gives
                    the modal a visual moment without crossing into
                    "celebration emoji" territory (locked memory: only
                    🌱 is reserved). Per-scenario icon makes the
                    surface scannable at a glance — Trophy for a
                    crossed milestone, TrendingUp for outperforming,
                    Heart for the consistent-streak anchor. */}
                <div className="flex items-center justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))]">
                    <HeroIcon size={26} strokeWidth={1.8} />
                  </div>
                </div>
                {/* Three scenarios — outperforming / consistent / milestone.
                    Rewritten 2026-05-13 from the previous comparison-table
                    register (math panel + 'Double to \$X' CTA + 🌟 emoji
                    + platitudinal greeting-card lines) toward calm Kiddo
                    prose. The information is identical; the surface is
                    no longer fintech-conversion-funnel anatomy.
                    Key changes:
                      - No emoji (🌟 violated brand; only 🌱 is reserved)
                      - No 'The first \$X is the hardest' platitude (also
                        slightly inaccurate — next \$X comes at the same
                        contribution pace; compounding adds ~7%/yr only)
                      - No math-comparison panel (Acorns/Robinhood pattern)
                      - No 'Double to \$X' aggressive CTA. 'Adjust recurring'
                        honestly describes what happens (opens the editor)
                        without pushing a specific increment. */}

                {/* Scenario 1: Outperforming */}
                {smartNudge.scenario === "outperforming" && (
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {child}'s fund this year
                    </p>
                    <h2 className="mt-1 font-heading text-xl font-semibold text-foreground">
                      Up {smartNudge.returnPct}%.
                    </h2>
                    {balanceLine && (
                      <p className="mt-1 text-sm font-semibold text-[hsl(var(--kiddo-evergreen))]">
                        {balanceLine}
                      </p>
                    )}
                    <p className="mt-3 rounded-xl bg-muted/30 px-4 py-3 text-left text-sm text-foreground/80 leading-relaxed">
                      That's ahead of the 7% historical average. At {fmtAmt(smartNudge.currentMonthlyAmt)}/mo,{" "}
                      {child} is projected to have about {fmt(smartNudge.currentProjection)} at {majorityAge}.
                      {(smartNudge.doubledProjection ?? 0) > 0 && (smartNudge.doubledAmt ?? 0) > 0 && (
                        <>
                          {" "}Bumping to {fmtAmt(smartNudge.doubledAmt)}/mo projects to about {fmt(smartNudge.doubledProjection)}.
                        </>
                      )}
                    </p>
                  </div>
                )}

                {/* Scenario 2: Consistent streak */}
                {smartNudge.scenario === "consistent" && (
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Steady
                    </p>
                    <h2 className="mt-1 font-heading text-xl font-semibold text-foreground">
                      {smartNudge.streakMonths} months without a missed cycle.
                    </h2>
                    {balanceLine && (
                      <p className="mt-1 text-sm font-semibold text-[hsl(var(--kiddo-evergreen))]">
                        {balanceLine}
                      </p>
                    )}
                    <p className="mt-3 rounded-xl bg-muted/30 px-4 py-3 text-left text-sm text-foreground/80 leading-relaxed">
                      Compounding lives here. At {fmtAmt(smartNudge.currentMonthlyAmt)}/mo,{" "}
                      {child} projects to about {fmt(smartNudge.currentProjection)} at {majorityAge}.
                      {(smartNudge.doubledProjection ?? 0) > 0 && (smartNudge.doubledAmt ?? 0) > 0 && (
                        <>
                          {" "}Bumping to {fmtAmt(smartNudge.doubledAmt)}/mo projects to about {fmt(smartNudge.doubledProjection)}.
                        </>
                      )}
                    </p>
                  </div>
                )}

                {/* Scenario 3: Milestone */}
                {smartNudge.scenario === "milestone" && (
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Milestone
                    </p>
                    <h2 className="mt-1 font-heading text-xl font-semibold text-foreground">
                      {child} just crossed {fmtAmt(smartNudge.milestoneAmt)}.
                    </h2>
                    {balanceLine && (
                      <p className="mt-1 text-sm font-semibold text-[hsl(var(--kiddo-evergreen))]">
                        {balanceLine}
                      </p>
                    )}
                    {/* Honest projection. Rewritten 2026-05-15:
                        OLD copy said "the next $500 arrives in N months"
                        with math = milestoneAmt / monthlyAmt — wrong on
                        three counts: (1) ignored the current balance,
                        (2) ignored 7% growth, (3) "the next $500" meant
                        "another chunk" not "the next milestone."
                        NEW: nextMilestoneAmt is the literal next
                        threshold (e.g., $1K after $500), and the months
                        come from a month-by-month simulation that
                        starts at current balance, applies 7% net-of-fee
                        growth, and adds monthly contributions until
                        the next threshold is reached. nextMilestoneAmt
                        is undefined if the fund is at the highest
                        threshold ($100K), in which case we skip the
                        projection line entirely. */}
                    {/* Classic React gotcha: {x && <element>} renders
                        the literal "0" in the DOM if x === 0 (number),
                        because && returns its left operand when falsy
                        and React happily renders numbers as text.
                        Explicit `> 0` guards instead. Reported with a
                        screenshot 2026-05-15 — Emma's $1,917 fund
                        showed a stray "0" in the milestone modal
                        because monthsAtCurrentRate was 0 (fund already
                        past the next milestone, projection didn't
                        apply). The trigger-side gate now suppresses
                        this scenario entirely, but the defensive
                        boolean checks below remove the footgun. */}
                    {(smartNudge.nextMilestoneAmt ?? 0) > 0 && (smartNudge.monthsAtCurrentRate ?? 0) > 0 && (
                      <p className="mt-3 rounded-xl bg-muted/30 px-4 py-3 text-left text-sm text-foreground/80 leading-relaxed">
                        At your current pace ({fmtAmt(smartNudge.currentMonthlyAmt || 0)}/mo plus 7% historical-average growth), you'd cross {fmtAmt(smartNudge.nextMilestoneAmt)} in about {smartNudge.monthsAtCurrentRate} {smartNudge.monthsAtCurrentRate === 1 ? "month" : "months"}.
                        {(smartNudge.doubledAmt ?? 0) > 0 && (smartNudge.monthsDoubled ?? 0) > 0 && (
                          <>
                            {" "}At {fmtAmt(smartNudge.doubledAmt)}/mo, in about {smartNudge.monthsDoubled} {smartNudge.monthsDoubled === 1 ? "month" : "months"}.
                          </>
                        )}
                      </p>
                    )}
                  </div>
                )}

                {/* CTAs. 'Adjust recurring' replaces 'Double to \$X/month'
                    — the previous label proposed a 100% increase as the
                    default ask, which is aggressive even when the math
                    supports it. The button now honestly describes what
                    happens (opens the recurring-investment editor with
                    the doubled amount pre-filled as a suggestion, which
                    the parent can change). */}
                <div className="space-y-2">
                  <Button
                    className="w-full rounded-xl h-11"
                    onClick={() => {
                      haptic("medium");
                      setSmartNudge(null);
                      if (smartNudge.doubledAmt) setAutoInvestAmount(String(smartNudge.doubledAmt));
                      setEditingContribId(null);
                      setAutoInvestStep("amount");
                      setAutoInvestModalOpen(true);
                    }}
                  >
                    Adjust recurring
                  </Button>
                  <button
                    type="button"
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
                    onClick={() => { haptic("selection"); setSmartNudge(null); }}
                  >
                    Not now
                  </button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Recurring list-view action sheet — Edit / Pause-or-Resume / Cancel for the
          tapped row. Cancel uses a two-step within the same dialog (menu → confirm)
          rather than nesting another modal. */}
      <Dialog open={listActionContribId !== null} onOpenChange={(open) => { if (!open) closeListAction(); }}>
        <DialogContent className="max-w-sm w-[92vw] rounded-2xl p-0 overflow-hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Recurring investment actions</DialogTitle>
          {(() => {
            // Pull the contrib from root-level parentContributions (the IIFE scope where
            // `allContribs` lives is unreachable from this dialog at component root).
            const contrib = listActionContribId
              ? (parentContributions as any[]).find((c) => String(c.id) === listActionContribId)
              : null;
            if (!contrib) return null;
            const freqLabel = (f: string) => {
              if (f === "daily") return "day";
              if (f === "weekly") return "week";
              if (f === "yearly") return "year";
              return "month";
            };
            const effectiveStatus = optimisticContribStatus[String(contrib.id)] ?? contrib.status;
            const isPausedRow = effectiveStatus === "paused";
            const actionLoading = contribActionLoading[String(contrib.id)] ?? null;
            const sheetPickMeta = contrib.executionModel === "pick" && contrib.selectedTicker
              ? lookupPickMeta(contrib.selectedTicker, quotedAutoInvestStocks)
              : null;
            const targetLabel = sheetPickMeta
              ? sheetPickMeta.name
              : strategyLabelFor((activeFund as any)?.investmentStrategy, recipientFirstNameDisplay);

            if (listActionConfirmCancel) {
              // Loss-aversion diff: cancelling a recurring schedule is silent —
              // money stops moving, nothing visibly breaks. Without surfacing what
              // they're forfeiting, parents tap "Yes, cancel" on autopilot. The FV
              // of the remaining schedule until age 18, framed as "$X less for
              // Emma at 18", is the same calculus as the edit-mode upside diff
              // pointed in the opposite direction. Same disclaimer applies.
              const cancelAmt = parseFloat(String(contrib.amount || "0"));
              const cancelFreq = String(contrib.frequency || "monthly");
              const cancelPeriodsPerYear = cancelFreq === "daily" ? 365 : cancelFreq === "weekly" ? 52 : cancelFreq === "yearly" ? 1 : 12;
              const cancelAnnualized = cancelAmt * cancelPeriodsPerYear;
              const cancelMonthly = cancelAmt * (cancelPeriodsPerYear / 12);
              const cancelMonthsTo18 = age18Transition?.daysUntil18 ? Math.max(0, age18Transition.daysUntil18 / 30.4375) : null;
              const cancelR = 0.07 / 12;
              const cancelFv = cancelMonthsTo18 && cancelMonthsTo18 > 0
                ? cancelMonthly * ((Math.pow(1 + cancelR, cancelMonthsTo18) - 1) / cancelR)
                : null;
              const cancelChildFirst = recipientFirstNameDisplay || "them";
              const cancelFmt0 = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n));
              const cancelShowProjection = cancelFv !== null && cancelFv > cancelAmt * 1.5;
              return (
                <div className="p-6 space-y-5">
                  <div>
                    <p className="text-sm font-medium text-destructive">Cancel recurring investment</p>
                    <h2 className="mt-1 font-heading text-xl font-semibold text-foreground">Are you sure?</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      This stops {formatCurrency(cancelAmt)}/{freqLabel(cancelFreq)} into {targetLabel}. Existing contributions stay invested. You can set up a new one anytime.
                    </p>
                  </div>
                  {cancelShowProjection && cancelFv !== null && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200/60 p-3 space-y-2">
                      <div className="grid grid-cols-[auto_auto_1fr] gap-x-2 gap-y-1 text-[12px] items-baseline">
                        <span className="text-amber-900/55">Was</span>
                        <span className="text-amber-900/80 tabular-nums">{formatCurrency(cancelAnnualized)}/yr</span>
                        <span className="text-amber-900/55 text-[11px]">added on autopilot</span>
                        <span className="text-amber-900/55">After</span>
                        <span className="text-amber-900 font-semibold tabular-nums">$0/yr</span>
                        <span className="text-amber-900/55 text-[11px]">unless you set up a new one</span>
                      </div>
                      <div className="pt-1.5 border-t border-amber-200/60 space-y-1">
                        <p className="text-[12px] text-amber-900/85 leading-relaxed">
                          By {cancelChildFirst}'s 18th: <span className="line-through text-amber-900/45">{cancelFmt0(cancelFv)}</span>
                          {" → "}
                          <span className="font-semibold">$0</span>
                        </p>
                        <p className="text-[12px] font-semibold text-amber-800 leading-relaxed">
                          −{cancelFmt0(cancelFv)} less for {cancelChildFirst} at {majorityAge}<span className="text-amber-900/55 font-normal">*</span>
                        </p>
                      </div>
                      <p className="text-[10px] text-amber-900/55 leading-snug pt-0.5">
                        *Assuming a 7% yearly average. Markets vary. Time is what compounds.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full rounded-2xl"
                      disabled={actionLoading === "cancel"}
                      onClick={() => setListActionConfirmCancel(false)}
                      data-testid="button-keep-recurring"
                    >
                      Keep it for {cancelChildFirst}
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full rounded-2xl text-destructive hover:text-destructive hover:bg-destructive/5"
                      disabled={actionLoading === "cancel"}
                      onClick={async () => {
                        haptic("medium");
                        const id = String(contrib.id);
                        await handleUpdateAutoInvestStatus(id, "cancelled");
                        closeListAction();
                      }}
                      data-testid="button-confirm-cancel-recurring"
                    >
                      {actionLoading === "cancel" ? "Cancelling…" : "Yes, cancel anyway"}
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-medium text-primary">Recurring investment</p>
                  <h2 className="mt-1 font-heading text-xl font-semibold text-foreground tabular-nums">
                    {formatCurrency(parseFloat(contrib.amount))}
                    <span className="text-base font-normal text-muted-foreground">/{freqLabel(contrib.frequency)}</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    into {targetLabel} · {isPausedRow ? "Paused" : "Active"}
                  </p>
                </div>
                <div className="space-y-2">
                  <button
                    type="button"
                    className="w-full text-left rounded-2xl border border-border/60 bg-muted/20 px-4 py-3.5 hover:bg-muted/40 transition-colors"
                    data-testid="list-action-edit"
                    onClick={() => {
                      haptic("selection");
                      setEditingContribId(String(contrib.id));
                      setAutoInvestAmount(contrib.amount);
                      setAutoInvestFrequency(contrib.frequency as "daily" | "weekly" | "monthly" | "yearly");
                      setAutoInvestSelectedBankId(contrib.bankAccountId || "");
                      setAutoInvestExecutionModel((contrib.executionModel as "auto" | "pick") || "auto");
                      setAutoInvestTicker(contrib.selectedTicker || "");
                      setAutoInvestStep("amount");
                      setAutoInvestModalOpen(true);
                      closeListAction();
                    }}
                  >
                    <p className="text-sm font-semibold text-foreground">Edit</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Change amount, frequency, target, or bank.</p>
                  </button>

                  {isPausedRow ? (
                    <button
                      type="button"
                      className="w-full text-left rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.3)] bg-[hsl(var(--kiddo-evergreen)/0.06)] px-4 py-3.5 hover:bg-[hsl(var(--kiddo-evergreen)/0.10)] transition-colors disabled:opacity-60"
                      data-testid="list-action-resume"
                      disabled={actionLoading === "resume"}
                      onClick={async () => {
                        haptic("selection");
                        const id = String(contrib.id);
                        await handleUpdateAutoInvestStatus(id, "active");
                        closeListAction();
                      }}
                    >
                      <p className="text-sm font-semibold text-[hsl(var(--kiddo-evergreen))]">
                        {actionLoading === "resume" ? "Resuming…" : "Resume"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Restart the schedule from the next run date.</p>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="w-full text-left rounded-2xl border border-border/60 bg-muted/20 px-4 py-3.5 hover:bg-muted/40 transition-colors disabled:opacity-60"
                      data-testid="list-action-pause"
                      disabled={actionLoading === "pause"}
                      onClick={() => {
                        haptic("light");
                        const id = String(contrib.id);
                        closeListAction();
                        // Hand off to the existing pause-options dialog, which already
                        // offers "1 month / indefinitely / cancel instead" choices.
                        setPauseOptionsContribId(id);
                      }}
                    >
                      <p className="text-sm font-semibold text-foreground">Pause</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Stop the next run. Resume anytime.</p>
                    </button>
                  )}

                  <button
                    type="button"
                    className="w-full text-left rounded-2xl border border-red-200/60 bg-red-50/40 px-4 py-3.5 hover:bg-red-50/80 transition-colors"
                    data-testid="list-action-cancel"
                    onClick={() => {
                      haptic("light");
                      setListActionConfirmCancel(true);
                    }}
                  >
                    <p className="text-sm font-semibold text-red-600">Cancel</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Stop permanently. Existing investments stay in place.</p>
                  </button>
                </div>
                <button
                  type="button"
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
                  onClick={closeListAction}
                >
                  Close
                </button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Pause options modal */}
      <Dialog open={pauseOptionsContribId !== null} onOpenChange={(open) => { if (!open) setPauseOptionsContribId(null); }}>
        <DialogContent className="max-w-sm w-[92vw] rounded-2xl p-0 overflow-hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Pause recurring investment</DialogTitle>
          <div className="p-6 space-y-5">
            <div>
              <p className="text-sm font-medium text-primary">Recurring investment</p>
              <h2 className="mt-1 font-heading text-xl font-semibold text-foreground">Pause for a bit?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The fund keeps everything it has. Nothing is lost. Resume whenever you're ready.
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                className="w-full text-left rounded-2xl border border-border/60 bg-muted/20 px-4 py-3.5 hover:bg-muted/40 transition-colors"
                onClick={() => {
                  const id = pauseOptionsContribId!;
                  setPauseOptionsContribId(null);
                  void handleUpdateAutoInvestStatus(id, "paused");
                }}
              >
                <p className="text-sm font-semibold text-foreground">Pause for 1 month</p>
                <p className="text-xs text-muted-foreground mt-0.5">Come back and resume when the month is up.</p>
              </button>

              <button
                type="button"
                className="w-full text-left rounded-2xl border border-border/60 bg-muted/20 px-4 py-3.5 hover:bg-muted/40 transition-colors"
                onClick={() => {
                  const id = pauseOptionsContribId!;
                  setPauseOptionsContribId(null);
                  void handleUpdateAutoInvestStatus(id, "paused");
                }}
              >
                <p className="text-sm font-semibold text-foreground">Pause indefinitely</p>
                <p className="text-xs text-muted-foreground mt-0.5">Resume from this screen whenever you're ready.</p>
              </button>

              <button
                type="button"
                className="w-full text-left rounded-2xl border border-red-200/60 bg-red-50/40 px-4 py-3.5 hover:bg-red-50/80 transition-colors"
                onClick={() => {
                  const id = pauseOptionsContribId!;
                  setPauseOptionsContribId(null);
                  handleCancelAutoInvest(id);
                }}
              >
                <p className="text-sm font-semibold text-red-600">Cancel instead</p>
                <p className="text-xs text-muted-foreground mt-0.5">Stop permanently. You can always set up a new one.</p>
              </button>
            </div>

            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
              onClick={() => setPauseOptionsContribId(null)}
            >
              Keep it running
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail history modal — same generic surface Activity uses, mounted
          at Dashboard's page root so the History icon on each recurring
          card AND the "View all contributions →" link on the Last
          contribution card open inline without a navigation. URL contract
          (?detail=schedule:{id} | ?detail=contributions) matches Activity
          so deep links work from anywhere. */}
      {(() => {
        if (!detailScope) return null;
        const allFeed = dashboardActivityFeed as FeedActivity[];

        if (detailScope.kind === "schedule") {
          const schedule = parentContributions.find((c: any) => String(c.id) === detailScope.scheduleId);
          if (!schedule) return null;
          const scopedRows = allFeed.filter((row) => {
            const meta = parseActivityMetadata((row as any).metadata);
            const pcId = typeof (meta as any).parentContributionId === "string" ? (meta as any).parentContributionId : null;
            if (pcId !== detailScope.scheduleId) return false;
            // Suppress the gift_received row for parent contributions —
            // the parent_contribution row already covers it (one entry per
            // money event, not two). Same de-dupe rule as Activity.
            const t = normalizeActivityType(row.type);
            if (t === "gift_received" && (meta as any).isParentContribution === true) return false;
            return true;
          });
          const amt = parseActivityAmount((schedule as any).amount);
          const total = parseActivityAmount((schedule as any).totalContributed) ?? 0;
          const cycles = amt && amt > 0
            ? Math.round(total / amt)
            : scopedRows.filter((r) => normalizeActivityType(r.type) === "parent_contribution").length;
          const startedDate = (schedule as any).createdAt ? new Date(String((schedule as any).createdAt)) : null;
          const ticker = (schedule as any).executionModel === "pick" && typeof (schedule as any).selectedTicker === "string"
            ? (schedule as any).selectedTicker.toUpperCase()
            : null;
          const destLabel = ticker
            ? `into ${ticker}`
            : (schedule as any).executionModel === "family"
              ? "into family mix"
              : "into managed mix";
          const isPaused = (schedule as any).status === "paused";
          // Payment method + next-charge info now lands in the hero
          // (subtitle + stats grid) instead of a recursive Scheduled tab
          // that just re-displayed the schedule the parent had already
          // tapped. The Scheduled tab is hidden on per-schedule modals
          // (showScheduled in the modal goes false when scheduledRows is
          // empty), leaving only History | Pending — the views that
          // actually carry new info.
          const bank = (schedule as any).bankAccountId
            ? bankAccounts.find((b: any) => b.id === (schedule as any).bankAccountId)
            : null;
          const pmLabel = bank ? `${bank.bankName || "Bank"} ····${bank.last4 || ""}` : null;
          const nextRunDate = (schedule as any).nextRunDate ? new Date(String((schedule as any).nextRunDate)) : null;
          const nextChargeLabel = isPaused
            ? "Paused"
            : nextRunDate && Number.isFinite(nextRunDate.getTime())
              ? nextRunDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
              : "Not scheduled";
          const stats: DetailStat[] = [
            { label: "Total invested", value: formatCurrency(total), tone: total > 0 ? "positive" : "neutral" },
            { label: "Cycles fired", value: cycles > 0 ? `${cycles} ${cycles === 1 ? "cycle" : "cycles"}` : "Not yet", tone: "neutral" },
            // Replaces "Cycle amount" — that value is already in the modal
            // title ($25.00/mo). "Next charge" is the question the parent
            // actually asks looking at this surface.
            { label: "Next charge", value: nextChargeLabel, tone: isPaused ? "neutral" : "positive" },
            { label: "Started", value: startedDate ? startedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Not yet", tone: "neutral" },
          ];
          // Subtitle merges destination + payment method so the parent
          // sees "where" + "how it's paid" at a glance — the two facts
          // the deleted Scheduled tab carried beyond what the trigger
          // card already showed.
          const subtitleParts = [destLabel];
          if (pmLabel) subtitleParts.push(pmLabel);
          if (isPaused) subtitleParts.push("paused");
          const composedSubtitle = subtitleParts.join(" · ");
          return (
            <DetailHistoryModal
              open
              onClose={closeDetailScope}
              title={`${ticker || "Recurring"} · ${amt != null ? formatCurrency(amt) : ""}/${(schedule as any).frequency === "weekly" ? "wk" : (schedule as any).frequency === "yearly" ? "yr" : "mo"}`}
              subtitle={composedSubtitle}
              summaryStats={stats}
              rows={scopedRows}
              bottomCta={{
                // Opens the existing Edit / Pause / Cancel action sheet —
                // the canonical "do something with this schedule" surface.
                // Was routing to the multi-step edit modal directly, which
                // was a deeper drilldown than parents wanted; the action
                // sheet exposes all three management actions in one tap
                // and matches what the MoreVertical icon already opens.
                label: "Manage recurring →",
                onClick: () => {
                  closeDetailScope();
                  setListActionConfirmCancel(false);
                  setListActionContribId(String(schedule.id));
                },
                testId: "detail-modal-manage-recurring",
              }}
            />
          );
        }

        // Contributions scope — every parent contribution (recurring +
        // one-time). Sub-toggle narrows further. Identifies parent rows
        // via isParentContribution flag in metadata OR senderEmail
        // matching the fund owner's email. The senderEmail fallback
        // catches all rows that pre-date the server-side flag (without
        // it, the modal misses every parent contribution that landed
        // before the flag was wired up).
        const ownerEmailLowerForFilter = String((user as any)?.email || "").trim().toLowerCase();
        const rowSenderEmail = (row: FeedActivity): string => {
          const enriched = row as any;
          const meta = parseActivityMetadata(enriched.metadata);
          const raw = typeof enriched.senderEmail === "string"
            ? enriched.senderEmail
            : (typeof (meta as any).senderEmail === "string" ? (meta as any).senderEmail : "");
          return String(raw || "").trim().toLowerCase();
        };
        const isRecurringRow = (row: FeedActivity): boolean => {
          const meta = parseActivityMetadata((row as any).metadata);
          return typeof (meta as any).parentContributionId === "string" && !!(meta as any).parentContributionId;
        };
        const isParentContribRow = (row: FeedActivity): boolean => {
          const t = normalizeActivityType(row.type);
          if (t === "parent_contribution" || t === "parent_contribution_failed") return true;
          if (t === "gift_received" || t === "gift_received_cash") {
            const meta = parseActivityMetadata((row as any).metadata);
            if ((meta as any).isParentContribution === true) return true;
            if (ownerEmailLowerForFilter && rowSenderEmail(row) === ownerEmailLowerForFilter) return true;
          }
          return false;
        };
        // Row display transform: rewrite gift_received → parent_contribution
        // visuals (type/title/description) so the modal renders "You
        // contributed $X · Investing into AAPL" instead of "Gift from Dovi
        // · Gift received". Mirrors the inline override the Activity main
        // feed already applies. Pre-transformed at the IIFE level so the
        // generic DetailHistoryModal stays a dumb renderer.
        const applyParentContribDisplay = (row: FeedActivity): FeedActivity => {
          const t = normalizeActivityType(row.type);
          if (t === "parent_contribution" || t === "parent_contribution_failed") return row;
          // Only override the gift-family rows we filter in. gift_invested
          // isn't in the filter so won't reach here, but the guard is
          // cheap and correct.
          if (t !== "gift_received" && t !== "gift_received_cash" && t !== "gift_invested") return row;
          const meta = parseActivityMetadata((row as any).metadata);
          const overrideToParent =
            (meta as any).isParentContribution === true ||
            (!!ownerEmailLowerForFilter && rowSenderEmail(row) === ownerEmailLowerForFilter);
          if (!overrideToParent) return row;
          const amtNum = parseActivityAmount(row.amount);
          const tickerRaw = (meta as any).ticker;
          const ticker = typeof tickerRaw === "string" ? tickerRaw.toUpperCase() : null;
          return {
            ...row,
            type: "parent_contribution" as any,
            title: `You added $${(amtNum != null ? amtNum : 0).toFixed(2)}`,
            description: ticker ? `Investing into ${ticker}` : "Investing across the diversified mix",
          };
        };
        const allContribRows = allFeed.filter(isParentContribRow).map(applyParentContribDisplay);
        const subFilteredRows = allContribRows.filter((row) => {
          if (contributionsSubFilter === "all") return true;
          const recurring = isRecurringRow(row);
          if (contributionsSubFilter === "recurring") return recurring;
          if (contributionsSubFilter === "onetime") return !recurring;
          return true;
        });
        const recurringCount = allContribRows.filter(isRecurringRow).length;
        const onetimeCount = allContribRows.length - recurringCount;
        const totalContributed = subFilteredRows.reduce((s, r) => {
          const n = parseActivityAmount(r.amount);
          return s + (n != null && n > 0 ? n : 0);
        }, 0);
        const avgContrib = subFilteredRows.length > 0 ? totalContributed / subFilteredRows.length : 0;
        const lastDate = (() => {
          let latest: Date | null = null;
          for (const r of subFilteredRows) {
            const d = parseActivitySafeDate(r.createdAt);
            if (d && (!latest || d.getTime() > latest.getTime())) latest = d;
          }
          return latest;
        })();
        const stats: DetailStat[] = [
          { label: "Total invested", value: formatCurrency(totalContributed), tone: totalContributed > 0 ? "positive" : "neutral" },
          { label: "Investments", value: `${subFilteredRows.length}`, tone: "neutral" },
          { label: "Average", value: subFilteredRows.length > 0 ? formatCurrency(avgContrib) : "Not yet", tone: "neutral" },
          { label: "Most recent", value: lastDate ? lastDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Not yet", tone: "neutral" },
        ];
        return (
          <DetailHistoryModal
            open
            onClose={closeDetailScope}
            title="Your investments"
            subtitle={recipientFirstNameDisplay ? `Every dollar you've added to ${recipientFirstNameDisplay}'s fund.` : "Every dollar you've added to this fund."}
            summaryStats={stats}
            subToggle={{
              options: [
                { value: "all", label: "All", count: allContribRows.length },
                { value: "recurring", label: "Recurring", count: recurringCount },
                { value: "onetime", label: "One-time", count: onetimeCount },
              ],
              value: contributionsSubFilter,
              onChange: (v) => setContributionsSubFilter(v as typeof contributionsSubFilter),
            }}
            rows={subFilteredRows}
          />
        );
      })()}

      {/* First-sell tax explainer modal — opens when the server returns
          409 on a kid-owner's first sale. Continue re-fires the request
          with confirmTaxExplainer:true. Per AGE_18_HANDOFF_SPEC.md
          bucket 2. */}
      <FirstSellTaxExplainerModal
        payload={sellTaxExplainer?.payload || null}
        busy={sellLoading}
        onCancel={() => setSellTaxExplainer(null)}
        onConfirm={() => {
          if (!sellTaxExplainer) return;
          void handleSellHolding(sellTaxExplainer.sharesToSell, { confirmTaxExplainer: true });
        }}
      />
    </div>
  );
}
