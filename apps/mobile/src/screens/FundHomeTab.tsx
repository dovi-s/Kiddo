// FundHomeTab — the native fund home, rebuilt to MIRROR the web Dashboard arc.
//
// The web app is ONE rich scrolling fund page (client/src/pages/Dashboard.tsx):
//   hero → recurring chip → 30-day summary → cash-waiting → quick links →
//   growth chart → holdings (chosen + managed) → who-loves roster.
// The old mobile Home was a 4-card sketch fed only by /funds + /gifts. This
// rebuild consumes the SAME consolidated `dashboard-summary` payload the web
// dashboard is built on (holdings, history, parentContributions, giftAllocations,
// recurringEnabled, full gifts) and renders the same arc on the brand kit
// (KiddoCard / KText / @kora/tokens) — no off-brand hand-rolled chrome.
//
// Everything reads from @kora/tokens so it stays brand-faithful and drift-free.
// Post-handoff (accessRole 'previous_owner') hides write CTAs, mirroring web.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from "react-native-svg";
import { colors, semanticColors, radius, spacing } from "@kora/tokens";
import { KText, KiddoCard, Button, Skeleton, haptic, Appear } from "../ui";
import { SinceLastVisitDigest } from "../components/SinceLastVisitDigest";
import { projectFundValue, ageFromBirthdate } from "../lib/projection";
import { looksLikeTestSender } from "../lib/gifters";
import { isReadOnlyFund, isOwnerModeFund } from "../lib/fund";
import {
  formatBalance,
  WEB_BASE,
  apiRecordParentReferralShare,
  type ApiFund,
  type ApiEvent,
  type DashboardSummary,
  type DashboardGift,
  type ParentContribution,
  type ApiHolding,
} from "../api";

// ─── helpers ────────────────────────────────────────────────────────────────

const NON_COUNTING = new Set(["pending", "failed", "refunded", "canceled", "cancelled", "host_hold"]);

// Auto-invest ETF universe = the "Managed mix". Mirrors the server's
// ADMIN_ASSET_UNIVERSE auto_invest set (marketQuotes.ts). Anything NOT here is a
// gifter-chosen individual stock ("Chosen with love").
const MANAGED_MIX_ETFS = new Set([
  "VTI", "VXUS", "BND", "VGT", "VUG", "VYM", "SCHD", "QQQ", "VOO", "VEA", "VWO", "BNDX", "AGG",
]);


