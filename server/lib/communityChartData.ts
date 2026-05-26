// computeCommunityChartData — extracted 2026-05-26 from the inline
// computation in the /api/kid-view/:token/content endpoint
// (server/routes.ts ~5579-5656). Same computation, two consumers:
//
//   1. KidView (kid-facing) — renders the chart as the kid's
//      self-portrait of who built their fund. Original consumer.
//   2. Dashboard (parent-facing) — surfaced 2026-05-26 alongside
//      the FundTabs ship. The chart was the strongest emotional
//      asset Kiddo has, hidden on the kid surface only. Surfacing
//      it on the parent's primary surface keeps the gifter loop
//      visible at the place parents spend the most time.
//
// Locked 2026-05-18 per the Target-vs-Walmart positioning
// discussion. The chart is the visual self-portrait of the
// audience Kiddo serves: kids surrounded by a community of
// people who care, building something real over time. The
// extraction preserves the exact computation; the kid-view
// route is refactored to call the helper rather than computing
// inline, eliminating drift risk between the two consumers.

const COMMUNITY_TOP_N = 6;

export type CommunitySeriesData = {
  label: string;
  totalUsd: number;
  points: Array<{ at: string; cumulative: number }>;
};

export type CommunityChartData = {
  fundStartedAt: string | null;
  totalContributors: number;
  series: CommunitySeriesData[];
};

type GiftLike = {
  id?: string;
  status?: string | null;
  message?: string | null;
  netAmount?: string | number | null;
  amount?: string | number | null;
  senderEmail?: string | null;
  senderName?: string | null;
  isAnonymous?: boolean | null;
  createdAt?: string | Date | null;
};

type FundLike = {
  recipientFirstName?: string | null;
  createdAt?: string | Date | null;
};

export function computeCommunityChartData(gifts: GiftLike[], fund: FundLike): CommunityChartData {
  // Status filter: only "real" contributions appear in the community
  // self-portrait. failed/refunded/canceled gifts are correctly
  // excluded; pending status is excluded too because the visual
  // would lie about contributions that haven't actually landed yet.
  const eligibleGifts = gifts.filter((g) => {
    const s = String(g.status || "").toLowerCase();
    return ["processing", "invested", "settled", "host_hold"].includes(s);
  });

  // Aggregate by sender_email (the canonical identity). Display
  // label is the most-recent non-empty sender_name; anonymous gifts
  // collapse into a single bucket so the chart doesn't lie about
  // "5 contributors" when 3 are repeat anonymous.
  const anonLabel = `Someone who loves ${fund.recipientFirstName || "this kid"}`;
  type GifterAgg = {
    email: string;
    label: string;
    totalUsd: number;
    events: Array<{ at: string; amount: number }>;
  };
  const aggByEmail = new Map<string, GifterAgg>();

  for (const g of eligibleGifts) {
    const isAnon = Boolean(g.isAnonymous);
    const rawEmail = String(g.senderEmail || "").trim().toLowerCase();
    const groupKey = isAnon ? "__anon__" : (rawEmail || `__unnamed_${g.id || Math.random()}__`);
    const rawName = String(g.senderName || "").trim();
    const displayLabel = isAnon ? anonLabel : (rawName || "A gifter");
    const amount = parseFloat(String(g.netAmount || g.amount || "0")) || 0;
    if (amount <= 0) continue;
    const at = g.createdAt ? new Date(g.createdAt as any).toISOString() : new Date().toISOString();
    let entry = aggByEmail.get(groupKey);
    if (!entry) {
      entry = { email: groupKey, label: displayLabel, totalUsd: 0, events: [] };
      aggByEmail.set(groupKey, entry);
    } else if (!isAnon && rawName && entry.label === "A gifter") {
      // Backfill display label if a later gift carried a name and
      // earlier didn't (most common case: gifter signed in with
      // magic link after their first anon-name gift).
      entry.label = rawName;
    }
    entry.totalUsd += amount;
    entry.events.push({ at, amount });
  }

  // Sort by total contribution descending, take top N as distinct
  // series. The rest bucket into "Others" so the chart stays
  // scannable. The "Others" bucket preserves total dollars and
  // event timing so the chart's overall shape stays honest.
  const allGifters = Array.from(aggByEmail.values()).sort((a, b) => b.totalUsd - a.totalUsd);
  const topGifters = allGifters.slice(0, COMMUNITY_TOP_N);
  const restGifters = allGifters.slice(COMMUNITY_TOP_N);
  const seriesList: Array<{ label: string; totalUsd: number; events: Array<{ at: string; amount: number }> }> = topGifters.map((g) => ({
    label: g.label,
    totalUsd: Number(g.totalUsd.toFixed(2)),
    events: g.events,
  }));

  if (restGifters.length > 0) {
    const othersTotal = restGifters.reduce((s, g) => s + g.totalUsd, 0);
    const othersEvents = restGifters.flatMap((g) => g.events);
    seriesList.push({
      label: restGifters.length === 1 ? "1 other" : `${restGifters.length} others`,
      totalUsd: Number(othersTotal.toFixed(2)),
      events: othersEvents,
    });
  }

  // Per-series cumulative path. For each series, sort events ASC
  // by date, then emit a running cumulative total. The client
  // renders a step-stacked area chart from this.
  const series = seriesList.map((s) => {
    const sorted = [...s.events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    let running = 0;
    const points = sorted.map((e) => {
      running += e.amount;
      return { at: e.at, cumulative: Number(running.toFixed(2)) };
    });
    return { label: s.label, totalUsd: s.totalUsd, points };
  });

  return {
    fundStartedAt: fund.createdAt ? new Date(fund.createdAt as any).toISOString() : null,
    totalContributors: allGifters.length,
    series,
  };
}
