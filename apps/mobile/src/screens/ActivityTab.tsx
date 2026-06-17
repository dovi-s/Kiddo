// ActivityTab — the native activity ledger, mirroring the web /activity surface.
//
// The web app has no standalone "Growth" page (growth lives on the dashboard,
// now mirrored on the native Home). It DOES have an activity ledger: the
// chronological record of every transaction on the fund. This tab repurposes
// the old "Growth" slot as that ledger, fed by dashboard-summary.transactions.

import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, semanticColors, radius, spacing } from "@kora/tokens";
import { KText, KiddoCard, Button, Skeleton, Appear } from "../ui";
import { formatBalance, type ApiActivity, type ApiFund, type DashboardSummary } from "../api";

function childNameOf(fund?: ApiFund | null): string {
  return fund?.recipientFirstName || fund?.name || "your child";
}

function fullDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Map a transaction type to an icon, tint, and whether it reduces the balance.
function present(type: string): { icon: any; tint: string; negative: boolean } {
  const t = type.toLowerCase();
  if (t.includes("withdraw") || t.includes("debit")) return { icon: "arrow-up-circle", tint: "#C0392B", negative: true };
  if (t.includes("fee")) return { icon: "remove-circle", tint: "#C0392B", negative: true };
  // Sell — holdings converted to cash WITHIN the fund (a reallocation, not money
  // leaving). Checked explicitly: "sell" matched none of the cases below and
  // fell through to the gift default, so a sale rendered with a gift icon.
  if (t.includes("sell") || t.includes("sold")) return { icon: "swap-horizontal", tint: colors.evergreen, negative: false };
  if (t.includes("invest") || t.includes("buy")) return { icon: "trending-up", tint: colors.evergreen, negative: false };
  if (t.includes("dividend")) return { icon: "cash", tint: colors.evergreen, negative: false };
  if (t.includes("contribution") || t.includes("recurring")) return { icon: "repeat", tint: colors.evergreen, negative: false };
  // default: an incoming gift / deposit
  return { icon: "gift", tint: colors.gold, negative: false };
}

// NOTE (cross-surface consistency): the canonical event labels live in
// shared/activity-semantics.ts (canonicalLabel) and are the single source of
// truth for the WEB surfaces (feed / detail / modal / dashboard). This screen
// can't reuse it yet for two reasons: (1) Metro doesn't resolve the web's
// "@shared/*" tsconfig alias at runtime, and (2) this tab is fed by
// dashboard-summary.transactions, whose `type` is the brokerage vocabulary
// (gift / sell / withdrawal / fee / dividend), NOT the activity vocabulary
// (gift_received / auto_invest / ...). True web↔native unification = repoint
// this tab at /api/activities and import canonicalLabel. Until then, keep the
// strings below matching the canonical wording (e.g. "Recurring investment",
// "Gift received", "Withdrawal", "Dividend").
function labelFor(a: ApiActivity): string {
  // /api/activities already returns a canonical, human title (e.g. "You
  // contributed $100.00", "Gift from Leo Rivera"). Use it directly.
  return (a.title || "").trim() || "Fund update";
}

export interface ActivityTabProps {
  activeFund: ApiFund | null;
  summary: DashboardSummary | null;
  /** Canonical per-fund activity feed (GET /api/activities). null = loading. */
  activities: ApiActivity[] | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onAddFund: () => void;
}

const NON_COUNTING_STATUS = new Set(["pending", "failed", "refunded", "canceled", "cancelled", "host_hold"]);

const ACTIVITY_FILTERS: readonly (readonly ["all" | "gifts" | "yours" | "portfolio", string])[] = [
  ["all", "All"],
  ["gifts", "Gifts"],
  ["yours", "Yours"],
  ["portfolio", "Portfolio"],
];

