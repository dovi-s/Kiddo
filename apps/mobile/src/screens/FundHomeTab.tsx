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
  ActivityIndicator,
  Animated,
  Dimensions,
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
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from "react-native-svg";
import { colors, semanticColors, radius, spacing } from "@kora/tokens";
import { KText, KiddoCard, Button, Skeleton, haptic } from "../ui";
import { projectFundValue, ageFromBirthdate } from "../lib/projection";
import { looksLikeTestSender } from "../lib/gifters";
import {
  formatBalance,
  WEB_BASE,
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

/** The calendar date the recipient turns 18, e.g. "Nov 1, 2033". */
function eighteenthDateLabel(birthdate?: string | null): string | null {
  const birth = parseBirthdate(birthdate);
  if (!birth) return null;
  const d = new Date(birth);
  d.setFullYear(d.getFullYear() + 18);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** Whole days until the recipient turns 18 (null if past or unknown). */
function daysUntil18(birthdate?: string | null): number | null {
  const birth = parseBirthdate(birthdate);
  if (!birth) return null;
  const eighteen = new Date(birth);
  eighteen.setFullYear(eighteen.getFullYear() + 18);
  const days = Math.ceil((eighteen.getTime() - Date.now()) / 86_400_000);
  return days > 0 ? days : null;
}

/** "in 3 years" / "in 8 months" until the recipient turns 18. */
function countdownTo18(birthdate?: string | null): string | null {
  const birth = parseBirthdate(birthdate);
  if (!birth) return null;
  const eighteen = new Date(birth);
  eighteen.setFullYear(eighteen.getFullYear() + 18);
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

function CountUp({
  value,
  color,
  prefix = "$",
}: {
  value: number;
  color: string;
  prefix?: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(value);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (Platform.OS === "web") {
      // Animated listeners + native driver are flaky on rn-web; just set.
      setShown(value);
      return;
    }
    anim.setValue(0);
    const id = anim.addListener(({ value: t }) => setShown(from + (value - from) * t));
    Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [value]);

  const formatted = `${prefix}${Math.round(shown).toLocaleString("en-US")}${
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
  } = props;

  const childName = childNameOf(activeFund);
  const isReadOnly =
    (activeFund as any)?.accessRole === "previous_owner" && Boolean((activeFund as any)?.transferredAt);
  const isOwnerMode = Boolean((activeFund as any)?.transferredAt) && (activeFund as any)?.accessRole === "owner";
  // Tapping a holding opens a detail sheet (cost basis, % of fund, who picked it) —
  // the web's per-holding depth surface, instead of navigating away.
  const [selectedHolding, setSelectedHolding] = useState<ApiHolding | null>(null);
  const [projectionOpen, setProjectionOpen] = useState(false);
  const [age18Open, setAge18Open] = useState(false);
  const [kidViewOpen, setKidViewOpen] = useState(false);

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
      if (!name || g.isAnonymous) {
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
  const countdown = countdownTo18(activeFund?.recipientBirthdate);
  const eighteenthDate = eighteenthDateLabel(activeFund?.recipientBirthdate);
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
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={refresh}
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

      {/* ── approaching-handoff banner (within 90 days of turning 18) ──────── */}
      {(() => {
        const days = daysUntil18(activeFund?.recipientBirthdate);
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
                {childName} turns 18 on {eighteenthDateLabel(activeFund?.recipientBirthdate)}. Here's what changes.
              </KText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={semanticColors.text.muted} />
          </Pressable>
        );
      })()}

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <KiddoCard variant="hero">
        {/* identity row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <KText variant="eyebrow" color="rgba(248,245,240,0.72)">
            {childName}'s Fund · {String(activeFund.accountType || "UTMA").toUpperCase()}
          </KText>
          {d.peopleCount > 0 ? (
            <View
              style={{
                backgroundColor: "rgba(197,130,30,0.22)",
                borderRadius: radius.pill,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <KText variant="caption" color="#F8D889">
                {d.gifts.length} {d.gifts.length === 1 ? "gift" : "gifts"} · {d.peopleCount}{" "}
                {d.peopleCount === 1 ? "person" : "people"}
              </KText>
            </View>
          ) : null}
        </View>

        {/* balance — always from the fund row (loaded before the summary), so it
            shows instantly instead of skeletoning while the summary streams in. */}
        <View style={{ marginTop: spacing.sm }}>
          <CountUp value={d.totalValue} color={semanticColors.text.inverse} />
        </View>

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
            {childName} turns 18 in {countdown}
          </KText>
        ) : null}

        {/* recent-gift carousel */}
        {d.recent.length > 0 ? (
          <GiftCarousel gifts={d.recent} childName={childName} />
        ) : null}

        {/* hero CTAs — Share + a projection peek (mirrors the web hero; the old
            "Open fund" sent users to an obsolete, thinner detail screen — Home IS
            the fund view now). */}
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
          {!isReadOnly ? (
            <Button label="Share" onPress={handleShare} variant="monetization" style={{ flex: 1 }} />
          ) : null}
          {hasStarted ? (
            <Button
              label="See its future"
              onPress={() => setProjectionOpen(true)}
              variant="outline"
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
      </KiddoCard>

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
        <RecurringChip
          activeCount={d.activeRecurring.length}
          pausedCount={d.pausedRecurring.length}
          monthly={d.monthlyRecurring}
          enabled={d.recurringEnabled}
          onPress={() => onSelectFund(activeFund)}
        />
      ) : null}

      {/* ── 30-day / fund-so-far summary ───────────────────────────────────── */}
      {hasStarted ? (
        <View>
          <SectionLabel>{isOwnerMode ? "Your fund so far" : `${childName}'s fund so far`} 🌱</SectionLabel>
          <KiddoCard>
            {!summaryReady ? (
              summaryPending ? (
                <View style={{ gap: 12, paddingVertical: 4 }}>
                  <Skeleton height={16} width="80%" />
                  <Skeleton height={16} width="60%" />
                </View>
              ) : null
            ) : (
              <>
                <SummaryRow
                  label={isOwnerMode ? "Gifts from people who love you" : `Gifts from people who love ${childName}`}
                  value={formatBalance(d.giftsTotal)}
                />
                {d.activeRecurring.length > 0 ? (
                  <SummaryRow
                    label="Your recurring investments"
                    value={`${formatBalance(d.monthlyRecurring)}/mo`}
                  />
                ) : null}
                {Math.abs(d.growth) >= 1 ? (
                  <SummaryRow
                    label={d.growth >= 0 ? "Market growth" : "Market change"}
                    value={`${d.growth >= 0 ? "+" : "−"}${formatBalance(Math.abs(d.growth))}`}
                    valueColor={d.growth >= 0 ? "#1A7F47" : "#C0392B"}
                  />
                ) : null}
              </>
            )}
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
          </KiddoCard>
        </View>
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

      {/* ── quick links ────────────────────────────────────────────────────── */}
      <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
        {!isReadOnly ? (
          <QuickLink icon="share-social" label="Share link" gold onPress={handleShare} />
        ) : null}
        <QuickLink icon="eye-outline" label="Gifter page" onPress={openGifterPage} />
        {!isOwnerMode ? (
          <QuickLink icon="happy-outline" label={`${childName}'s view`} onPress={() => setKidViewOpen(true)} />
        ) : null}
        {!isReadOnly ? (
          <QuickLink
            icon={activeEvent ? "calendar" : "add-circle-outline"}
            label={activeEvent ? activeEvent.name : "New occasion"}
            onPress={onCreateEvent}
          />
        ) : null}
      </View>

      {/* ── growth chart (only with real summary data; skeleton while pending) ── */}
      {hasStarted && summaryReady ? (
        <View>
          <SectionLabel>{isOwnerMode ? "Your growth" : `${childName}'s growth`}</SectionLabel>
          <KiddoCard>
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
              <Metric
                label="Have gifted"
                value={`${d.peopleCount} ${d.peopleCount === 1 ? "person" : "people"}`}
              />
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
          </KiddoCard>
        </View>
      ) : hasStarted && summaryPending ? (
        <View>
          <SectionLabel>{isOwnerMode ? "Your growth" : `${childName}'s growth`}</SectionLabel>
          <Skeleton height={130} rounded={radius.card} />
        </View>
      ) : null}

      {/* ── holdings ───────────────────────────────────────────────────────── */}
      {summary && (d.chosen.length > 0 || d.managed.length > 0) ? (
        <View>
          <SectionLabel>{isOwnerMode ? "What you own" : `What ${childName} owns`}</SectionLabel>
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
        </View>
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
            {childName} gets full control at 18. Until then, every gift and note you add is part of the story
            that's waiting for them.
          </KText>
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
          childName={childName}
          isOwnerMode={isOwnerMode}
          onClose={() => setProjectionOpen(false)}
        />
      ) : null}

      {age18Open && activeFund ? (
        <Age18PlanSheet
          childName={childName}
          birthdate={activeFund.recipientBirthdate}
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
            <Pressable onPress={onClose} hitSlop={10}>
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
  startingValue,
  monthly,
  onClose,
}: {
  childName: string;
  birthdate?: string | null;
  startingValue: number;
  monthly: number;
  onClose: () => void;
}) {
  const date = eighteenthDateLabel(birthdate);
  const days = daysUntil18(birthdate);
  const currentAge = ageFromBirthdate(birthdate) ?? 5;
  const projectedAt18 = projectFundValue({
    startingValue,
    monthlyContribution: monthly,
    yearsAhead: Math.max(0, 18 - currentAge),
    contributionYears: Math.max(0, 18 - currentAge),
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
          {childName} turns 18{date ? ` on ${date}` : ""}.
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
              at 18, at a 7% average annual return after our 0.10% fee. A projection, not a promise.
            </KText>
          </KiddoCard>
        ) : null}

        {/* what changes */}
        <KText variant="sectionLabel" color={semanticColors.text.muted} style={{ marginTop: spacing.lg, marginBottom: spacing.xs }}>
          What changes at 18
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
          <KText variant="bodyStrong">The money conversation doesn't start at 18.</KText>
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
  childName,
  isOwnerMode,
  onClose,
}: {
  startingValue: number;
  monthly: number;
  birthdate?: string | null;
  childName: string;
  isOwnerMode: boolean;
  onClose: () => void;
}) {
  const currentAge = ageFromBirthdate(birthdate) ?? 5;
  const contributionYears = Math.max(0, 18 - currentAge); // UTMA window (default majority 18)
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
  enabled,
  onPress,
}: {
  activeCount: number;
  pausedCount: number;
  monthly: number;
  enabled: boolean;
  onPress: () => void;
}) {
  let icon: any = "repeat";
  let tint = colors.evergreen;
  let text: string;
  let dashed = false;
  if (activeCount > 0) {
    text = `${formatBalance(monthly)}/mo recurring · ${activeCount} active`;
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
      onPress={onPress}
      style={{
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
      }}
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
      onPress={onPress}
      style={{
        flexGrow: 1,
        flexBasis: "30%",
        alignItems: "center",
        gap: 6,
        paddingVertical: spacing.md,
        borderRadius: radius.inner,
        backgroundColor: gold ? colors.gold : semanticColors.surface.card,
        borderWidth: gold ? 0 : 1,
        borderColor: semanticColors.surface.muted,
      }}
    >
      <Ionicons name={icon} size={20} color={gold ? "#38290A" : colors.evergreen} />
      <KText variant="caption" color={gold ? "#38290A" : semanticColors.text.primary} numberOfLines={1} center>
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
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: semanticColors.surface.card,
        borderRadius: radius.inner,
        borderWidth: 1,
        borderColor: semanticColors.surface.muted,
        padding: spacing.md,
      }}
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
