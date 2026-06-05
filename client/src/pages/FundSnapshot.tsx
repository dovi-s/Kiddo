import { useEffect, useMemo, useState } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Printer, ArrowLeft, Settings2 } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { capFirst } from "@/lib/format-name";
import { useAuth } from "@/hooks/use-auth";
import { useFunds } from "@/hooks/use-funds";
import { useCountUp } from "@/hooks/use-count-up";
import { getMajorityAgeForState, US_STATES } from "@shared/utma";
import { projectFundValue } from "@shared/projection";
import type { Fund, Holding, Gift } from "@shared/schema";

// ── Print-ready snapshot of a single fund ─────────────────────────────────────
// One-page artifact for sharing OUTSIDE the app — to a non-gifter spouse, a
// grandparent who hasn't installed, an advisor, an estate planner. NOT a new
// nav section. Reachable via a "Print snapshot" action in the Share modal.
//
// Architecture choices:
//  - Auth-required, parent-only. The parent prints/PDFs and shares the FILE,
//    not the URL — no token system, no sharing-link revocation surface.
//  - Sized for US Letter (8.5" × 11") with print-first CSS so Cmd-P / Ctrl-P
//    produces a clean PDF without modification.
//  - Opens in a new tab so it doesn't disturb the dashboard the parent was on.
//  - Toggle controls (gift list, names, projection, exact amounts) so the
//    parent can match the audience — full detail to spouse, anonymized to
//    advisor, projection-only to extended family.
//  - Reuses /api/funds/:id/dashboard-summary so the data matches what Dashboard
//    shows. Single round-trip, cached by the existing query.
//  - No SSN, no last name (unless parent toggles it on), no transaction IDs,
//    no internal references — only data the parent would willingly hand to a
//    third party.