function num(v: unknown): number {
  const n = parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

function childNameOf(fund?: ApiFund | null): string {
  return fund?.recipientFirstName || fund?.name || "your child";
}

function shortDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Parse a recipient birthdate robustly: a bare "YYYY-MM-DD" gets anchored to
// noon UTC (avoids timezone-off-by-one); a full ISO timestamp is used as-is.
// (Appending "T12:00:00.000Z" to an already-ISO string produced an invalid date,
// which silently nulled the at-18 card / handoff banner / projection age.)
function parseBirthdate(birthdate?: string | null): Date | null {
  if (!birthdate) return null;
  const s = /^\d{4}-\d{2}-\d{2}$/.test(birthdate) ? `${birthdate}T12:00:00.000Z` : birthdate;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The calendar date the recipient reaches majority. Uses the fund's real
 *  majorityAge (UTMA age varies by state, 18-21) — NOT a hardcoded 18. */
function majorityDateLabel(birthdate?: string | null, majorityAge = 18): string | null {
  const birth = parseBirthdate(birthdate);
  if (!birth) return null;
  const d = new Date(birth);
  d.setFullYear(d.getFullYear() + majorityAge);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** Whole days until the recipient reaches majority (null if past or unknown). */
function daysUntilMajority(birthdate?: string | null, majorityAge = 18): number | null {
  const birth = parseBirthdate(birthdate);
  if (!birth) return null;
  const at = new Date(birth);
  at.setFullYear(at.getFullYear() + majorityAge);
  const days = Math.ceil((at.getTime() - Date.now()) / 86_400_000);
  return days > 0 ? days : null;
}

/** "in 3 years" / "in 8 months" until the recipient reaches majority. */
function countdownToMajority(birthdate?: string | null, majorityAge = 18): string | null {
  const birth = parseBirthdate(birthdate);
  if (!birth) return null;
  const eighteen = new Date(birth);
  eighteen.setFullYear(eighteen.getFullYear() + majorityAge);
  const days = Math.ceil((eighteen.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return null;
  const years = Math.floor(days / 365);
  const months = Math.max(0, Math.round((days % 365) / 30));
  if (years <= 0) return `${months} month${months === 1 ? "" : "s"}`;
  if (months <= 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} yr${years === 1 ? "" : "s"} ${months} mo`;
}

// Per-occasion emoji + soft pastel tile (mirrors the web colored occasion cards).
function occasionPresentation(type?: string | null): { emoji: string; bg: string; border: string } {
  const t = String(type || "").toLowerCase();
  if (t.includes("birthday")) return { emoji: "🎂", bg: "#FBF1DD", border: "#EFD9A8" };
  if (t.includes("grad")) return { emoji: "🎓", bg: "#E7F0EA", border: "#C4DDCB" };
  if (t.includes("holiday") || t.includes("christmas")) return { emoji: "🎄", bg: "#EAF1EC", border: "#CADCCF" };
  if (t.includes("welcome") || t.includes("baby") || t.includes("shower")) return { emoji: "👶", bg: "#FBEEF0", border: "#EFCDD4" };
  if (t.includes("college") || t.includes("school")) return { emoji: "🎓", bg: "#ECEFF8", border: "#CDD6EE" };
  return { emoji: "🎁", bg: "#FAF1E4", border: "#EBD7B6" };
}

// Deterministic warm avatar tint per name (mirrors the web roster palette).
const AVATAR_TINTS = ["#1B3A2D", "#C5821E", "#3E6B52", "#9C5A1E", "#5B4B8A", "#A04668"];
function tintFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

// ─── count-up balance (the web hero's signature animated reveal) ──────────────

// Keys whose roll has already played this app session. The web hero rolls ONCE
// PER KID and snaps when you switch back (the founder's locked behavior — no
// "rolls every switch / goes back down"); we mirror it with a per-key lock.
const rolledBalanceKeys = new Set<string>();
let reduceMotionCached = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reduceMotionCached = v;
  })
  .catch(() => {});

function CountUp({
  value,
  color,
  prefix = "$",
  rollKey,
  cents,
}: {
  value: number;
  color: string;
  prefix?: string;
  /** Roll once per key (e.g. fund id), then snap on return. Omit = always roll. */
  rollKey?: string;
  /** Always show 2 decimals (the web hero shows $23,577.27). */
  cents?: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(value);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;

    const alreadyRolled = rollKey ? rolledBalanceKeys.has(rollKey) : false;
    // Snap (no animation) on web, under reduced motion, or when this kid's
    // balance already rolled once this session.
    if (Platform.OS === "web" || reduceMotionCached || alreadyRolled) {
      setShown(value);
      if (rollKey) rolledBalanceKeys.add(rollKey);
      return;
    }

    anim.setValue(0);
    const id = anim.addListener(({ value: t }) => setShown(from + (value - from) * t));
    Animated.timing(anim, {
      toValue: 1,
      duration: 700, // countUp (locked)
      easing: Easing.bezier(0.16, 1, 0.3, 1), // outExpo (locked)
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && rollKey) rolledBalanceKeys.add(rollKey);
    });
    return () => anim.removeListener(id);
  }, [value, rollKey]);

  const formatted = cents
    ? `${prefix}${shown.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${prefix}${Math.round(shown).toLocaleString("en-US")}${
        // keep cents only when the target has meaningful cents and is small
        value < 1000 && value % 1 !== 0 ? (shown - Math.floor(shown)).toFixed(2).slice(1) : ""
      }`;

  return (
    <KText variant="display" color={color} tabular style={{ fontSize: 46, lineHeight: 52 }}>
      {value === 0 ? `${prefix}0.00` : formatted}
    </KText>
  );
}

// ─── column sparkline (no react-native-svg dependency) ────────────────────────
//
// A real area+line growth chart (react-native-svg), mirroring the web's smooth
// trend chart: evergreen line, soft gradient fill, gold dot on the latest point.
// Renders the fund's total-value history; flat/empty history renders a calm
// near-baseline so the card never looks broken.

function GrowthChart({ points }: { points: number[] }) {
  // Card inner width = screen − screen padding (16·2) − card padding (16·2).
  const width = Math.max(220, Dimensions.get("window").width - 64);
  const height = 96;
  const data = points.length >= 2 ? points : [0, 0, 0];
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = Math.max(max - min, 1);
  const n = data.length;
  const px = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * width);
  const py = (v: number) => height - 6 - ((v - min) / span) * (height - 12);
  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const area = `${line} L${width.toFixed(1)},${height} L0,${height} Z`;
  const lastX = px(n - 1);
  const lastY = py(data[n - 1]);
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.evergreen} stopOpacity={0.22} />
          <Stop offset="1" stopColor={colors.evergreen} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#growthFill)" />
      <Path d={line} stroke={colors.evergreen} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={lastX} cy={lastY} r={4} fill={colors.gold} />
    </Svg>
  );
}

// ─── section header ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <KText variant="sectionLabel" color={semanticColors.text.muted} style={{ marginBottom: spacing.xs }}>
      {children}
    </KText>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

// Compact collapsible card (web parity: a one-line summary + chevron that
// expands to the detail). Keeps the dashboard scannable instead of a tall scroll.
function Collapsible({
  title,
  summary,
  summaryColor,
  open,
  onToggle,
  onReveal,
  children,
}: {
  title: string;
  summary?: string | null;
  summaryColor?: string;
  open: boolean;
  onToggle: () => void;
  // Web-parity reveal: when this section opens low in the scroll, glide it up so
  // the freshly shown content isn't stranded below the fold. The parent decides
  // whether a scroll is actually needed (it knows the offset + viewport) — we
  // just report our position + height once the open layout has settled. Fires
  // only on the closed→open transition; on close we report nothing, so the
  // section collapses in place and the page never moves. (Sections stay
  // independent — opening one never closes another.)
  onReveal?: (y: number, height: number) => void;
  children: React.ReactNode;
}) {
  const yRef = useRef(0);
  const hRef = useRef(0);
  useEffect(() => {
    if (!open || !onReveal) return;
    // Wait a frame so the expanded children have laid out and hRef reflects the
    // OPEN height (rAF runs after the layout pass that fires our onLayout).
    const id = requestAnimationFrame(() => onReveal(yRef.current, hRef.current));
    return () => cancelAnimationFrame(id);
  }, [open]);
  return (
    <Pressable
      onPress={onToggle}
      onLayout={(e) => {
        yRef.current = e.nativeEvent.layout.y;
        hRef.current = e.nativeEvent.layout.height;
      }}
    >
      <KiddoCard>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <KText variant="bodyStrong">{title}</KText>
            {summary ? (
              <KText variant="caption" color={summaryColor ?? semanticColors.text.muted} style={{ marginTop: 2 }}>
                {summary}
              </KText>
            ) : null}
          </View>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={semanticColors.text.muted} />
        </View>
        {open ? <View style={{ marginTop: spacing.sm }}>{children}</View> : null}
      </KiddoCard>
    </Pressable>
  );
}

export interface FundHomeTabProps {
  activeFund: ApiFund | null;
  summary: DashboardSummary | null;
  summaryLoading: boolean;
  events: ApiEvent[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectFund: (fund: ApiFund) => void;
  onAddFund: () => void;
  onCreateEvent: () => void;
  isDemoAccount?: boolean;
}

export function FundHomeTab(props: FundHomeTabProps) {
  const {
    activeFund,
    summary,
    summaryLoading,
    events,
    loading,
    refreshing,
    error,
    onRefresh,
    onSelectFund,
    onAddFund,
    onCreateEvent,
    isDemoAccount,
  } = props;

  const navigation = useNavigation<any>();
  const childName = childNameOf(activeFund);
  const isReadOnly = isReadOnlyFund(activeFund);
  const isOwnerMode = isOwnerModeFund(activeFund);
  // Tapping a holding opens a detail sheet (cost basis, % of fund, who picked it) —
  // the web's per-holding depth surface, instead of navigating away.
  const [selectedHolding, setSelectedHolding] = useState<ApiHolding | null>(null);
  const [projectionOpen, setProjectionOpen] = useState(false);
  // Sections default COLLAPSED (one summary line + chevron), like web — the
  // always-expanded ledger/chart/holdings made the dashboard tall and verbose.
  const [fundSoFarOpen, setFundSoFarOpen] = useState(false);
  const [growthOpen, setGrowthOpen] = useState(false);
  const [holdingsOpen, setHoldingsOpen] = useState(false);
  const [age18Open, setAge18Open] = useState(false);
  const [kidViewOpen, setKidViewOpen] = useState(false);

  // Reveal-if-needed on section open (web parity, see Collapsible). We track the
  // live scroll offset + viewport height so we ONLY scroll when the opened
  // section would otherwise fall below the fold — an already-visible section is
  // left exactly where it is (no yank). On close nothing fires.
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const viewportHRef = useRef(0);
  const revealIfNeeded = (cardY: number, cardH: number) => {
    const sv = scrollRef.current;
    const vh = viewportHRef.current;
    if (!sv || !vh) return;
    const top = scrollYRef.current;
    const fullyVisible = cardY >= top && cardY + cardH <= top + vh;
    if (fullyVisible) return; // already comfortable — don't move it
    sv.scrollTo({ y: Math.max(0, cardY - spacing.md), animated: true });
  };

  const handleShare = async () => {
    if (!activeFund) return;
    haptic("selection");
    try {
      await Share.share({
        message: `Give ${childName} a gift that grows: ${WEB_BASE}/${activeFund.slug}`,
        url: `${WEB_BASE}/${activeFund.slug}`,
      });
    } catch {
      /* user dismissed */
    }
  };

  const openGifterPage = () => {
    if (!activeFund) return;
    haptic("selection");
    Linking.openURL(`${WEB_BASE}/${activeFund.slug}`).catch(() => {});
  };

  // ── derive everything from the summary (the web parity layer) ──────────────
  const d = useMemo(() => {
    const balance = num(activeFund?.balance);
    const cash = num((activeFund as any)?.cashBalance);
    const pending = num(activeFund?.pendingBalance);
    const totalValue = balance + cash + pending;

    const gifts: DashboardGift[] = (summary?.gifts ?? [])
      .filter((g) => !NON_COUNTING.has(String(g.status || "").toLowerCase()))
      // Drop dev/test/seed junk senders ("test", "qqqqq", mash) so they don't
      // appear in the roster, recent gifts, or counts — mirrors the web's
      // looksLikeTestSender (shared/test-content.ts). Anonymous gifts pass.
      .filter((g) => !looksLikeTestSender(g.senderName, g.senderEmail));
    const giftsTotal = gifts.reduce((s, g) => s + num(g.netAmount ?? g.amount), 0);

    // contributors: unique named senders + an anonymous bucket
    const named = new Map<string, { name: string; total: number; last: string; count: number }>();
    let anonCount = 0;
    let anonTotal = 0;
    for (const g of gifts) {
      const name = (g.senderName || "").trim();
      // "Someone" / "Someone who loves X" is the anonymous display fallback — fold
      // it into the anon bucket instead of rendering a named "Someone" avatar.
      if (!name || g.isAnonymous || /^someone\b/i.test(name)) {
        anonCount += 1;
        anonTotal += num(g.netAmount ?? g.amount);
        continue;
      }
      const cur = named.get(name) || { name, total: 0, last: g.createdAt, count: 0 };
      cur.total += num(g.netAmount ?? g.amount);
      cur.count += 1;
      if (new Date(g.createdAt) > new Date(cur.last)) cur.last = g.createdAt;
      named.set(name, cur);
    }
    const contributors = Array.from(named.values()).sort((a, b) => b.total - a.total);
    const peopleCount = contributors.length + (anonCount > 0 ? 1 : 0);

    // recent gifts (most recent first) for the hero carousel
    const recent = [...gifts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // recurring
    const contributions: ParentContribution[] = summary?.parentContributions ?? [];
    const activeRecurring = contributions.filter((c) => String(c.status).toLowerCase() === "active");
    const pausedRecurring = contributions.filter((c) => String(c.status).toLowerCase() === "paused");
    const monthlyRecurring = activeRecurring.reduce((s, c) => {
      const a = num(c.amount);
      const f = String(c.frequency).toLowerCase();
      return s + (f === "weekly" ? a * 4.33 : f === "yearly" ? a / 12 : f === "daily" ? a * 30 : a);
    }, 0);

    // holdings split by ASSET TYPE (matches the web's source classification):
    // the auto-invest ETF set = "Managed mix"; everything else (individual
    // stocks like NFLX) = "Chosen with love". The prior allocation-source split
    // misclassified stocks with incomplete allocation records into the mix.
    const holdings: ApiHolding[] = summary?.holdings ?? [];
    const chosen = holdings.filter((h) => !MANAGED_MIX_ETFS.has(h.ticker.toUpperCase()));
    const managed = holdings.filter((h) => MANAGED_MIX_ETFS.has(h.ticker.toUpperCase()));
    const holdingsTotal = holdings.reduce((s, h) => s + num(h.currentValue), 0);

    // principal + growth from the gifts (cost basis) vs current invested value
    const principal = giftsTotal;
    const growth = balance - principal; // market move on invested principal

    // history series (total value over time)
    const history = (summary?.history ?? []).map((h) => num(h.totalValue));

    return {
      balance,
      cash,
      pending,
      totalValue,
      gifts,
      giftsTotal,
      recent,
      contributors,
      anonCount,
      anonTotal,
      peopleCount,
      activeRecurring,
      pausedRecurring,
      monthlyRecurring,
      chosen,
      managed,
      holdingsTotal,
      principal,
      growth,
      history,
      recurringEnabled: summary?.recurringEnabled ?? false,
    };
  }, [summary, activeFund]);

  const hasStarted = d.totalValue > 0 || d.gifts.length > 0;
  // The summary streams in after the fund row. While it's still pending we must
  // NOT render its derived numbers (gifts total, growth, holdings) — they'd read
  // a misleading $0 / "+balance growth" next to a real Worth-today. Skeleton instead.
  const summaryReady = !!summary;
  const summaryPending = summaryLoading && !summary;
  // The child's real age of majority (UTMA, varies by state 18-21) — read the
  // fund's value, never hardcode 18 (the web shows 21 for funds set that way).
  const majorityAge = Number((activeFund as any)?.majorityAge) || 18;
  const countdown = countdownToMajority(activeFund?.recipientBirthdate, majorityAge);
  // Locked projection math (mirror of shared/projection.ts) for the hero
  // "on track for $X when {name} turns {majorityAge}" pill.
  const heroProjAge = ageFromBirthdate(activeFund?.recipientBirthdate) ?? 5;
  const heroProjection = projectFundValue({
    startingValue: d.totalValue,
    monthlyContribution: d.monthlyRecurring,
    yearsAhead: Math.max(0, majorityAge - heroProjAge),
    contributionYears: Math.max(0, majorityAge - heroProjAge),
  });
  const eighteenthDate = majorityDateLabel(activeFund?.recipientBirthdate, majorityAge);
  // Web-parity "horizon" number: what it could become if left to grow to 33
  // (contributions still stop at majority). Shown on the handoff card.
  const horizon33 = projectFundValue({
    startingValue: d.totalValue,
    monthlyContribution: d.monthlyRecurring,
    yearsAhead: Math.max(0, 33 - heroProjAge),
    contributionYears: Math.max(0, majorityAge - heroProjAge),
  });
  const activeEvents = events.filter(
    (e) => e.status === "active" && !e.isPermanent && (!activeFund || String(e.fundId) === String(activeFund.id)),
  );
  const activeEvent = activeEvents[0];

  // ── loading / error / empty wrappers ───────────────────────────────────────
  const refresh = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.evergreen} />
  );

  if (loading) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <Skeleton height={188} rounded={radius.hero} />
        <Skeleton height={120} rounded={radius.card} />
        <Skeleton height={150} rounded={radius.card} />
      </ScrollView>
    );
  }

  if (error) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md }} refreshControl={refresh}>
        <KiddoCard style={{ marginTop: spacing.md }}>
          <KText variant="heading">Something didn't load.</KText>
          <KText variant="caption" style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
            {error}
          </KText>
          <Button label="Try again" onPress={onRefresh} variant="outline" />
        </KiddoCard>
      </ScrollView>
    );
  }

  if (!activeFund) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md }} refreshControl={refresh}>
        <View style={{ paddingTop: spacing.xl, gap: spacing.sm }}>
          <KText variant="title">Every great fund starts here.</KText>
          <KText variant="body" color={semanticColors.text.muted}>
            Create one fund, share one link, and let the first gift change the screen.
          </KText>
          <Button label="Start a fund" onPress={onAddFund} size="lg" style={{ marginTop: spacing.sm }} />
        </View>
      </ScrollView>
    );
  }

  return (
    <>
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={refresh}
      scrollEventThrottle={16}
      onScroll={(e) => {
        scrollYRef.current = e.nativeEvent.contentOffset.y;
      }}
      onLayout={(e) => {
        viewportHRef.current = e.nativeEvent.layout.height;
      }}
    >
      {/* ── activate investing (fund not yet active = identity not verified) ── */}
      {!isReadOnly && String(activeFund.status || "").toLowerCase() === "draft" ? (
        <KiddoCard>
          <KText variant="eyebrow" color={colors.goldInk}>One quick step</KText>
          <KText variant="heading" style={{ marginTop: 2 }}>Activate investing</KText>
          <KText variant="caption" style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
            Gifts are held safely until we verify your identity — a secure, one-time step required to invest.
            It takes a couple of minutes on the web.
          </KText>
          <Button
            label="Verify identity on the web"
            onPress={() => {
              haptic("selection");
              Linking.openURL(`${WEB_BASE}/activate-investing`).catch(() => {});
            }}
            fullWidth
          />
          <KText variant="caption" color={semanticColors.text.muted} center style={{ marginTop: spacing.sm }}>
            You may need to sign in. Identity steps stay on our secure web flow.
          </KText>
        </KiddoCard>
      ) : null}

      {/* ── approaching-handoff banner (within 90 days of majority) ───────── */}
      {(() => {
        const days = daysUntilMajority(activeFund?.recipientBirthdate, majorityAge);
        if (!days || days > 90 || isReadOnly) return null;
        return (
          <Pressable
            onPress={() => setAge18Open(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              backgroundColor: colors.evergreen + "12",
              borderRadius: radius.inner,
              borderWidth: 1,
              borderColor: colors.evergreen + "30",
              padding: spacing.md,
            }}
          >
            <Ionicons name="time-outline" size={20} color={colors.evergreen} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <KText variant="bodyStrong" color={colors.evergreen}>
                Handoff in {days} {days === 1 ? "day" : "days"}
              </KText>
              <KText variant="caption" color={semanticColors.text.muted}>
                {childName} turns {majorityAge}{eighteenthDate ? ` on ${eighteenthDate}` : ""}. Here's what changes.
              </KText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={semanticColors.text.muted} />
          </Pressable>
        );
      })()}

      {/* ── "while you were away" recap (web parity, above the hero) ───────── */}
      {hasStarted && activeFund ? (
        <SinceLastVisitDigest
          subject={`${childName}'s fund`}
          currentValue={d.totalValue}
          gifts={summary?.gifts ?? []}
          fundId={activeFund.id}
          isDemoAccount={isDemoAccount}
          viewerIsContributor={!isReadOnly}
        />
      ) : null}

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <Appear delay={0}>
      <KiddoCard variant="hero">
        {/* identity row (web parity: avatar + name · type · ACTIVE) */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: "rgba(248,245,240,0.92)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <KText variant="label" color={colors.evergreen}>
              {(childName || "?").trim().charAt(0).toUpperCase()}
            </KText>
          </View>
          <KText variant="eyebrow" color="rgba(248,245,240,0.72)" style={{ flex: 1 }}>
            {childName}'s Fund · {String(activeFund.accountType || "UTMA").toUpperCase()}
            {String(activeFund.status || "").toLowerCase() === "active" ? " · ACTIVE" : ""}
          </KText>
        </View>

        {/* "TODAY" eyebrow above the balance (web parity) */}
        <KText variant="eyebrow" color="#F8D889" style={{ marginTop: spacing.md }}>
          Today
        </KText>
        {/* balance — always from the fund row (loaded before the summary), so it
            shows instantly instead of skeletoning while the summary streams in.
            Cents shown for web parity ($23,577.27). */}
        <View style={{ marginTop: 2 }}>
          <CountUp value={d.totalValue} color={semanticColors.text.inverse} rollKey={activeFund.id} cents />
        </View>

        {/* gift count in gold under the balance (web parity, not a corner pill) */}
        {d.peopleCount > 0 ? (
          <KText variant="label" color="#F8D889" style={{ marginTop: 2 }}>
            {d.gifts.length} {d.gifts.length === 1 ? "gift" : "gifts"} · {d.peopleCount}{" "}
            {d.peopleCount === 1 ? "person" : "people"}
          </KText>
        ) : null}

        {/* substat */}
        <KText variant="body" color="rgba(248,245,240,0.82)" style={{ marginTop: 2 }}>
          {!hasStarted
            ? "Ready for the first gift."
            : d.cash > 0
              ? `${formatBalance(d.cash)} settling · invests in 1–2 business days`
              : isOwnerMode
                ? "This is yours now."
                : `Growing for ${childName}`}
        </KText>
        {countdown && !isReadOnly ? (
          <KText variant="caption" color="rgba(248,245,240,0.6)" style={{ marginTop: 2 }}>
            {childName} turns {majorityAge} in {countdown}
          </KText>
        ) : null}

        {/* recent-gift carousel */}
        {d.recent.length > 0 ? (
          <GiftCarousel gifts={d.recent} childName={childName} />
        ) : null}

        {/* hero CTAs — full-width gold Share + the "on track" projection pill,
            mirroring the web hero. */}
        {!isReadOnly ? (
          <View style={{ marginTop: spacing.md }}>
            <Button label={`Share ${childName}'s link`} onPress={handleShare} variant="monetization" fullWidth />
          </View>
        ) : null}
        {hasStarted && heroProjection > d.totalValue ? (
          <Pressable
            onPress={() => {
              haptic("selection");
              setProjectionOpen(true);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: spacing.sm,
              backgroundColor: "rgba(14,37,24,0.55)",
              borderRadius: radius.pill,
              paddingHorizontal: 14,
              paddingVertical: 11,
            }}
          >
            <Ionicons name="trending-up" size={15} color="#F8D889" />
            <KText variant="caption" color="#F8D889" style={{ flex: 1 }}>
              On track for ${Math.round(heroProjection).toLocaleString("en-US")} when {childName} turns {majorityAge}
            </KText>
            <Ionicons name="chevron-forward" size={14} color="rgba(248,216,137,0.7)" />
          </Pressable>
        ) : null}
      </KiddoCard>
      </Appear>

      {/* ── first-gift nudge (only before the fund is funded) ──────────────── */}
      {!hasStarted && !isReadOnly ? (
        <KiddoCard>
          <KText variant="eyebrow" color={colors.goldInk}>Next step</KText>
          <KText variant="heading" style={{ marginTop: 2 }}>
            Share {childName}'s link.
          </KText>
          <KText variant="caption" style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
            The first gift is the moment this becomes real. When it arrives, we'll ask you to verify your
            identity so gifts can be invested.
          </KText>
          <Button label={`Share ${childName}'s link`} onPress={handleShare} fullWidth />
        </KiddoCard>
      ) : null}

      {/* ── recurring chip ─────────────────────────────────────────────────── */}
      {hasStarted && !isReadOnly ? (
        <Appear delay={80}>
          <RecurringChip
            activeCount={d.activeRecurring.length}
            pausedCount={d.pausedRecurring.length}
            monthly={d.monthlyRecurring}
            nextDate={
              d.activeRecurring
                .map((c) => c.nextRunDate)
                .filter(Boolean)
                .sort()[0] ?? null
            }
            enabled={d.recurringEnabled}
            onPress={() =>
              activeFund &&
              navigation.navigate("Recurring", { fundId: activeFund.id, fundName: childName })
            }
          />
        </Appear>
      ) : null}

      {/* ── 30-day / fund-so-far summary ───────────────────────────────────── */}
      {hasStarted ? (
        <Appear delay={160}>
          <Pressable
            onPress={() => {
              haptic("selection");
              setFundSoFarOpen((o) => !o);
            }}
          >
            <KiddoCard>
              {/* collapsed header: title + "+$X grown so far" + chevron (web parity) */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <KText variant="bodyStrong">
                    {isOwnerMode ? "Your fund so far" : `${childName}'s fund so far`} 🌱
                  </KText>
                  {summaryReady && Math.abs(d.growth) >= 1 ? (
                    <KText
                      variant="caption"
                      color={d.growth >= 0 ? "#1A7F47" : "#C0392B"}
                      style={{ marginTop: 2 }}
                    >
                      {d.growth >= 0 ? "+" : "−"}
                      {formatBalance(Math.abs(d.growth))} grown so far
                    </KText>
                  ) : null}
                </View>
                <Ionicons
                  name={fundSoFarOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={semanticColors.text.muted}
                />
              </View>

              {fundSoFarOpen ? (
                !summaryReady ? (
                  summaryPending ? (
                    <View style={{ gap: 12, paddingVertical: 4, marginTop: spacing.sm }}>
                      <Skeleton height={16} width="80%" />
                      <Skeleton height={16} width="60%" />
                    </View>
                  ) : null
                ) : (
                  <View style={{ marginTop: spacing.sm }}>
                    <SummaryRow
                      label={isOwnerMode ? "Gifts from people who love you" : `Gifts from people who love ${childName}`}
                      value={formatBalance(d.giftsTotal)}
                    />
                    {d.activeRecurring.length > 0 ? (
                      <SummaryRow label="Your recurring investments" value={`${formatBalance(d.monthlyRecurring)}/mo`} />
                    ) : null}
                    {Math.abs(d.growth) >= 1 ? (
                      <SummaryRow
                        label={d.growth >= 0 ? "Market growth" : "Market change"}
                        value={`${d.growth >= 0 ? "+" : "−"}${formatBalance(Math.abs(d.growth))}`}
                        valueColor={d.growth >= 0 ? "#1A7F47" : "#C0392B"}
                      />
                    ) : null}
                    <View
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: semanticColors.surface.muted,
                        marginTop: spacing.sm,
                        paddingTop: spacing.sm,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <KText variant="bodyStrong">Worth today</KText>
                      <KText variant="bodyStrong" tabular>
                        {formatBalance(d.totalValue)}
                      </KText>
                    </View>
                  </View>
                )
              ) : null}
            </KiddoCard>
          </Pressable>
        </Appear>
      ) : null}

      {/* ── cash waiting (informational; cash auto-invests, no action needed) ── */}
      {d.cash > 0 && !isReadOnly ? (
        <KiddoCard>
          <KText variant="eyebrow" color={colors.goldInk}>Cash is waiting</KText>
          <KText variant="title" tabular style={{ marginTop: 2 }}>
            {formatBalance(d.cash)}
          </KText>
          <KText variant="caption" style={{ marginTop: 2 }}>
            Invests automatically on the next cycle, usually 1 to 2 business days.
          </KText>
        </KiddoCard>
      ) : null}

      {/* ── quick links (bare icon row, web parity) ────────────────────────── */}
      <Appear delay={240} style={{ flexDirection: "row", gap: spacing.xs }}>
        {!isReadOnly ? (
          <QuickLink icon="share-social-outline" label="Share link" onPress={handleShare} />
        ) : null}
        <QuickLink icon="eye-outline" label="Gifter page" onPress={openGifterPage} />
        {!isOwnerMode ? (
          <QuickLink icon="happy-outline" label={`${childName}'s view`} onPress={() => setKidViewOpen(true)} />
        ) : null}
        {!isReadOnly ? (
          <QuickLink
            icon={activeEvent ? "calendar-outline" : "calendar-outline"}
            label={activeEvent ? activeEvent.name : `${childName}'s Birthday`}
            onPress={onCreateEvent}
          />
        ) : null}
      </Appear>

      {/* "see it from a gifter's side" hint pill (web parity) */}
      {!isReadOnly ? (
        <Pressable
          onPress={() => {
            haptic("selection");
            openGifterPage();
          }}
          style={{
            backgroundColor: semanticColors.surface.muted,
            borderRadius: radius.inner,
            paddingVertical: 12,
            paddingHorizontal: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <KText variant="caption" color={semanticColors.text.muted} center>
            See it from a gifter's side: give {childName} a gift, then watch it land
          </KText>
          <Ionicons name="arrow-forward" size={14} color={semanticColors.text.muted} />
        </Pressable>
      ) : null}

      {/* ── growth chart (collapsible, web parity) ── */}
      {hasStarted && summaryReady ? (
        <Collapsible
          title={isOwnerMode ? "Your growth" : `${childName}'s growth`}
          summary={
            Math.abs(d.growth) >= 1
              ? `${d.growth >= 0 ? "+" : "−"}${formatBalance(Math.abs(d.growth))} growth`
              : "Tap to see the trend"
          }
          summaryColor={d.growth >= 0 ? "#1A7F47" : "#C0392B"}
          open={growthOpen}
          onReveal={revealIfNeeded}
          onToggle={() => {
            haptic("selection");
            setGrowthOpen((o) => !o);
          }}
        >
          <GrowthChart points={d.history} />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: spacing.md,
              paddingTop: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: semanticColors.surface.muted,
            }}
          >
            <Metric label="Total gifts" value={formatBalance(d.giftsTotal)} />
            {Math.abs(d.growth) >= 1 ? (
              <Metric
                label={d.growth >= 0 ? "Growth" : "Change"}
                value={`${d.growth >= 0 ? "+" : "−"}${formatBalance(Math.abs(d.growth))}`}
                valueColor={d.growth >= 0 ? "#1A7F47" : "#C0392B"}
              />
            ) : null}
            <Metric label="Have gifted" value={`${d.peopleCount} ${d.peopleCount === 1 ? "person" : "people"}`} />
          </View>
          <Pressable
            onPress={() => {
              haptic("selection");
              setProjectionOpen(true);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              marginTop: spacing.sm,
              paddingTop: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: semanticColors.surface.muted,
            }}
          >
            <KText variant="label" color={colors.evergreen}>
              See what it could become
            </KText>
            <Ionicons name="arrow-forward" size={15} color={colors.evergreen} />
          </Pressable>
        </Collapsible>
      ) : hasStarted && summaryPending ? (
        <View>
          <SectionLabel>{isOwnerMode ? "Your growth" : `${childName}'s growth`}</SectionLabel>
          <Skeleton height={130} rounded={radius.card} />
        </View>
      ) : null}

      {/* ── holdings ───────────────────────────────────────────────────────── */}
      {summary && (d.chosen.length > 0 || d.managed.length > 0) ? (
        <Collapsible
          title={isOwnerMode ? "What you own" : `What ${childName} owns`}
          summary={`${d.chosen.length + d.managed.length} holding${
            d.chosen.length + d.managed.length === 1 ? "" : "s"
          } powering the growth`}
          open={holdingsOpen}
          onReveal={revealIfNeeded}
          onToggle={() => {
            haptic("selection");
            setHoldingsOpen((o) => !o);
          }}
        >
          <View style={{ gap: spacing.sm }}>
            {d.chosen.length > 0 ? (
              <>
                <KText variant="caption" color={colors.evergreen} style={{ marginBottom: 2 }}>
                  Chosen with love 💚
                </KText>
                {d.chosen.map((h) => (
                  <HoldingRow key={h.id} holding={h} total={d.holdingsTotal} onPress={() => setSelectedHolding(h)} />
                ))}
              </>
            ) : null}
            {d.managed.length > 0 ? (
              <>
                {d.chosen.length > 0 ? (
                  <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: spacing.xs, marginBottom: 2 }}>
                    Managed mix
                  </KText>
                ) : null}
                {d.managed.map((h) => (
                  <HoldingRow key={h.id} holding={h} total={d.holdingsTotal} onPress={() => setSelectedHolding(h)} />
                ))}
              </>
            ) : null}
          </View>
        </Collapsible>
      ) : hasStarted && summaryLoading ? (
        <Skeleton height={120} rounded={radius.card} />
      ) : null}

      {/* ── your part of the story (recurring schedules) ───────────────────── */}
      {!isReadOnly && (d.activeRecurring.length > 0 || d.pausedRecurring.length > 0) ? (
        <View>
          <SectionLabel>{isOwnerMode ? "Your contributions" : `Your part of ${childName}'s story`}</SectionLabel>
          <KiddoCard>
            {[...d.activeRecurring, ...d.pausedRecurring].map((c, i) => {
              const paused = String(c.status).toLowerCase() === "paused";
              const freq = String(c.frequency || "").toLowerCase();
              const unit = freq === "weekly" ? "/wk" : freq === "yearly" ? "/yr" : freq === "daily" ? "/day" : "/mo";
              const next = c.nextRunDate
                ? new Date(c.nextRunDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : null;
              return (
                <View
                  key={c.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    paddingVertical: 8,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: semanticColors.surface.muted,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 11,
                      backgroundColor: (paused ? colors.gold : colors.evergreen) + "16",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name={paused ? "pause" : "repeat"} size={16} color={paused ? colors.goldInk : colors.evergreen} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <KText variant="bodyStrong">
                      {formatBalance(c.amount)}{unit}
                      {c.selectedTicker ? ` · ${c.selectedTicker}` : ""}
                    </KText>
                    <KText variant="caption" color={semanticColors.text.muted}>
                      {paused ? "Paused" : next ? `Next on ${next}` : "Active"}
                    </KText>
                  </View>
                </View>
              );
            })}
          </KiddoCard>
        </View>
      ) : null}

      {/* ── who loves {child} ──────────────────────────────────────────────── */}
      {d.peopleCount > 0 ? (
        <View>
          <SectionLabel>{isOwnerMode ? "Who loves you" : `Who loves ${childName}`}</SectionLabel>
          <KiddoCard>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
              {d.contributors.slice(0, 9).map((c) => (
                <View key={c.name} style={{ alignItems: "center", width: 64 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: tintFor(c.name),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <KText variant="bodyStrong" color="#FFFFFF">
                      {c.name.charAt(0).toUpperCase()}
                    </KText>
                  </View>
                  <KText variant="caption" center numberOfLines={1} style={{ marginTop: 4, maxWidth: 64 }}>
                    {c.name.split(" ")[0]}
                  </KText>
                  {/* per-person date + gift count (web parity) */}
                  <KText
                    variant="caption"
                    center
                    color={semanticColors.text.muted}
                    numberOfLines={1}
                    style={{ fontSize: 10, lineHeight: 13, maxWidth: 64 }}
                  >
                    {new Date(c.last).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {c.count}
                  </KText>
                </View>
              ))}
              {d.anonCount > 0 ? (
                <View style={{ alignItems: "center", width: 64 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: semanticColors.surface.muted,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="person" size={22} color={semanticColors.text.muted} />
                  </View>
                  <KText variant="caption" center style={{ marginTop: 4 }}>
                    {d.anonCount} anon.
                  </KText>
                </View>
              ) : null}
            </View>
            <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: spacing.md }}>
              {formatBalance(d.giftsTotal)} gifted to {isOwnerMode ? "your" : `${childName}'s`} fund.
            </KText>
          </KiddoCard>
        </View>
      ) : null}

      {/* ── occasions & goals (mirrors web "Occasions and Goals") ──────────── */}
      {activeEvents.length > 0 && !isReadOnly ? (
        <View>
          <SectionLabel>{isOwnerMode ? "Your occasions and goals" : `${childName}'s occasions and goals`}</SectionLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.md }}
          >
            {activeEvents.slice(0, 6).map((e) => {
              const o = occasionPresentation(e.eventType);
              return (
                <Pressable
                  key={e.id}
                  onPress={onCreateEvent}
                  style={{
                    width: 150,
                    borderRadius: radius.inner,
                    padding: spacing.md,
                    backgroundColor: o.bg,
                    borderWidth: 1,
                    borderColor: o.border,
                    gap: 6,
                  }}
                >
                  <KText variant="title" style={{ fontSize: 24 }}>{o.emoji}</KText>
                  <KText variant="bodyStrong" numberOfLines={2}>{e.name}</KText>
                  <KText variant="caption" color={semanticColors.text.muted}>
                    {e.giftCount > 0 ? `${formatBalance(e.totalRaised || "0")} raised` : "Ready for gifts"}
                  </KText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* ── the day it becomes theirs (mirrors web at-18 anchor card) ────────── */}
      {eighteenthDate && !isReadOnly && !isOwnerMode ? (
        <KiddoCard variant="hero" onPress={() => setAge18Open(true)}>
          <KText variant="eyebrow" color="#F8D889">The day it all becomes {childName}'s</KText>
          <KText variant="title" color="#FFF7E8" style={{ marginTop: 4 }}>
            {eighteenthDate}
          </KText>
          <KText variant="body" color="rgba(255,247,232,0.82)" style={{ marginTop: spacing.xs }}>
            {childName} gets full control at {majorityAge}. Until then, every gift and note you add is part of the story
            that's waiting for them.
          </KText>
          {horizon33 > heroProjection ? (
            <KText variant="caption" color="#F8D889" style={{ marginTop: spacing.sm }}>
              If {childName} lets it keep growing to 33, it could be about $
              {Math.round(horizon33).toLocaleString("en-US")}.
            </KText>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.sm }}>
            <KText variant="label" color="#F8D889">See the handoff plan</KText>
            <Ionicons name="arrow-forward" size={15} color="#F8D889" />
          </View>
        </KiddoCard>
      ) : null}

      {/* ── owner doorway (post-handoff) ───────────────────────────────────── */}
      {isOwnerMode ? (
        <KiddoCard>
          <KText variant="eyebrow" color={colors.goldInk}>Start one for someone you love</KText>
          <KText variant="caption" style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
            Someone started this for you before you could ask. When there's a kid you want to show up for,
            you already know how.
          </KText>
          <Button label="Start a fund" onPress={onAddFund} />
        </KiddoCard>
      ) : null}

      {/* ── pass it along (parent→parent, 2026-06-04) ──────────────────────
          Mirrors the web dashboard's end-of-page row 1:1 (locked rule: match
          web). A DIFFERENT species from Share-{kid}'s-link: this hands a
          FRIEND'S family the product, no bounty ever. End-of-scroll = the
          conviction peak; native share sheet = a text between parents at
          pickup, the real medium of this behavior. Hidden for read-only
          roles + post-handoff owners (they have the doorway above). */}
      {!isReadOnly && !isOwnerMode && activeFund ? (
        <Pressable
          onPress={() => {
            haptic("selection");
            const refCode = `pf-${String(activeFund.id || "").slice(0, 12)}`;
            void apiRecordParentReferralShare(activeFund.id, refCode);
            void Share.share({
              message: `We started an investment fund for our kid that family and friends gift into. Thought your family might want this too. ${WEB_BASE}/?ref=${refCode}`,
            }).catch(() => {});
          }}
          style={{
            marginTop: spacing.md,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 14,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: "rgba(26,23,16,0.16)",
            alignItems: "center",
          }}
        >
          <KText variant="caption" color={semanticColors.text.muted} center>
            Know a family who'd want this? <KText variant="caption" style={{ fontWeight: "600" }}>Pass it along →</KText>
          </KText>
        </Pressable>
      ) : null}
      </ScrollView>

      {selectedHolding ? (
        <HoldingDetailSheet
          holding={selectedHolding}
          total={d.holdingsTotal}
          allocations={summary?.giftAllocations ?? []}
          gifts={d.gifts}
          childName={childName}
          isOwnerMode={isOwnerMode}
          onClose={() => setSelectedHolding(null)}
        />
      ) : null}

      {projectionOpen && activeFund ? (
        <ProjectionSheet
          startingValue={d.totalValue}
          monthly={d.monthlyRecurring}
          birthdate={activeFund.recipientBirthdate}
          majorityAge={majorityAge}
          childName={childName}
          isOwnerMode={isOwnerMode}
          onClose={() => setProjectionOpen(false)}
        />
      ) : null}

      {age18Open && activeFund ? (
        <Age18PlanSheet
          childName={childName}
          birthdate={activeFund.recipientBirthdate}
          majorityAge={majorityAge}
          startingValue={d.totalValue}
          monthly={d.monthlyRecurring}
          onClose={() => setAge18Open(false)}
        />
      ) : null}

      {kidViewOpen && activeFund ? (
        <KidViewPreview
          childName={childName}
          totalValue={d.totalValue}
          peopleCount={d.peopleCount}
          contributors={d.contributors}
          holdings={[...d.chosen, ...d.managed]}
          history={d.history}
          countdown={countdown}
          onClose={() => setKidViewOpen(false)}
        />
      ) : null}
    </>
  );
}

// Kid View preview — what the child sees: warm, simplified, celebratory, read-only.
// Mirrors the web's "preview Kid View" (parent-facing). No money depth/cost basis —
// just "this is yours, it's growing, and people love you."
function KidViewPreview({
  childName,
  totalValue,
  peopleCount,
  contributors,
  holdings,
  history,
  countdown,
  onClose,
}: {
  childName: string;
  totalValue: number;
  peopleCount: number;
  contributors: { name: string }[];
  holdings: ApiHolding[];
  history: number[];
  countdown: string | null;
  onClose: () => void;
}) {
  const owned = holdings.slice(0, 8);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.evergreen }}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 64, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <KText variant="eyebrow" color="rgba(248,245,240,0.6)">Preview of {childName}'s view</KText>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.8)" />
            </Pressable>
          </View>

          {/* the big warm moment */}
          <KText variant="title" color="#FFF7E8" style={{ marginTop: spacing.xl }}>
            Hi {childName} 👋
          </KText>
          <KText variant="body" color="rgba(248,245,240,0.82)" style={{ marginTop: spacing.xs }}>
            This is your money. People who love you have been growing it for your future.
          </KText>
          <KText variant="display" color="#FFFFFF" tabular style={{ fontSize: 52, lineHeight: 58, marginTop: spacing.md }}>
            {formatBalance(totalValue)}
          </KText>
          {countdown ? (
            <KText variant="caption" color="rgba(248,245,240,0.6)" style={{ marginTop: 2 }}>
              It becomes fully yours in {countdown}.
            </KText>
          ) : null}

          {/* growth */}
          {history.length >= 2 ? (
            <View style={{ marginTop: spacing.lg, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.card, padding: spacing.md }}>
              <KText variant="caption" color="#F8D889">It's been growing 🌱</KText>
              <View style={{ marginTop: spacing.sm }}>
                <GrowthChart points={history} />
              </View>
            </View>
          ) : null}

          {/* people who love you */}
          {peopleCount > 0 ? (
            <View style={{ marginTop: spacing.lg }}>
              <KText variant="bodyStrong" color="#FFF7E8">
                {peopleCount} {peopleCount === 1 ? "person loves" : "people love"} you
              </KText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }}>
                {contributors.slice(0, 8).map((c) => (
                  <View key={c.name} style={{ alignItems: "center", width: 60 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: tintFor(c.name), alignItems: "center", justifyContent: "center" }}>
                      <KText variant="bodyStrong" color="#FFFFFF">{c.name.charAt(0).toUpperCase()}</KText>
                    </View>
                    <KText variant="caption" color="rgba(248,245,240,0.7)" center numberOfLines={1} style={{ marginTop: 4, maxWidth: 60 }}>
                      {c.name.split(" ")[0]}
                    </KText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* companies you own */}
          {owned.length > 0 ? (
            <View style={{ marginTop: spacing.lg }}>
              <KText variant="bodyStrong" color="#FFF7E8">Companies you own a piece of</KText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }}>
                {owned.map((h) => (
                  <View key={h.id} style={{ alignItems: "center", width: 64 }}>
                    <StockLogo ticker={h.ticker} size={44} />
                    <KText variant="caption" color="rgba(248,245,240,0.7)" center numberOfLines={1} style={{ marginTop: 4, maxWidth: 64 }}>
                      {h.name || h.ticker}
                    </KText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <KText variant="caption" color="rgba(248,245,240,0.5)" style={{ marginTop: spacing.xl }}>
            This is a preview of what {childName} sees in Kid View.
          </KText>
        </ScrollView>
      </View>
    </Modal>
  );
}

// Age-18 handoff plan — what changes at majority + the projected number + the
// honest "the money conversation doesn't start at 18" framing. Mirrors the web
// Age18Plan page's spine.
function Age18PlanSheet({
  childName,
  birthdate,
  majorityAge = 18,
  startingValue,
  monthly,
  onClose,
}: {
  childName: string;
  birthdate?: string | null;
  majorityAge?: number;
  startingValue: number;
  monthly: number;
  onClose: () => void;
}) {
  const date = majorityDateLabel(birthdate, majorityAge);
  const days = daysUntilMajority(birthdate, majorityAge);
  const currentAge = ageFromBirthdate(birthdate) ?? 5;
  const projectedAt18 = projectFundValue({
    startingValue,
    monthlyContribution: monthly,
    yearsAhead: Math.max(0, majorityAge - currentAge),
    contributionYears: Math.max(0, majorityAge - currentAge),
  });

  const changes = [
    { icon: "key-outline", title: "Full control transfers to them", body: `${childName} becomes the legal owner and decides what happens next.` },
    { icon: "shield-checkmark-outline", title: "Nothing is sold automatically", body: "The investments stay invested. No forced sale, no taxable event at the handoff." },
    { icon: "book-outline", title: "The Memory Book is theirs", body: "Every gift, note, and photo — the whole story — goes with them." },
    { icon: "pricetag-outline", title: "Pricing simplifies", body: "The per-fund Plus subscription ends; only the 0.10% AUM line remains." },
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(14,37,24,0.4)" }} onPress={onClose} />
      <ScrollView
        style={{ maxHeight: "88%", backgroundColor: colors.cream, borderTopLeftRadius: radius.container, borderTopRightRadius: radius.container }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: semanticColors.surface.muted, alignSelf: "center", marginBottom: spacing.md }} />
        <KText variant="sectionLabel" color={semanticColors.text.muted}>The handoff</KText>
        <KText variant="title" style={{ marginTop: 4 }}>
          {childName} turns {majorityAge}{date ? ` on ${date}` : ""}.
        </KText>
        {days ? (
          <KText variant="body" color={semanticColors.text.muted} style={{ marginTop: 2 }}>
            {days} {days === 1 ? "day" : "days"} away. Here's what changes — and what doesn't.
          </KText>
        ) : null}

        {/* projected number */}
        {projectedAt18 > startingValue ? (
          <KiddoCard variant="hero" style={{ marginTop: spacing.md }}>
            <KText variant="eyebrow" color="#F8D889">Could be worth around</KText>
            <KText variant="display" color="#FFF7E8" tabular style={{ fontSize: 40, lineHeight: 46, marginTop: 2 }}>
              {formatBalance(projectedAt18)}
            </KText>
            <KText variant="caption" color="rgba(255,247,232,0.78)" style={{ marginTop: 2 }}>
              at {majorityAge}, at a 7% average annual return after our 0.10% fee. A projection, not a promise.
            </KText>
          </KiddoCard>
        ) : null}

        {/* what changes */}
        <KText variant="sectionLabel" color={semanticColors.text.muted} style={{ marginTop: spacing.lg, marginBottom: spacing.xs }}>
          What changes at {majorityAge}
        </KText>
        <KiddoCard>
          {changes.map((c, i) => (
            <View
              key={c.title}
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: semanticColors.surface.muted,
              }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.evergreen + "14", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={c.icon as any} size={17} color={colors.evergreen} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <KText variant="bodyStrong">{c.title}</KText>
                <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: 2 }}>{c.body}</KText>
              </View>
            </View>
          ))}
        </KiddoCard>

        {/* after the handoff */}
        <KiddoCard style={{ marginTop: spacing.md }}>
          <KText variant="bodyStrong">The money conversation doesn't start at {majorityAge}.</KText>
          <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: spacing.xs }}>
            The years of gifts and notes are the head start. The handoff is a moment to talk about what it
            took to build, and what they might do with it — not a finish line.
          </KText>
        </KiddoCard>

        <Button label="Done" onPress={onClose} fullWidth style={{ marginTop: spacing.md }} />
      </ScrollView>
    </Modal>
  );
}

// Projection sheet — "what the fund could become." Uses the locked projection
// math (mirror of shared/projection.ts): 7% net of the 0.10% fee, contributions
// through majority, then pure compound. Milestone-age picker + a projected curve.
function ProjectionSheet({
  startingValue,
  monthly,
  birthdate,
  majorityAge = 18,
  childName,
  isOwnerMode,
  onClose,
}: {
  startingValue: number;
  monthly: number;
  birthdate?: string | null;
  majorityAge?: number;
  childName: string;
  isOwnerMode: boolean;
  onClose: () => void;
}) {
  const currentAge = ageFromBirthdate(birthdate) ?? 5;
  const contributionYears = Math.max(0, majorityAge - currentAge); // contributions stop at majority
  const MILESTONES = [18, 21, 25, 30, 40, 50, 65];
  const ages = MILESTONES.filter((a) => a > currentAge + 0.5);
  const [age, setAge] = useState<number>(ages.find((a) => a >= currentAge + 5) ?? ages[0] ?? 18);

  const project = (toAge: number) =>
    projectFundValue({ startingValue, monthlyContribution: monthly, yearsAhead: toAge - currentAge, contributionYears });
  const target = project(age);

  // trajectory now → selected age
  const width = Math.max(220, Dimensions.get("window").width - 72);
  const height = 110;
  const series: number[] = [];
  const yearsAhead = age - currentAge;
  const stepN = 40;
  for (let i = 0; i <= stepN; i++) series.push(project(currentAge + (yearsAhead * i) / stepN));
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = Math.max(max - min, 1);
  const px = (i: number) => (i / stepN) * width;
  const py = (v: number) => height - 6 - ((v - min) / span) * (height - 12);
  const line = series.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const areaPath = `${line} L${width.toFixed(1)},${height} L0,${height} Z`;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(14,37,24,0.4)" }} onPress={onClose} />
      <View
        style={{
          backgroundColor: colors.cream,
          borderTopLeftRadius: radius.container,
          borderTopRightRadius: radius.container,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 40,
        }}
      >
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: semanticColors.surface.muted, alignSelf: "center", marginBottom: spacing.md }} />
        <KText variant="sectionLabel" color={semanticColors.text.muted}>
          {isOwnerMode ? "What your fund could become" : `What ${childName}'s fund could become`}
        </KText>
        <View style={{ marginTop: spacing.xs }}>
          <CountUp value={target} color={colors.evergreen} />
        </View>
        <KText variant="body" color={semanticColors.text.muted} style={{ marginTop: 2 }}>
          when {isOwnerMode ? "you're" : `${childName} is`} {age}
        </KText>

        {/* age milestone pills */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.md }}>
          {ages.map((a) => {
            const on = a === age;
            return (
              <Pressable
                key={a}
                onPress={() => {
                  haptic("selection");
                  setAge(a);
                }}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 14,
                  borderRadius: radius.pill,
                  backgroundColor: on ? colors.evergreen : semanticColors.surface.card,
                  borderWidth: 1,
                  borderColor: on ? colors.evergreen : semanticColors.surface.muted,
                }}
              >
                <KText variant="label" color={on ? "#FFFFFF" : semanticColors.text.primary}>
                  {a}
                </KText>
              </Pressable>
            );
          })}
        </View>

        {/* trajectory */}
        <View style={{ marginTop: spacing.md }}>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="projFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.gold} stopOpacity={0.22} />
                <Stop offset="1" stopColor={colors.gold} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={areaPath} fill="url(#projFill)" />
            <Path d={line} stroke={colors.evergreen} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={px(stepN)} cy={py(series[stepN])} r={4} fill={colors.gold} />
          </Svg>
        </View>

        <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: spacing.sm }}>
          Based on {formatBalance(startingValue)} today{monthly > 0 ? ` plus ${formatBalance(monthly)}/mo` : ""}, at a 7%
          average annual return after our 0.10% fee.
        </KText>
        <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: 4 }}>
          A projection, not a promise — markets rise and fall.
        </KText>
        <Button label="Done" onPress={onClose} fullWidth style={{ marginTop: spacing.md }} />
      </View>
    </Modal>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

