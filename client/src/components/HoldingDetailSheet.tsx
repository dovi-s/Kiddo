import { useState, useEffect, useMemo } from "react";
import { Plus, TrendingDown, Users, ArrowRight, Layers, ChevronDown } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceDot } from "recharts";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TrendChartSkeleton } from "@/components/TrendChartSkeleton";
import { StockLogo } from "@/components/ui/stock-logo";
import { haptic } from "@/lib/haptics";
import { friendlyHoldingName } from "@/lib/ticker-names";
import { gifterIdentityKey } from "@/lib/gifter-name";
import { getEtfHoldings } from "@/lib/etf-holdings";
import { useCountUp } from "@/hooks/use-count-up";
import type { Holding, Gift } from "@shared/schema";

// Per-ticker, per-gift allocation row. When provided, the modal builds the contributor
// list from EXACT allocations rather than the proportional approximation, including
// for managed-mix holdings whose original funding came from rebalanced sells.
type GiftAllocationLite = {
  id: string;
  giftId: string;
  ticker: string;
  costBasis: string;
  shares: string | null;
  source: "pick" | "auto" | "rebalance" | string;
};

// Lightweight thank-you record. Just the status field is needed here; the full
// ThankYou record stays on the dashboard.
type ThankYouLite = { id?: string; status?: string | null };

interface HoldingDetailSheetProps {
  holding: Holding | null;
  onClose: () => void;
  recipientName?: string;
  totalPortfolioValue: number;
  gifts: Gift[];
  giftAllocations?: GiftAllocationLite[];
  thankYousByGiftId?: Map<string, ThankYouLite>;
  ownerEmail?: string | null;
  onAddMore: (ticker: string) => void;
  onSell: (holding: Holding) => void;
  // True when the active fund is read-only for the current user
  // (previous owner post-handoff, or a viewer). Hides every write CTA
  // — Add more, Move to cash, Add to strategy, Adjust strategy — while
  // keeping the holding's chart, contributor list, and gift detail
  // visible. The holding sheet is a powerful READ surface (per-ticker
  // chart, "Chosen with love" attribution, gift history) and stays
  // open for read-only roles; only the parent actions disappear.
  isReadOnly?: boolean;
  // True when the current viewer OWNS this fund post-handoff (the kid, now the
  // adult owner). Flips third-person child framing ("% of Haley's fund", "chose
  // AAPL for Haley") to second person ("% of your fund", "chose AAPL for you").
  isOwnerMode?: boolean;
  // True when this ticker is a slice of the active managed mix (VTI/BND/etc).
  // When true, per-ETF actions are replaced by strategy-level actions —
  // adding to one ETF or selling one ETF would silently break the strategy.
  isManagedMix?: boolean;
  // Display name of the active strategy (e.g. "Growth Mix"). Used in the
  // managed-mix action labels and the "Part of …" caption.
  strategyLabel?: string;
  // Fired instead of onAddMore when isManagedMix is true. Routes to the
  // contribute flow in managed mode (spreads across all strategy ETFs per
  // ratio) rather than locking funds to a single ETF.
  onAddToStrategy?: () => void;
  // Fired by the "Adjust strategy →" link. Routes to Settings → Strategy,
  // where the parent can switch mixes or move the whole strategy to cash.
  onAdjustStrategy?: () => void;
  onNavigateToGift?: (giftId: string) => void;
  onNavigateToGifter?: (name: string) => void;
}

type PricePoint = { date: string; ts: number; value: number };
type ChartRange = "1D" | "1W" | "1M" | "1Y" | "ALL";
const CHART_RANGES: ChartRange[] = ["1D", "1W", "1M", "1Y", "ALL"];

// Buy-marker shape — derived from per-gift records that targeted this
// ticker. Plotted as ReferenceDots on the AreaChart at the closest
// historical price point. Multiple gifts on the same chart point merge
// into one marker (count > 1) so dots don't overlap visually.
type BuyMarker = {
  x: number;       // PricePoint.ts — the NUMERIC x-axis value (timestamp)
  y: number;       // price at that point (so the dot sits on the line)
  count: number;   // how many gifts collapsed into this marker
};