function formatCurrency(value: number, withCents = true): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: withCents ? 2 : 0,
    maximumFractionDigits: withCents ? 2 : 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDateLong(value: string | Date | null | undefined): string {
  if (!value) return "";
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function formatDateShort(value: string | Date | null | undefined): string {
  if (!value) return "";
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

interface DashboardSummary {
  fundId: string;
  holdings: Holding[];
  gifts: Gift[];
  events: Array<any>;
  history: Array<{ snapshotDate: string; investedValue: string; cashValue: string; totalValue: string; principalBasis: string }>;
}

export default function FundSnapshot() {
  const { fundId } = useParams<{ fundId: string }>();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: funds = [] } = useFunds();

  const params = new URLSearchParams(search);
  // Toggle defaults — parent can override via URL or via the tray. The
  // defaults are "show everything reasonable" because the most common share
  // case is to a spouse or grandparent who wants the full picture.
  const [showGifts, setShowGifts] = useState(params.get("gifts") !== "0");
  const [showNames, setShowNames] = useState(params.get("names") !== "0");
  const [showProjection, setShowProjection] = useState(params.get("projection") !== "0");
  const [exactAmounts, setExactAmounts] = useState(params.get("rounded") !== "1");
  const [showLastName, setShowLastName] = useState(params.get("lastname") === "1");
  const [autoPrinted, setAutoPrinted] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // Auto-print when ?print=1 — for a "Print directly" affordance from the
  // Share modal that skips the toolbar. Fires once after data loads.
  useEffect(() => {
    if (params.get("print") === "1" && !autoPrinted && !authLoading) {
      const t = window.setTimeout(() => {
        window.print();
        setAutoPrinted(true);
      }, 600);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, autoPrinted]);

  const fund = funds.find((f) => f.id === fundId) || null;

  const { data: summary } = useQuery<DashboardSummary>({
    queryKey: ["/api/funds", fundId, "dashboard-summary"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/dashboard-summary`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json();
    },
    enabled: !!fundId && isAuthenticated,
    staleTime: 30_000,
  });

  // Holdings sorted by current value descending. Was unsorted in
  // v1 — top of the list could be the third-largest position, which
  // reads as random on an advisor-facing snapshot. Audit-flagged
  // 2026-05-26: VTI ($263) was at the top but GOOGL ($312, the
  // largest single holding) was buried mid-list. Now the biggest
  // positions anchor the top.
  const holdings = useMemo(
    () =>
      (summary?.holdings || [])
        .filter((h) => parseFloat(h.shares || "0") > 0.0001)
        .sort((a, b) => parseFloat(String(b.currentValue || "0")) - parseFloat(String(a.currentValue || "0"))),
    [summary],
  );

  // Gift filter — also excludes obvious test-data gifts (sender
  // name is "test" / "testing" or matches the obvious test pattern).
  // The proper isTestUser-aware filter lives server-side and joins
  // gifts to users by sender_email; until that ships, this
  // client-side pattern catches the bulk of the dev-data leakage
  // on the audit/advisor-facing snapshot. Audit-flagged 2026-05-26.
  const gifts = useMemo(
    () =>
      (summary?.gifts || [])
        // 2026-05-15 alignment with Dashboard's gifterRoster filter:
        // dropped "processing" from this snapshot's gift list. The
        // snapshot is the print/PDF-export surface that parents share
        // with advisors and family — a processing gift shown here as
        // "received" while the Dashboard hero shows it as "settling"
        // creates surface-to-surface drift. Use settled+invested only
        // so the snapshot matches the Dashboard position statement.
        // Processing gifts will appear on next snapshot fetch once
        // they settle (1-2 business days).
        .filter((g) => ["settled", "invested"].includes(String(g.status || "").toLowerCase()))
        .filter((g) => {
          // Test-data exclusion — names that match dev-test patterns.
          // Real user names that happen to contain "test" as a substring
          // (e.g., "Testa", "Steston") are NOT excluded; this is a
          // strict equality / leading-test match against obvious dev
          // placeholders only.
          const name = String(g.senderName || "").trim().toLowerCase();
          if (!name) return true; // anon gifts always allowed
          if (name === "test" || name === "testing" || name === "qqqqq" || name === "tstgin") return false;
          return true;
        })
        .sort((a, b) => new Date(String((b as any).settledAt || b.createdAt)).getTime() - new Date(String((a as any).settledAt || a.createdAt)).getTime()),
    [summary],
  );

  // Auto-invest system-message regex. Auto-invest schedules append
  // a boilerplate "Auto-invest contribution to X's Fund." message
  // to gift rows on schedule firing. On Memory Book that gets
  // suppressed via AUTO_INVEST_MEMORY_RE (server-side filter); on
  // this snapshot we need the same filter at the message-render
  // level so an advisor doesn't see "Auto-invest contribution to
  // Emma's Fund." quoted as if it were a personal note. Audit-
  // flagged 2026-05-26.
  const AUTO_INVEST_MSG_RE = /^auto-invest contribution to .+'s fund\.?$/i;

  const balance = fund
    ? parseFloat(String(fund.balance || "0")) +
      parseFloat(String((fund as any).pendingBalance || "0")) +
      parseFloat(String((fund as any).cashBalance || "0"))
    : 0;
  const costBasis = useMemo(
    () => holdings.reduce((sum, h) => sum + parseFloat(String(h.costBasis || "0")), 0),
    [holdings],
  );
  const gain = balance - costBasis;
  const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0;
  const isUp = gain >= 0;

  // Count-up on the snapshot hero + stats. People print/share this
  // surface — the count-up makes the cold-mount load read as the
  // gift moment expanding, not as a static number flashing in.
  // Stats strip animates in parallel; the projection at majority
  // age is the most ceremonial of the four and gets the same
  // treatment as Projection.tsx's hero number.
  const { value: animatedBalance, isAnimating: balanceAnimating } = useCountUp({
    from: balance * 0.95,
    to: balance,
    duration: 1000,
    enabled: balance > 0,
  });
  const { value: animatedGain, isAnimating: gainAnimating } = useCountUp({
    from: 0,
    to: gain,
    duration: 1000,
    enabled: Math.abs(gain) > 0.01,
  });

  // Contributor + gift counts. Distinct (case-insensitive) named contributors
  // + a single "Anonymous" bucket if any anon gifts exist.
  const stats = useMemo(() => {
    const namedContribs = new Set<string>();
    let anonCount = 0;
    let totalGifts = 0;
    for (const g of gifts) {
      totalGifts += 1;
      const name = String(g.senderName || "").trim();
      const isAnon = !name || /^someone who loves/i.test(name) || name.toLowerCase() === "anonymous";
      if (isAnon) anonCount += 1;
      else namedContribs.add(name.toLowerCase());
    }
    return {
      contributorCount: namedContribs.size + (anonCount > 0 ? 1 : 0),
      giftCount: totalGifts,
    };
  }, [gifts]);

  const sinceDate = useMemo(() => {
    if (gifts.length === 0) return null;
    const oldest = gifts[gifts.length - 1];
    return (oldest as any).settledAt || oldest.createdAt;
  }, [gifts]);

  // Projection at age 18 — routes through the canonical projectFundValue
  // helper (shared/projection.ts) so this surface gets the same fee-netted
  // and effective-rate-compounded math as the Projection page, Calculator,
  // Dashboard, Age 18 Plan, and Memory Book "On track for $X" lines.
  // Migrated from raw Math.pow(1.07, yearsLeft) on 2026-05-21 as part of
  // the projection-helper consolidation sweep — previously this surface
  // skipped the AUM-fee netting and used raw 1.07^years, so its numbers
  // ran ~0.1% higher than the canonical surfaces. Now consistent.
  // State-specific majority age — read from the fund's state via the
  // shared US_STATES lookup. Hoisted above the projection useMemo so
  // the projection math respects state variance (was previously
  // hardcoded to dob+18, which over-projected by ~3 years of compound
  // growth for IL/WI/CA/MS and other non-18 statutes — a ~20-30%
  // overstatement of the projected balance for those states). Audit
  // 2026-05-25 caught.
  // Effective majority age. Prefer an explicit per-account election (the
  // stored majorityAge field — e.g. a CA custodian electing 21, which CA
  // UTMA permits) since that is the legal truth for THIS fund and is what
  // Age18Plan / GiftSuccess already use. Fall back to the state statutory
  // default only when no election was made (stored value is the schema
  // default of 18), preserving the state-variance fix for funds that never
  // set an explicit age. Without this, an elected-21 fund (every Dunphy
  // demo fund) showed "Est. at 18" here while the rest of the app said 21.
  const storedMajorityAge = Number((fund as any)?.majorityAge);
  const fundMajorityAge = fund
    ? (storedMajorityAge && storedMajorityAge !== 18
        ? storedMajorityAge
        : getMajorityAgeForState((fund as any).recipientState || ""))
    : 18;
  const projectionAtMajority = useMemo(() => {
    if (!fund || !showProjection) return null;
    const birthdate = (fund as any).recipientBirthdate;
    if (!birthdate) return null;
    const dob = new Date(birthdate);
    if (Number.isNaN(dob.getTime())) return null;
    const majorityDate = new Date(dob);
    majorityDate.setFullYear(dob.getFullYear() + fundMajorityAge);
    const yearsLeft = (majorityDate.getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000);
    if (yearsLeft <= 0) return null;
    const projected = projectFundValue({
      startingValue: balance,
      // INTENTIONAL: a formal statement projects only the CURRENT balance
      // forward — it doesn't assume the parent keeps contributing. This makes
      // "Est. at {age}" deliberately lower than the dashboard's "On track for
      // $X", which includes ongoing recurring. The footnote spells this out so
      // the two surfaces don't read as a contradiction. Do not change to a
      // recurring amount to "match" the dashboard. 2026-06-05.
      monthlyContribution: 0,
      yearsAhead: yearsLeft,
    });
    return { value: projected, atDate: majorityDate };
  }, [fund, balance, showProjection, fundMajorityAge]);

  // Count-up on the stats strip + projection. Same ceremony as the
  // Projection page hero number — the projection at majority is the
  // most aspirational number on this surface, so it gets the slower
  // 1.2s curve. Counts (gifters / gifts received) animate quickly
  // and round to integers via Math.round on the rendered side.
  const { value: animatedContributorCount, isAnimating: contributorCountAnimating } = useCountUp({
    from: 0,
    to: stats.contributorCount,
    duration: 700,
    enabled: stats.contributorCount > 0,
  });
  const { value: animatedGiftCount, isAnimating: giftCountAnimating } = useCountUp({
    from: 0,
    to: stats.giftCount,
    duration: 700,
    enabled: stats.giftCount > 0,
  });
  const projectionValue = projectionAtMajority?.value ?? 0;
  const { value: animatedProjectionAt18, isAnimating: projectionAt18Animating } = useCountUp({
    from: projectionValue * 0.6,
    to: projectionValue,
    duration: 1200,
    enabled: projectionValue > 0,
  });

  const childFirst = capFirst(fund?.recipientFirstName) || "Your child";
  const childLast = capFirst((fund as any)?.recipientLastName) || "";
  const displayName = showLastName && childLast ? `${childFirst} ${childLast}` : childFirst;
  const generatedAt = formatDateLong(new Date());
  const stateName = fund ? US_STATES.find((s) => s.code === (fund as any).recipientState)?.name : null;
  // Alias retained so other call sites that read `majorityAge` below
  // keep working without churn. The hoisted const is fundMajorityAge.
  const majorityAge = fundMajorityAge;

  const fmt = (v: number) => formatCurrency(v, exactAmounts);
  const ownerName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();

  if (authLoading || !fund) {
    // Skeleton that sketches the final PDF layout — toolbar, hero card
    // with name + balance, two stat rows, a holdings table, a gifts list.
    // Mirrors the real snapshot's geometry so the swap to live content
    // doesn't reflow the page. Print-style sans-serif keeps the
    // load state visually consistent with the artifact it's about to
    // become.
    return (
      <div className="snapshot-loading-shell">
        <div className="snapshot-loading-toolbar">
          <div className="snapshot-loading-pill" style={{ width: 70 }} />
          <div className="snapshot-loading-pill" style={{ width: 160 }} />
          <div className="snapshot-loading-pill" style={{ width: 80 }} />
        </div>
        <div className="snapshot-loading-page">
          <div className="snapshot-loading-header">
            <div className="snapshot-loading-line" style={{ width: "55%", height: 22 }} />
            <div className="snapshot-loading-line" style={{ width: "30%", height: 10, marginTop: 6 }} />
          </div>
          <div className="snapshot-loading-hero">
            <div className="snapshot-loading-line" style={{ width: 90, height: 10 }} />
            <div className="snapshot-loading-line" style={{ width: 220, height: 36, marginTop: 10 }} />
            <div className="snapshot-loading-line" style={{ width: 160, height: 12, marginTop: 10 }} />
          </div>
          <div className="snapshot-loading-stat-row">
            <div className="snapshot-loading-stat" />
            <div className="snapshot-loading-stat" />
            <div className="snapshot-loading-stat" />
          </div>
          <div className="snapshot-loading-section">
            <div className="snapshot-loading-line" style={{ width: 120, height: 11, marginBottom: 12 }} />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="snapshot-loading-list-row">
                <div className="snapshot-loading-line" style={{ width: "45%", height: 10 }} />
                <div className="snapshot-loading-line" style={{ width: "20%", height: 10 }} />
              </div>
            ))}
          </div>
          <div className="snapshot-loading-section">
            <div className="snapshot-loading-line" style={{ width: 140, height: 11, marginBottom: 12 }} />
            {[0, 1, 2].map((i) => (
              <div key={i} className="snapshot-loading-list-row">
                <div className="snapshot-loading-line" style={{ width: "55%", height: 10 }} />
                <div className="snapshot-loading-line" style={{ width: "18%", height: 10 }} />
              </div>
            ))}
          </div>
        </div>
        <style>{`
          .snapshot-loading-shell{min-height:100vh;background:#faf7f2;font-family:'DM Sans',system-ui,sans-serif;padding:24px 16px}
          .snapshot-loading-toolbar{display:flex;align-items:center;justify-content:space-between;max-width:760px;margin:0 auto 24px;padding:0 4px}
          .snapshot-loading-pill{height:24px;background:rgba(0,0,0,0.06);border-radius:9999px}
          .snapshot-loading-page{max-width:760px;margin:0 auto;background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 1px 3px rgba(0,0,0,0.04)}
          .snapshot-loading-header{margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid rgba(0,0,0,0.06)}
          .snapshot-loading-hero{padding:20px;background:rgba(0,0,0,0.025);border-radius:12px;margin-bottom:20px}
          .snapshot-loading-stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
          .snapshot-loading-stat{height:60px;background:rgba(0,0,0,0.04);border-radius:10px}
          .snapshot-loading-section{margin-bottom:24px;padding:16px;background:rgba(0,0,0,0.02);border-radius:10px}
          .snapshot-loading-list-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0}
          .snapshot-loading-line{background:rgba(0,0,0,0.06);border-radius:4px;display:inline-block}
        `}</style>
      </div>
    );
  }

  return (
    <div className="snapshot-root">
      {/* Toolbar — hidden in print via the @media print rule below */}
      <div className="snapshot-toolbar" data-testid="snapshot-toolbar">
        <button
          type="button"
          onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/dashboard")}
          className="snapshot-toolbar-button"
          data-testid="button-snapshot-back"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="snapshot-toolbar-title">{displayName}'s fund snapshot</div>
        <div className="snapshot-toolbar-actions">
          <details className="snapshot-options">
            <summary>
              <Settings2 size={14} />
              Options
            </summary>
            <div className="snapshot-options-panel">
              <p className="snapshot-options-label">What to include</p>
              <label><input type="checkbox" checked={showGifts} onChange={(e) => setShowGifts(e.target.checked)} /> Gift history</label>
              <label><input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} disabled={!showGifts} /> Gifter names</label>
              <label><input type="checkbox" checked={showProjection} onChange={(e) => setShowProjection(e.target.checked)} /> Projection at {fundMajorityAge}</label>
              <label><input type="checkbox" checked={exactAmounts} onChange={(e) => setExactAmounts(e.target.checked)} /> Exact amounts (vs rounded)</label>
              {/* Disabled when the fund has no recipientLastName on file —
                  AddFundSheet captures last name optionally, so older / quick
                  funds may not have one. A toggle that produces no visible
                  change reads as broken; better to disable it and explain. */}
              <label style={{ opacity: childLast ? 1 : 0.55 }}>
                <input
                  type="checkbox"
                  checked={showLastName && !!childLast}
                  onChange={(e) => setShowLastName(e.target.checked)}
                  disabled={!childLast}
                />{" "}
                Include last name
                {!childLast && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                    (none on file. Add it in {childFirst}'s profile.)
                  </span>
                )}
              </label>
            </div>
          </details>
          <button
            type="button"
            onClick={() => window.print()}
            className="snapshot-toolbar-button snapshot-toolbar-button--primary"
            data-testid="button-snapshot-print"
          >
            <Printer size={14} />
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* The page itself — sized for US Letter, padded for safe print margins */}
      <div className="snapshot-page" data-testid="snapshot-page">
        {/* Top brand strip */}
        <div className="snapshot-header">
          {/* Brand strip — the Logo's built-in wordmark is suppressed so the
              custom .snapshot-brand-text wordmark (Bricolage 22px dark green)
              owns the visible "Kiddo" treatment. Print-page register favors
              that bolder dark-green look over the Logo's shimmer-gradient
              default. Without `showWordmark={false}` we'd render the brand
              name twice (Logo's wordmark + this span), which the parent
              flagged as "Kiddo Kiddo Kiddo" in the header. */}
          <div className="snapshot-brand">
            <Logo size="md" className="text-foreground" showWordmark={false} />
            <span className="snapshot-brand-text">Kiddo</span>
          </div>
          <div className="snapshot-meta">
            <p className="snapshot-meta-line">{displayName}'s Fund · UTMA</p>
            <p className="snapshot-meta-date">As of {generatedAt}</p>
          </div>
        </div>

        {/* Hero — balance + gain */}
        <div className="snapshot-hero">
          <p className="snapshot-eyebrow">Total balance</p>
          <p
            className="snapshot-balance"
            aria-live={balanceAnimating ? "off" : "polite"}
            aria-label={fmt(balance)}
          >{fmt(animatedBalance)}</p>
          {Math.abs(gain) > 0.01 && (
            <p
              className={`snapshot-gain ${isUp ? "is-up" : "is-down"}`}
              aria-live={gainAnimating ? "off" : "polite"}
              aria-label={`${isUp ? "+" : ""}${fmt(gain)} (${isUp ? "+" : ""}${gainPct.toFixed(2)}%) all-time`}
            >
              {isUp ? "+" : ""}{fmt(animatedGain)} ({isUp ? "+" : ""}{gainPct.toFixed(2)}%) all-time
            </p>
          )}
          {/* The principal put in. The stats strip shows the gift COUNT (134),
              but every audience — spouse, grandparent, advisor — wants the gift
              DOLLARS that grew into the balance. Cost basis = the total
              invested. Completes the "$X in → $Y today" story. 2026-06-05. */}
          {costBasis > 0 && (
            <p className="snapshot-contributed">From {fmt(costBasis)} in gifts</p>
          )}
        </div>

        {/* Stats strip */}
        <div className="snapshot-stats">
          <div className="snapshot-stat">
            <p className="snapshot-stat-label">Gifters</p>
            <p
              className="snapshot-stat-value"
              aria-live={contributorCountAnimating ? "off" : "polite"}
              aria-label={String(stats.contributorCount)}
            >{Math.round(animatedContributorCount)}</p>
          </div>
          <div className="snapshot-stat">
            <p className="snapshot-stat-label">Gifts received</p>
            <p
              className="snapshot-stat-value"
              aria-live={giftCountAnimating ? "off" : "polite"}
              aria-label={String(stats.giftCount)}
            >{Math.round(animatedGiftCount)}</p>
          </div>
          <div className="snapshot-stat">
            <p className="snapshot-stat-label">Active since</p>
            <p className="snapshot-stat-value">{sinceDate ? formatDateShort(sinceDate) : "Just started"}</p>
          </div>
          {projectionAtMajority && (
            <div className="snapshot-stat">
              <p className="snapshot-stat-label">Est. at {majorityAge}</p>
              <p
                className="snapshot-stat-value"
                aria-live={projectionAt18Animating ? "off" : "polite"}
                aria-label={fmt(projectionValue)}
              >{fmt(animatedProjectionAt18)}</p>
            </div>
          )}
        </div>

        {/* Holdings */}
        {holdings.length > 0 && (
          <div className="snapshot-section">
            <p className="snapshot-section-label">Current holdings</p>
            <div className="snapshot-holdings">
              {holdings.map((h) => {
                const value = parseFloat(String(h.currentValue || "0"));
                const basis = parseFloat(String(h.costBasis || "0"));
                const hgain = value - basis;
                const hisUp = hgain >= 0;
                // Delta column standardization: always render the gain
                // column with explicit "—" when |gain| < $0.01. Was a
                // conditional render in v1 which made some rows show a
                // delta and others not — read as "missing data." Per
                // an advisor-facing surface, consistent column layout
                // matters more than visual chrome. Audit-flagged
                // 2026-05-26.
                const hasMeaningfulGain = Math.abs(hgain) > 0.01;
                // Position weight — the standard brokerage-statement column. An
                // advisor scans these to see concentration; "<1%" matches the
                // dashboard's holding-weight format. value ÷ total, no risky
                // math. 2026-06-05.
                const pctOfFund = balance > 0 ? (value / balance) * 100 : 0;
                return (
                  <div key={h.id} className="snapshot-holding">
                    <div className="snapshot-ticker">{h.ticker}</div>
                    <div className="snapshot-holding-name">{h.name || h.ticker}</div>
                    <div className="snapshot-holding-value">{fmt(value)}</div>
                    {hasMeaningfulGain ? (
                      <div className={`snapshot-holding-gain ${hisUp ? "is-up" : "is-down"}`}>
                        {hisUp ? "+" : ""}{fmt(hgain)}
                      </div>
                    ) : (
                      <div className="snapshot-holding-gain snapshot-holding-gain--neutral">—</div>
                    )}
                    {pctOfFund > 0 && (
                      <div className="snapshot-holding-pct">
                        {pctOfFund < 1 ? "<1" : Math.round(pctOfFund)}% of fund
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Gift history */}
        {showGifts && gifts.length > 0 && (
          <div className="snapshot-section">
            <p className="snapshot-section-label">Gift history</p>
            <div className="snapshot-gifts">
              {gifts.map((g) => {
                const name = String(g.senderName || "").trim();
                const isAnon = !name || /^someone who loves/i.test(name) || name.toLowerCase() === "anonymous";
                const displayGifter = !showNames || isAnon ? "Anonymous" : name;
                const initial = displayGifter.slice(0, 1).toUpperCase();
                const amount = parseFloat(String(g.netAmount || g.amount || "0"));
                const date = (g as any).settledAt || g.createdAt;
                // Suppress the auto-invest boilerplate message from
                // the displayed quote — same pattern Memory Book uses
                // via AUTO_INVEST_MEMORY_RE on the server side. An
                // advisor reading the snapshot doesn't need to see
                // "Auto-invest contribution to Emma's Fund." quoted
                // as if a gifter wrote it. The gift itself still
                // renders; only the system-generated message text
                // is hidden. Audit-flagged 2026-05-26.
                const rawMessage = String(g.message || "").trim();
                const displayMessage = rawMessage && !AUTO_INVEST_MSG_RE.test(rawMessage) ? rawMessage : null;
                return (
                  <div key={g.id} className="snapshot-gift">
                    <div className="snapshot-gift-avatar">{initial}</div>
                    <div className="snapshot-gift-body">
                      <p className="snapshot-gift-name">{displayGifter}</p>
                      {displayMessage && showNames && (
                        <p className="snapshot-gift-message">"{displayMessage.slice(0, 120)}{displayMessage.length > 120 ? "…" : ""}"</p>
                      )}
                    </div>
                    <div className="snapshot-gift-meta">
                      <p className="snapshot-gift-amount">{fmt(amount)}</p>
                      <p className="snapshot-gift-date">{formatDateShort(date)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* What this means / disclosure */}
        <div className="snapshot-disclosure">
          <p className="snapshot-disclosure-title">{displayName}'s fund is invested in real markets.</p>
          <p className="snapshot-disclosure-body">
            Once investing is live, every gift is invested in publicly-traded stocks through <strong>our broker-dealer partner</strong>, Member FINRA / SIPC.
            {stateName && (
              <>
                {" "}This is a Uniform Transfers to Minors Act (UTMA) custodial account registered in <strong>{stateName}</strong>.
                {" "}{displayName} takes full legal control of this fund at age <strong>{majorityAge}</strong>{projectionAtMajority && <>. That's <strong>{formatDateLong(projectionAtMajority.atDate)}</strong></>}.
              </>
            )}
          </p>
          <p className="snapshot-disclosure-footer">
            SIPC coverage up to $500,000 per account. Securities are not FDIC insured. Investments may lose value. Any projection grows the current balance at a 7% average annual return, net of Kiddo's annual fee, and assumes no further gifts (so it runs lower than the in-app estimate, which counts ongoing contributions). It is an estimate, not a guarantee. Past performance does not guarantee future returns. Custodian: {ownerName || "Parent / Guardian"}.
          </p>
        </div>

        {/* Page footer — dropped the "One page" claim (2026-06-05): a full gift
            history runs to several pages when printed, so it was inaccurate. */}
        <p className="snapshot-footer">
          Generated by Kiddo · {generatedAt} · Print or save as PDF
        </p>
      </div>

      {/* All styles inline here — keeps the snapshot route self-contained
          and lets the print CSS overrides live next to the screen styles. */}
      <style>{`
        .snapshot-root {
          min-height: 100vh;
          background: #f5f1eb;
          font-family: "DM Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #1a1710;
        }

        .snapshot-toolbar {
          position: sticky;
          top: 0;
          z-index: 10;
          background: #ffffff;
          border-bottom: 1px solid rgba(26, 23, 16, 0.10);
          padding: 14px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .snapshot-toolbar-title {
          /* Truly centered, not "between Back and the wider actions group".
             Absolutely centered in the (positioned) sticky toolbar so the side
             widths can't pull it off-center; truncates rather than overlapping
             a long fund name; pointer-events:none so it never intercepts a
             click meant for Back / the actions. 2026-06-05. */
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          max-width: 42%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          pointer-events: none;
          font-weight: 600;
          font-size: 14px;
          color: rgba(26, 23, 16, 0.85);
        }
        .snapshot-toolbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .snapshot-toolbar-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid rgba(26, 23, 16, 0.15);
          background: #ffffff;
          color: rgba(26, 23, 16, 0.85);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }
        .snapshot-toolbar-button:hover {
          background: rgba(26, 23, 16, 0.04);
        }
        .snapshot-toolbar-button--primary {
          background: hsl(143, 47%, 22%);
          color: #fff;
          border-color: hsl(143, 47%, 22%);
        }
        .snapshot-toolbar-button--primary:hover {
          background: hsl(143, 47%, 18%);
        }

        .snapshot-options {
          position: relative;
        }
        .snapshot-options summary {
          list-style: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid rgba(26, 23, 16, 0.15);
          background: #ffffff;
          color: rgba(26, 23, 16, 0.85);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
        }
        .snapshot-options summary::-webkit-details-marker { display: none; }
        .snapshot-options[open] summary {
          background: rgba(26, 23, 16, 0.05);
        }
        .snapshot-options-panel {
          position: absolute;
          right: 0;
          top: calc(100% + 6px);
          width: 240px;
          max-width: calc(100vw - 24px);
          background: #ffffff;
          border: 1px solid rgba(26, 23, 16, 0.10);
          border-radius: 16px;
          padding: 14px 16px;
          box-shadow: 0 14px 38px rgba(26, 23, 16, 0.14);
          z-index: 20;
        }
        /* Mobile: stack toolbar actions vertically so the options panel
           doesn't overflow the viewport edge when there's a long fund name
           in the title. */
        @media (max-width: 480px) {
          .snapshot-toolbar { padding: 12px 14px; gap: 8px; }
          .snapshot-toolbar-title {
            /* On mobile the toolbar stacks, so the title returns to the flow
               (full-width, centered below) — undo the desktop absolute centering. */
            position: static;
            transform: none;
            left: auto;
            top: auto;
            max-width: none;
            white-space: normal;
            pointer-events: auto;
            order: 2;
            width: 100%;
            text-align: center;
            font-size: 12.5px;
          }
          .snapshot-options-panel { right: -8px; width: 220px; }
          .snapshot-page { padding: 24px 20px; margin: 16px 8px; }
        }
        .snapshot-options-label {
          font-size: 10.5px;
          font-weight: 700;
          color: rgba(26, 23, 16, 0.55);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 10px;
        }
        .snapshot-options-panel label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: rgba(26, 23, 16, 0.85);
          padding: 5px 0;
          cursor: pointer;
        }

        .snapshot-page {
          max-width: 7.5in;
          margin: 24px auto;
          padding: 32px 40px 28px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(26, 23, 16, 0.06);
        }

        .snapshot-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding-bottom: 18px;
          margin-bottom: 26px;
          border-bottom: 1px solid rgba(26, 23, 16, 0.10);
        }
        .snapshot-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .snapshot-brand-text {
          font-family: "Bricolage Grotesque", system-ui, sans-serif;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: hsl(143, 47%, 18%);
        }
        .snapshot-meta {
          text-align: right;
        }
        .snapshot-meta-line {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: rgba(26, 23, 16, 0.55);
          text-transform: uppercase;
        }
        .snapshot-meta-date {
          font-size: 12px;
          color: rgba(26, 23, 16, 0.55);
          margin-top: 3px;
        }

        .snapshot-hero {
          padding: 8px 0 28px;
        }
        .snapshot-eyebrow {
          font-size: 11px;
          font-weight: 700;
          color: rgba(26, 23, 16, 0.50);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
        }
        .snapshot-balance {
          font-family: "Bricolage Grotesque", system-ui, sans-serif;
          font-size: 56px;
          font-weight: 700;
          letter-spacing: -0.025em;
          line-height: 1;
          color: #1a1710;
          font-variant-numeric: tabular-nums;
        }
        .snapshot-gain {
          font-size: 14px;
          font-weight: 600;
          margin-top: 10px;
          font-variant-numeric: tabular-nums;
        }
        .snapshot-gain.is-up { color: hsl(143, 47%, 28%); }
        .snapshot-gain.is-down { color: hsl(0, 65%, 42%); }
        .snapshot-contributed {
          font-size: 12.5px;
          color: rgba(26, 23, 16, 0.50);
          margin-top: 5px;
          font-variant-numeric: tabular-nums;
        }

        .snapshot-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
          margin-bottom: 26px;
          border-top: 1px solid rgba(26, 23, 16, 0.08);
          border-bottom: 1px solid rgba(26, 23, 16, 0.08);
          padding: 16px 0;
        }
        .snapshot-stat {
          padding: 0 14px;
          border-left: 1px solid rgba(26, 23, 16, 0.08);
        }
        .snapshot-stat:first-child { border-left: none; padding-left: 0; }
        .snapshot-stat-label {
          font-size: 10px;
          font-weight: 700;
          color: rgba(26, 23, 16, 0.50);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin-bottom: 4px;
        }
        .snapshot-stat-value {
          font-family: "Bricolage Grotesque", system-ui, sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: #1a1710;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.01em;
        }

        .snapshot-section {
          margin-bottom: 26px;
        }
        .snapshot-section-label {
          font-size: 11px;
          font-weight: 700;
          color: rgba(26, 23, 16, 0.55);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 12px;
        }
        .snapshot-holdings {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .snapshot-holding {
          background: #fdfaf3;
          border: 1px solid rgba(26, 23, 16, 0.08);
          border-radius: 12px;
          padding: 12px 14px;
          text-align: center;
        }
        .snapshot-ticker {
          display: inline-block;
          background: hsl(43, 47%, 92%);
          color: hsl(43, 60%, 28%);
          padding: 2px 9px;
          border-radius: 6px;
          font-size: 10.5px;
          font-weight: 800;
          letter-spacing: 0.02em;
          margin-bottom: 6px;
        }
        .snapshot-holding-name {
          font-size: 11px;
          color: rgba(26, 23, 16, 0.55);
          margin-bottom: 6px;
          line-height: 1.3;
        }
        .snapshot-holding-value {
          font-family: "Bricolage Grotesque", system-ui, sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: #1a1710;
          font-variant-numeric: tabular-nums;
        }
        .snapshot-holding-gain {
          font-size: 11px;
          font-weight: 600;
          margin-top: 3px;
          font-variant-numeric: tabular-nums;
        }
        .snapshot-holding-gain.is-up { color: hsl(143, 47%, 28%); }
        .snapshot-holding-gain.is-down { color: hsl(0, 65%, 42%); }
        .snapshot-holding-pct {
          font-size: 10px;
          color: rgba(26, 23, 16, 0.42);
          margin-top: 4px;
          font-variant-numeric: tabular-nums;
        }
        /* Neutral delta — added 2026-05-26 to standardize the column.
           Holdings with |gain| < $0.01 now render an em-dash placeholder
           instead of leaving the row visually shorter than its neighbors.
           Muted color so it reads as "no meaningful change" rather than
           a gain/loss the eye should track. */
        .snapshot-holding-gain.snapshot-holding-gain--neutral { color: rgba(26, 23, 16, 0.35); }

        .snapshot-gifts {
          border: 1px solid rgba(26, 23, 16, 0.08);
          border-radius: 12px;
          padding: 4px 16px;
        }
        .snapshot-gift {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 0;
          border-bottom: 1px solid rgba(26, 23, 16, 0.06);
        }
        .snapshot-gift:last-child {
          border-bottom: none;
        }
        .snapshot-gift-avatar {
          width: 30px;
          height: 30px;
          border-radius: 999px;
          background: hsl(143, 28%, 92%);
          color: hsl(143, 47%, 22%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
          flex-shrink: 0;
        }
        .snapshot-gift-body { flex: 1; min-width: 0; }
        .snapshot-gift-name {
          font-size: 13px;
          font-weight: 700;
          color: #1a1710;
        }
        .snapshot-gift-message {
          font-size: 11.5px;
          color: rgba(26, 23, 16, 0.55);
          font-style: italic;
          margin-top: 2px;
          line-height: 1.4;
        }
        .snapshot-gift-meta {
          text-align: right;
          flex-shrink: 0;
        }
        .snapshot-gift-amount {
          font-family: "Bricolage Grotesque", system-ui, sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: #1a1710;
          font-variant-numeric: tabular-nums;
        }
        .snapshot-gift-date {
          font-size: 10.5px;
          color: rgba(26, 23, 16, 0.50);
          margin-top: 1px;
        }

        .snapshot-disclosure {
          background: linear-gradient(135deg, hsl(43, 47%, 95%), #fdfaf3);
          border: 1px solid hsl(43, 47%, 84%);
          border-radius: 14px;
          padding: 18px 22px;
          margin-bottom: 22px;
        }
        .snapshot-disclosure-title {
          font-family: "Bricolage Grotesque", system-ui, sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: #1a1710;
          margin-bottom: 8px;
          letter-spacing: -0.005em;
        }
        .snapshot-disclosure-body {
          font-size: 12.5px;
          color: rgba(26, 23, 16, 0.75);
          line-height: 1.65;
        }
        .snapshot-disclosure-footer {
          font-size: 10.5px;
          color: rgba(26, 23, 16, 0.50);
          margin-top: 10px;
          line-height: 1.55;
        }

        .snapshot-footer {
          font-size: 10.5px;
          color: rgba(26, 23, 16, 0.45);
          text-align: center;
          margin-top: 10px;
        }

        /* ── Print styles — produce a clean PDF on Cmd-P ─────────── */
        @media print {
          @page { size: letter; margin: 0.45in; }
          html, body, #root { background: #fff !important; }
          .snapshot-root { background: #fff !important; }
          .snapshot-toolbar { display: none !important; }
          .snapshot-page {
            box-shadow: none !important;
            margin: 0 auto !important;
            padding: 0 !important;
            border-radius: 0 !important;
            max-width: none !important;
          }
          .snapshot-section { break-inside: avoid; }
          .snapshot-disclosure { break-inside: avoid; }
          .snapshot-gift { break-inside: avoid; }
          .snapshot-holding { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
