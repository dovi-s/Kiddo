// FundDetailScreen — the per-fund deep view (balance, pending/cash, holdings,
// gift history). Rebuilt onto the design-system kit (2026-06-02): brand tokens +
// KiddoCard/KText/Button, off the hand-styled greys. Data loading, StockLogo, and
// status mapping are unchanged.

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, semanticColors, radius, spacing } from "@kora/tokens";
import {
  apiGetFundHoldings,
  apiGetFundGifts,
  formatBalance,
  type ApiFund,
  type ApiHolding,
  type ApiGift,
  WEB_BASE,
} from "../api";
import { KText, KiddoCard, Button, haptic } from "../ui";

function StockLogo({ ticker, size = 44 }: { ticker?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const upper = String(ticker || "STK").trim().toUpperCase() || "STK";
  if (failed) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.gold + "22", alignItems: "center", justifyContent: "center" }}>
        <KText variant="caption" color={colors.goldInk}>{upper.slice(0, 4)}</KText>
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: "#fff", borderWidth: 1, borderColor: semanticColors.surface.muted }}>
      <Image
        source={{ uri: `https://assets.parqet.com/logos/symbol/${upper}?format=jpg` }}
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

interface FundDetailScreenProps {
  fund: ApiFund;
  onBack: () => void;
}

function giftStatusLabel(status: string) {
  switch ((status || "").toLowerCase()) {
    case "invested":
    case "settled": return "Invested";
    case "processing": return "Processing";
    case "pending": return "Pending";
    case "host_hold": return "Waiting";
    case "failed": return "Failed";
    default: return "Received";
  }
}

// Status chip palette — success/danger from the brand tokens; processing keeps a
// calm blue (no brand blue token yet); the rest read as neutral muted.
function giftStatusChip(status: string): { bg: string; fg: string } {
  switch ((status || "").toLowerCase()) {
    case "invested":
    case "settled": return { bg: semanticColors.success.background, fg: semanticColors.success.text };
    case "processing": return { bg: "#DBEAFE", fg: "#1E40AF" };
    case "failed": return { bg: semanticColors.danger.background, fg: semanticColors.danger.text };
    default: return { bg: semanticColors.surface.muted, fg: semanticColors.text.muted };
  }
}