function StockPriceChart({ ticker, gifts }: { ticker: string; gifts: Gift[] }) {
  const [range, setRange] = useState<ChartRange>("1Y");
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setData([]);
    setLoading(true);
    setError(false);
    fetch(`/api/stock-price/${encodeURIComponent(ticker)}?range=${range}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((pts: PricePoint[]) => { setData(pts); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [ticker, range]);

  // Hold the trend's draw-in until JUST AFTER the header numbers' count-up
  // (900ms) settles, so it reads as its own beat — numbers roll in first, then
  // the line draws in (founder 2026-06-05: "the trend should come right after
  // the roll in of the numbers, a tiny drop after, smooth"). The sheet remounts
  // per holding open, so this mount-timer re-anchors to each open's numbers.
  // ~1050ms = 900 (count-up) + a ~150ms breath, mirroring the hero
  // balance→projection stagger. Data still fetches immediately; we just gate the
  // VISUAL so the line never races the numbers, even on a warm cache.
  const [canDrawChart, setCanDrawChart] = useState(false);
  useEffect(() => {
    // Keyed on `ticker` so the stagger REPLAYS every time a different holding
    // opens (the header numbers re-roll then too), whether the sheet remounts
    // or just receives a new ticker. NOT keyed on `range` — a range change
    // mid-session should redraw immediately, not wait out the stagger again.
    setCanDrawChart(false);
    const t = setTimeout(() => setCanDrawChart(true), 1050);
    return () => clearTimeout(t);
  }, [ticker]);

  const min = data.length ? Math.min(...data.map((d) => d.value)) * 0.98 : 0;
  const max = data.length ? Math.max(...data.map((d) => d.value)) * 1.02 : 0;
  const isUp = data.length >= 2 && data[data.length - 1].value >= data[0].value;
  const color = isUp ? "#16a34a" : "#dc2626";
  const stride = Math.max(1, Math.floor((data.length || 1) / 5));
  // Ticks + dots are positioned on the NUMERIC ts (a real time axis), not the
  // date STRING (2026-06-08). The string axis was categorical, and coarse
  // ranges (ALL) repeat labels — Yahoo's ALL series ends "...Mar 2026, Jun
  // 2026, Jun 2026" — which poisoned the category scale so EVERY gold gift-dot
  // silently dropped (ifOverflow hidden) on ALL while the legend still
  // promised them. Numeric positioning is immune to duplicate/coarse labels.
  const ticks = data.filter((_, i) => i % stride === 0 || i === data.length - 1).map((d) => d.ts);
  const tsToLabel = new Map(data.map((d) => [d.ts, d.date]));

  // Buy markers — for each gift to this ticker, find the closest chart
  // point by timestamp and stack on its x. Filtered down to settled +
  // invested gifts (pending and held aren't real buys yet). Off-range
  // gifts (e.g., a gift 18 months ago when on 1Y view) silently skip
  // because the closest point ends up too far from the gift date.
  //
  // Implementation: O(gifts x data) lookup. With data ~250 points (1Y
  // daily) and gifts typically < 20 per ticker, this is ~5000 ops —
  // negligible, no memoization needed.
  const buyMarkers: BuyMarker[] = (() => {
    if (data.length === 0) return [];
    const tickerUpper = ticker.toUpperCase();
    const matched = gifts.filter((g) => {
      const status = String(g.status || "").toLowerCase();
      if (status !== "settled" && status !== "invested") return false;
      return String(g.selectedTicker || "").toUpperCase() === tickerUpper;
    });
    if (matched.length === 0) return [];

    // Range tolerance: if the gift date is more than 4 intervals away
    // from the nearest chart point, the gift is considered out-of-range
    // for this chart timeframe. Computed from the actual data spacing
    // so it scales across 1W (hour intervals), 1Y (day intervals), and
    // ALL (week intervals) automatically.
    const ms_per_interval = data.length > 1
      ? (data[data.length - 1].ts - data[0].ts) / (data.length - 1)
      : Number.POSITIVE_INFINITY;
    const tolerance = ms_per_interval * 4;

    // Group by the matched point's ts (a stable unique key per chart point —
    // date strings can repeat on coarse ranges, which previously merged
    // distinct points and broke positioning).
    const grouped = new Map<number, BuyMarker>();
    for (const gift of matched) {
      const giftTs = gift.createdAt ? new Date(gift.createdAt).getTime() : 0;
      if (!giftTs) continue;
      // Binary search would be cleaner but linear is fine at this size.
      let closest = data[0];
      let closestDelta = Math.abs(closest.ts - giftTs);
      for (const pt of data) {
        const d = Math.abs(pt.ts - giftTs);
        if (d < closestDelta) {
          closest = pt;
          closestDelta = d;
        }
      }
      if (closestDelta > tolerance) continue;
      const existing = grouped.get(closest.ts);
      if (existing) {
        existing.count += 1;
      } else {
        grouped.set(closest.ts, {
          x: closest.ts,
          y: closest.value,
          count: 1,
        });
      }
    }
    return Array.from(grouped.values());
  })();

  return (
    <div className="space-y-2">
      {/* Range selector */}
      <div className="flex gap-1 justify-end">
        {CHART_RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
              range === r
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Chart area */}
      {loading ? (
        // Chart-shaped skeleton (matches the dashboard/trend chart's loading
        // treatment) instead of a bare "Loading…" — the area resolves into a
        // price chart, so the placeholder should look like one.
        <TrendChartSkeleton heightPx={160} />
      ) : error || data.length < 2 ? (
        <div className="w-full rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-center" style={{ height: 160 }}>
          <span className="text-xs text-muted-foreground">Chart unavailable</span>
        </div>
      ) : !canDrawChart ? (
        // Data's ready, but hold the draw until the header numbers settle. Same
        // calm box (no layout shift) — the line draws into it a beat later.
        <div className="w-full rounded-2xl overflow-hidden border border-border/40 bg-background" style={{ height: 160 }} />
      ) : (
        <div className="w-full rounded-2xl overflow-hidden border border-border/40 bg-background" style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id={`sg-${ticker}-${range}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="ts"
                type="number"
                domain={["dataMin", "dataMax"]}
                ticks={ticks}
                tickFormatter={(ts) => tsToLabel.get(Number(ts)) ?? ""}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis domain={[min, max]} hide />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-xl border border-border bg-background px-3 py-2 shadow-lg text-xs">
                      <p className="font-semibold text-foreground">{formatCurrency(payload[0].value as number)}</p>
                      <p className="text-muted-foreground">{payload[0].payload.date}</p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#sg-${ticker}-${range})`}
                dot={false}
                activeDot={{ r: 4, fill: color }}
                // Smooth left-to-right draw-in. Gated to start ~1050ms after the
                // sheet opens (see canDrawChart) so it follows the numbers, not
                // races them. 1300ms reads smooth without dragging.
                isAnimationActive={true}
                animationDuration={1300}
              />
              {/* Buy markers — one gold ReferenceDot per (chart point, gift)
                  pair. Multiple gifts on the same point merge into a
                  single marker (kept as one dot; the count metadata is
                  available if a future iteration wants to scale dot
                  radius or show a label). Gold matches the kiddo-gold
                  token; white stroke keeps the dot visible against both
                  the green-shaded gain fill and the red-shaded loss
                  fill. ifOverflow='hidden' prevents Recharts from
                  surfacing a dot that's slightly off-domain (the
                  computed y is the chart's actual value at the closest
                  matched date, so this should always be in-domain, but
                  the safeguard catches edge cases). Per 2026-05-25 audit
                  ship — anchors the contributors block below to specific
                  moments on the price timeline. */}
              {buyMarkers.map((m) => (
                // ReferenceDot rendered AFTER <Area> so it draws ON TOP
                // (Recharts respects JSX child order for z-ordering;
                // no isFront prop needed — and it isn't typed on this
                // Recharts version anyway).
                <ReferenceDot
                  key={`buy-${m.x}-${m.count}`}
                  x={m.x}
                  y={m.y}
                  r={4.5}
                  fill="hsl(43, 75%, 55%)"
                  stroke="white"
                  strokeWidth={1.5}
                  ifOverflow="hidden"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {/* Legend for the buy markers — renders only when at least one
          marker is on the chart so the line stays clean for tickers
          with no on-range gifts. Keeps the gifter loop's "you bought
          here" story legible without needing a tooltip on each dot. */}
      {buyMarkers.length > 0 && !loading && !error && data.length >= 2 && (
        <p className="text-[10px] text-muted-foreground/80 leading-snug px-1">
          <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ background: "hsl(43, 75%, 55%)", verticalAlign: "middle" }} />
          {buyMarkers.length === 1 ? "Gold dot marks when this gift was made." : `Gold dots mark when gifts to ${ticker} were made.`}
        </p>
      )}
    </div>
  );
}

// Static descriptions for common tickers. Falls back gracefully.
const TICKER_INFO: Record<string, { about: string; category: string }> = {
  AAPL:  { about: "Makes iPhones, Macs, and the App Store. One of the most valuable companies ever built.", category: "Technology" },
  AMZN:  { about: "Started as a bookstore. Now runs the internet's backbone and sells everything.", category: "Consumer / Cloud" },
  GOOGL: { about: "The world's search engine, YouTube, and Google Cloud, all under one roof.", category: "Technology" },
  GOOG:  { about: "The world's search engine, YouTube, and Google Cloud, all under one roof.", category: "Technology" },
  MSFT:  { about: "Windows, Xbox, LinkedIn, and Azure cloud. One of the oldest and strongest tech giants.", category: "Technology" },
  TSLA:  { about: "Electric cars, solar, and energy storage. Betting on a world that runs on electricity.", category: "Automotive / Energy" },
  NFLX:  { about: "Turned DVD rentals into global streaming. 260M+ subscribers watch their shows.", category: "Entertainment" },
  DIS:   { about: "Marvel, Star Wars, Disney+, and theme parks. The ultimate entertainment empire.", category: "Entertainment" },
  NKE:   { about: "Just Do It. The world's biggest sportswear brand, on every field and street.", category: "Consumer" },
  SBUX:  { about: "20,000+ stores worldwide. The coffee shop that became a daily ritual for millions.", category: "Consumer" },
  RBLX:  { about: "A gaming platform where millions of kids build and play. More like a creative universe.", category: "Gaming" },
  SPOT:  { about: "The world's leading music streaming platform. 600M+ listeners, millions of podcasts.", category: "Entertainment" },
  META:  { about: "Facebook, Instagram, WhatsApp, and a big bet on the metaverse.", category: "Social / Technology" },
  NVDA:  { about: "Makes the chips that power AI, gaming, and data centers. At the center of the AI revolution.", category: "Technology" },
  VTI:   { about: "Owns a tiny piece of every major US company: over 3,600 stocks in one fund.", category: "ETF · US Total Market" },
  VXUS:  { about: "Owns thousands of international stocks outside the US. 50+ countries in one fund.", category: "ETF · International" },
  BND:   { about: "Owns thousands of US investment-grade bonds. The steady, reliable layer of a portfolio.", category: "ETF · US Bonds" },
  AGG:   { about: "Tracks the broad US bond market. The classic stability layer.", category: "ETF · US Bonds" },
  BNDX:  { about: "International bonds outside the US, dollar-hedged. Diversifies beyond US fixed income.", category: "ETF · International Bonds" },
  VOO:   { about: "Tracks the S&P 500: the 500 biggest US companies. A classic long-term hold.", category: "ETF · S&P 500" },
  SPY:   { about: "The original S&P 500 ETF. Tracks 500 of America's largest companies.", category: "ETF · S&P 500" },
  QQQ:   { about: "Tracks the Nasdaq 100, heavy on tech giants like Apple, Microsoft, and Nvidia.", category: "ETF · Tech-heavy" },
  VGT:   { about: "Focuses entirely on US technology companies.", category: "ETF · Technology" },
  VUG:   { about: "Tracks the largest US growth companies. Tilts toward fast-growing names.", category: "ETF · US Growth" },
  VYM:   { about: "Tracks US companies with above-average dividend yields. Steady income tilt.", category: "ETF · Dividend" },
  SCHD:  { about: "Focuses on US companies with consistent dividend growth. Quality + income.", category: "ETF · Dividend Growth" },
  BRK_B: { about: "Warren Buffett's holding company. Owns insurance, railroads, energy, and dozens more.", category: "Conglomerate" },
  JPM:   { about: "America's largest bank. Serves half of US households in some form.", category: "Finance" },
  V:     { about: "Processes hundreds of billions of transactions per year. The rails that money runs on.", category: "Finance" },
  MA:    { about: "Mastercard. Powers payments in 210+ countries. A toll road for every swipe.", category: "Finance" },
  TGT:   { about: "Where most American families shop every week. Groceries, clothes, home goods, all under one roof.", category: "Consumer" },
  CMCSA: { about: "Comcast. Owns NBC, Universal Studios, theme parks, and the cable connecting most US homes.", category: "Entertainment / Media" },
  DUOL:  { about: "The owl that teaches the world languages. Used by hundreds of millions of learners.", category: "Education" },
  ABNB:  { about: "Airbnb. Lets anyone host or stay anywhere on Earth. Built on trust at scale.", category: "Travel" },
  NTDOY: { about: "Nintendo. Mario, Zelda, Pokémon, and the Switch. The original family gaming brand.", category: "Gaming" },
  DPZ:   { about: "Domino's. Delivers more pizzas globally than anyone else. A surprisingly tech-forward food company.", category: "Consumer" },
  CHWY:  { about: "Chewy. Ships food and supplies to millions of pets. Customers send Chewy more handwritten thank-yous than any retailer.", category: "Consumer / Pets" },
  ADBE:  { about: "Adobe. Photoshop, Illustrator, Premiere. The software behind most of the world's creative work.", category: "Technology" },
  Z:     { about: "Zillow. The first place most Americans look when imagining their next home.", category: "Real Estate" },
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function formatShareCount(s: string | number | null | undefined): string {
  const n = parseFloat(String(s || "0"));
  if (n === 0) return "0";
  if (n >= 1) return n.toFixed(4).replace(/\.?0+$/, "");
  return n.toFixed(6).replace(/\.?0+$/, "");
}

// Per feedback_anonymous_as_explicit_flag.md: prefer the explicit
// isAnonymous flag from the gift row when available. String-matching
// fallback is for legacy rows pre-dating the boolean column.
function displayGifterName(name?: string | null, isAnonymous?: boolean): string {
  if (isAnonymous === true) return "Anonymous";
  const n = String(name || "").trim();
  if (!n || /^someone who loves/i.test(n) || n.toLowerCase() === "anonymous") return "Anonymous";
  return n;
}


function formatGiftDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  } catch { return null; }
}

