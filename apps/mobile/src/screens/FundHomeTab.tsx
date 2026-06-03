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
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, semanticColors, radius, spacing } from "@kora/tokens";
import { KText, KiddoCard, Button, Skeleton, haptic } from "../ui";
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

/** The calendar date the recipient turns 18, e.g. "Nov 1, 2033". */
function eighteenthDateLabel(birthdate?: string | null): string | null {
  if (!birthdate) return null;
  const birth = new Date(`${birthdate}T12:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const d = new Date(birth);
  d.setFullYear(d.getFullYear() + 18);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** "in 3 years" / "in 8 months" until the recipient turns 18. */
function countdownTo18(birthdate?: string | null): string | null {
  if (!birthdate) return null;
  const birth = new Date(`${birthdate}T12:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) return null;
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
// A clean column sparkline built from Views — honest, brand-colored, and
// dependency-free. Renders the fund's total-value history; flat/empty history
// renders a calm baseline so the card never looks broken.

function Sparkline({ points, tint }: { points: number[]; tint: string }) {
  const data = points.length >= 2 ? points : [0, 0];
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = Math.max(max - min, 1);
  // cap bars so a long history stays legible
  const step = Math.max(1, Math.ceil(data.length / 40));
  const bars = data.filter((_, i) => i % step === 0);
  return (
    <View style={{ height: 84, flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
      {bars.map((v, i) => {
        const pct = (v - min) / span;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: Math.max(3, pct * 84),
              backgroundColor: i === bars.length - 1 ? colors.gold : tint,
              opacity: i === bars.length - 1 ? 1 : 0.28 + pct * 0.5,
              borderRadius: 2,
            }}
          />
        );
      })}
    </View>
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

    const gifts: DashboardGift[] = (summary?.gifts ?? []).filter(
      (g) => !NON_COUNTING.has(String(g.status || "").toLowerCase()),
    );
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

    // holdings split: "chosen" = tickers that came from a gifter pick; rest = managed mix
    const holdings: ApiHolding[] = summary?.holdings ?? [];
    const chosenTickers = new Set(
      (summary?.giftAllocations ?? [])
        .filter((a) => String(a.source || "").toLowerCase() === "pick")
        .map((a) => a.ticker.toUpperCase()),
    );
    const chosen = holdings.filter((h) => chosenTickers.has(h.ticker.toUpperCase()));
    const managed = holdings.filter((h) => !chosenTickers.has(h.ticker.toUpperCase()));
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
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={refresh}
    >
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

        {/* balance */}
        <View style={{ marginTop: spacing.sm }}>
          {summaryLoading && !summary ? (
            <Skeleton height={50} width={200} rounded={12} />
          ) : (
            <CountUp value={d.totalValue} color={semanticColors.text.inverse} />
          )}
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

        {/* hero CTAs */}
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
          {!isReadOnly ? (
            <Button label="Share" onPress={handleShare} variant="monetization" style={{ flex: 1 }} />
          ) : null}
          <Button
            label="Open fund"
            onPress={() => onSelectFund(activeFund)}
            variant="outline"
            style={{ flex: 1 }}
          />
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

      {/* ── cash waiting ───────────────────────────────────────────────────── */}
      {d.cash > 0 && !isReadOnly ? (
        <KiddoCard onPress={() => onSelectFund(activeFund)}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <KText variant="eyebrow" color={colors.goldInk}>Cash is waiting</KText>
              <KText variant="title" tabular style={{ marginTop: 2 }}>
                {formatBalance(d.cash)}
              </KText>
              <KText variant="caption" style={{ marginTop: 2 }}>
                Invests automatically on the next cycle, usually 1 to 2 business days.
              </KText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={semanticColors.text.muted} />
          </View>
        </KiddoCard>
      ) : null}

      {/* ── quick links ────────────────────────────────────────────────────── */}
      <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
        {!isReadOnly ? (
          <QuickLink icon="share-social" label="Share link" gold onPress={handleShare} />
        ) : null}
        <QuickLink icon="eye-outline" label="Gifter page" onPress={openGifterPage} />
        {!isReadOnly ? (
          <QuickLink
            icon={activeEvent ? "calendar" : "add-circle-outline"}
            label={activeEvent ? activeEvent.name : "New occasion"}
            onPress={onCreateEvent}
          />
        ) : null}
      </View>

      {/* ── growth chart ───────────────────────────────────────────────────── */}
      {hasStarted ? (
        <View>
          <SectionLabel>{isOwnerMode ? "Your growth" : `${childName}'s growth`}</SectionLabel>
          <KiddoCard>
            <Sparkline points={d.history} tint={colors.evergreen} />
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
          </KiddoCard>
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
                  <HoldingRow key={h.id} holding={h} total={d.holdingsTotal} onPress={() => onSelectFund(activeFund)} />
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
                  <HoldingRow key={h.id} holding={h} total={d.holdingsTotal} onPress={() => onSelectFund(activeFund)} />
                ))}
              </>
            ) : null}
          </View>
        </View>
      ) : hasStarted && summaryLoading ? (
        <Skeleton height={120} rounded={radius.card} />
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
        <KiddoCard variant="hero">
          <KText variant="eyebrow" color="#F8D889">The day it all becomes {childName}'s</KText>
          <KText variant="title" color="#FFF7E8" style={{ marginTop: 4 }}>
            {eighteenthDate}
          </KText>
          <KText variant="body" color="rgba(255,247,232,0.82)" style={{ marginTop: spacing.xs }}>
            {childName} gets full control at 18. Until then, every gift and note you add is part of the story
            that's waiting for them.
          </KText>
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
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

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
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: colors.evergreen + "12",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <KText variant="label" color={colors.evergreen}>
          {holding.ticker.slice(0, 2).toUpperCase()}
        </KText>
      </View>
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