export function FundDetailScreen({ fund, onBack }: FundDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const [holdings, setHoldings] = useState<ApiHolding[]>([]);
  const [gifts, setGifts] = useState<ApiGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [h, g] = await Promise.all([apiGetFundHoldings(fund.id), apiGetFundGifts(fund.id)]);
      setHoldings(h);
      setGifts(g);
    } catch (err: any) {
      setError(err?.message || "Could not load fund details.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fund.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleShare = async () => {
    const childName = fund.recipientFirstName || fund.name;
    const url = `${WEB_BASE}/${fund.slug}`;
    haptic("selection");
    try {
      await Share.share({ message: `Give ${childName} a gift that grows: ${url}`, url });
    } catch {}
  };

  const childName = fund.recipientFirstName || fund.name;
  const balance = parseFloat(String(fund.balance || "0"));
  const gain = parseFloat(String(fund.totalGain || "0"));
  const gainPercent = parseFloat(String(fund.gainPercent || "0"));
  const pending = parseFloat(String(fund.pendingBalance || "0"));
  const cash = parseFloat(String((fund as any).cashBalance || "0"));
  const hasStarted = balance > 0 || pending > 0 || cash > 0 || gifts.length > 0;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Pressable onPress={() => { haptic("selection"); onBack(); }} style={styles.backBtn} accessibilityRole="button">
          <Ionicons name="arrow-back" size={18} color={colors.evergreen} />
          <KText variant="label" color={colors.evergreen}>Back</KText>
        </Pressable>
        <KText variant="heading" center style={styles.headerTitle} numberOfLines={1}>{childName}</KText>
        <Pressable onPress={handleShare} style={styles.shareBtn} accessibilityRole="button">
          <Ionicons name="share-social-outline" size={14} color={colors.goldInk} />
          <KText variant="label" color={colors.goldInk}>Share</KText>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.evergreen} />}
        showsVerticalScrollIndicator={false}
      >
        <KiddoCard variant="hero">
          <KText variant="eyebrow" color="rgba(248,245,240,0.8)">{childName}'s Fund</KText>
          <KText variant="display" color={semanticColors.text.inverse} tabular style={{ marginTop: spacing.xs }}>
            {formatBalance(balance)}
          </KText>
          {gain === 0 ? (
            <KText variant="caption" color="rgba(248,245,240,0.82)" style={{ marginTop: spacing.xs }}>
              {hasStarted ? "Ready for the next gift" : "Every great fund starts here."}
            </KText>
          ) : (
            <KText variant="bodyStrong" color={gain >= 0 ? colors.goldLight : "#FCA5A5"} tabular style={{ marginTop: spacing.xs }}>
              {gain >= 0 ? "+" : ""}{formatBalance(gain)} ({gain >= 0 ? "+" : ""}{gainPercent.toFixed(2)}%)
            </KText>
          )}
          <KText variant="caption" color="rgba(248,245,240,0.65)" style={{ marginTop: spacing.sm }}>
            {fund.contributorCount} gifter{fund.contributorCount !== 1 ? "s" : ""}. Private by gift link.
          </KText>
        </KiddoCard>

        {pending > 0 ? (
          <KiddoCard style={styles.amberCard}>
            <KText variant="eyebrow" color={semanticColors.gift.text}>Pending</KText>
            <KText variant="title" color={semanticColors.gift.text} tabular style={{ marginTop: 2 }}>{formatBalance(fund.pendingBalance)}</KText>
            <KText variant="caption" color={semanticColors.gift.text} style={{ marginTop: 2 }}>Gifts processing. Usually settles in 1-3 days.</KText>
          </KiddoCard>
        ) : null}

        {cash > 0 ? (
          <KiddoCard style={styles.amberCard}>
            <KText variant="eyebrow" color={semanticColors.gift.text}>Waiting to invest</KText>
            <KText variant="title" color={semanticColors.gift.text} tabular style={{ marginTop: 2 }}>{formatBalance(String(cash))}</KText>
            <KText variant="caption" color={semanticColors.gift.text} style={{ marginTop: 2 }}>
              Already in {fund.recipientFirstName || "the fund"}'s account. Investing on the next cycle.
            </KText>
          </KiddoCard>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.evergreen} />
            <KText variant="caption" style={{ marginTop: spacing.sm }}>Loading...</KText>
          </View>
        ) : error ? (
          <KiddoCard>
            <KText variant="caption" color={semanticColors.danger.text} center>{error}</KText>
            <Button label="Retry" onPress={() => loadData()} variant="outline" style={{ marginTop: spacing.sm, alignSelf: "center" }} />
          </KiddoCard>
        ) : (
          <>
            <View style={styles.section}>
              <KText variant="sectionLabel">What {fund.recipientFirstName || "they"} own{fund.recipientFirstName ? "s" : ""}</KText>
              {holdings.length === 0 ? (
                <KiddoCard>
                  <KText variant="bodyStrong" center>Gifts are on their way.</KText>
                  <KText variant="caption" center style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
                    Share the gift link. When the first gift arrives, we'll help you verify so it can be invested.
                  </KText>
                  <Button label="Share gift link" onPress={handleShare} fullWidth />
                </KiddoCard>
              ) : (
                holdings.map((h) => {
                  const g = parseFloat(String(h.gain));
                  return (
                    <KiddoCard key={h.id}>
                      <View style={styles.row}>
                        <StockLogo ticker={h.ticker} size={44} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <KText variant="bodyStrong" numberOfLines={1}>{h.name}</KText>
                          <KText variant="caption" style={{ marginTop: 2 }}>Part of {fund.recipientFirstName || "their"}'s future</KText>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <KText variant="bodyStrong" tabular>{formatBalance(h.currentValue)}</KText>
                          {g !== 0 ? (
                            <KText variant="caption" tabular color={g >= 0 ? semanticColors.success.text : semanticColors.danger.text} style={{ marginTop: 2 }}>
                              {g >= 0 ? "+" : ""}{formatBalance(h.gain)}
                            </KText>
                          ) : null}
                        </View>
                      </View>
                    </KiddoCard>
                  );
                })
              )}
            </View>

            <View style={styles.section}>
              <KText variant="sectionLabel">Every gift has a story</KText>
              {gifts.length === 0 ? (
                <KiddoCard>
                  <KText variant="bodyStrong" center>The first gift is the hardest.</KText>
                  <KText variant="caption" center style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>After that, it's just birthdays.</KText>
                  <Button label="Share gift link" onPress={handleShare} fullWidth />
                </KiddoCard>
              ) : (
                gifts.slice(0, 10).map((g) => {
                  const date = new Date(g.createdAt);
                  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
                  const chip = giftStatusChip(g.status);
                  return (
                    <KiddoCard key={g.id}>
                      <View style={[styles.row, { alignItems: "flex-start" }]}>
                        <View style={styles.giftIcon}>
                          <Ionicons name="gift-outline" size={16} color={colors.evergreen} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <KText variant="bodyStrong">{g.senderName || "A family gift"}</KText>
                          {g.message ? (
                            <KText variant="caption" numberOfLines={2} style={{ marginTop: 2, fontStyle: "italic" }}>"{g.message}"</KText>
                          ) : null}
                          <KText variant="caption" style={{ marginTop: 2 }}>{dateStr}</KText>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          <KText variant="bodyStrong" tabular>{formatBalance(g.amount)}</KText>
                          <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                            <KText variant="eyebrow" color={chip.fg}>{giftStatusLabel(g.status)}</KText>
                          </View>
                        </View>
                      </View>
                    </KiddoCard>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semanticColors.surface.app },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: semanticColors.surface.card,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: semanticColors.surface.muted,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 4 },
  headerTitle: { flex: 1, marginHorizontal: spacing.sm },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.gold, borderRadius: radius.pill },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },
  amberCard: { backgroundColor: semanticColors.gift.background, borderColor: semanticColors.gift.border },
  center: { alignItems: "center", paddingVertical: 32 },
  section: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  giftIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(27,58,45,0.08)", alignItems: "center", justifyContent: "center" },
  chip: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: radius.pill },
});