// Per-holding detail sheet — value, gain, shares, % of fund, cost basis, and the
// people who picked it. Mirrors the web HoldingDetailSheet's depth (a deliberate
// dual-audience feature for sophisticated parents).
function HoldingDetailSheet({
  holding,
  total,
  allocations,
  gifts,
  childName,
  isOwnerMode,
  onClose,
}: {
  holding: ApiHolding;
  total: number;
  allocations: { giftId: string; ticker: string; costBasis: string; shares: string; source?: string }[];
  gifts: DashboardGift[];
  childName: string;
  isOwnerMode: boolean;
  onClose: () => void;
}) {
  const ticker = holding.ticker.toUpperCase();
  const value = num(holding.currentValue);
  const gain = num(holding.gain);
  const shares = num(holding.shares);
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const allocs = allocations.filter((a) => a.ticker.toUpperCase() === ticker);
  const costBasis = allocs.reduce((s, a) => s + num(a.costBasis), 0);
  const pickedGiftIds = new Set(allocs.filter((a) => String(a.source || "").toLowerCase() === "pick").map((a) => a.giftId));
  const contributors = new Map<string, number>();
  for (const g of gifts) {
    if (!pickedGiftIds.has(g.id)) continue;
    const name = (g.senderName || "").trim();
    if (!name || g.isAnonymous) continue;
    contributors.set(name, (contributors.get(name) || 0) + num(g.netAmount ?? g.amount));
  }
  const people = Array.from(contributors.entries()).sort((a, b) => b[1] - a[1]);

  const Stat = ({ label, val, color }: { label: string; val: string; color?: string }) => (
    <View style={{ flexBasis: "48%", paddingVertical: 8 }}>
      <KText variant="caption" color={semanticColors.text.muted}>{label}</KText>
      <KText variant="bodyStrong" tabular color={color} style={{ marginTop: 2 }}>{val}</KText>
    </View>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(14,37,24,0.4)" }} onPress={onClose} />
      <View
        style={{
          backgroundColor: colors.cream,
          borderTopLeftRadius: radius.container,
          borderTopRightRadius: radius.container,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 40,
        }}
      >
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: semanticColors.surface.muted, alignSelf: "center", marginBottom: spacing.md }} />
        {/* identity */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <StockLogo ticker={holding.ticker} size={48} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <KText variant="heading" numberOfLines={1}>{holding.name || ticker}</KText>
            <KText variant="caption" color={semanticColors.text.muted}>{ticker}</KText>
          </View>
        </View>
        {/* value + gain */}
        <KText variant="display" tabular style={{ fontSize: 38, lineHeight: 44, marginTop: spacing.md }}>
          {formatBalance(value)}
        </KText>
        {Math.abs(gain) >= 0.01 ? (
          <KText variant="bodyStrong" tabular color={gain >= 0 ? "#1A7F47" : "#C0392B"} style={{ marginTop: 2 }}>
            {gain >= 0 ? "+" : "−"}{formatBalance(Math.abs(gain))} since first gift
          </KText>
        ) : null}
        {/* stats */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: spacing.md, borderTopWidth: 1, borderTopColor: semanticColors.surface.muted, paddingTop: spacing.sm }}>
          <Stat label="Shares" val={shares.toFixed(shares < 1 ? 4 : 2)} />
          <Stat label="% of fund" val={`${pct}%`} />
          {costBasis > 0 ? <Stat label="Invested" val={formatBalance(costBasis)} /> : null}
          {costBasis > 0 ? (
            <Stat
              label="Gain"
              val={`${gain >= 0 ? "+" : "−"}${Math.abs(costBasis ? (gain / costBasis) * 100 : 0).toFixed(1)}%`}
              color={gain >= 0 ? "#1A7F47" : "#C0392B"}
            />
          ) : null}
        </View>
        {/* contributors */}
        {people.length > 0 ? (
          <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: semanticColors.surface.muted, paddingTop: spacing.sm }}>
            <KText variant="sectionLabel" color={semanticColors.text.muted} style={{ marginBottom: spacing.xs }}>
              {people.length === 1 ? `1 person chose ${ticker}` : `${people.length} people chose ${ticker}`}
              {isOwnerMode ? " for you" : ` for ${childName}`}
            </KText>
            {people.slice(0, 6).map(([name, amt]) => (
              <View key={name} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }}>
                <KText variant="body">{name}</KText>
                <KText variant="body" tabular color={semanticColors.text.muted}>{formatBalance(amt)}</KText>
              </View>
            ))}
          </View>
        ) : null}
        <Button label="Done" onPress={onClose} fullWidth style={{ marginTop: spacing.md }} />
        <KText variant="caption" color={semanticColors.text.muted} center style={{ marginTop: spacing.sm }}>
          Prices via market data; may be delayed. Share counts are estimates.
        </KText>
      </View>
    </Modal>
  );
}

