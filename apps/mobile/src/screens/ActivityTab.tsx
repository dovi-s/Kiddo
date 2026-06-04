// ActivityTab — the native activity ledger, mirroring the web /activity surface.
//
// The web app has no standalone "Growth" page (growth lives on the dashboard,
// now mirrored on the native Home). It DOES have an activity ledger: the
// chronological record of every transaction on the fund. This tab repurposes
// the old "Growth" slot as that ledger, fed by dashboard-summary.transactions.

import React, { useMemo } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, semanticColors, radius, spacing } from "@kora/tokens";
import { KText, KiddoCard, Button, Skeleton, Appear } from "../ui";
import { formatBalance, type ApiFund, type DashboardSummary, type DashboardTransaction } from "../api";

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
function labelFor(tx: DashboardTransaction): string {
  const t = tx.type.toLowerCase();
  const desc = (tx.description || "").trim();
  const descL = desc.toLowerCase();
  // Gifts: the stored description is a raw internal label ("gift payment") — show
  // the canonical "Gift received" instead of leaking it verbatim.
  if (t.includes("gift") || descL === "gift payment" || descL === "gift") return "Gift received";
  // Otherwise prefer a human description (e.g. "Moved 0.5 shares of CMCSA to cash").
  if (desc) return desc;
  if (t.includes("withdraw")) return "Withdrawal";
  if (t.includes("fee")) return "Platform fee";
  if (t.includes("sell") || t.includes("sold")) return "Sold";
  if (t.includes("invest")) return "Invested";
  if (t.includes("dividend")) return "Dividend";
  if (t.includes("contribution")) return "Recurring investment";
  if (t.includes("gift")) return "Gift received";
  // Title-case the raw type as a last resort.
  return tx.type.charAt(0).toUpperCase() + tx.type.slice(1).replace(/_/g, " ");
}

export interface ActivityTabProps {
  activeFund: ApiFund | null;
  summary: DashboardSummary | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onAddFund: () => void;
}

export function ActivityTab({ activeFund, summary, loading, refreshing, onRefresh, onAddFund }: ActivityTabProps) {
  const childName = childNameOf(activeFund);
  const txns = useMemo(
    () =>
      [...(summary?.transactions ?? [])].sort(
        (a, b) =>
          new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime(),
      ),
    [summary],
  );

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

      <KText variant="sectionLabel" color={semanticColors.text.muted}>All activity</KText>

      {loading && !summary ? (
        <>
          <Skeleton height={64} rounded={radius.card} />
          <Skeleton height={64} rounded={radius.card} />
          <Skeleton height={64} rounded={radius.card} />
        </>
      ) : txns.length === 0 ? (
        <KiddoCard>
          <KText variant="bodyStrong">Nothing yet.</KText>
          <KText variant="caption" style={{ marginTop: spacing.xs }}>
            Share {childName}'s link and the first gift will appear here, followed by every investment and
            milestone along the way.
          </KText>
        </KiddoCard>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {txns.map((tx) => {
            const p = present(tx.type);
            const amt = Math.abs(parseFloat(String(tx.amount || "0")));
            return (
              <KiddoCard key={tx.id}>
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
                    <KText variant="bodyStrong" numberOfLines={1}>{labelFor(tx)}</KText>
                    <KText variant="caption" color={semanticColors.text.muted}>
                      {fullDate(tx.completedAt || tx.createdAt)}
                    </KText>
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
          })}
        </View>
      )}
    </ScrollView>
  );
}