export function ActivityTab({
  activeFund,
  summary,
  activities,
  loading,
  refreshing,
  onRefresh,
  onAddFund,
}: ActivityTabProps) {
  const childName = childNameOf(activeFund);
  // The feed reads the canonical /api/activities rows (rich titles + status),
  // NOT dashboard-summary.transactions (which is sparse/empty).
  const feed = useMemo(
    () => [...(activities ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [activities],
  );

  // Money summary (web parity): all-time gifts-from-others / you-added /
  // withdrawals / market growth, computed from the same summary payload.
  const money = useMemo(() => {
    const gifts = summary?.gifts ?? [];
    let others = 0;
    let you = 0;
    let giftCount = 0;
    for (const g of gifts) {
      if (NON_COUNTING_STATUS.has(String(g.status || "").toLowerCase())) continue;
      const amt = parseFloat(String(g.netAmount ?? g.amount ?? "0")) || 0;
      if (g.parentContributionId) you += amt;
      else {
        others += amt;
        giftCount += 1;
      }
    }
    let withdrawals = 0;
    for (const tx of summary?.transactions ?? []) {
      if (String(tx.type || "").toLowerCase().includes("withdraw")) {
        withdrawals += Math.abs(parseFloat(String(tx.amount || "0")) || 0);
      }
    }
    const growth = parseFloat(String((activeFund as any)?.totalGain ?? "0")) || 0;
    return { others, you, withdrawals, growth, giftCount };
  }, [summary, activeFund]);

  const [filter, setFilter] = useState<"all" | "gifts" | "yours" | "portfolio">("all");
  const filtered = useMemo(() => {
    if (filter === "all") return feed;
    return feed.filter((a) => {
      const t = (a.type || "").toLowerCase();
      if (filter === "gifts") return t.includes("gift") && !a.isParentContribution;
      if (filter === "yours") return a.isParentContribution || t.includes("contribution");
      if (filter === "portfolio")
        return t.includes("invest") || t.includes("sell") || t.includes("sold") || t.includes("dividend") || t.includes("buy");
      return true;
    });
  }, [feed, filter]);

  // Group the (filtered) feed by month, like the web (JUNE 2026, MAY 2026, ...).
  const grouped = useMemo(() => {
    const groups: { label: string; items: ApiActivity[] }[] = [];
    let cur: { label: string; items: ApiActivity[] } | null = null;
    for (const a of filtered) {
      const d = new Date(a.createdAt);
      const label = Number.isNaN(d.getTime())
        ? "Earlier"
        : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      if (!cur || cur.label !== label) {
        cur = { label, items: [] };
        groups.push(cur);
      }
      cur.items.push(a);
    }
    return groups;
  }, [filtered]);

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.evergreen} />;

  if (!activeFund) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md }} refreshControl={refresh}>
        <View style={{ paddingTop: spacing.xl, gap: spacing.sm }}>
          <KText variant="title">Activity starts with a gift.</KText>
          <KText variant="body" color={semanticColors.text.muted}>
            Create a fund and share the link. Every gift, investment, and milestone shows up here.
          </KText>
          <Button label="Start a fund" onPress={onAddFund} size="lg" style={{ marginTop: spacing.sm }} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={refresh}
    >
      {/* balance header */}
      <Appear delay={0}>
        <KiddoCard>
          <KText variant="sectionLabel" color={semanticColors.text.muted}>{childName}'s fund</KText>
          <KText variant="display" tabular style={{ fontSize: 38, lineHeight: 44, marginTop: 2 }}>
            {formatBalance(activeFund.balance)}
          </KText>
          <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: 2 }}>
            Worth today, held in {childName}'s name.
          </KText>
        </KiddoCard>
      </Appear>

      {/* money summary (web parity) */}
      {summary ? (
        <Appear delay={40}>
          <KiddoCard>
            <KText variant="sectionLabel" color={semanticColors.text.muted}>
              Money summary{money.giftCount > 0 ? ` · ${money.giftCount} gift${money.giftCount === 1 ? "" : "s"}` : ""}
            </KText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: spacing.sm }}>
              <MoneyStat label="Gifts from others" value={formatBalance(money.others)} />
              <MoneyStat label="You added" value={formatBalance(money.you)} />
              <MoneyStat label="Withdrawals" value={formatBalance(money.withdrawals)} />
              <MoneyStat label="Market growth" value={`+${formatBalance(money.growth)}`} positive />
            </View>
          </KiddoCard>
        </Appear>
      ) : null}

      {activities === null ? (
        // null = the feed is still loading (or the fetch failed/timed out). We
        // must NOT claim "Nothing yet" then — show skeletons; pull-to-refresh
        // (and the connectivity banner) recover a failed load.
        <>
          <KText variant="sectionLabel" color={semanticColors.text.muted}>All activity</KText>
          <Skeleton height={64} rounded={radius.card} />
          <Skeleton height={64} rounded={radius.card} />
          <Skeleton height={64} rounded={radius.card} />
        </>
      ) : feed.length === 0 ? (
        <>
          <KText variant="sectionLabel" color={semanticColors.text.muted}>All activity</KText>
          <KiddoCard>
            <KText variant="bodyStrong">Nothing yet.</KText>
            <KText variant="caption" style={{ marginTop: spacing.xs }}>
              Share {childName}'s link and the first gift will appear here, followed by every investment and
              milestone along the way.
            </KText>
          </KiddoCard>
        </>
      ) : (
        <>
          {/* filter pills (web parity: All / Gifts / Yours / Portfolio) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -2 }}
            contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: 2, paddingVertical: 2 }}
          >
            {ACTIVITY_FILTERS.map(([key, label]) => {
              const active = filter === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setFilter(key)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: active ? colors.evergreen : "transparent",
                    borderWidth: active ? 0 : 1.5,
                    borderColor: "#E5DDD4",
                  }}
                >
                  <KText variant="caption" color={active ? "#F8F5F0" : semanticColors.text.muted}>
                    {label}
                  </KText>
                </Pressable>
              );
            })}
          </ScrollView>

          {grouped.length === 0 ? (
            <KiddoCard>
              <KText variant="caption" color={semanticColors.text.muted}>
                No {filter} activity yet.
              </KText>
            </KiddoCard>
          ) : (
            <View style={{ gap: spacing.md }}>
              {grouped.map((g) => (
                <View key={g.label} style={{ gap: spacing.sm }}>
                  <KText variant="caption" color={semanticColors.text.muted}>
                    {g.label.toUpperCase()}
                  </KText>
                  {g.items.map((a) => (
                    <ActRow key={a.id} a={a} />
                  ))}
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function MoneyStat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <View style={{ width: "50%", paddingVertical: 6, paddingRight: spacing.sm }}>
      <KText variant="caption" color={semanticColors.text.muted}>
        {label}
      </KText>
      <KText
        variant="bodyStrong"
        tabular
        color={positive ? "#1A7F47" : semanticColors.text.primary}
        style={{ marginTop: 1 }}
      >
        {value}
      </KText>
    </View>
  );
}

// Small status chip ("Invested" / "Pending"), mirroring the web feed rows.
function statusChip(status?: string | null): { label: string; bg: string; fg: string } | null {
  const s = String(status || "").toLowerCase();
  if (s === "settled" || s === "invested") return { label: "Invested", bg: "#E7F0E9", fg: "#1A7F47" };
  if (s === "pending" || s === "processing" || s === "host_hold") return { label: "Pending", bg: "#FBEFD6", fg: "#6F4611" };
  return null;
}

function ActRow({ a }: { a: ApiActivity }) {
  const p = present(a.type);
  const amt = Math.abs(parseFloat(String(a.amount || "0")));
  const desc = (a.description || "").trim();
  const chip = statusChip(a.status);
  return (
    <KiddoCard>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: p.tint + "18",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={p.icon} size={18} color={p.tint} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <KText variant="bodyStrong" numberOfLines={1}>
            {labelFor(a)}
          </KText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 }}>
            {chip ? (
              <View style={{ backgroundColor: chip.bg, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1 }}>
                <KText variant="caption" color={chip.fg}>
                  {chip.label}
                </KText>
              </View>
            ) : null}
            <KText variant="caption" color={semanticColors.text.muted} numberOfLines={1} style={{ flex: 1 }}>
              {desc ? `${desc} · ` : ""}
              {fullDate(a.createdAt)}
            </KText>
          </View>
        </View>
        {amt > 0 ? (
          <KText variant="bodyStrong" tabular color={p.negative ? "#C0392B" : "#1A7F47"}>
            {p.negative ? "−" : "+"}
            {formatBalance(amt)}
          </KText>
        ) : null}
      </View>
    </KiddoCard>
  );
}