function GiftCarousel({ gifts, childName }: { gifts: DashboardGift[]; childName: string }) {
  const [idx, setIdx] = useState(0);
  const shown = gifts.slice(0, 5);
  const g = shown[Math.min(idx, shown.length - 1)];
  if (!g) return null;
  const who = g.isAnonymous || !g.senderName ? "Someone" : g.senderName.split(" ")[0];
  return (
    <Pressable
      onPress={() => setIdx((i) => (i + 1) % shown.length)}
      style={{
        marginTop: spacing.md,
        backgroundColor: "rgba(255,255,255,0.10)",
        borderRadius: radius.inner,
        padding: spacing.md,
      }}
    >
      <KText variant="bodyStrong" color="#FFF7E8">
        {who} added {formatBalance(g.netAmount ?? g.amount)} to {childName}'s future
      </KText>
      {g.message ? (
        <KText variant="caption" color="rgba(248,245,240,0.78)" style={{ marginTop: 2 }} numberOfLines={2}>
          “{g.message}”
        </KText>
      ) : g.selectedTicker ? (
        <KText variant="caption" color="rgba(248,245,240,0.7)" style={{ marginTop: 2 }}>
          {g.selectedTicker}
        </KText>
      ) : null}
      {shown.length > 1 ? (
        <View style={{ flexDirection: "row", gap: 5, marginTop: spacing.sm }}>
          {shown.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === idx ? 16 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === idx ? "#F8D889" : "rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function RecurringChip({
  activeCount,
  pausedCount,
  monthly,
  nextDate,
  enabled,
  onPress,
}: {
  activeCount: number;
  pausedCount: number;
  monthly: number;
  nextDate?: string | null;
  enabled: boolean;
  onPress: () => void;
}) {
  let icon: any = "repeat";
  let tint = colors.evergreen;
  let text: string;
  let dashed = false;
  if (activeCount > 0) {
    // Show the NEXT run date (web parity), falling back to the active count.
    const nd = nextDate ? new Date(nextDate) : null;
    const dateLabel =
      nd && !Number.isNaN(nd.getTime())
        ? nd.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : null;
    text = `${formatBalance(monthly)}/mo recurring · ${dateLabel ? `next ${dateLabel}` : `${activeCount} active`}`;
  } else if (pausedCount > 0) {
    icon = "pause-circle-outline";
    tint = colors.gold;
    text = "Recurring paused · tap to manage";
  } else {
    icon = "add-circle-outline";
    text = "Start your own recurring";
    dashed = true;
  }
  return (
    <Pressable
      onPress={() => {
        haptic("selection");
        onPress();
      }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          backgroundColor: semanticColors.surface.card,
          borderRadius: radius.control,
          borderWidth: dashed ? 1.5 : 1,
          borderStyle: dashed ? "dashed" : "solid",
          borderColor: dashed ? tint + "66" : semanticColors.surface.muted,
          paddingVertical: 12,
          paddingHorizontal: spacing.md,
        },
        pressed ? { opacity: 0.7 } : null,
      ]}
    >
      <Ionicons name={icon} size={18} color={tint} />
      <KText variant="label" color={tint} style={{ flex: 1 }}>
        {text}
      </KText>
      <Ionicons name="chevron-forward" size={16} color={semanticColors.text.muted} />
    </Pressable>
  );
}

function SummaryRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 7,
      }}
    >
      <KText variant="body" color={semanticColors.text.muted} style={{ flex: 1, marginRight: spacing.sm }}>
        {label}
      </KText>
      <KText variant="bodyStrong" tabular color={valueColor}>
        {value}
      </KText>
    </View>
  );
}