function ContributorRow({ name, total, costBasisSlice, count, subtitle, estimatedShares, date, message, onNavigate, isRecurring, thankYouState, showExpandChevron, isExpanded }: {
  name: string; total: number; costBasisSlice?: number; count: number; subtitle?: string;
  estimatedShares?: number | null; date?: string | null; message?: string | null; onNavigate?: () => void;
  isRecurring?: boolean;
  thankYouState?: "sent" | "partial" | "draft" | "missing" | "self" | "anonymous";
  // Anonymous multi-gift rows show a rotating chevron (expand state)
  // instead of the › navigation arrow. Other row types use ›.
  showExpandChevron?: boolean;
  isExpanded?: boolean;
}) {
  const sharesLabel = estimatedShares != null && estimatedShares > 0
    ? `~${estimatedShares >= 1 ? estimatedShares.toFixed(4).replace(/\.?0+$/, "") : estimatedShares.toFixed(6).replace(/\.?0+$/, "")} shares`
    : null;
  const dateLabel = count === 1 ? formatGiftDate(date) : null;
  // Single-gift fallback parallels the multi-gift case ("2 gifts" / "3 gifts")
  // — "1 gift" reads consistently with the count-based pattern when the gift's
  // date is genuinely unavailable (older dev/test data with null settledAt +
  // null createdAt). Previous bare "gift" silently dropped context and read
  // as broken UI compared to the dated-form "gift · May 7, 2026."
  const subtitleText = subtitle ?? (count > 1 ? `${count} gifts` : dateLabel ? `gift · ${dateLabel}` : "1 gift");
  // Full message (no truncation) for single-gift contributors. With the
  // featured spotlight removed, this row carries the story — and there's
  // room for it because the row is one of few. Multi-gift contributors get
  // no message preview because there isn't a single one to show; the user
  // taps through to Memory Book to see them all.
  const fullMessage = message && count === 1 ? message.trim() : null;

  const gain = costBasisSlice != null && costBasisSlice > 0.01 ? total - costBasisSlice : null;
  const gainPct = gain != null && costBasisSlice != null && costBasisSlice > 0.01 ? (gain / costBasisSlice) * 100 : null;
  const showGain = gain != null && Math.abs(gain) > 0.01;

  const inner = (
    <>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
          {name === "Anonymous" ? "?" : name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <p className="text-sm font-medium text-foreground truncate">{name}</p>
            {isRecurring && (
              <span
                title="Has an active recurring investment in this holding"
                className="shrink-0 inline-flex items-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.07em] text-[hsl(var(--kiddo-evergreen))]"
              >
                ↻ Recurring
              </span>
            )}
            {thankYouState === "sent" && (
              <span title="You've thanked them" className="shrink-0 inline-flex items-center rounded-full bg-[rgba(26,61,43,0.09)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.07em] text-[rgb(26,61,43)]">
                ✓ Thanked
              </span>
            )}
            {thankYouState === "partial" && (
              <span title="Some of their gifts are thanked, some are still awaiting" className="shrink-0 inline-flex items-center rounded-full bg-[hsl(43,75%,92%)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.07em] text-[hsl(43,55%,28%)]">
                Some thanks pending
              </span>
            )}
            {thankYouState === "draft" && (
              <span title="A thank-you is drafted but not sent yet" className="shrink-0 inline-flex items-center rounded-full bg-[hsl(43,75%,92%)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.07em] text-[hsl(43,55%,28%)]">
                ⏳ Awaiting thanks
              </span>
            )}
            {thankYouState === "missing" && (
              <span title="No thank-you on record" className="shrink-0 inline-flex items-center rounded-full bg-[rgba(26,23,16,0.06)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.07em] text-[rgba(26,23,16,0.55)]">
                No thanks yet
              </span>
            )}
            {/* "✨ From you" pill removed for self-gifts — sender name is
                already in the row, so the pill duplicated info the parent
                could read directly. Same removal applied across Dashboard
                hero, Dashboard event-list, gifter detail modal, and Memory
                Book list. */}
          </div>
          <p className="text-[11px] text-muted-foreground">{subtitleText}</p>
          {fullMessage && (
            <p
              className="font-heading italic text-[hsl(var(--kiddo-evergreen))] mt-1.5 leading-snug"
              style={{ fontSize: 13.5, letterSpacing: "-0.005em" }}
            >
              &ldquo;{fullMessage}&rdquo;
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(total)}</p>
          {showGain && gainPct != null ? (
            // When there's a meaningful gain/loss for a single-gift
            // contributor, append "· Original $X" so the trajectory is
            // explicit ($50 → $52.40 instead of just "+$2.40"). The same
            // "Original $X" wording is used in the multi-gift contributor's
            // expanded detail rows below (line ~940), so the single-gift
            // and multi-gift contexts read with parallel vocabulary. The
            // "·" separator matches the date/cost separator pattern used
            // in the expanded rows. Was "from $X" — replaced 2026-05-12
            // for consistency.
            <p className={`text-[10px] font-semibold tabular-nums ${gain! >= 0 ? "text-green-600" : "text-red-500"}`}>
              {gain! >= 0 ? "+" : ""}{formatCurrency(gain!)} ({gain! >= 0 ? "+" : ""}{gainPct.toFixed(1)}%)
              {count === 1 && costBasisSlice != null && costBasisSlice > 0.01 && (
                <span className="text-muted-foreground/70 font-normal"> · Original {formatCurrency(costBasisSlice)}</span>
              )}
            </p>
          ) : sharesLabel ? (
            <p className="text-[10px] text-muted-foreground/70 tabular-nums">{sharesLabel}</p>
          ) : null}
        </div>
        {showExpandChevron ? (
          <ChevronDown
            size={14}
            className="text-muted-foreground/60 transition-transform"
            style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
            aria-hidden="true"
          />
        ) : (
          <span className="text-[10px] text-muted-foreground/50 leading-none select-none">›</span>
        )}
      </div>
    </>
  );
  if (onNavigate) {
    return (
      <button
        type="button"
        onClick={onNavigate}
        className="flex w-full items-center justify-between rounded-xl bg-muted/30 px-3.5 py-2.5 hover:bg-muted/50 active:bg-muted/60 transition-colors text-left"
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/30 px-3.5 py-2.5">
      {inner}
    </div>
  );
}

function useTodayQuote(ticker: string | null | undefined) {
  const [data, setData] = useState<{ change?: number; changePercent?: number; isEstimate?: boolean } | null>(null);
  useEffect(() => {
    if (!ticker) return;
    fetch(`/api/market/quotes?symbols=${encodeURIComponent(ticker.toUpperCase())}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((body: { quotes?: Array<{ change?: number; changePercent?: number; isEstimate?: boolean }> }) => {
        const q = body.quotes?.[0];
        if (q) setData(q);
      })
      .catch(() => {});
  }, [ticker]);
  return data;
}

// Outer guard. Mounts the body ONLY when there's a holding to show, so all
// the body's hooks run in the same order on every render. Without this guard,
// the early return ran before the hooks — when `holding` flipped null↔value
// the hook count changed between renders, which corrupts React's internal
// fiber state and surfaces as "Internal React error: Expected static flag was
// missing." That corruption can also cause downstream effects (Memory Book's
// deep-link scroll) to silently misfire.
export function HoldingDetailSheet(props: HoldingDetailSheetProps) {
  if (!props.holding) return null;
  return <HoldingDetailSheetBody {...props} holding={props.holding} />;
}

function HoldingDetailSheetBody({
  holding,
  onClose,
  recipientName,
  totalPortfolioValue,
  gifts,
  giftAllocations,
  thankYousByGiftId,
  ownerEmail,
  isOwnerMode = false,
  onAddMore,
  onSell,
  isManagedMix = false,
  strategyLabel,
  onAddToStrategy,
  onAdjustStrategy,
  onNavigateToGift,
  onNavigateToGifter,
  isReadOnly = false,
}: HoldingDetailSheetProps & { holding: Holding }) {
  const ticker = holding.ticker;
  const name = friendlyHoldingName(ticker, holding.name);
  const info = TICKER_INFO[ticker.toUpperCase().replace(/\./g, "_")];
  const todayQuote = useTodayQuote(ticker);

  const currentValue = parseFloat(holding.currentValue || "0");
  const costBasis = parseFloat(holding.costBasis || "0");
  const shares = parseFloat(holding.shares || "0");
  const gain = currentValue - costBasis;
  const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0;
  const isUp = gain >= 0;
  const portfolioPct = totalPortfolioValue > 0 ? (currentValue / totalPortfolioValue) * 100 : 0;
  const pricePerShare = shares > 0 ? currentValue / shares : 0;
  const avgCostPerShare = shares > 0 ? costBasis / shares : 0;
  const shareCount = formatShareCount(holding.shares);

  // Count-up on the three hero numbers in this sheet (header
  // currentValue + the position-summary grid). The sheet is a
  // "drill into this holding" Apple-Settings surface — the lead
  // numbers should settle in on each open. useCountUp re-runs on
  // remount, so opening a different holding triggers a fresh
  // animation each time. Header gain animates from 0 so growth
  // reads as appearing rather than landing flat.
  const { value: animatedCurrentValue, isAnimating: currentValueAnimating } = useCountUp({
    from: currentValue * 0.95,
    to: currentValue,
    duration: 900,
    enabled: currentValue > 0,
  });
  const { value: animatedCostBasis, isAnimating: costBasisAnimating } = useCountUp({
    from: costBasis * 0.95,
    to: costBasis,
    duration: 900,
    enabled: costBasis > 0,
  });
  const { value: animatedGain, isAnimating: gainAnimating } = useCountUp({
    from: 0,
    to: gain,
    duration: 900,
    enabled: Math.abs(gain) > 0.01,
  });

  // Settled / invested gifts. Pending and held gifts have not built a holding yet.
  const settledGifts = gifts.filter((g) =>
    ["settled", "invested"].includes(String(g.status || "").toLowerCase())
  );

  // Gifts that specifically targeted this ticker (used to mark "isManaged" for header copy).
  const specificGifts = settledGifts.filter(
    (g) => String(g.selectedTicker || "").toUpperCase() === ticker.toUpperCase()
  );
  const isManaged = specificGifts.length === 0;

  // Exact allocations for THIS ticker, if present. This is the precise per-gift split
  // (e.g. SBUX rebalance into VTI gives a real cost-basis row for the originating gift).
  const exactAllocations = (giftAllocations || []).filter(
    (a) => String(a.ticker || "").toUpperCase() === ticker.toUpperCase()
  );
  const useExactAllocations = exactAllocations.length > 0;

  const giftById = new Map<string, Gift>();
  for (const g of settledGifts) {
    if (g.id) giftById.set(String(g.id), g);
  }

  // Per-contributor thank-you accumulation. Cases:
  //   sent     — at least one of their gifts is thanked, none awaiting/missing
  //   partial  — mix of sent + awaiting (some thanked, some not)
  //   draft    — has a thank-you in draft, none sent
  //   missing  — invested gifts but no thank-you record at all
  //   self     — this is the fund owner viewing their own gift
  //   anonymous — anonymous gifter or sender with no email; can't be thanked
  type ThankYouState = "sent" | "partial" | "draft" | "missing" | "self" | "anonymous";
  const ownerEmailLower = String(ownerEmail || "").trim().toLowerCase();

  const uniqueMap = new Map<string, { id: string; name: string; total: number; costBasisSlice: number; count: number; date?: string | null; giftId?: string; mostRecentGiftId?: string; mostRecentGiftDate?: number; message?: string | null; isRecurring: boolean; sentCount: number; draftCount: number; missingCount: number; isAnonymous: boolean; isOwner: boolean }>();

  // Helper to fold a single gift into its sender's bucket, including thank-you accounting.
  const accumulateGift = (
    gift: Gift,
    amt: number,
    basisSlice: number,
  ) => {
    // Group by stable IDENTITY (email-when-present), not display name — so one
    // person signing different names ("Gloria Pritchett" once, "Grandma" next)
    // is ONE contributor, and two different people who share a name stay
    // separate. Same root fix as the Dashboard roster (gifterIdentityKey,
    // 2026-06-08). BOTH this map and giftDetailsByContributor key on idKey so
    // the render's detail lookup (by c.id) stays aligned; the DISPLAYED name
    // resolves to the most-recent gift's name below.
    const displayName = displayGifterName(gift.senderName, (gift as any).isAnonymous);
    const idKey = gifterIdentityKey(gift.senderName, (gift as any).senderEmail, (gift as any).isAnonymous);
    const giftDate = (gift as any).settledAt || (gift as any).createdAt || null;
    const giftDateMs = giftDate ? new Date(String(giftDate)).getTime() : 0;
    const giftIsRecurring = !!(gift as any).parentContributionId;
    const giftEmailLower = String((gift as any).senderEmail || "").trim().toLowerCase();
    // Thank-you anonymity is SEPARATE from grouping: a gift with no email can't
    // be thanked, but a named no-email gifter ("The Johnsons", cash) still gets
    // its own bucket via idKey. Only true-anonymous collapses to one row.
    const isAnon = displayName === "Anonymous" || !giftEmailLower;
    const isOwnerGift = !!ownerEmailLower && giftEmailLower === ownerEmailLower;
    const ty = gift.id ? thankYousByGiftId?.get(String(gift.id)) : null;
    const tyStatus = String(ty?.status || "").toLowerCase();
    const isSent = tyStatus === "sent";
    const isDraft = !!ty && !isSent;
    const ex = uniqueMap.get(idKey);
    if (ex) {
      ex.total += amt; ex.costBasisSlice += basisSlice; ex.count += 1;
      ex.date = undefined; ex.giftId = undefined; ex.message = undefined;
      // Track the most recent gift per contributor — drives BOTH the displayed
      // name (most-recent self-identification, for an email-collapsed gifter)
      // and the Memory Book deep-link target. For multi-gift contributors
      // (especially Anonymous), landing on the most recent gift's entry is more
      // useful than dumping the user into the unfiltered timeline.
      if (giftDateMs > (ex.mostRecentGiftDate || 0)) {
        ex.mostRecentGiftDate = giftDateMs;
        ex.name = displayName;
        if (gift.id) ex.mostRecentGiftId = gift.id;
      }
      if (giftIsRecurring) ex.isRecurring = true;
      if (isAnon) ex.isAnonymous = true;
      if (isOwnerGift) ex.isOwner = true;
      if (!isAnon && !isOwnerGift) {
        if (isSent) ex.sentCount += 1;
        else if (isDraft) ex.draftCount += 1;
        else ex.missingCount += 1;
      }
    } else {
      uniqueMap.set(idKey, {
        id: idKey,
        name: displayName,
        total: amt,
        costBasisSlice: basisSlice,
        count: 1,
        date: giftDate,
        giftId: gift.id ?? undefined,
        mostRecentGiftId: gift.id ?? undefined,
        mostRecentGiftDate: giftDateMs,
        message: gift.message ?? null,
        isRecurring: giftIsRecurring,
        sentCount: !isAnon && !isOwnerGift && isSent ? 1 : 0,
        draftCount: !isAnon && !isOwnerGift && isDraft ? 1 : 0,
        missingCount: !isAnon && !isOwnerGift && !isSent && !isDraft ? 1 : 0,
        isAnonymous: isAnon,
        isOwner: isOwnerGift,
      });
    }
  };

  if (useExactAllocations) {
    // Real per-gift allocation rows. Value each gift by its ACTUAL share count ×
    // the current price (i.e. distribute current value by SHARE proportion), not
    // by cost proportion — otherwise every gift to a holding shows the same
    // blended % and an early gift (which bought far more shares per dollar)
    // looks identical to a recent one. Share-based reflects the true compounding:
    // a $60 2009 Apple gift is worth dramatically more than a $60 2024 one.
    // Falls back to cost proportion only if a row is missing its share count.
    const totalAllocShares = exactAllocations.reduce((s, a) => s + Math.max(0, parseFloat(a.shares || "0")), 0);
    const totalAllocCost = exactAllocations.reduce((s, a) => s + Math.max(0, parseFloat(a.costBasis || "0")), 0);
    for (const alloc of exactAllocations) {
      const gift = giftById.get(String(alloc.giftId));
      if (!gift) continue;
      const allocCost = Math.max(0, parseFloat(alloc.costBasis || "0"));
      const allocShares = Math.max(0, parseFloat(alloc.shares || "0"));
      const proportion = totalAllocShares > 0
        ? allocShares / totalAllocShares
        : (totalAllocCost > 0 ? allocCost / totalAllocCost : 0);
      const amt = currentValue > 0 ? proportion * currentValue : allocCost;
      accumulateGift(gift, amt, allocCost);
    }
  } else {
    // Fallback when allocation rows aren't available (older gifts, edge cases): proportional
    // estimate against the relevant gift pool. Same behavior as before this rework.
    const sourceGifts = isManaged ? settledGifts : specificGifts;
    const sourceGiftTotal = sourceGifts.reduce((sum, gift) => sum + Math.max(0, parseFloat(gift.netAmount || gift.amount || "0")), 0);
    for (const g of sourceGifts) {
      const rawGiftAmount = Math.max(0, parseFloat(g.netAmount || g.amount || "0"));
      const proportion = sourceGiftTotal > 0 ? rawGiftAmount / sourceGiftTotal : 0;
      const amt = isManaged && sourceGiftTotal > 0 ? proportion * currentValue : rawGiftAmount;
      const basisSlice = isManaged && sourceGiftTotal > 0 ? proportion * costBasis : rawGiftAmount;
      accumulateGift(g, amt, basisSlice);
    }
  }

  const computeThankYouState = (entry: typeof uniqueMap extends Map<string, infer V> ? V : never): ThankYouState => {
    if (entry.isAnonymous) return "anonymous";
    if (entry.isOwner) return "self";
    if (entry.sentCount > 0 && entry.draftCount === 0 && entry.missingCount === 0) return "sent";
    if (entry.sentCount > 0) return "partial";
    if (entry.draftCount > 0) return "draft";
    return "missing";
  };

  const contributorList = Array.from(uniqueMap.values())
    .map(entry => ({ ...entry, thankYouState: computeThankYouState(entry) }))
    .sort((a, b) => b.total - a.total);

  // Per-contributor list of individual gifts with current value + delta.
  // Lets multi-gift contributor rows expand inline to show their per-gift
  // breakdown — replaces the standalone "Each gift, today" section below.
  // Single source of truth for gift-level performance data.
  type GiftDetailRow = {
    key: string;
    giftId: string | null;
    date: string | null;
    original: number;
    todayVal: number;
    delta: number;
    pct: number;
    // Gift message — surfaced on the expanded detail row so a parent
    // drilling into a multi-gift contributor (especially Anonymous, where
    // each "gift" can have a distinct note) doesn't lose the Memory Book
    // payload that came with each contribution. Per
    // feedback_memory_book_inversion.md: "note IS the entry." Hiding the
    // note in the expanded inline view was a Memory Book violation.
    message: string | null;
  };
  const giftDetailsByContributor = useMemo(() => {
    const map = new Map<string, GiftDetailRow[]>();
    if (!useExactAllocations) return map;
    // Value each gift by its ACTUAL shares (share proportion of current value),
    // not cost proportion — so each gift's "today" value + % reflects WHEN it
    // bought in. An early gift bought more shares per dollar and is worth far
    // more now; cost proportion wrongly flattens every gift to one blended %.
    const totalAllocShares = exactAllocations.reduce(
      (s, a) => s + Math.max(0, parseFloat(a.shares || "0")),
      0,
    );
    const totalAllocCost = exactAllocations.reduce(
      (s, a) => s + Math.max(0, parseFloat(a.costBasis || "0")),
      0,
    );
    for (const alloc of exactAllocations) {
      const gift = giftById.get(String(alloc.giftId));
      if (!gift) continue;
      const original = Math.max(0, parseFloat(alloc.costBasis || "0"));
      const allocShares = Math.max(0, parseFloat(alloc.shares || "0"));
      const proportion = totalAllocShares > 0
        ? allocShares / totalAllocShares
        : (totalAllocCost > 0 ? original / totalAllocCost : 0);
      const todayVal = currentValue > 0 ? proportion * currentValue : original;
      const delta = todayVal - original;
      const pct = original > 0 ? (delta / original) * 100 : 0;
      const giftIdStr = gift.id ? String(gift.id) : null;
      const giftDate = (gift as any).settledAt || (gift as any).createdAt || null;
      // Keyed by the SAME identity as uniqueMap (gifterIdentityKey), so the
      // contributor row's c.id lookup below finds its detail rows even when the
      // person used different names across gifts.
      const senderKey = gifterIdentityKey(gift.senderName, (gift as any).senderEmail, (gift as any).isAnonymous);
      // React key MUST be the allocation row's PK, not the gift's PK.
      // A single gift can produce multiple gift_allocations rows for the
      // same ticker (managed-mix splits, rebalance top-ups, partial
      // fills) — when that happens, keying on giftId collides and React
      // warns "Encountered two children with the same key." alloc.id is
      // unique per allocation row, so it's the natural key here. giftId
      // stays available on `row.giftId` below for the navigate-to-gift
      // button — that uses the gift's id, not the React key.
      const allocIdStr = alloc.id ? String(alloc.id) : `${giftIdStr || "noid"}-${original}-${todayVal}`;
      const giftMessage = typeof gift.message === "string" ? gift.message.trim() : "";
      const row: GiftDetailRow = {
        key: allocIdStr,
        giftId: giftIdStr,
        date: giftDate,
        original,
        todayVal,
        delta,
        pct,
        message: giftMessage || null,
      };
      const existing = map.get(senderKey);
      if (existing) existing.push(row); else map.set(senderKey, [row]);
    }
    // Sort each contributor's gifts newest-first.
    map.forEach((rows) => {
      rows.sort((a: GiftDetailRow, b: GiftDetailRow) =>
        new Date(String(b.date || 0)).getTime() - new Date(String(a.date || 0)).getTime(),
      );
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useExactAllocations, exactAllocations, currentValue, giftById]);

  // Expand state ONLY for anonymous multi-gift contributors. Anonymous isn't
  // really "one person" — it's a bucket of separate gifts that happen to share
  // the same generic label. So the row's tap CAN'T meaningfully navigate
  // (there's no single anonymous person, no filterable name) — it can only
  // reveal its contents. Single-gift rows + named multi-gift rows still tap
  // to navigate (the row IS or REPRESENTS one identifiable thing).
  // Was: `expandedAnonymous: boolean`. The inline expand was reserved for
  // the Anonymous bucket only; named multi-gift rows (e.g., "Dovi · 2
  // gifts") collapsed to one row that navigated to Memory Book on tap.
  // That handoff went to ALL of Dovi's gifts across every ticker, not
  // the specific gifts that built THIS holding — wrong answer for the
  // question being asked. New behavior: any multi-gift row (named or
  // anon) expands inline to show its specific gifts. State is the
  // expanded contributor's name (or null) so only one expands at a time.
  const [expandedContributorName, setExpandedContributorName] = useState<string | null>(null);
  useEffect(() => { setExpandedContributorName(null); }, [holding?.id]);

  return (
    <Sheet open={!!holding} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="overflow-y-auto max-h-[92vh]">
        {/* `name` (friendlyHoldingName) already carries a " (TICKER)" suffix
            for ETFs, so "{name} ({ticker})" rendered "Bonds (BND) (BND)" — a
            screen reader announced the ticker twice. Strip the suffix first,
            then append once, so it's always "Bonds (BND) holding details" /
            "Apple (AAPL) holding details" — ticker present once, never doubled.
            (2026-06-07, same redundancy fix as the dashboard holding rows.) */}
        <SheetTitle className="sr-only">{name.replace(new RegExp(`\\s*\\(${ticker}\\)\\s*$`, "i"), "").trim() || name} ({ticker}) holding details</SheetTitle>
        <SheetDescription className="sr-only">
          Position summary, price history, contributors, and actions for {name}.
        </SheetDescription>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <StockLogo ticker={ticker} size={44} />
          <div className="flex-1 min-w-0">
            <p className="font-heading text-lg font-bold text-foreground leading-tight">{name}</p>
            <p className="text-sm text-muted-foreground font-medium">
              {ticker}{info?.category ? ` · ${info.category}` : ""}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p
              className="font-heading text-xl font-bold text-foreground tabular-nums"
              aria-live={currentValueAnimating ? "off" : "polite"}
              aria-label={formatCurrency(currentValue)}
            >{formatCurrency(animatedCurrentValue)}</p>
            {costBasis > 0 && Math.abs(gain) > 0.01 && (
              <p
                className={`text-sm font-semibold tabular-nums ${isUp ? "text-green-600" : "text-red-500"}`}
                aria-live={gainAnimating ? "off" : "polite"}
                aria-label={`${isUp ? "+" : ""}${formatCurrency(gain)} (${isUp ? "+" : ""}${gainPct.toFixed(2)}%)`}
              >
                {isUp ? "+" : ""}{formatCurrency(animatedGain)} ({isUp ? "+" : ""}{gainPct.toFixed(2)}%)
              </p>
            )}
          </div>
        </div>


        {/* Featured single-gift spotlight removed: this slider is about THE
            STOCK (price, performance, who built the position). The story
            (sender + message + date) belongs in the contributor section
            below, where it scales naturally from 1 person → many. The
            contributor row already shows the message; the previous spotlight
            was a third repetition of the same data on the same screen. */}

        {/* About */}
        {info?.about && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-4 px-0.5">{info.about}</p>
        )}

        {/* What's inside — top holdings of the ETF.
            Only renders for tickers Kora has holdings data for (the ~8
            supported ETFs in client/src/lib/etf-holdings.ts). Individual
            stocks like AAPL skip this section because there's no
            underlying basket to display. Static data, manually updated
            quarterly per the maintenance discipline documented in that
            file — the "as of" date is shown explicitly so the parent
            knows it's not real-time. Per project_brokerage_as_trust_feature,
            showing the actual underlying companies turns the abstract
            "3,600 stocks in one fund" into concrete "you really do own
            pieces of these companies." Logos via the existing StockLogo
            (Parqet CDN) — same brand-mark vocabulary used everywhere
            else on parent surfaces. */}
        {(() => {
          const etfData = getEtfHoldings(ticker);
          if (!etfData) return null;
          const isBondFund = ticker.toUpperCase() === "BND";
          const sectionLabel = isBondFund ? "Top issuers" : "Top holdings";
          return (
            <div className="mb-4 px-0.5">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {sectionLabel}
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  As of {etfData.asOf}
                </p>
              </div>
              {/* Single-row horizontal scroll — locked 2026-05-19 per
                  the chip-row layout audit. Was flex-wrap, which broke
                  the top-10 holdings list into 2-3 rows of unequal
                  visual weight. One scrollable row reads as a clean
                  "top by weight, scroll for the rest" — top holding
                  on the left, weight tapers as the user swipes. Each
                  chip gets shrink-0 so flex doesn't compress them. */}
              <div className="kiddo-h-scroll gap-1.5 -mx-1 px-1">
                {etfData.topHoldings.map((h) => (
                  <div
                    key={h.ticker}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[hsl(var(--kiddo-evergreen)/0.20)] bg-[hsl(var(--kiddo-cream)/0.4)] pl-1 pr-2 py-0.5"
                    title={`${h.name} · ${h.weight.toFixed(2)}%`}
                  >
                    {/* Bond fund "tickers" (USGOV, FNMA, etc.) aren't real
                        equity tickers Parqet has logos for; skip the logo
                        in that case and let the StockLogo letter-fallback
                        not even fire. For everything else, the regular
                        StockLogo treatment applies. */}
                    {!isBondFund && (
                      <StockLogo ticker={h.ticker} size={14} className="shrink-0" />
                    )}
                    <span className="text-[11px] font-bold text-[hsl(var(--kiddo-evergreen))] tabular-nums">
                      {h.ticker}
                    </span>
                    <span className="text-[10.5px] font-medium text-muted-foreground tabular-nums">
                      {h.weight.toFixed(h.weight >= 10 ? 1 : 2)}%
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground/60 leading-relaxed">
                Source: {etfData.source}{etfData.totalAssets ? ` · ${etfData.totalAssets} total assets` : ""}
              </p>
            </div>
          );
        })()}

        {/* Price chart with per-gift buy markers (2026-05-25). Pass
            settledGifts (filtered upstream to settled + invested
            statuses); the chart filters AGAIN to gifts that target
            THIS ticker and renders one gold dot per buy at the closest
            historical price point. Off-range gifts are silently
            skipped — a gift made 18 months ago doesn't render on the
            1M view, only on 1Y / ALL where the timeline includes that
            date. Powers the visual "you bought here" anchor for the
            contributors block below. */}
        <StockPriceChart ticker={ticker} gifts={settledGifts} />

        {/* Position summary grid */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-muted/40 border border-border/30 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Shares owned</p>
            <p className="text-base font-bold text-foreground tabular-nums">{shareCount}</p>
            {pricePerShare > 0 && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{formatCurrency(pricePerShare)}/share now</p>
            )}
          </div>
          <div className="rounded-2xl bg-muted/40 border border-border/30 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Cost basis</p>
            <p
              className="text-base font-bold text-foreground tabular-nums"
              aria-live={costBasisAnimating ? "off" : "polite"}
              aria-label={formatCurrency(costBasis)}
            >{formatCurrency(animatedCostBasis)}</p>
            {avgCostPerShare > 0 && (
              <p className="text-[11px] text-muted-foreground mt-0.5">avg {formatCurrency(avgCostPerShare)}/share</p>
            )}
          </div>
          <div className="rounded-2xl bg-muted/40 border border-border/30 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Since first gift</p>
            {costBasis > 0 && Math.abs(gain) > 0.01 ? (
              <>
                <p
                  className={`text-base font-bold tabular-nums ${isUp ? "text-green-600" : "text-red-500"}`}
                  aria-live={gainAnimating ? "off" : "polite"}
                  aria-label={`${isUp ? "+" : ""}${formatCurrency(gain)}`}
                >
                  {isUp ? "+" : ""}{formatCurrency(animatedGain)}
                </p>
                <p className={`text-[11px] mt-0.5 font-medium ${isUp ? "text-green-500" : "text-red-400"}`}>
                  {isUp ? "+" : ""}{gainPct.toFixed(2)}%
                </p>
              </>
            ) : (
              <p className="text-base font-bold text-muted-foreground">--</p>
            )}
          </div>
          <div className="rounded-2xl bg-muted/40 border border-border/30 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Today</p>
            {todayQuote?.changePercent != null ? (
              <>
                <p className={`text-base font-bold tabular-nums ${todayQuote.changePercent >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {todayQuote.changePercent >= 0 ? "+" : ""}{todayQuote.changePercent.toFixed(2)}%
                </p>
                {todayQuote.change != null && shares > 0 && (
                  <p className={`text-[11px] mt-0.5 font-medium ${todayQuote.change >= 0 ? "text-green-500" : "text-red-400"}`}>
                    {todayQuote.change >= 0 ? "+" : ""}{formatCurrency(todayQuote.change * shares)} on your shares
                  </p>
                )}
              </>
            ) : (
              <p className="text-base font-bold text-muted-foreground">--</p>
            )}
          </div>
        </div>
        <div className="mt-2.5 rounded-2xl bg-muted/40 border border-border/30 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            {isOwnerMode ? "% of your fund" : recipientName ? `% of ${recipientName}'s fund` : "% of fund"}
          </p>
          <p className="text-base font-bold text-foreground tabular-nums">
            {portfolioPct > 0 ? `${portfolioPct.toFixed(1)}%` : "--"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {formatCurrency(currentValue)} of {formatCurrency(totalPortfolioValue)}
          </p>
        </div>

        {/* Contributors — always shown when there's at least one. Predictable
            structure beats "smart" hiding: the user expects this list to be
            in the same place every time they open a holding. */}
        {contributorList.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-muted-foreground shrink-0" />
              <p className="text-sm font-semibold text-foreground">
                {isManaged
                  ? `Everyone who built ${isOwnerMode ? "your" : recipientName ? `${recipientName}'s` : "this"} portfolio`
                  : contributorList.length === 1
                    ? `1 person chose ${ticker} for ${isOwnerMode ? "you" : recipientName || "this fund"}`
                    : `${contributorList.length} people chose ${ticker} for ${isOwnerMode ? "you" : recipientName || "this fund"}`}
              </p>
            </div>
            {isManaged && (
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                {useExactAllocations
                  ? `Each person's exact slice of ${ticker}, traced back to the gifts that funded this holding (including rebalanced positions).`
                  : `Each person's proportional slice of this holding, based on their share of total gifts.`}
              </p>
            )}
            <div className="space-y-2">
              {contributorList.slice(0, 6).map((c, i) => {
                const refPrice = isManaged ? pricePerShare : avgCostPerShare;
                const estShares = refPrice > 0 ? c.total / refPrice : null;
                // Three row archetypes, each with a distinct tap behavior:
                //
                //   1. SINGLE GIFT (any name) — row IS the gift. Tap →
                //      navigate to that gift entry. Visual: › arrow.
                //
                //   2. NAMED MULTI-GIFT (e.g., Mom · 4 gifts) — Mom is one
                //      person. Tap → navigate to Memory Book filtered to her
                //      gifts (scrolled to most recent). Visual: › arrow. No
                //      inline per-gift detail (Memory Book has the rich
                //      context — photos, messages — that the inline rows
                //      can't replicate).
                //
                //   3. MULTI-GIFT (any name) — Preferred: tap expands inline
                //      to show the specific gifts that built THIS holding.
                //      Was previously named-multi → "navigate to Memory Book
                //      filtered to this gifter," which handed off ALL their
                //      gifts across every ticker — wrong for the question
                //      ("who bought DPZ for me?"). Inline expand keeps the
                //      answer scoped to the holding being inspected.
                //
                //      Fallback: when exact per-gift allocations aren't
                //      tracked for this holding (legacy holdings created
                //      before allocation tracking, or managed-mix splits),
                //      detailRows is empty. In that case keep the old
                //      Memory-Book-by-gifter navigation so the row still
                //      goes somewhere useful when tapped.
                const singleGiftId = c.count === 1 ? c.giftId : null;
                const isMultiGift = c.count > 1;
                const detailRows = isMultiGift ? (giftDetailsByContributor.get(c.id) || []) : [];
                const visibleDetailRows = detailRows.slice(0, 5);
                const canExpandInline = isMultiGift && detailRows.length > 0;
                const isExpanded = canExpandInline && expandedContributorName === c.name;
                const navigateFn = singleGiftId && onNavigateToGift
                  ? () => { haptic("selection"); onClose(); onNavigateToGift(singleGiftId); }
                  : canExpandInline
                    ? () => {
                        haptic("selection");
                        setExpandedContributorName((cur) => cur === c.name ? null : c.name);
                      }
                    : isMultiGift && c.name !== "Anonymous" && onNavigateToGifter
                      ? () => { haptic("selection"); onClose(); onNavigateToGifter(c.name); }
                      : c.mostRecentGiftId && onNavigateToGift
                        ? () => { haptic("selection"); onClose(); onNavigateToGift(c.mostRecentGiftId!); }
                        : undefined;
                return (
                <div key={i}>
                  <ContributorRow
                    name={c.name}
                    total={c.total}
                    costBasisSlice={c.costBasisSlice}
                    count={c.count}
                    subtitle={isManaged ? undefined : c.count > 1 ? `${c.count} gifts` : undefined}
                    estimatedShares={estShares}
                    date={isManaged ? undefined : c.date}
                    message={c.message}
                    onNavigate={navigateFn}
                    isRecurring={c.isRecurring}
                    thankYouState={c.thankYouState}
                    showExpandChevron={canExpandInline}
                    isExpanded={isExpanded}
                  />
                  {canExpandInline && isExpanded && (
                    <div className="ml-9 mt-1 mb-1 space-y-1.5 border-l-2 border-border/50 pl-3">
                      {visibleDetailRows.map((r) => {
                        const showDelta = Math.abs(r.delta) >= 0.01;
                        const canNavigate = r.giftId && !!onNavigateToGift;
                        const inner = (
                          <>
                            <div className="min-w-0">
                              <p className="text-[11.5px] text-muted-foreground tabular-nums">
                                {r.date ? `${formatGiftDate(r.date)} · ` : ""}Original {formatCurrency(r.original)}
                              </p>
                              {/* Gift message (when present). Same italic-evergreen
                                  treatment as the single-gift contributor row's
                                  message preview — consistent register across
                                  collapsed and expanded views. Per
                                  feedback_memory_book_inversion.md: "note IS the
                                  entry." Critical for Anonymous expanded rows
                                  where each gift can have a distinct note. */}
                              {r.message && (
                                <p
                                  className="font-heading italic text-[hsl(var(--kiddo-evergreen))] mt-1 leading-snug"
                                  style={{ fontSize: 12, letterSpacing: "-0.005em" }}
                                >
                                  &ldquo;{r.message}&rdquo;
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-semibold text-foreground tabular-nums">{formatCurrency(r.todayVal)}</p>
                              {showDelta ? (
                                <p className={`text-[10px] font-semibold tabular-nums ${r.delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                                  {r.delta >= 0 ? "+" : ""}{formatCurrency(r.delta)} ({r.delta >= 0 ? "+" : ""}{r.pct.toFixed(1)}%)
                                </p>
                              ) : (
                                <p className="text-[10px] text-muted-foreground/70">at cost</p>
                              )}
                            </div>
                          </>
                        );
                        if (canNavigate && r.giftId) {
                          return (
                            <button
                              key={r.key}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                haptic("selection");
                                onNavigateToGift!(r.giftId!);
                              }}
                              data-testid={`gift-perf-row-${r.key}`}
                              className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-muted/40 transition-colors text-left"
                            >
                              {inner}
                            </button>
                          );
                        }
                        return (
                          <div
                            key={r.key}
                            data-testid={`gift-perf-row-${r.key}`}
                            className="flex items-center justify-between px-2.5 py-1.5"
                          >
                            {inner}
                          </div>
                        );
                      })}
                      {/* Overflow link — only reachable for anonymous multi
                          (detailRows is empty for other types). Navigates to
                          the most recent of the anon gifts since we can't
                          filter Memory Book by "Anonymous" as a name. */}
                      {detailRows.length > 3 && c.mostRecentGiftId && onNavigateToGift && (
                        <button
                          type="button"
                          onClick={() => { haptic("selection"); onClose(); onNavigateToGift(c.mostRecentGiftId!); }}
                          className="w-full text-left text-[11px] font-semibold text-[hsl(var(--kiddo-evergreen))] hover:underline px-2.5 py-1"
                        >
                          See all {detailRows.length} gifts in Memory Book →
                        </button>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
              {contributorList.length > 6 && (
                <p className="text-center text-xs text-muted-foreground pt-1">
                  +{contributorList.length - 6} more
                </p>
              )}
            </div>
          </div>
        )}

        {/* "Each gift, today" merged into the contributor list above — the
            per-gift performance rows now live inline under each multi-gift
            contributor (tap chevron to expand). Single source of truth: one
            section grouped by person, with gift-level detail one tap away
            for the multi-gift rows that actually have multiple gifts to show. */}

        {/* Actions — different shape for picks vs managed mix.
            Picks (NFLX, AAPL, DIS): per-ticker actions — add more / move to cash.
            Managed-mix slices (VTI, BND, VXUS, VGT): strategy-level actions —
            adding to ONE ETF off-ratio breaks the strategy promise; selling ONE
            ETF breaks diversification AND triggers a needless taxable event.
            For managed mix the unit of action is the strategy, not the ETF. */}
        {isReadOnly ? null : isManagedMix ? (
          <>
            {/* Stack full-width on mobile, side-by-side on desktop (2026-06-07,
                founder "the CTAs are crammed"). "Add to Growth Mix" + "Adjust
                strategy" are both long labels — at half-width on a phone they
                cram / wrap. Full-width stacked = roomy labels + bigger tap
                targets; sm:flex-row restores the pair where there's room. */}
            <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
              <Button
                className="flex-1 rounded-2xl gap-2"
                onClick={() => { haptic("medium"); onClose(); onAddToStrategy?.(); }}
                data-testid="button-holding-add-to-strategy"
              >
                <Layers size={15} />
                Add to {strategyLabel || "the mix"}
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-2xl gap-2"
                onClick={() => { haptic("light"); onClose(); onAdjustStrategy?.(); }}
                data-testid="button-holding-adjust-strategy"
              >
                Adjust strategy
                <ArrowRight size={14} />
              </Button>
            </div>
            {/* "the managed mix" fallback → "the diversified mix"
                2026-05-20. Cross-surface unification per the locked
                product-language pass. See twin notes on Activity.tsx
                and MemoryBook.tsx for the reasoning ("managed"
                connotes active management; "diversified" is factual
                and matches the rest of the product's vocabulary). */}
            <p className="mt-3 text-center text-[11.5px] text-muted-foreground leading-relaxed">
              Part of {strategyLabel || "the diversified mix"}. Adding spreads across every position to keep the ratio. To sell or rebalance, switch the strategy.
            </p>
          </>
        ) : (
          // Stack full-width on mobile, side-by-side on desktop — matches the
          // managed-mix actions above so both holding types feel consistent.
          <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
            <Button
              className="flex-1 rounded-2xl gap-2"
              onClick={() => { haptic("medium"); onClose(); onAddMore(ticker); }}
              data-testid="button-holding-add-more"
            >
              <Plus size={15} />
              Add more
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-2xl gap-2 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => { haptic("medium"); onClose(); onSell(holding); }}
              data-testid="button-holding-move-to-cash"
            >
              <TrendingDown size={15} />
              Move to cash
            </Button>
          </div>
        )}

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Price data via Yahoo Finance · 1-year daily closes · may be delayed{shares > 0 ? " · Share counts are estimates based on avg cost" : ""}
        </p>
      </SheetContent>
    </Sheet>
  );
}
