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

  // Aggregate by canonical identity. Three identity tiers exist:
  //   1. Real email → bucket by lowercased email (gifters who left
  //      contact info, including magic-link gifters).
  //   2. No email but a real name → bucket by lowercased name (handles
  //      "Aunt Sally" cash gifts where the parent typed a name but
  //      didn't capture an email; two such gifts aggregate by name).
  //   3. Anonymous → bucket as __anon__ (the explicit isAnonymous flag
  //      OR the implicit "no email + name missing or matches the
  //      anon-label string" case). All anonymous gifts across the
  //      lifetime of the fund collapse into ONE legend entry. Previous
  //      behavior bucketed by `__unnamed_${gift_id}__` which created
  //      a separate "Someone who loves Emma" entry per gift —
  //      audit-flagged 2026-05-26.
  //
  // Why the implicit-anon catch matters: gifters can land in case (3)
  // through three paths — explicit anonymous toggle, name field left
  // empty entirely, or typing the anon-label string into the name
  // field (some gifters type "Anonymous" or "Someone who loves Emma"
  // themselves). All three should aggregate; previously only the
  // first did.
  const anonLabel = `Someone who loves ${fund.recipientFirstName || "this kid"}`;
  const anonLabelLower = anonLabel.toLowerCase();
  type GifterAgg = {
    email: string;
    label: string;
    totalUsd: number;
    events: Array<{ at: string; amount: number }>;
  };
  const aggByEmail = new Map<string, GifterAgg>();

  for (const g of eligibleGifts) {
    const amount = parseFloat(String(g.netAmount || g.amount || "0")) || 0;
    if (amount <= 0) continue;

    const isAnonFlag = Boolean(g.isAnonymous);
    const rawEmail = String(g.senderEmail || "").trim().toLowerCase();
    const rawName = String(g.senderName || "").trim();
    const rawNameLower = rawName.toLowerCase();
    // The name "looks anonymous" if it's empty OR matches the system
    // anon-label string (case-insensitive). The case-insensitive match
    // catches "Anonymous", "anonymous", "Someone who loves Emma",
    // "someone who loves emma", etc.
    const nameLooksAnon = !rawName
      || rawNameLower === anonLabelLower
      || rawNameLower === "anonymous";
    const treatAsAnon = isAnonFlag || (!rawEmail && nameLooksAnon);

    let groupKey: string;
    let displayLabel: string;
    if (treatAsAnon) {
      groupKey = "__anon__";
      displayLabel = anonLabel;
    } else if (rawEmail) {
      groupKey = rawEmail;
      displayLabel = rawName || "A gifter";
    } else {
      // No email but has a non-anon-looking name. Bucket by lowercased
      // name so multiple "Aunt Sally" gifts (without emails) aggregate
      // into one band instead of N separate bands. The `__name_`
      // prefix prevents collision with email-based keys (an email like
      // `__name_sally@x.com` can't exist).
      groupKey = `__name_${rawNameLower}__`;
      displayLabel = rawName;
    }

    const at = g.createdAt ? new Date(g.createdAt as any).toISOString() : new Date().toISOString();
    let entry = aggByEmail.get(groupKey);
    if (!entry) {
      entry = { email: groupKey, label: displayLabel, totalUsd: 0, events: [] };
      aggByEmail.set(groupKey, entry);
    } else if (!treatAsAnon && rawName && entry.label === "A gifter") {
      // Backfill display label if a later gift carried a name and
      // earlier didn't (most common case: email-only first gift,
      // then a later gift adds the gifter's name).
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