function Metric({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <KText variant="caption" color={semanticColors.text.muted}>
        {label}
      </KText>
      <KText variant="bodyStrong" tabular color={valueColor}>
        {value}
      </KText>
    </View>
  );
}

// Bare icon action (web parity: an even icon ROW under the hero, not boxed cards).
function QuickLink({
  icon,
  label,
  gold,
  onPress,
}: {
  icon: any;
  label: string;
  gold?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        haptic("selection");
        onPress();
      }}
      style={({ pressed }) => [
        { flex: 1, alignItems: "center", gap: 5, paddingVertical: spacing.sm },
        pressed ? { opacity: 0.6 } : null,
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.evergreen} />
      <KText variant="caption" color={semanticColors.text.primary} numberOfLines={1} center>
        {label}
      </KText>
    </Pressable>
  );
}

// Real stock/ETF logo from the same source the web uses (Parqet), with a clean
// ticker fallback when a logo is missing (ETFs, delisted, network). Mirrors
// client/src/components/ui/stock-logo.tsx.
function StockLogo({ ticker, size = 38 }: { ticker: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const upper = String(ticker || "").trim().toUpperCase() || "STK";
  // Ticker letters sit underneath; the (opaque jpg) logo paints on top when it
  // loads and covers them. So while loading OR on error we show clean letters
  // instead of a blank white box — no network-dependent empty state.
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: colors.evergreen + "12",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <KText variant="label" color={colors.evergreen} style={{ fontSize: upper.length > 3 ? 10 : 12 }}>
        {upper.length > 4 ? upper.slice(0, 4) : upper}
      </KText>
      {!failed ? (
        <Image
          source={{ uri: `https://assets.parqet.com/logos/symbol/${upper}?format=jpg` }}
          style={{ position: "absolute", top: 0, left: 0, width: size, height: size }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}

function HoldingRow({
  holding,
  total,
  onPress,
}: {
  holding: ApiHolding;
  total: number;
  onPress: () => void;
}) {
  const value = num(holding.currentValue);
  const gain = num(holding.gain);
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <Pressable
      onPress={() => {
        haptic("selection");
        onPress();
      }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          backgroundColor: semanticColors.surface.card,
          borderRadius: radius.inner,
          borderWidth: 1,
          borderColor: semanticColors.surface.muted,
          padding: spacing.md,
        },
        pressed ? { opacity: 0.7, transform: [{ scale: 0.99 }] } : null,
      ]}
    >
      <StockLogo ticker={holding.ticker} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <KText variant="bodyStrong" numberOfLines={1}>
          {holding.name || holding.ticker}
        </KText>
        <KText variant="caption" color={semanticColors.text.muted}>
          {num(holding.shares).toFixed(num(holding.shares) < 1 ? 4 : 2)} shares · {pct}% of fund
        </KText>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <KText variant="bodyStrong" tabular>
          {formatBalance(value)}
        </KText>
        {Math.abs(gain) >= 0.01 ? (
          <KText variant="caption" tabular color={gain >= 0 ? "#1A7F47" : "#C0392B"}>
            {gain >= 0 ? "+" : "−"}
            {formatBalance(Math.abs(gain))}
          </KText>
        ) : null}
      </View>
    </Pressable>
  );
}
