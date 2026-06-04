// GiftTab — the native share / gifter-link surface, mirroring the web gifting
// surface (gift link + share + occasions + recent gifts + the loop nudge).
// Rebuilt on the brand kit; the trust copy stays entity-agnostic + conditional
// per the locked custody-copy rule ("when investing is live ... our broker-dealer
// partner, Member FINRA/SIPC").

import React from "react";
import { Linking, RefreshControl, ScrollView, Share, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, semanticColors, radius, spacing } from "@kora/tokens";
import { KText, KiddoCard, Button, haptic } from "../ui";
import { formatBalance, WEB_BASE, type ApiFund, type ApiEvent, type DashboardGift } from "../api";
import { looksLikeTestSender } from "../lib/gifters";
import { isReadOnlyFund } from "../lib/fund";
import { Appear } from "../ui";

function childNameOf(fund?: ApiFund | null): string {
  return fund?.recipientFirstName || fund?.name || "your child";
}

function shortDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const NON_COUNTING = new Set(["pending", "failed", "refunded", "canceled", "cancelled", "host_hold"]);

export interface GiftTabProps {
  activeFund: ApiFund | null;
  gifts: DashboardGift[];
  events: ApiEvent[];
  refreshing: boolean;
  onRefresh: () => void;
  onAddFund: () => void;
  onCreateEvent: () => void;
}

export function GiftTab({
  activeFund,
  gifts,
  events,
  refreshing,
  onRefresh,
  onAddFund,
  onCreateEvent,
}: GiftTabProps) {
  const childName = childNameOf(activeFund);
  const giftUrl = activeFund ? `${WEB_BASE}/${activeFund.slug}` : "";
  const isReadOnly = isReadOnlyFund(activeFund);

  const recent = gifts
    .filter((g) => !NON_COUNTING.has(String(g.status || "").toLowerCase()))
    .filter((g) => !looksLikeTestSender(g.senderName, g.senderEmail))
    .slice(0, 4);
  const activeEvents = events.filter(
    (e) => e.status === "active" && !e.isPermanent && (!activeFund || String(e.fundId) === String(activeFund.id)),
  );

  const handleShare = async () => {
    if (!activeFund) return;
    haptic("selection");
    try {
      await Share.share({ message: `Give ${childName} a gift that grows: ${giftUrl}`, url: giftUrl });
    } catch {
      /* dismissed */
    }
  };

  const openGifterPage = () => {
    if (!giftUrl) return;
    haptic("selection");
    Linking.openURL(giftUrl).catch(() => {});
  };

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.evergreen} />;

  if (!activeFund) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md }} refreshControl={refresh}>
        <View style={{ paddingTop: spacing.xl, gap: spacing.sm }}>
          <KText variant="title">Create the fund first.</KText>
          <KText variant="body" color={semanticColors.text.muted}>
            Then Kiddo gives you one link people can use to give in under a minute.
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
      {/* hero */}
      <Appear delay={0}>
      <KiddoCard variant="hero">
        <KText variant="eyebrow" color="#F8D889">Gift link</KText>
        <KText variant="title" color="#FFF7E8" style={{ marginTop: 4 }}>
          Share {childName}'s gift link.
        </KText>
        <KText variant="body" color="rgba(255,247,232,0.82)" style={{ marginTop: spacing.xs }}>
          No account needed. Takes about a minute. Every gift can become part of the Memory Book.
        </KText>

        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.10)",
            borderRadius: radius.inner,
            paddingHorizontal: spacing.md,
            paddingVertical: 13,
            marginTop: spacing.md,
          }}
        >
          <KText variant="label" color="#FFF7E8" numberOfLines={1}>
            {giftUrl.replace(/^https?:\/\//, "")}
          </KText>
        </View>

        {!isReadOnly ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            <Button label="Share gift link" onPress={handleShare} variant="monetization" fullWidth />
            <Button label="Preview gifter page" onPress={openGifterPage} variant="outline" fullWidth />
          </View>
        ) : (
          <KText variant="body" color="rgba(255,247,232,0.82)" style={{ marginTop: spacing.md }}>
            This fund was transferred to {childName}. They manage gifting from here.
          </KText>
        )}
      </KiddoCard>
      </Appear>

      {/* occasions */}
      {!isReadOnly ? (
        <View>
          <KText variant="sectionLabel" color={semanticColors.text.muted} style={{ marginBottom: spacing.xs }}>
            Occasions
          </KText>
          <View style={{ gap: spacing.sm }}>
            {activeEvents.map((e) => (
              <KiddoCard key={e.id} onPress={openGifterPage}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <KText variant="bodyStrong" numberOfLines={1}>{e.name}</KText>
                    <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: 2 }}>
                      {e.giftCount} {e.giftCount === 1 ? "gift" : "gifts"} · {formatBalance(e.totalRaised || "0")} raised
                      {e.eventDate ? ` · ${shortDate(e.eventDate)}` : ""}
                    </KText>
                  </View>
                  <View
                    style={{
                      backgroundColor: colors.evergreen + "18",
                      borderRadius: radius.pill,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                    }}
                  >
                    <KText variant="caption" color={colors.evergreen}>Live</KText>
                  </View>
                </View>
              </KiddoCard>
            ))}
            <Button
              label="Create an occasion"
              onPress={onCreateEvent}
              variant={activeEvents.length === 0 ? "primary" : "ghost"}
            />
          </View>
        </View>
      ) : null}

      {/* recent gifts */}
      <View>
        <KText variant="sectionLabel" color={semanticColors.text.muted} style={{ marginBottom: spacing.xs }}>
          Recent gifts
        </KText>
        {recent.length === 0 ? (
          <KiddoCard>
            <KText variant="bodyStrong">The first gift is the hardest.</KText>
            <KText variant="caption" style={{ marginTop: spacing.xs }}>
              Share {childName}'s gift link to start receiving investments. After that, it's just birthdays.
            </KText>
          </KiddoCard>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {recent.map((g) => (
              <KiddoCard key={g.id}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <KText variant="bodyStrong">
                      {formatBalance(g.netAmount ?? g.amount)} from {g.senderName || "someone who loves them"}
                    </KText>
                    <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: 2 }} numberOfLines={2}>
                      {g.message ? `“${g.message}”` : `Invested in ${childName}'s future with Kiddo.`}
                    </KText>
                  </View>
                  <KText variant="caption" color={semanticColors.text.muted}>{shortDate(g.createdAt) || ""}</KText>
                </View>
              </KiddoCard>
            ))}
          </View>
        )}
      </View>

      {/* trust strip — entity-agnostic + conditional per locked custody-copy rule */}
      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", paddingHorizontal: spacing.xs }}>
        <Ionicons name="shield-checkmark-outline" size={16} color={semanticColors.text.muted} style={{ marginTop: 1 }} />
        <KText variant="caption" color={semanticColors.text.muted} style={{ flex: 1 }}>
          When investing is live, money will be held through our broker-dealer partner (Member FINRA/SIPC). SIPC
          protects against brokerage failure, not market losses.
        </KText>
      </View>

      {!isReadOnly ? (
        <KText variant="caption" center color={colors.goldInk}>
          The more you share, the more it grows.
        </KText>
      ) : null}
    </ScrollView>
  );
}
